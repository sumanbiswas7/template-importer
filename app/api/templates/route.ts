import { NextResponse } from "next/server";
import {
  addTemplate, getTemplate, listTemplates, removeTemplate, updateTemplate,
} from "@/lib/store";
import { isSectionArray } from "@/lib/template";

// Each route handler deploys as a Vercel serverless function.
export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// GET /api/templates          → list (without trees)
// GET /api/templates?id=<id>  → one full document, including its tree
export function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json(listTemplates());
  const doc = getTemplate(id);
  return doc ? NextResponse.json(doc) : bad("Not found.", 404);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const hasTree = body?.tree !== undefined;

  if (hasTree && !isSectionArray(body.tree)) return bad("Invalid template structure.");
  if (!name || (!content && !hasTree)) return bad("Both name and content are required.");
  return NextResponse.json(addTemplate(name, content, hasTree ? body.tree : []), { status: 201 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!removeTemplate(id)) return bad("Not found.", 404);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const content = typeof body?.content === "string" ? body.content.trim() : undefined;

  if (name === "" || content === "") return bad("Both name and content are required.");
  if (body?.tree !== undefined && !isSectionArray(body.tree)) return bad("Invalid template structure.");

  const updated = updateTemplate(id, { name, content, tree: body?.tree });
  return updated ? NextResponse.json(updated) : bad("Not found.", 404);
}
