import { adminDomains, adminSchema } from "@/lib/server/admin-data";
import { PageHead, SchemaBanner } from "./_components/ui";
import DomainsClient from "./_components/DomainsClient";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  const [domains, schema] = await Promise.all([adminDomains(), adminSchema()]);
  return (
    <div style={{ padding: "32px 40px", maxWidth: 1000 }}>
      <PageHead title="Domains" />
      <p style={{ color: "var(--muted)", margin: "0 0 14px" }}>
        One row per exam domain, with its weight in the exam. Full mocks and the diagnostic draw questions at these weights, and results are reported against them.
      </p>
      <SchemaBanner schema={schema} />
      <DomainsClient domains={domains} />
    </div>
  );
}
