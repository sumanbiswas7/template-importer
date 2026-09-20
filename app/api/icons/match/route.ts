import OpenAI from "openai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

const isStringArray = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max && v.every((s) => typeof s === "string" && s.length > 0 && s.length <= 120);

// Body: { names: string[] } → { icons: { [name]: iconKey }, error?: string }
// Names already in Supabase (`section_icons`) are answered from there. Only the rest go to the
// LLM, which picks from the `icons` table; its answers are saved back. Best-effort: on any
// failure the response still carries whatever was already known (`error` says what went wrong).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isStringArray(body?.names, 100)) {
    return NextResponse.json({ error: "Expected a non-empty `names` string array." }, { status: 400 });
  }
  const names: string[] = body.names;
  const supabase = createClient(await cookies());

  const keyOf = new Map<string, string>(); // normalized name → icon key
  const respond = (error?: string) =>
    NextResponse.json({
      icons: Object.fromEntries(names.filter((n) => keyOf.has(normalize(n))).map((n) => [n, keyOf.get(normalize(n))!])),
      ...(error && { error }),
    });

  const wanted = [...new Set(names.map(normalize))];
  const cached = await supabase.from("section_icons").select("name, icon_key").in("name", wanted);
  if (cached.error) return respond(`Supabase: ${cached.error.message}`);
  for (const row of cached.data) keyOf.set(row.name, row.icon_key);

  const unknown = names.filter((n, i) => !keyOf.has(normalize(n)) && names.findIndex((m) => normalize(m) === normalize(n)) === i);
  if (unknown.length === 0) return respond();
  if (!process.env.OPENAI_API_KEY) return respond("OpenAI credentials aren't configured (set OPENAI_API_KEY).");

  const vocabulary = await supabase.from("icons").select("key");
  if (vocabulary.error) return respond(`Supabase: ${vocabulary.error.message}`);
  const icons = vocabulary.data.map((r) => r.key as string);
  if (icons.length === 0) return respond("The icons table is empty.");

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
        { role: "user", content: JSON.stringify({ sections: unknown }) },
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
                  properties: { name: { type: "string" }, icon: { type: "string", enum: [...icons, "none"] } },
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

    // Trust nothing: keep only names we asked about and keys we allowed.
    const asked = new Set(unknown);
    const allowed = new Set(icons);
    const rows: { name: string; icon_key: string }[] = [];
    for (const m of parsed.matches ?? []) {
      if (asked.has(m.name) && allowed.has(m.icon)) {
        keyOf.set(normalize(m.name), m.icon);
        rows.push({ name: normalize(m.name), icon_key: m.icon });
      }
    }
    if (rows.length > 0) {
      // Insert-only: existing answers are never overwritten.
      const saved = await supabase.from("section_icons").upsert(rows, { onConflict: "name", ignoreDuplicates: true });
      if (saved.error) return respond(`Supabase: ${saved.error.message}`);
    }
    return respond();
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) return respond("OpenAI rejected the API key.");
    if (err instanceof OpenAI.RateLimitError) return respond("Rate limited. Try again shortly.");
    return respond("Icon matching failed.");
  }
}
