-- Run once in the Supabase SQL editor (Dashboard → SQL Editor).

-- The vocabulary the LLM may choose from. Keys must match the ICONS map in lib/sectionIcons.tsx.
create table if not exists public.icons (
  key text primary key
);

-- Cache of section name (lowercased, whitespace-collapsed) -> icon key.
create table if not exists public.section_icons (
  name text primary key,
  icon_key text not null references public.icons (key)
);

alter table public.icons enable row level security;
alter table public.section_icons enable row level security;

-- The app uses the publishable (anon) key, so these policies decide what anyone can do.
-- Icons: read-only. Section icons: readable and append-only (no update / delete).
drop policy if exists "icons are readable" on public.icons;
create policy "icons are readable" on public.icons for select using (true);
drop policy if exists "section_icons are readable" on public.section_icons;
create policy "section_icons are readable" on public.section_icons for select using (true);
drop policy if exists "section_icons can be added" on public.section_icons;
create policy "section_icons can be added" on public.section_icons for insert with check (true);

insert into public.icons (key) values
  ('home'),
  ('exterior'),
  ('roof'),
  ('interior'),
  ('foundation'),
  ('structure'),
  ('basement'),
  ('attic'),
  ('heating'),
  ('cooling'),
  ('hvac'),
  ('ventilation'),
  ('plumbing'),
  ('water'),
  ('electrical'),
  ('outlet'),
  ('lighting'),
  ('door'),
  ('window'),
  ('stairs'),
  ('garage'),
  ('kitchen'),
  ('bathroom'),
  ('bedroom'),
  ('laundry'),
  ('appliance'),
  ('refrigerator'),
  ('fireplace'),
  ('fire_safety'),
  ('smoke_detector'),
  ('wall'),
  ('floor'),
  ('ceiling'),
  ('paint'),
  ('fence'),
  ('landscaping'),
  ('vegetation'),
  ('driveway'),
  ('drainage'),
  ('pool'),
  ('pest'),
  ('insulation'),
  ('sun'),
  ('repair'),
  ('tools'),
  ('ladder'),
  ('safety'),
  ('waste'),
  ('bathroom_fixture'),
  ('general_information'),
  ('building_code'),
  ('region'),
  ('roof_slope'),
  ('roof_coverings'),
  ('product_approval'),
  ('roof_deck_attachment'),
  ('roof_to_wall_attachment'),
  ('roof_geometry'),
  ('secondary_water_resistance'),
  ('opening_protection_chart'),
  ('opening_protection'),
  ('inspector_information'),
  ('inspector_certification'),
  ('homeowner'),
  ('additional_information')
on conflict (key) do nothing;

-- Make the API pick up the new tables immediately.
notify pgrst, 'reload schema';
