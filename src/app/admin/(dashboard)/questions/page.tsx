import { adminDomains, adminQuestions, adminSchema } from "@/lib/server/admin-data";
import { PageHead, SchemaBanner } from "../_components/ui";
import QuestionsClient from "./QuestionsClient";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const { domain } = await searchParams;
  const [domains, questions, schema] = await Promise.all([adminDomains(), adminQuestions(), adminSchema()]);
  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100 }}>
      <PageHead title="Question bank" />
      <SchemaBanner schema={schema} />
      <QuestionsClient domains={domains} questions={questions} initialDomain={domain ? Number(domain) : 0} />
    </div>
  );
}
