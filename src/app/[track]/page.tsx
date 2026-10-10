import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRACKS, TRACK_IDS, isTrack } from "@/lib/blueprint";
import { bankMeta } from "@/lib/bank";
import TrackClient from "./TrackClient";

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
    title: `${t.name} (${t.code}) practice quiz | Agentic AI Institute`,
    description: `Free ${t.short} practice: readiness diagnostic, quick sprints, domain drills and full ${t.items}-question mocks. Every module open.`,
  };
}

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (!isTrack(track)) notFound();
  return <TrackClient track={track} meta={(await bankMeta())[track]} />;
}
