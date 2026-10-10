import { NextResponse } from "next/server";

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
