import type { Metadata } from "next";
import { Golos_Text } from "next/font/google";
import "./globals.css";
import { EmailGateProvider } from "@/components/EmailGate";
import DisclaimerBanner from "@/components/DisclaimerBanner";

const golosText = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
  title: "Claude Certification Practice Quiz | Associate & Developer | Agentic AI Institute",
  description: "Free practice quizzes for the Claude Certified Associate (CCAO-F) and Developer (CCDV-F) exams. Instant feedback, a readiness estimate out of 1,000 and a personal study plan. Independent, not affiliated with Anthropic.",
  openGraph: {
    title: "Claude Certification Practice Quiz",
    description: "Find out if you are ready for the Claude Associate or Developer exam.",
    images: ["/agentic-ai-logo.png"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${golosText.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <EmailGateProvider>
          <DisclaimerBanner />
          {children}
        </EmailGateProvider>
      </body>
    </html>
  );
}
