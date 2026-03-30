import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const JSON_DIR = path.join(process.cwd(), "json");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params;

  if (!/^[a-z0-9-]+$/i.test(section)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }

  try {
    const filePath = path.join(JSON_DIR, `${section}.json`);
    const content = await readFile(filePath, "utf8");
    return new NextResponse(content, {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }
}
