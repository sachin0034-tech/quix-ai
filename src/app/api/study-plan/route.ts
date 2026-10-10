import { NextResponse } from "next/server";
import OpenAI from "openai";
import { bad, readJson } from "@/lib/server/http";
import { resultFromRequest, type ResultRequest } from "@/lib/server/attempt";
import { getBlueprint } from "@/lib/bank";
import { buildStudyPlan, type StudyPlan } from "@/lib/study-plan";

interface Body {
  request: ResultRequest;
  examDate?: string | null;
  readyStreak?: boolean;
}

export const maxDuration = 30;

/**
 * Personal study plan. The structure (days, drills, docs, retest) is built deterministically from the
 * domain scores; when OPENAI_API_KEY is set the model only adds a short summary and a focus line per
 * day, and its output is discarded if it does not match the template.
 */
export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  const result = body && (await resultFromRequest(body.request));
  if (!body || !result) return bad("Invalid attempt");

  const plan = buildStudyPlan({ result, domains: (await getBlueprint())[result.track], examDate: body.examDate, readyStreak: body.readyStreak });
  return NextResponse.json({ plan: await polish(plan, result.readiness) });
}

async function polish(plan: StudyPlan, readiness: number | null): Promise<StudyPlan> {
  if (!process.env.OPENAI_API_KEY) return plan;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 12_000 });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write short, honest, encouraging study-plan wording for a Claude certification practice site. The readiness number is an ESTIMATE, never a promise; never say pass is guaranteed. Reply with JSON: {\"summary\": string (2-3 sentences), \"dayFocus\": string[] (one short sentence per day, same length as the days array)}.",
        },
        {
          role: "user",
          content: JSON.stringify({
            readiness,
            tight: plan.tight,
            looksReady: plan.looksReady,
            baseSummary: plan.summary,
            days: plan.days.map((d) => ({ day: d.day, title: d.title })),
          }),
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.dayFocus) || parsed.dayFocus.length !== plan.days.length) return plan;
    return {
      ...plan,
      summary: parsed.summary.slice(0, 600),
      days: plan.days.map((d, i) => ({ ...d, focus: typeof parsed.dayFocus[i] === "string" ? parsed.dayFocus[i].slice(0, 200) : undefined })),
    };
  } catch (err) {
    console.warn("[study-plan] model polish failed, using template plan:", err instanceof Error ? err.message : err);
    return plan;
  }
}
