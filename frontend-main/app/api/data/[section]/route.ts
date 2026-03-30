import { NextResponse } from "next/server";

const SECTION_TO_VIEW: Record<string, string> = {
  executive: "executive",
  trends: "trends",
  multidim: "multidim",
  funnel: "funnel",
  explorer: "explorer",
  client: "client",
};

const BACKEND_BASE = process.env.BACKEND_API_BASE ?? "http://34.60.183.121";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params;
  const viewName = SECTION_TO_VIEW[section];

  if (!viewName) {
    return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  }

  try {
    // Use /frontend-dashboard?view={section} endpoint
    const upstream = await fetch(`${BACKEND_BASE}/frontend-dashboard?view=${viewName}`, {
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Backend returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const payload = await upstream.json();
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach backend data service" },
      { status: 502 },
    );
  }
}
