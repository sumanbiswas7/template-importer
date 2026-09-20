import OpenAI from "openai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

// POST /api/templates/icons?id=<templateId> → { icons: { [sectionId]: iconKey }, error? }
// Asks the LLM for an icon for every section of the template that has none, picking from the
// `icons` table, and stores the answers on the sections. Runs once per template: on success the
// template is marked `icons_resolved`, so a section the model answered "none" for stays blank.
// Best-effort: on any failure the template is left unmarked (so a later open retries) and the
// response says what went wrong.
export async function POST(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const supabase = createClient(await cookies());
  const icons: Record<string, string> = {};
  const respond = (error?: string) => NextResponse.json({ icons, ...(error && { error }) });

  const template = await supabase.from("templates").select("icons_resolved").eq("id", id).maybeSingle();
  if (template.error || !template.data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (template.data.icons_resolved) return respond();

  const sections = await supabase.from("sections").select("id, name, icon").eq("template_id", id);
  if (sections.error) return respond(`Supabase: ${sections.error.message}`);
  const targets = sections.data.filter((s) => !s.icon);

  const store = async () => {
    const saved = await supabase.rpc("apply_section_icons", { p_template_id: id, p_icons: icons });
    return saved.error ? respond(`Supabase: ${saved.error.message}`) : respond();
  };
  if (targets.length === 0) return store();

  const names = [...new Map(targets.map((s) => [normalize(s.name), s.name])).values()];
  if (!process.env.OPENAI_API_KEY) return respond("OpenAI credentials aren't configured (set OPENAI_API_KEY).");

  const vocabulary = await supabase.from("icons").select("key");
  if (vocabulary.error) return respond(`Supabase: ${vocabulary.error.message}`);
  const keys = vocabulary.data.map((r) => r.key as string);
  if (keys.length === 0) return respond("The icons table is empty.");

  try {
    const client = new OpenAI(); // reads OPENAI_API_KEY
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You assign an icon to each section name of a property inspection report template. " +
            "For every section name, pick the single best-fitting icon key from the allowed list, judging by meaning " +
            "(e.g. 'Heating' → a flame, 'Roof' → a roof/house). If nothing fits reasonably, answer \"none\" - " +
            "a placeholder is better than a misleading icon. Return one entry per input name, using the name exactly as given.",
        },
        { role: "user", content: JSON.stringify({ sections: names }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "icon_matches",
          strict: true,
          schema: {
            type: "object",
            properties: {
              matches: {
                type: "array",
                items: {
                  type: "object",
                  properties: { name: { type: "string" }, icon: { type: "string", enum: [...keys, "none"] } },
                  required: ["name", "icon"],
                  additionalProperties: false,
                },
              },
            },
            required: ["matches"],
            additionalProperties: false,
          },
        },
      },
    });

    const choice = completion.choices[0];
    if (!choice || choice.finish_reason === "length" || choice.message.refusal) {
      return respond("The model couldn't complete the icon match.");
    }
    const parsed = JSON.parse(choice.message.content ?? "{}") as { matches?: { name: string; icon: string }[] };

    // Trust nothing: keep only keys we allowed, and map names back onto every section with that name.
    const allowed = new Set(keys);
    const keyOf = new Map<string, string>(); // normalized name → icon key
    for (const m of parsed.matches ?? []) if (allowed.has(m.icon)) keyOf.set(normalize(m.name), m.icon);
    for (const s of targets) {
      const key = keyOf.get(normalize(s.name));
      if (key) icons[s.id] = key;
    }
    return await store();
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) return respond("OpenAI rejected the API key.");
    if (err instanceof OpenAI.RateLimitError) return respond("Rate limited. Try again shortly.");
    return respond("Icon matching failed.");
  }
}
