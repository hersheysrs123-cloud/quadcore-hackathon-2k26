import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/visualizations
 * Local-first mode: 3D models and widget configs are stored in local storage / IndexedDB.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    offline: true,
    localFirst: true,
    visualizations: [],
    message: "Visualizations stored locally in IndexedDB.",
  });
}

/**
 * POST /api/visualizations
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    offline: true,
    localFirst: true,
    message: "Visualization saved locally.",
  });
}
