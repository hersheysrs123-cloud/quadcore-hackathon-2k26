import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/events
 * Local-first mode: Calendar events are stored directly in Dexie.js (IndexedDB).
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    offline: true,
    localFirst: true,
    events: [],
    message: "Calendar events stored locally in IndexedDB.",
  });
}

/**
 * POST /api/calendar/events
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    offline: true,
    localFirst: true,
    message: "Calendar action stored locally.",
  });
}
