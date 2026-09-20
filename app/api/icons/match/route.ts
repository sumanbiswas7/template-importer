import OpenAI from "openai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const isStringArray = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max && v.every((s) => typeof s === "string" && s.length > 0 && s.length <= 120);

// Picks one icon key per section name, from the caller's list of allowed keys.
// Body: { names: string[], icons: string[] } → { matches: { [name]: iconKey } } (unmatched names omitted)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isStringArray(body?.names, 100) || !isStringArray(body?.icons, 500)) {
    return bad("Expected non-empty `names` and `icons` string arrays.");
  }
  const names: string[] = body.names;
  const icons: string[] = body.icons;

  if (!process.env.OPENAI_API_KEY) {
    return bad("OpenAI credentials aren't configured (set OPENAI_API_KEY).", 503);
  }

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
      return bad("The model couldn't complete the icon match.", 502);
    }
    const parsed = JSON.parse(choice.message.content ?? "{}") as {
      matches?: { name: string; icon: string }[];
    };

    // Trust nothing: keep only names we asked about and keys we allowed.
    const asked = new Set(names);
    const allowed = new Set(icons);
    const matches: Record<string, string> = {};
    for (const m of parsed.matches ?? []) {
      if (asked.has(m.name) && allowed.has(m.icon)) matches[m.name] = m.icon;
    }
    return NextResponse.json({ matches });
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) return bad("OpenAI rejected the API key.", 503);
    if (err instanceof OpenAI.RateLimitError) return bad("Rate limited. Try again shortly.", 429);
    return bad("Icon matching failed.", 502);
  }
}
