import { NextResponse } from "next/server";
import { addTemplate, listTemplates, removeTemplate, updateTemplate } from "@/lib/store";

// Each route handler deploys as a Vercel serverless function.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(listTemplates());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!name || !content) {
    return NextResponse.json(
      { error: "Both name and content are required." },
      { status: 400 },
    );
  }
  return NextResponse.json(addTemplate(name, content), { status: 201 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!removeTemplate(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!name || !content) {
    return NextResponse.json(
      { error: "Both name and content are required." },
      { status: 400 },
    );
  }
  const updated = updateTemplate(id, name, content);
  if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(updated);
}
