import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";

    const res = await fetch(`${backendUrl}/v1/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `Backend returned ${res.status}: ${errorText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Replay API error:", err);
    return NextResponse.json(
      { error: "Could not connect to Python backend for offline replay." },
      { status: 503 }
    );
  }
}
