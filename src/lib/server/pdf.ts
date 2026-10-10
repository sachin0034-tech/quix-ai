import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ResultSummary } from "@/types/quiz";
import type { StudyPlan } from "@/lib/study-plan";
import { DISCLAIMER } from "@/lib/config";
import { TRACKS } from "@/lib/blueprint";

const NAVY = rgb(0.027, 0.106, 0.224);
const MUTED = rgb(0.35, 0.4, 0.5);
const RED = rgb(0.86, 0.15, 0.15);
const GREEN = rgb(0.09, 0.64, 0.29);
const RULE = rgb(0.88, 0.9, 0.94);

const W = 595.28;
const H = 841.89;
const M = 48;

/** Helvetica can only encode WinAnsi, so anything else is replaced rather than crashing the render. */
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?").replace(/\s+/g, " ");

export interface PdfOptions {
  name?: string | null;
  plan?: StudyPlan | null;
  reportUrl?: string | null;
}

export async function buildReportPdf(result: ResultSummary, opts: PdfOptions = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  try {
    logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "agentic-ai-logo-cropped.png")));
  } catch {
    /* the report still renders without the logo */
  }

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const need = (h: number) => {
    if (y - h < M + 24) newPage();
  };
  const wrap = (text: string, f: PDFFont, size: number, width: number): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of safe(text).split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  const para = (text: string, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = o.size ?? 10;
    const f = o.f ?? font;
    const indent = o.indent ?? 0;
    for (const l of wrap(text, f, size, W - 2 * M - indent)) {
      need(size + 4);
      page.drawText(l, { x: M + indent, y: y - size, size, font: f, color: o.color ?? NAVY });
      y -= size + 4;
    }
    y -= o.gap ?? 4;
  };
  const heading = (text: string) => {
    need(40);
    y -= 10;
    page.drawText(safe(text), { x: M, y: y - 14, size: 14, font: bold, color: NAVY });
    y -= 20;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: RULE });
    y -= 8;
  };

  // Header
  if (logo) {
    const h = 34;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: M, y: y - h, width: w, height: h });
    y -= h + 10;
  }
  const track = TRACKS[result.track];
  page.drawText(safe(`${track.short} (${track.code}) readiness report`), { x: M, y: y - 20, size: 20, font: bold, color: NAVY });
  y -= 30;
  para(`${opts.name ? `Prepared for ${opts.name}. ` : ""}${new Date().toISOString().slice(0, 10)} - ${modeName(result)}`, { color: MUTED });
  para(DISCLAIMER, { size: 8, color: MUTED, gap: 8 });

  // Score
  if (result.readiness !== null) {
    heading("Readiness estimate");
    need(60);
    page.drawText(String(result.readiness), { x: M, y: y - 34, size: 36, font: bold, color: result.passed ? GREEN : RED });
    page.drawText("/ 1000", { x: M + 90, y: y - 34, size: 14, font, color: MUTED });
    page.drawText(`Pass line ${result.passLine}`, { x: M + 170, y: y - 34, size: 12, font: bold, color: NAVY });
    y -= 46;
    para(
      result.passed
        ? `Your estimate is above the ${result.passLine} pass line. Estimate, not an official score.`
        : `You are ${result.gap} points short of the ${result.passLine} pass line. Estimate, not an official score.`,
      { f: bold }
    );
    if (result.lowConfidence) para("This attempt has few questions, so treat the estimate as low confidence. A full mock is more reliable.", { size: 9, color: MUTED });
  } else {
    heading("Summary");
    para(`${result.correct} of ${result.total} correct (${Math.round(result.pct * 100)}%).`);
  }

  // Domains
  heading("Percent correct by domain");
  for (const d of result.domains) {
    need(22);
    page.drawText(safe(`${d.domain} (${d.weight}%)`), { x: M, y: y - 10, size: 10, font, color: NAVY });
    const barX = W - M - 160;
    page.drawRectangle({ x: barX, y: y - 12, width: 110, height: 8, color: RULE });
    if (d.pct !== null) page.drawRectangle({ x: barX, y: y - 12, width: 110 * d.pct, height: 8, color: d.pct >= 0.69 ? GREEN : RED });
    page.drawText(d.pct === null ? "n/a" : `${Math.round(d.pct * 100)}%`, { x: W - M - 40, y: y - 11, size: 10, font: bold, color: NAVY });
    y -= 22;
  }

  if (result.lifts.length) {
    heading("Where to focus (ranked by score lift)");
    for (const l of result.lifts.slice(0, 8)) {
      para(`${l.name}${l.kind === "subSkill" ? ` - ${l.domain}` : ""}: ${Math.round(l.pct * 100)}% correct, worth about +${l.lift} points`, { indent: 8 });
    }
  }

  const unweighted = result.subSkills.filter((s) => s.weight === null && s.pct !== null && (s.pct as number) < 0.78).sort((a, b) => (a.pct as number) - (b.pct as number)).slice(0, 8);
  if (unweighted.length) {
    heading("Sub-skills to review (no published weight)");
    for (const s of unweighted) para(`${s.subSkill} - ${s.domain}: ${Math.round((s.pct as number) * 100)}% (${s.correct}/${s.total})`, { indent: 8 });
  }

  if (result.patterns.length) {
    heading("Patterns in your mistakes");
    for (const p of result.patterns) para(`• ${p}`, { indent: 8 });
  }
  heading("Time per question");
  para(`${result.avgSecondsPerQuestion} seconds on average, against the ${result.paceSeconds}-second exam pace.`);

  if (opts.plan) {
    heading("Your study plan");
    para(opts.plan.summary);
    for (const d of opts.plan.days) {
      para(`Day ${d.day}${d.date ? ` (${d.date})` : ""}: ${d.title}`, { f: bold, gap: 1 });
      if (d.focus) para(d.focus, { indent: 8, color: MUTED, gap: 1 });
      for (const t of d.tasks) para(`- ${t}`, { indent: 8, size: 9, gap: 1 });
      y -= 4;
    }
  }

  heading(`Every missed question (${result.missed.length})`);
  if (!result.missed.length) para("No missed questions.");
  result.missed.forEach((m, i) => {
    need(70);
    para(`${i + 1}. [${m.domain} / ${m.subSkill}] ${m.question}`, { f: bold, gap: 2 });
    const text = (labels: string[]) => labels.map((l) => `${l}) ${m.options.find((o) => o.label === l)?.text ?? ""}`).join("; ");
    para(`Your answer: ${m.userPicks.length ? text(m.userPicks) : "(not answered)"}`, { indent: 8, color: RED, size: 9, gap: 1 });
    para(`Correct: ${text(m.keys)}`, { indent: 8, color: GREEN, size: 9, gap: 1 });
    para(`Why: ${m.explanation}`, { indent: 8, size: 9, gap: 8 });
  });

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(safe(`${DISCLAIMER}  Page ${i + 1} of ${pages.length}`), { x: M, y: 24, size: 7.5, font, color: MUTED });
  });
  return pdf.save();
}

function modeName(r: ResultSummary): string {
  return { diagnostic: "Readiness diagnostic", full: "Full mock exam", sprint: "Quick sprint", drill: "Domain drill", review: "Review mistakes" }[r.mode];
}
