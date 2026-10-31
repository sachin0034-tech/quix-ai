import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRACKS, TRACK_IDS, isTrack } from "@/lib/blueprint";
import { bankMeta, getLevel } from "@/lib/bank";
import type { BankQuestion } from "@/types/quiz";
import TrackClient from "./TrackClient";
import DeveloperTrackClient, { type LevelCounts } from "./DeveloperTrackClient";

// Questions come from the database; refresh the counts every minute
export const revalidate = 60;

export function generateStaticParams() {
  return TRACK_IDS.map((track) => ({ track }));
}

export async function generateMetadata({ params }: { params: Promise<{ track: string }> }): Promise<Metadata> {
  const { track } = await params;
  if (!isTrack(track)) return {};
  const t = TRACKS[track];
  return {
    title: track === "developer" ? `Claude Developer Certification Mock Test (${t.code}) | Free` : `Claude ${t.short} Certification Mock Test (${t.code}) | Free`,
    description: `Claude ${t.short} certification mock test (${t.code}): free ${t.items}-question mocks, readiness diagnostic and domain drills. Independent exam prep.`,
    alternates: { canonical: `/${track}` },
    openGraph: { url: `/${track}`, title: `Claude ${t.short} Certification Mock Test (${t.code})`, images: ["/agentic-ai-logo.png"] },
  };
}

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (!isTrack(track)) notFound();
  const meta = (await bankMeta())[track];
  return (
    track === "developer"
      ? <DeveloperTrackClient meta={meta} levels={await levelCounts()} />
      : <TrackClient track={track} meta={meta} />
  );
}

/** Question counts of the Developer levels, sent to the page without the questions or their keys */
async function levelCounts(): Promise<LevelCounts> {
  const byModule = (bank: BankQuestion[]) => {
    const out: Record<string, number> = {};
    for (const q of bank) if (q.submoduleName) out[q.submoduleName] = (out[q.submoduleName] ?? 0) + 1;
    return out;
  };
  const [one, two, three] = [await getLevel(1), await getLevel(2), await getLevel(3)];
  return {
    total: { 1: one.bank.length, 2: two.bank.length, 3: three.bank.length },
    modules: { 1: byModule(one.bank), 2: byModule(two.bank), 3: byModule(three.bank) },
  };
}
