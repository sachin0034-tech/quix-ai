import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDomains, adminSchema } from "@/lib/server/admin-data";
import { PageHead, SchemaBanner } from "../../_components/ui";
import DomainEditor from "../../_components/DomainEditor";

export const dynamic = "force-dynamic";

export default async function DomainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [domains, schema] = await Promise.all([adminDomains(), adminSchema()]);
  const domain = domains.find((d) => d.id === Number(id));
  if (!domain) notFound();
  return (
    <div style={{ padding: "32px 40px", maxWidth: 860 }}>
      <p style={{ margin: "0 0 8px" }}><Link href="/admin" style={{ color: "var(--muted)" }}>← All domains</Link></p>
      <PageHead title={domain.title}>
        <Link href={`/admin/questions?domain=${domain.id}`} style={{ color: "#214f91" }}>{domain.questionCount} questions →</Link>
      </PageHead>
      <SchemaBanner schema={schema} />
      <DomainEditor domain={domain} />
    </div>
  );
}
