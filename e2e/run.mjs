// End-to-end test of the whole app against a running dev server (real Supabase, real LLM).
//
//   pnpm dev                      # in one terminal
//   pnpm e2e                      # in another
//
// Every step runs even if an earlier one failed (steps that depend on a failed one are SKIPPED),
// and everything is logged to e2e/results/<timestamp>/{run.log,results.json,*.png}.
// Env: E2E_BASE_URL (default http://localhost:3000), E2E_KEEP=1 to keep the data it creates,
//      HEADED=1 to watch in a real browser window (`pnpm e2e:watch`), SLOWMO=<ms> to change the pace (default 150).
// It creates templates named "e2e-<id>…" and deletes them at the end.

import { chromium } from "playwright";
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const HEADED = process.env.HEADED === "1";
const KEEP = process.env.E2E_KEEP === "1";
const RUN = `e2e-${Date.now().toString(36)}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "results", new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(OUT, { recursive: true });

// --- logging ------------------------------------------------------------------
const logFile = path.join(OUT, "run.log");
// Terminal output is coloured (green pass, red fail, yellow skip/warning); the log file stays plain.
const COLOR = process.stdout.isTTY || !!process.env.FORCE_COLOR;
const paint = (code) => (t) => (COLOR ? `\x1b[${code}m${t}\x1b[0m` : t);
const green = paint("32"), red = paint("31"), yellow = paint("33"), dim = paint("2"), bold = paint("1");
const log = (line = "") => {
  console.log(line);
  fs.appendFileSync(logFile, `${line.replace(/\x1b\[[0-9;]*m/g, "")}\n`);
};

// --- fixture ------------------------------------------------------------------
const HEADER = [
  "Section Name", "Item Name", "Comment Name", "Comment Text", "Comment Type (info, limit, defect)",
  "Category (-1, 0, 1)", "Multiple Choice Options", "Order", "Answer Type", "Notes",
];
const ROWS = [
  ["Roof", "Shingles", "Curling", "Shingles are curling at the edges.", "defect", "1", "", "1", "boolean", "note-a"],
  ["Roof", "Shingles", "Age of roof", "The roof is about 15 years old.", "info", "", "10 years,15 years,20 years", "2", "checkbox", "note-b"],
  ["Roof", "Flashing", "Loose flashing", "Flashing is loose near the chimney.", "limit", "0", "", "1", "text", "note-c"],
  ["Heating", "Furnace", "Furnace age", "Furnace age could not be determined.", "info", "", "", "1", "boolean", "note-d"],
  ["Heating", "Furnace", "Not tested", "The furnace was not tested.", "limit", "-1", "", "2", "boolean", "note-e"],
];
const FILE = path.join(OUT, `${RUN}.xlsx`);
{
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADER, ...ROWS]), "Template");
  fs.writeFileSync(FILE, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// --- tiny test framework -----------------------------------------------------------
const results = [];
const ctx = {}; // state shared between steps
const created = new Set(); // template ids to delete at the end
let page;
let notes = []; // console / network problems seen during the current step
let dialogs = []; // window.confirm / alert messages seen during the current step

const check = (cond, msg) => { if (!cond) throw new Error(msg); };
const same = (actual, expected, msg) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n      expected: ${e}\n      actual:   ${a}`);
};
async function eventually(fn, msg, ms = 10000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${msg}${last ? ` (${String(last.message).split("\n")[0]})` : ""}`);
}

async function step(name, fn, { needs = [], timeout = 30000 } = {}) {
  const missing = needs.filter((k) => !ctx[k]);
  if (missing.length) {
    results.push({ name, status: "skip" });
    log(yellow(`  ○ SKIP  ${name}   (needs: ${missing.join(", ")})`));
    return;
  }
  notes = [];
  dialogs = [];
  if (HEADED) await page?.evaluate((n) => { window.name = n; window.__e2eBanner?.(); }, name).catch(() => {});
  const t0 = Date.now();
  let timer;
  try {
    await Promise.race([
      fn(),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`Step timed out after ${timeout / 1000}s`)), timeout); }),
    ]);
    const ms = Date.now() - t0;
    results.push({ name, status: "pass", ms, notes });
    log(`  ${green("✓ PASS")}  ${name}   ${dim(`(${ms}ms)`)}`);
    for (const n of notes) log(yellow(`          ⚠ ${n}`));
  } catch (err) {
    const ms = Date.now() - t0;
    const shot = path.join(OUT, `${String(results.length + 1).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").slice(0, 50)}.png`);
    await page?.screenshot({ path: shot }).catch(() => {});
    results.push({ name, status: "fail", ms, error: String(err.message), screenshot: path.basename(shot), notes });
    log(`  ${red(bold("✗ FAIL"))}  ${red(name)}   ${dim(`(${ms}ms)`)}`);
    for (const l of String(err.message).split("\n")) log(red(`          ${l}`));
    for (const n of notes) log(yellow(`          ⚠ ${n}`));
    log(dim(`          screenshot: ${path.basename(shot)}`));
  } finally {
    clearTimeout(timer);
  }
}
const section = (title) => log(`\n${bold(`▸ ${title}`)}`);

// --- helpers ---------------------------------------------------------------------
async function api(p, init) {
  const res = await fetch(`${BASE}${p}`, init);
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
const json = (method, body) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const getDoc = async (id) => {
  const r = await api(`/api/templates?id=${id}`);
  check(r.status === 200, `GET template ${id} → HTTP ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};
const sectionOf = (doc, name) => doc.tree.find((s) => s.name === name);
const subOf = (doc, sec, name) => sectionOf(doc, sec)?.subsections.find((s) => s.name === name);
const allIds = (doc) => doc.tree.flatMap((s) => [s.id, ...s.subsections.flatMap((x) => [x.id, ...x.comments.map((c) => c.id)])]);
const shape = (doc) => doc.tree.map((s) => ({
  name: s.name, icon: s.icon ?? null,
  subs: s.subsections.map((x) => ({ name: x.name, comments: x.comments.map((c) => [c.name, c.type, c.category, c.text, c.options, c.answerType, c.extra]) })),
}));

const listRow = (name) => page.locator("li.row").filter({ has: page.getByRole("heading", { name, exact: true }) });
const editor = () => page.locator(".editor");
const fab = () => page.locator(".fab");
const saveBtn = () => fab().getByRole("button", { name: /^Save$|^Saving/ });
const sectionRow = (name) => page.locator(".tree__row--section").filter({ has: page.getByRole("button", { name, exact: true }) });
const subRow = (name) => page.locator(".tree__row:not(.tree__row--section)").filter({ has: page.getByRole("button", { name, exact: true }) });
const card = (name) => page.locator(".comment").filter({ has: page.locator(".comment__title strong", { hasText: name }) });

async function openEditor(id) {
  await page.goto(`${BASE}/templates/${id}`);
  await editor().waitFor({ timeout: 90000 }); // first open waits for the LLM icon step
}
async function goList() {
  await page.goto(BASE);
  await page.locator("h1:has-text('My templates'), .import-big").first().waitFor();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// dnd-kit's keyboard sensor: Space picks up, arrows move, Space drops. It attaches its listeners a tick
// after pick-up, so the keys need small pauses between them.
async function keyboardDrag(grip, arrow) {
  await grip.focus();
  await page.keyboard.press("Space");
  await sleep(250);
  await page.keyboard.press(arrow);
  await sleep(250);
  await page.keyboard.press("Space");
  await sleep(250);
}
async function save() {
  await saveBtn().click();
  const ok = fab().locator(".fab__ok");
  const err = fab().locator(".fab__error");
  const end = Date.now() + 15000;
  for (;;) {
    if (await err.isVisible()) throw new Error("Save showed “Couldn’t save”");
    if (await ok.isVisible()) break;
    if (Date.now() > end) throw new Error("Save neither confirmed nor failed within 15s");
    await new Promise((r) => setTimeout(r, 150));
  }
  await eventually(async () => (await saveBtn().isDisabled()), "Save button should be disabled again after saving");
}
async function importFile(file) {
  await page.locator("input[type=file]").setInputFiles(file);
  await page.waitForURL(/\/templates\/[0-9a-f-]{36}/, { timeout: 30000 });
  const id = page.url().split("/").pop();
  created.add(id);
  await editor().waitFor({ timeout: 90000 });
  return id;
}
async function addComment(type, { name, text, category }) {
  await page.locator(`.group--${type}`).getByRole("button", { name: "New comment" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Name", { exact: true }).fill(name);
  if (text) { await dlg.locator(".rte__content").click(); await page.keyboard.type(text); }
  if (category) await dlg.getByRole("radio", { name: category }).click();
  await dlg.getByRole("button", { name: "Done" }).click();
  await dlg.waitFor({ state: "detached" });
}

// --- run ----------------------------------------------------------------------------
async function main() {
  log(`E2E run ${RUN}`);
  log(`Base URL: ${BASE}    Output: ${path.relative(process.cwd(), OUT)}\n`);

  // Server reachable?
  const ping = await api("/api/templates").catch((e) => ({ status: 0, body: String(e) }));
  if (ping.status !== 200) {
    log(red(`✗ ${BASE}/api/templates → ${ping.status} ${JSON.stringify(ping.body)}\n  Is \`pnpm dev\` running, and has supabase/schema.sql been applied?`));
    process.exit(2);
  }

  const launch = { headless: !HEADED, slowMo: HEADED ? Number(process.env.SLOWMO ?? 150) : 0 };
  const browser = await chromium.launch({ ...launch, channel: "chrome" }).catch(() => chromium.launch(launch));
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  // In watch mode, a banner at the top of every page names the step that is running.
  if (HEADED) {
    await context.addInitScript(() => {
      const show = () => {
        let el = document.getElementById("__e2e-banner");
        if (!el) {
          el = document.createElement("div");
          el.id = "__e2e-banner";
          el.setAttribute("style", "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:80vw;" +
            "padding:6px 14px;border-radius:999px;background:#111;color:#fff;font:600 13px system-ui;pointer-events:none;opacity:.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
          const style = document.createElement("style");
          // The text lives in a CSS pseudo-element so it can never match a getByText() lookup.
          style.textContent = "#__e2e-banner::before{content:attr(data-step)}@media print{#__e2e-banner{display:none!important}}";
          document.documentElement.append(style, el);
        }
        el.setAttribute("data-step", `E2E ▸ ${window.name}`);
      };
      window.__e2eBanner = show;
      if (window.name) addEventListener("DOMContentLoaded", show);
    });
  }
  page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("dialog", async (d) => { dialogs.push(d.message()); await d.accept().catch(() => {}); });
  page.on("pageerror", (e) => notes.push(`page error: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") notes.push(`console.error: ${m.text().slice(0, 200)}`); });
  page.on("response", (r) => { if (r.url().startsWith(BASE) && r.url().includes("/api/") && r.status() >= 400) notes.push(`HTTP ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}${new URL(r.url()).search}`); });

  try {
    // ── Import ────────────────────────────────────────────────────────────────────
    section("Import");
    await step("list page loads", async () => { await goList(); });

    await step("import a spreadsheet and land in the editor", async () => {
      await goList();
      ctx.aId = await importFile(FILE);
      check(UUID.test(ctx.aId), `template id is not a uuid: ${ctx.aId}`);
      await page.getByRole("heading", { name: "Overview" }).waitFor();
      ctx.aName = RUN;
    }, { timeout: 120000 });

    await step("saved tree matches the spreadsheet (API)", async () => {
      const doc = await getDoc(ctx.aId);
      same(doc.name, RUN, "template name comes from the file name");
      same(doc.tree.map((s) => s.name), ["Roof", "Heating"], "section order");
      same(sectionOf(doc, "Roof").subsections.map((s) => s.name), ["Shingles", "Flashing"], "Roof subsections");
      same(sectionOf(doc, "Heating").subsections.map((s) => s.name), ["Furnace"], "Heating subsections");
      const shingles = subOf(doc, "Roof", "Shingles").comments;
      same(shingles.map((c) => c.name), ["Curling", "Age of roof"], "comment order follows the Order column");
      same([shingles[0].type, shingles[0].category, shingles[0].answerType], ["defect", "1", "boolean"], "comment fields");
      same(shingles[1].options, "10 years,15 years,20 years", "multiple choice options");
      same(shingles[0].extra, { Notes: "note-a" }, "extra spreadsheet columns are kept");
      same(doc.content, "2 sections · 3 subsections · 5 comments", "summary text");
      check(allIds(doc).every((i) => UUID.test(i)), "every id should be a database uuid");
      ctx.aOriginalIds = allIds(doc);
    }, { needs: ["aId"] });

    await step("first open chose icons with the LLM and stored them", async () => {
      const doc = await getDoc(ctx.aId);
      check(doc.iconsResolved === true, "iconsResolved should be true after the first open");
      const icons = doc.tree.map((s) => s.icon).filter(Boolean);
      check(icons.length > 0, `no section got an icon (LLM failure? is OPENAI_API_KEY set?) — ${JSON.stringify(doc.tree.map((s) => [s.name, s.icon]))}`);
      notes.push(`icons: ${doc.tree.map((s) => `${s.name}=${s.icon ?? "none"}`).join(", ")}`);
    }, { needs: ["aId"] });

    await step("tree shows both sections", async () => {
      await sectionRow("Roof").waitFor();
      await sectionRow("Heating").waitFor();
    }, { needs: ["aId"] });

    await step("overview shows the right counts", async () => {
      const stats = await page.locator(".stat").allInnerTexts();
      const flat = stats.map((s) => s.replace(/\s+/g, " ").trim());
      check(flat.some((s) => /^2 Sections/.test(s)), `sections stat: ${flat}`);
      check(flat.some((s) => /^3 Subsections/.test(s)), `subsections stat: ${flat}`);
      check(flat.some((s) => /^1 Defects/.test(s)), `defects stat: ${flat}`);
      check(flat.some((s) => /^2 Information/.test(s)), `info stat: ${flat}`);
      check(flat.some((s) => /^2 Limitations/.test(s)), `limitations stat: ${flat}`);
    }, { needs: ["aId"] });

    await step("importing the same file again gets a unique name (“… 2”)", async () => {
      await goList();
      ctx.bId = await importFile(FILE);
      const doc = await getDoc(ctx.bId);
      same(doc.name, `${RUN} 2`, "second import of the same name");
      check(!doc.tree.flatMap((s) => [s.id, ...s.subsections.flatMap((x) => [x.id, ...x.comments.map((c) => c.id)])]).some((i) => ctx.aOriginalIds?.includes(i)), "ids must not be shared with the first template");
    }, { needs: ["aId"], timeout: 120000 });

    // ── Rename ───────────────────────────────────────────────────────────────────
    section("Rename");
    await step("Save is disabled when there is nothing to save", async () => {
      await openEditor(ctx.aId);
      check(await saveBtn().isDisabled(), "Save should be disabled on a clean editor");
    }, { needs: ["aId"] });

    await step("editing the name enables Save", async () => {
      await page.getByLabel("Template name").fill(`${RUN}-a`);
      check(await saveBtn().isEnabled(), "Save should be enabled after a change");
    }, { needs: ["aId"] });

    await step("renaming to a name that already exists fails cleanly", async () => {
      await page.getByLabel("Template name").fill(`${RUN} 2`);
      await saveBtn().click();
      await fab().locator(".fab__error").waitFor({ timeout: 10000 });
      check(await saveBtn().isEnabled(), "Save should stay enabled so the user can retry");
      const doc = await getDoc(ctx.aId);
      check(doc.name !== `${RUN} 2`, "the rename must not have been applied");
    }, { needs: ["aId"] });

    await step("renaming in the editor saves and persists", async () => {
      await page.getByLabel("Template name").fill(`${RUN}-a`);
      await save();
      same((await getDoc(ctx.aId)).name, `${RUN}-a`, "name in DB");
      await page.reload();
      await editor().waitFor();
      same(await page.getByLabel("Template name").inputValue(), `${RUN}-a`, "name after reload");
      ctx.aName = `${RUN}-a`;
    }, { needs: ["aId"] });

    await step("renaming from the list page (Edit dialog)", async () => {
      await goList();
      await listRow(ctx.aName).getByRole("button", { name: "Edit" }).click();
      const dlg = page.getByRole("dialog");
      await dlg.locator("input[name=name]").fill(`${RUN}-a-edited`);
      await dlg.getByRole("button", { name: "Save" }).click();
      await dlg.waitFor({ state: "detached" });
      await listRow(`${RUN}-a-edited`).waitFor();
      same((await getDoc(ctx.aId)).name, `${RUN}-a-edited`, "name in DB");
      ctx.aName = `${RUN}-a-edited`;
    }, { needs: ["aId"] });

    await step("list row shows the derived summary", async () => {
      const text = await listRow(ctx.aName).innerText();
      check(text.includes("2 sections · 3 subsections · 5 comments"), `row text: ${text.replace(/\n/g, " | ")}`);
    }, { needs: ["aId"] });

    await step("search filters the list", async () => {
      await page.getByPlaceholder("Search templates...").fill(`${RUN}-a-edited`);
      await listRow(ctx.aName).waitFor();
      check((await listRow(`${RUN} 2`).count()) === 0, "other templates should be filtered out");
      await page.getByPlaceholder("Search templates...").fill("");
    }, { needs: ["aId"] });

    // ── Duplicate ────────────────────────────────────────────────────────────────
    section("Duplicate");
    await step("duplicate creates “… (copy)” with the same content", async () => {
      await goList();
      await listRow(ctx.aName).getByRole("button", { name: "Duplicate" }).click();
      ctx.cName = `${ctx.aName} (copy)`;
      await listRow(ctx.cName).waitFor({ timeout: 15000 });
      const list = (await api("/api/templates")).body;
      ctx.cId = list.find((t) => t.name === ctx.cName)?.id;
      check(ctx.cId, "duplicate is not in the API list");
      created.add(ctx.cId);
      const a = await getDoc(ctx.aId), c = await getDoc(ctx.cId);
      same(shape(c), shape(a), "duplicate content (incl. icons and extra fields)");
      same(c.iconsResolved, a.iconsResolved, "iconsResolved carried over");
      check(!allIds(c).some((i) => allIds(a).includes(i)), "duplicate must have brand-new ids");
    }, { needs: ["aId"] });

    await step("original is untouched by duplicating", async () => {
      same((await getDoc(ctx.aId)).content, "2 sections · 3 subsections · 5 comments", "original summary");
    }, { needs: ["aId", "cId"] });

    await step("open the duplicate from the list", async () => {
      await listRow(ctx.cName).getByRole("link", { name: "Open" }).click();
      await page.waitForURL(`**/templates/${ctx.cId}`);
      await editor().waitFor();
      await page.getByRole("heading", { name: "Overview" }).waitFor();
      same(await page.getByLabel("Template name").inputValue(), ctx.cName, "editor title");
      // Icons were copied, so there should have been no "Setting up…" phase; sections just render.
      await sectionRow("Roof").waitFor();
    }, { needs: ["cId"] });

    // ── Editing structure ──────────────────────────────────────────────────────────
    section("Editing the duplicate: sections, subsections, comments");
    await step("select a section shows its subsections", async () => {
      await sectionRow("Roof").getByRole("button", { name: "Roof", exact: true }).click();
      await page.getByRole("heading", { name: "Roof" }).waitFor();
      const items = await page.locator(".summary li").allInnerTexts();
      check(items.length === 2 && /Shingles/.test(items[0]) && /Flashing/.test(items[1]), `subsections list: ${items}`);
    }, { needs: ["cId"] });

    await step("select a subsection shows its comments grouped by type", async () => {
      await subRow("Shingles").getByRole("button", { name: "Shingles", exact: true }).click();
      await card("Curling").waitFor();
      await card("Age of roof").waitFor();
      check((await page.locator(".group--defect .comment").count()) === 1, "one defect");
      check((await page.locator(".group--info .comment").count()) === 1, "one info");
    }, { needs: ["cId"] });

    await step("rename a section in the tree (double-click)", async () => {
      await sectionRow("Roof").getByRole("button", { name: "Roof", exact: true }).dblclick();
      await page.locator(".tree__rename").fill("Roof & Gutters");
      await page.keyboard.press("Enter");
      await sectionRow("Roof & Gutters").waitFor();
      check(await saveBtn().isEnabled(), "Save should enable after a rename");
    }, { needs: ["cId"] });

    await step("add a section, a subsection and a comment", async () => {
      await page.getByRole("button", { name: "Add section" }).click();
      await page.locator(".tree__rename").fill("Plumbing");
      await page.keyboard.press("Enter");
      await sectionRow("Plumbing").waitFor();
      await page.locator(".tree__children").last().getByRole("button", { name: "Add subsection" }).click();
      await page.locator(".tree__rename").fill("Pipes");
      await page.keyboard.press("Enter");
      await subRow("Pipes").waitFor();
      await addComment("defect", { name: "Leaking joint", text: "Water under the sink", category: "High" });
      await card("Leaking joint").waitFor();
    }, { needs: ["cId"] });

    await step("Save persists structure changes (API)", async () => {
      await save();
      const doc = await getDoc(ctx.cId);
      same(doc.tree.map((s) => s.name), ["Roof & Gutters", "Heating", "Plumbing"], "section names/order");
      const pipes = subOf(doc, "Plumbing", "Pipes");
      check(pipes, "Pipes subsection missing");
      same(pipes.comments.length, 1, "Pipes comments");
      const c = pipes.comments[0];
      check(c.name === "Leaking joint" && c.type === "defect" && c.category === "1" && c.text.includes("Water under the sink"),
        `comment saved wrong: ${JSON.stringify(c)}`);
      check(allIds(doc).every((i) => UUID.test(i)), "new rows should have database uuids");
    }, { needs: ["cId"] });

    await step("editing again after the first save does not duplicate rows (id swap)", async () => {
      await page.getByRole("button", { name: "Edit subsection title" }).click();
      await page.getByLabel("subsection title").fill("Pipes & Fittings");
      await page.keyboard.press("Enter");
      await card("Leaking joint").waitFor(); // the panel must still show the saved comment
      await save();
      const doc = await getDoc(ctx.cId);
      const plumbing = sectionOf(doc, "Plumbing");
      same(plumbing.subsections.map((s) => s.name), ["Pipes & Fittings"], "only the renamed subsection exists");
      same(plumbing.subsections[0].comments.length, 1, "no duplicated comment");
      same(doc.tree.length, 3, "no duplicated sections");
    }, { needs: ["cId"] });

    await step("edit a comment (name and type) via the dialog", async () => {
      await card("Leaking joint").locator(".comment__title").click();
      const dlg = page.getByRole("dialog");
      await dlg.getByLabel("Name", { exact: true }).fill("Leaking joint (edited)");
      await dlg.getByRole("radio", { name: "Limitation" }).click();
      check(await dlg.getByRole("button", { name: "Reset" }).isEnabled(), "Reset should be enabled once changed");
      await dlg.getByRole("button", { name: "Done" }).click();
      await dlg.waitFor({ state: "detached" });
      await page.locator(".group--limit").locator(".comment", { hasText: "Leaking joint (edited)" }).waitFor();
      await save();
      const c = subOf(await getDoc(ctx.cId), "Plumbing", "Pipes & Fittings").comments[0];
      same([c.name, c.type], ["Leaking joint (edited)", "limit"], "edited comment in DB");
    }, { needs: ["cId"] });

    await step("closing the dialog with changes asks before discarding", async () => {
      await card("Leaking joint (edited)").locator(".comment__title").click();
      const dlg = page.getByRole("dialog");
      await dlg.getByLabel("Name", { exact: true }).fill("SHOULD NOT SAVE");
      dialogs.length = 0;
      await dlg.getByRole("button", { name: "Close" }).click(); // dialog handler accepts the confirm
      await dlg.waitFor({ state: "detached" });
      check(dialogs.some((m) => m.includes("Discard your changes")), "expected a discard confirmation");
      await card("Leaking joint (edited)").waitFor();
      check(await saveBtn().isDisabled(), "discarded edit must not dirty the template");
    }, { needs: ["cId"] });

    await step("duplicate a comment", async () => {
      await card("Leaking joint (edited)").getByRole("button", { name: "Duplicate comment" }).click();
      await card("Leaking joint (edited) (copy)").waitFor();
      await save();
      same(subOf(await getDoc(ctx.cId), "Plumbing", "Pipes & Fittings").comments.length, 2, "comments after duplicate");
    }, { needs: ["cId"] });

    await step("delete a comment", async () => {
      await card("(copy)").getByRole("button", { name: "Delete comment" }).click(); // confirm auto-accepted
      await page.locator(".comment").filter({ hasText: "(copy)" }).waitFor({ state: "detached" });
      await save();
      const comments = subOf(await getDoc(ctx.cId), "Plumbing", "Pipes & Fittings").comments;
      same(comments.map((c) => c.name), ["Leaking joint (edited)"], "remaining comments");
    }, { needs: ["cId"] });

    // ── Hide / unhide ───────────────────────────────────────────────────────────────
    section("Hide / unhide");
    await step("hide a comment → saved as hidden, survives reload", async () => {
      await card("Leaking joint (edited)").getByRole("button", { name: "Hide comment" }).click();
      check(await card("Leaking joint (edited)").evaluate((el) => el.classList.contains("is-hidden")), "card should be dimmed");
      check(await saveBtn().isEnabled(), "hiding should enable Save");
      await save();
      const c = subOf(await getDoc(ctx.cId), "Plumbing", "Pipes & Fittings").comments[0];
      same(c.hidden, true, "comment.hidden in DB");
      await page.reload(); await editor().waitFor();
      await sectionRow("Plumbing").getByRole("button", { name: "Plumbing", exact: true }).click();
      await subRow("Pipes & Fittings").getByRole("button", { name: "Pipes & Fittings", exact: true }).click();
      await card("Leaking joint (edited)").getByRole("button", { name: "Show comment" }).waitFor();
    }, { needs: ["cId"] });

    await step("unhide a comment → hidden=false in DB", async () => {
      await card("Leaking joint (edited)").getByRole("button", { name: "Show comment" }).click();
      await save();
      const c = subOf(await getDoc(ctx.cId), "Plumbing", "Pipes & Fittings").comments[0];
      check(!c.hidden, `comment.hidden should be false, got ${c.hidden}`);
    }, { needs: ["cId"] });

    await step("hide a subsection → saved, dimmed in the tree", async () => {
      await page.getByRole("button", { name: "Hide Pipes & Fittings", exact: true }).click();
      check(await subRow("Pipes & Fittings").evaluate((el) => el.classList.contains("is-hidden")), "row should be dimmed");
      await save();
      same(subOf(await getDoc(ctx.cId), "Plumbing", "Pipes & Fittings").hidden, true, "subsection.hidden in DB");
    }, { needs: ["cId"] });

    await step("hide a section → saved, its subsections dim too", async () => {
      await page.getByRole("button", { name: "Hide Plumbing", exact: true }).click();
      check(await subRow("Pipes & Fittings").evaluate((el) => el.classList.contains("is-hidden")), "child row should be dimmed");
      await save();
      same(sectionOf(await getDoc(ctx.cId), "Plumbing").hidden, true, "section.hidden in DB");
      await page.reload(); await editor().waitFor();
      await page.getByRole("button", { name: "Show Plumbing", exact: true }).waitFor();
    }, { needs: ["cId"] });

    await step("unhide section and subsection → hidden=false in DB", async () => {
      await page.getByRole("button", { name: "Show Plumbing", exact: true }).click();
      // After the reload the section is collapsed; opening it reveals its subsections.
      await sectionRow("Plumbing").getByRole("button", { name: "Plumbing", exact: true }).click();
      await page.getByRole("button", { name: "Show Pipes & Fittings", exact: true }).click();
      await save();
      const doc = await getDoc(ctx.cId);
      check(!sectionOf(doc, "Plumbing").hidden, `section.hidden = ${sectionOf(doc, "Plumbing").hidden}`);
      check(!subOf(doc, "Plumbing", "Pipes & Fittings").hidden, "subsection.hidden should be false");
    }, { needs: ["cId"] });

    // ── Overview search ──────────────────────────────────────────────────────────────
    section("Overview");
    await step("search comments from the overview", async () => {
      await page.getByRole("button", { name: "Overview" }).click();
      const search = page.getByLabel("Search comments");
      await search.fill("furnace");
      await eventually(async () => (await page.locator(".jump li").count()) === 2, "expected 2 furnace matches");
      await search.fill("zzz-no-match");
      await page.getByText("No comments match").waitFor();
      await search.fill("");
    }, { needs: ["cId"] });

    await step("clicking a search result opens that comment", async () => {
      await page.locator(".jump li").filter({ hasText: "Loose flashing" }).click();
      await page.getByRole("dialog").waitFor(); // focusId opens the comment dialog
      check((await page.getByRole("dialog").getByLabel("Name", { exact: true }).inputValue()) === "Loose flashing", "wrong comment opened");
      await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
    }, { needs: ["cId"] });

    // ── Reordering ───────────────────────────────────────────────────────────────────
    section("Reordering");
    await step("reorder sections with the keyboard (all collapsed), then save", async () => {
      await page.getByRole("button", { name: "Overview" }).click();
      const names = () => page.locator(".tree__row--section .tree__label").allInnerTexts();
      same(await names(), ["Roof & Gutters", "Heating", "Plumbing"], "initial order");
      const collapse = page.getByRole("button", { name: "Collapse all sections" });
      if (await collapse.count()) await collapse.click();
      await keyboardDrag(page.locator(".tree__row--section .grip").first(), "ArrowDown");
      await eventually(async () => (await names())[0] === "Heating", "first section should now be Heating");
      await save();
      same((await getDoc(ctx.cId)).tree.map((s) => s.name), ["Heating", "Roof & Gutters", "Plumbing"], "order in DB");
      await page.reload(); await editor().waitFor();
      same(await names(), ["Heating", "Roof & Gutters", "Plumbing"], "order after reload");
    }, { needs: ["cId"] });

    await step("reorder sections with the mouse while one is expanded, then save", async () => {
      const names = () => page.locator(".tree__row--section .tree__label").allInnerTexts();
      await sectionRow("Roof & Gutters").getByRole("button", { name: "Expand" }).click();
      await sectionRow("Roof & Gutters").getByRole("button", { name: "Roof & Gutters", exact: true }).waitFor();
      const grip = await sectionRow("Heating").locator(".grip").boundingBox();
      const target = await sectionRow("Plumbing").boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      await page.mouse.move(grip.x + 30, grip.y + 30, { steps: 5 });
      await page.mouse.move(target.x + 60, target.y + target.height / 2 + 10, { steps: 25 });
      await sleep(200);
      await page.mouse.up();
      await sleep(300);
      same(await names(), ["Roof & Gutters", "Plumbing", "Heating"], "order after dragging Heating onto Plumbing");
      await save();
      same((await getDoc(ctx.cId)).tree.map((s) => s.name), ["Roof & Gutters", "Plumbing", "Heating"], "order in DB");
    }, { needs: ["cId"] });

    await step("reorder comments within a group, then save", async () => {
      await sectionRow("Heating").getByRole("button", { name: "Heating", exact: true }).click();
      await subRow("Furnace").getByRole("button", { name: "Furnace", exact: true }).click();
      await addComment("info", { name: "Second info", text: "x" });
      const before = await page.locator(".group--info .comment__title strong").allInnerTexts();
      same(before, ["Furnace age", "Second info"], "info order before");
      const grip = page.locator(".group--info .grip").nth(1);
      await keyboardDrag(grip, "ArrowUp");
      await eventually(async () => (await page.locator(".group--info .comment__title strong").first().innerText()) === "Second info", "Second info should move first");
      await save();
      const c = subOf(await getDoc(ctx.cId), "Heating", "Furnace").comments.filter((x) => x.type === "info").map((x) => x.name);
      same(c, ["Second info", "Furnace age"], "order in DB");
    }, { needs: ["cId"] });

    // ── PDF export ───────────────────────────────────────────────────────────────────
    section("PDF export");
    await step("hidden items are left out of the print view", async () => {
      await page.getByRole("button", { name: "Hide Plumbing", exact: true }).click();
      await sectionRow("Heating").getByRole("button", { name: "Heating", exact: true }).click();
      await subRow("Furnace").getByRole("button", { name: "Furnace", exact: true }).click();
      await card("Second info").getByRole("button", { name: "Hide comment" }).click();
      const html = await page.locator(".print-doc").innerHTML();
      check(html.includes("Furnace age"), "visible comment should be in the print view");
      check(!html.includes("Second info"), "hidden comment must not be in the print view");
      check(!html.includes("Plumbing") && !html.includes("Leaking joint"), "hidden section must not be in the print view");
      check(html.includes("Roof &amp; Gutters"), "visible section should be in the print view");
    }, { needs: ["cId"] });

    await step("Export PDF triggers print with the template name as title", async () => {
      await page.evaluate(() => { window.__printed = 0; window.__title = ""; window.print = () => { window.__printed++; window.__title = document.title; }; });
      await fab().getByRole("button", { name: "Export PDF" }).click();
      same(await page.evaluate(() => window.__printed), 1, "window.print calls");
      same(await page.evaluate(() => window.__title), ctx.cName, "document.title while printing");
    }, { needs: ["cId"] });

    await step("print media hides the editor and shows the document", async () => {
      await page.emulateMedia({ media: "print" });
      check(await page.locator(".print-doc").isVisible(), ".print-doc should be visible in print");
      check(!(await editor().isVisible()), ".editor should be hidden in print");
      check(!(await fab().isVisible()), ".fab should be hidden in print");
      const pdf = await page.pdf({ format: "A4" });
      fs.writeFileSync(path.join(OUT, "export.pdf"), pdf);
      check(pdf.length > 2000, `generated PDF looks empty (${pdf.length} bytes)`);
      await page.emulateMedia({ media: "screen" });
    }, { needs: ["cId"] });

    await step("leaving with unsaved changes is blocked / warned", async () => {
      check(await saveBtn().isEnabled(), "there should be unsaved (hide) changes here");
      const prevented = await page.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      });
      check(prevented, "beforeunload should be cancelled while dirty");
    }, { needs: ["cId"] });

    // ── Deleting structure ───────────────────────────────────────────────────────────────
    section("Deleting");
    await step("delete a subsection and a section from the tree menu", async () => {
      await page.getByRole("button", { name: "Show Plumbing", exact: true }).click(); // unhide, back to a known state
      await sectionRow("Plumbing").getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: "Delete" }).click(); // confirm auto-accepted
      await sectionRow("Plumbing").waitFor({ state: "detached" });
      await save();
      const doc = await getDoc(ctx.cId);
      same(doc.tree.map((s) => s.name), ["Roof & Gutters", "Heating"], "sections after delete");
      const cs = doc.tree.flatMap((s) => s.subsections.flatMap((x) => x.comments)).map((c) => c.name);
      check(!cs.includes("Leaking joint (edited)"), "comments of a deleted section must be gone (cascade)");
    }, { needs: ["cId"] });

    await step("delete a subsection", async () => {
      await sectionRow("Roof & Gutters").getByRole("button", { name: "Roof & Gutters", exact: true }).click();
      await subRow("Flashing").hover();
      await subRow("Flashing").getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await subRow("Flashing").waitFor({ state: "detached" });
      await save();
      same(sectionOf(await getDoc(ctx.cId), "Roof & Gutters").subsections.map((s) => s.name), ["Shingles"], "subsections after delete");
    }, { needs: ["cId"] });

    // ── Robustness / API ─────────────────────────────────────────────────────────────────
    section("Not found and API validation");
    await step("unknown template id shows “doesn’t exist”", async () => {
      await page.goto(`${BASE}/templates/00000000-0000-4000-8000-000000000000`);
      await page.getByText("doesn’t exist").waitFor({ timeout: 15000 });
      await page.goto(`${BASE}/templates/not-a-uuid`);
      await page.getByText("doesn’t exist").waitFor({ timeout: 15000 });
    });

    await step("API rejects bad input", async () => {
      const noName = await api("/api/templates", json("POST", { tree: [] }));
      same(noName.status, 400, "POST without a name");
      const badTree = await api("/api/templates", json("POST", { name: `${RUN}-bad`, tree: "nope" }));
      same(badTree.status, 400, "POST with a non-array tree");
      const dupIds = await api("/api/templates", json("POST", { name: `${RUN}-dup`, tree: [{ id: "x", name: "A", subsections: [] }, { id: "x", name: "B", subsections: [] }] }));
      same(dupIds.status, 400, "POST with duplicate ids");
      same((await api("/api/templates?id=00000000-0000-4000-8000-000000000000", json("PUT", { name: "x" }))).status, 404, "PUT unknown id");
      same((await api("/api/templates?id=nope", { method: "DELETE" })).status, 404, "DELETE bad id");
      same((await api(`/api/templates?id=${ctx.cId ?? ctx.aId}`, json("PUT", { name: "  " }))).status, 400, "PUT blank name");
      same((await api(`/api/templates?id=${ctx.aId}`, json("PUT", { name: `${RUN} 2` }))).status, 409, "PUT duplicate name");
    }, { needs: ["aId"] });

    await step("API: names are unique case-insensitively", async () => {
      const r = await api("/api/templates", json("POST", { name: RUN.toUpperCase() + " 2", tree: [] }));
      same(r.status, 201, "POST");
      created.add(r.body.id);
      check(r.body.name !== RUN.toUpperCase() + " 2", `expected a suffixed name, got ${r.body.name}`);
    }, { needs: ["bId"] });

    await step("API: a client id from another template can’t steal its rows", async () => {
      const victim = await getDoc(ctx.bId);
      const victimComment = victim.tree[0].subsections[0].comments[0];
      const attacker = (await api("/api/templates", json("POST", { name: `${RUN}-attacker`, tree: [] }))).body;
      created.add(attacker.id);
      const tree = [{ id: "s1", name: "Mine", subsections: [{ id: "u1", name: "Mine", comments: [{ ...victimComment }] }] }];
      const put = await api(`/api/templates?id=${attacker.id}`, json("PUT", { tree }));
      same(put.status, 200, "PUT with a foreign comment id");
      const after = await getDoc(ctx.bId);
      same(after.tree[0].subsections[0].comments[0].id, victimComment.id, "victim's comment must still exist and stay in place");
      const mine = (await getDoc(attacker.id)).tree[0].subsections[0].comments[0];
      check(mine.id !== victimComment.id, "attacker's row must get a fresh id");
      check(put.body.idMap[victimComment.id] === mine.id, "idMap should map the foreign id to the new one");
    }, { needs: ["bId"] });

    // ── Delete from the UI ────────────────────────────────────────────────────────────────────
    section("Cleanup through the UI");
    await step("delete templates from the list", async () => {
      await goList();
      for (const id of [ctx.cId, ctx.bId, ctx.aId].filter(Boolean)) {
        const t = (await api("/api/templates")).body.find((x) => x.id === id);
        check(t, `template ${id} vanished before deleting`);
        await page.getByRole("button", { name: `Delete ${t.name}`, exact: true }).click();
        await eventually(async () => (await api(`/api/templates?id=${id}`)).status === 404, `template ${t.name} still exists after Delete`);
        created.delete(id);
      }
    }, { needs: ["aId"] });
  } finally {
    // Whatever failed above, don't leave test data behind.
    if (!KEEP) {
      for (const id of created) await api(`/api/templates?id=${id}`, { method: "DELETE" }).catch(() => {});
      const leftovers = ((await api("/api/templates")).body ?? []).filter((t) => t.name.startsWith(RUN) || t.name.startsWith(RUN.toUpperCase()));
      for (const t of leftovers) await api(`/api/templates?id=${t.id}`, { method: "DELETE" }).catch(() => {});
    }
    await browser.close();
  }

  // ── Summary ───────────────────────────────────────────────────────────────────────────
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail");
  const skip = results.filter((r) => r.status === "skip").length;
  log(`\n${"─".repeat(60)}`);
  log(`${green(bold(`${pass} passed`))}, ${fail.length ? red(bold(`${fail.length} failed`)) : `${fail.length} failed`}, ${skip ? yellow(`${skip} skipped`) : `${skip} skipped`}   (${results.length} steps)`);
  if (fail.length) {
    log(red("\nFailed:"));
    for (const f of fail) log(red(`  ✗ ${f.name}\n      ${String(f.error).split("\n")[0]}`));
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ run: RUN, base: BASE, results }, null, 2));
  log(`\nLog: ${path.relative(process.cwd(), logFile)}`);
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => { log(`\nFatal: ${e.stack ?? e}`); process.exit(2); });
