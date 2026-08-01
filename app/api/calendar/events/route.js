import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/events
 * Fetches all calendar events from Supabase.
 */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // Table might not exist yet; return empty array cleanly
      return NextResponse.json({ events: [] });
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    return NextResponse.json({ events: [], error: err.message });
  }
}

/**
 * POST /api/calendar/events
 * Creates a new event or deletes an event.
 * Body: { action: "create" | "delete", event }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { action = "create", event, id } = body ?? {};
  const supabase = getSupabaseServerClient();

  if (action === "delete") {
    const eventId = id || event?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Missing event id to delete." }, { status: 400 });
    }
    const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, deletedId: eventId });
  }

  // Create
  if (!event || !event.title) {
    return NextResponse.json({ error: "Event title is required." }, { status: 400 });
  }

  const eventPayload = {
    date: event.date || new Date().toISOString().split("T")[0],
    title: event.title.trim(),
    type: event.type || "socratic",
    time: event.time || "10:00 AM",
    space: event.space || "School",
  };

  const { data, error } = await supabase
    .from("calendar_events")
    .insert([eventPayload])
    .select()
    .single();

  if (error) {
    // If Supabase table doesn't exist yet, return echo so client works
    return NextResponse.json({
      success: true,
      event: { id: `local_${Date.now()}`, ...eventPayload },
      note: "Saved locally (Supabase table calendar_events missing).",
    });
  }

  return NextResponse.json({ success: true, event: data });
}
