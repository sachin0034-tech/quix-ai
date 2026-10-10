import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "220px",
          flexShrink: 0,
          background: "var(--navy)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 50,
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: "20px 18px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.02em",
            }}
          >
            Quix Admin
          </div>
          <div
            style={{ fontSize: "11px", color: "var(--on-navy-2)", marginTop: "2px" }}
          >
            Content Manager
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 0" }}>
          <Link
            href="/admin/analytics"
            style={{
              display: "block",
              padding: "9px 18px",
              color: "var(--on-navy)",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Analytics
          </Link>
          <Link
            href="/admin/leads"
            style={{
              display: "block",
              padding: "9px 18px",
              color: "var(--on-navy)",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Leads
          </Link>
          <Link
            href="/admin/calls"
            style={{
              display: "block",
              padding: "9px 18px",
              color: "var(--on-navy)",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            1:1 calls
          </Link>
          <Link
            href="/admin/reports"
            style={{
              display: "block",
              padding: "9px 18px",
              color: "var(--on-navy)",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Reported questions
          </Link>
          <Link
            href="/admin/responses"
            style={{
              display: "block",
              padding: "9px 18px",
              color: "var(--on-navy)",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Responses
          </Link>
          <Link
            href="/admin"
            style={{
              display: "block",
              padding: "9px 18px",
              color: "var(--on-navy)",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Domains
          </Link>
          <Link
            href="/admin/questions"
            style={{
              display: "block",
              padding: "9px 18px",
              color: "var(--on-navy)",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Question bank
          </Link>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "9px 18px",
              color: "var(--on-navy-2)",
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            View Site ↗
          </a>
        </nav>

        {/* Logout */}
        <div
          style={{
            padding: "16px 18px",
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                background: "none",
                border: "none",
                color: "var(--on-navy-2)",
                fontSize: "13px",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          marginLeft: "220px",
          minHeight: "100vh",
          background: "var(--canvas)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
