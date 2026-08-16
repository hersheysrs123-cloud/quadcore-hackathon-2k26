import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/reset
 * Body: { target: "notes" | "calendar" | "all" }
 * Local-first mode: Resets are handled directly in the browser via IndexedDB (Dexie.js).
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // Ignore JSON parse errors in local-first mode
  }

  const { target = "all" } = body ?? {};

  return NextResponse.json({
    success: true,
    offline: true,
    localFirst: true,
    target,
    message: `Factory reset signal for ${target} acknowledged. Data reset handled locally via IndexedDB.`,
  });
}
