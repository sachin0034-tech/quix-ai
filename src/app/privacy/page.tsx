import Link from "next/link";
import Header from "@/components/Header";
import { DISCLAIMER } from "@/lib/config";

export const metadata = { title: "Privacy | Claude Certification Practice Quiz" };

/** DRAFT: needs legal review before public launch (GDPR / CAN-SPAM wording, controller details). */
export default function Privacy() {
  return (
    <>
      <Header />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 96px", lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 36, margin: "0 0 8px" }}>Privacy</h1>
        <p style={{ color: "var(--muted)" }}>Draft policy, pending legal review. {DISCLAIMER}</p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>What we collect</h2>
        <p>
          Your email address, and optionally your name and target exam date, when you give them. We also record
          which questions you answer and your results, so we can show your progress and readiness estimate and
          write your study plan.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>How we use it</h2>
        <p>
          To save your progress, to produce your report and study plan, and to offer you a free review call with an
          advisor. If you tick the optional box, we also send study tips and course updates. We ask you to confirm your
          address before any marketing email, and every marketing email has a one-click unsubscribe.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>The AI tutor</h2>
        <p>
          Questions you type into the tutor are sent to an AI model provider to generate a reply. Please don&apos;t
          enter personal data there.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>Your choices</h2>
        <p>
          You can ask us to access or delete your data, or withdraw marketing consent, at any time by replying to any
          email from us.
        </p>
        <p style={{ marginTop: 32 }}>
          <Link href="/" style={{ color: "var(--navy)" }}>← Back to the quiz</Link>
        </p>
      </main>
    </>
  );
}
