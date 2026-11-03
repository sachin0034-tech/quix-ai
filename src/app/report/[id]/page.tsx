import { notFound } from "next/navigation";
import type { ResultSummary } from "@/types/quiz";
import type { StudyPlan } from "@/lib/study-plan";
import { TRACKS } from "@/lib/blueprint";
import { DISCLAIMER } from "@/lib/config";
import { db } from "@/lib/server/db";
import SiteFooter from "@/components/SiteFooter";
import RichText from "@/components/RichText";
import "@/app/design/results.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Readiness report | Agentic AI Institute", robots: { index: false, follow: false } };

/** Private report page linked from the booking, so the advisor sees the learner's report before the call. */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = db();
  if (!c) notFound();
  const { data } = await c.from("quiz_attempts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data.result as ResultSummary;
  const plan = data.plan as StudyPlan | null;
  const track = TRACKS[r.track];

  return (
    <>
      <header className="site-header site-header--compact">
        <div className="container site-header__inner">
          <span className="site-header__logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-on-navy.png" alt="Agentic AI Institute" width={81} height={36} />
          </span>
          <span className="site-header__context">Advisor View · {track.short}</span>
        </div>
      </header>
      <main id="main" className="section">
        <div className="container report-page stack" style={{ "--stack": "40px" } as React.CSSProperties}>
          <div className="stack" style={{ "--stack": "12px" } as React.CSSProperties}>
            <span className="eyebrow">{track.short} ({track.code}) Readiness Report</span>
            <h1 className="t-h2">
              {data.name ?? data.email ?? "Learner"}
              {r.readiness !== null ? ` · ${r.readiness} / 1000 (estimate)` : ` · ${r.correct} of ${r.total} correct`}
            </h1>
            <p className="t-sm t-muted">
              {data.exam_date ? `Exam date ${data.exam_date} · ` : ""}
              {data.email ?? "no email"} · {new Date(data.created_at).toISOString().slice(0, 10)}
            </p>
            {r.readiness !== null && (
              <div className="cluster">
                <span className={`tag ${r.passed ? "tag--success" : "tag--error"}`}>
                  {r.passed ? `Above the ${r.passLine} Pass Line` : `${r.gap} Points Short of the ${r.passLine} Pass Line`}
                </span>
                <span className="t-xs t-muted">Estimate, not an official score.</span>
              </div>
            )}
          </div>

          <div>
            <h2 className="t-h3" style={{ marginBottom: "var(--s-5)" }}>Percent Correct by Domain</h2>
            <div className="domains">
              {r.domains.map((d) => {
                const pct = d.pct === null ? null : Math.round(d.pct * 100);
                const isWeakest = d.domain === r.weakestDomain;
                return (
                  <div key={d.domain} className={`domain${isWeakest ? " is-weakest" : pct !== null && pct >= 80 ? " is-strong" : ""}`}>
                    <div>
                      <span className="domain__name">{d.domain}</span>
                      <span className="domain__weight">{d.weight}% of exam{isWeakest ? " · Weakest" : ""}</span>
                    </div>
                    <div className="progress" role="img" aria-label={pct === null ? "Not available" : `${pct}% correct`}>
                      <div className="progress__fill" style={{ "--value": `${pct ?? 0}%` } as React.CSSProperties} />
                    </div>
                    <span className="domain__score">{pct === null ? "n/a" : `${pct}%`}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {r.patterns.length > 0 && (
            <div>
              <h2 className="t-h3" style={{ marginBottom: "var(--s-4)" }}>Patterns</h2>
              <ul className="results-list results-list--bullets">{r.patterns.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}

          {plan && (
            <div className="card card--soft">
              <h2 className="t-h4">Study Plan</h2>
              <p className="t-sm" style={{ color: "var(--ink-2)" }}>{plan.summary}</p>
            </div>
          )}

          <div>
            <div className="cluster" style={{ justifyContent: "space-between", marginBottom: "var(--s-3)" }}>
              <h2 className="t-h3">Missed Questions</h2>
              <span className="tag tag--error">{r.missed.length} Missed</span>
            </div>
            {r.missed.map((m, i) => (
              <article key={m.id} className="report-missed">
                <p className="report-missed__q">{i + 1}. {m.question}</p>
                <p className="t-xs t-muted">{m.domain} · {m.subSkill}</p>
                <p className="is-no">Their answer: {m.userPicks.length ? m.userPicks.map((l) => m.options.find((o) => o.label === l)?.text).join("; ") : "not answered"}</p>
                <p className="is-ok">Correct: {m.keys.map((l) => m.options.find((o) => o.label === l)?.text).join("; ")}</p>
                <p style={{ color: "var(--ink-2)" }}><RichText text={m.explanation} links /></p>
              </article>
            ))}
          </div>

          <p className="t-xs t-muted">{DISCLAIMER}</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
