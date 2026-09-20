import { ICONS } from "./sectionIcons";

// Client-side "database" for the icon system. localStorage for now; every function here is
// the seam to replace with real DB calls later.
//   icons        → the vocabulary of icon keys the LLM may choose from
//   sectionIcons → normalized section name → icon key (what the LLM already answered)
const ICONS_KEY = "template-importer:icons";
const NAMES_KEY = "template-importer:section-icons";

export const normalizeName = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the registry just won't persist.
  }
}

/** Stored keys plus any keys the code knows about (so new icons in code appear automatically). */
export function getIconVocabulary(): string[] {
  const merged = [...new Set([...read<string[]>(ICONS_KEY, []), ...Object.keys(ICONS)])];
  write(ICONS_KEY, merged);
  return merged;
}

export const getNameMap = () => read<Record<string, string>>(NAMES_KEY, {});

/**
 * Returns normalized section name → icon key for the given names. Known names come from the
 * registry; only unknown ones are sent to the LLM, and its answers are saved back.
 * Never throws: on any failure the affected sections simply get no icon (placeholder).
 */
export async function resolveSectionIcons(names: string[]): Promise<Record<string, string>> {
  const known = getNameMap();
  const vocabulary = getIconVocabulary();
  const unknown = [...new Set(names.filter((n) => !known[normalizeName(n)]))];

  if (unknown.length > 0) {
    try {
      const res = await fetch("/api/icons/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: unknown, icons: vocabulary }),
      });
      if (res.ok) {
        const { matches }: { matches: Record<string, string> } = await res.json();
        for (const [name, icon] of Object.entries(matches)) {
          if (vocabulary.includes(icon)) known[normalizeName(name)] = icon;
        }
        write(NAMES_KEY, known);
      }
    } catch {
      // Offline or API unavailable: fall through with whatever is cached.
    }
  }
  return known;
}
