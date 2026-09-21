import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  addTemplate, getTemplate, listTemplates, removeTemplate, StoreError, updateTemplate,
} from "@/lib/store";
import { hasUniqueIds, isSectionArray } from "@/lib/template";
import { createClient } from "@/utils/supabase/server";

// Each route handler deploys as a Vercel serverless function.
export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Runs a store call and turns database failures into JSON errors.
async function handle(run: (db: ReturnType<typeof createClient>) => Promise<Response>) {
  try {
    return await run(createClient(await cookies()));
  } catch (err) {
    if (err instanceof StoreError) return bad(err.message, err.status);
    throw err;
  }
}

const validTree = (v: unknown) => isSectionArray(v) && hasUniqueIds(v);

// GET /api/templates          → list (without trees)
// GET /api/templates?id=<id>  → one full document, including its tree
export function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return handle(async (db) => {
    if (!id) return NextResponse.json(await listTemplates(db));
    const doc = await getTemplate(db, id);
    return doc ? NextResponse.json(doc) : bad("Not found.", 404);
  });
}

// Body: { name, tree, iconsResolved? }. Every id in the tree is replaced by a database id.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  // { copyOf: id } duplicates a stored template without the client sending the tree.
  if (typeof body?.copyOf === "string") {
    return handle(async (db) => {
      const src = await getTemplate(db, body.copyOf);
      if (!src) return bad("Not found.", 404);
      return NextResponse.json(await addTemplate(db, `${src.name} (copy)`, src.tree, src.iconsResolved), { status: 201 });
    });
  }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return bad("A name is required.");
  if (!validTree(body?.tree)) return bad("Invalid template structure.");
  return handle(async (db) =>
    NextResponse.json(await addTemplate(db, name, body.tree, body.iconsResolved === true), { status: 201 }),
  );
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return handle(async (db) =>
    (await removeTemplate(db, id)) ? NextResponse.json({ ok: true }) : bad("Not found.", 404),
  );
}

// Body: { name?, tree? } → { idMap }. idMap maps the ids of newly created rows to their database ids.
export async function PUT(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;

  if (name === "") return bad("A name is required.");
  if (body?.tree !== undefined && !validTree(body.tree)) return bad("Invalid template structure.");

  return handle(async (db) => {
    const updated = await updateTemplate(db, id, { name, tree: body?.tree });
    return updated ? NextResponse.json(updated) : bad("Not found.", 404);
  });
}
