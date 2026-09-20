# Template Importer

Import an inspection-report spreadsheet (.xlsx), edit it as **sections → subsections → comments**, and export it as PDF or XLS.

## Features

- Import a spreadsheet into an editable template (stored in Supabase)
- Drag-and-drop ordering, rename, hide/unhide sections, subsections and comments
- Rich-text comments (defect / info / limitation) with categories and answer types
- LLM-picked icons for each section (once, on first open)
- Tree view: an interactive React Flow map with per-type comment counts and a hover preview
- Export to PDF or to an XLS you can import again

## Setup

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=
```

Run [supabase/schema.sql](supabase/schema.sql) in your Supabase project to create the tables.

## Tests

`pnpm e2e` runs a Playwright test against a running dev server (`pnpm e2e:watch` to watch it in a browser).

## Layout

- `app/`: pages and API routes (`/api/templates`, `/api/templates/icons`)
- `components/`: template list, import dialog and the `editor/` UI
- `lib/`: template model, spreadsheet parsing, PDF/XLS export, icons
- `supabase/`: database schema
