import { bad, readJson } from "@/lib/server/http";
import { resultFromRequest, type ResultRequest } from "@/lib/server/attempt";
import { buildReportPdf } from "@/lib/server/pdf";
import type { StudyPlan } from "@/lib/study-plan";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await readJson<{ request: ResultRequest; name?: string; plan?: StudyPlan | null }>(req);
  const result = body && (await resultFromRequest(body.request));
  if (!body || !result) return bad("Invalid attempt");
  const bytes = await buildReportPdf(result, { name: body.name ?? null, plan: body.plan ?? null });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="claude-${result.track}-readiness-report.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
