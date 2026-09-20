import {
  IconAlarm, IconAirConditioning, IconBath, IconBed, IconBolt, IconBuildingCottage,
  IconBuildingEstate, IconBuildingWarehouse, IconBug, IconCar, IconChefHat, IconCloudRain,
  IconDoor, IconDroplets, IconFence, IconFireExtinguisher, IconFlame, IconFridge, IconHammer,
  IconHome, IconLadder, IconLamp, IconLayersSubtract, IconLeaf, IconMicrowave, IconMountain,
  IconPaint, IconPipeline, IconPlug, IconPool, IconRoad, IconRuler, IconShieldCheck, IconSnowflake,
  IconAngle, IconBook2, IconCertificate, IconHomeCheck, IconIdBadge2, IconInfoCircle,
  IconLayersLinked, IconLayoutGrid, IconMapPin, IconNotes, IconPolygon, IconRosetteDiscountCheck,
  IconShieldLock, IconSofa, IconStack2, IconTable, IconUmbrella,
  IconStairs, IconSun, IconTemperature, IconToiletPaper, IconTool,
  IconTrash, IconTree, IconWall, IconWashMachine, IconWind, IconWindow, type Icon,
} from "@tabler/icons-react";

// The code half of the icon system: stable key → component. The keys are what get stored
// (in the icons "collection", on sections, and offered to the LLM), so never rename one;
// add new entries freely. Anything without an entry renders the placeholder.
export const ICONS: Record<string, Icon> = {
  home: IconHome,
  exterior: IconBuildingEstate,
  roof: IconBuildingCottage,
  interior: IconSofa,
  foundation: IconMountain,
  structure: IconStack2,
  basement: IconBuildingWarehouse,
  attic: IconBuildingCottage,
  heating: IconFlame,
  cooling: IconSnowflake,
  hvac: IconAirConditioning,
  ventilation: IconWind,
  plumbing: IconPipeline,
  water: IconDroplets,
  electrical: IconBolt,
  outlet: IconPlug,
  lighting: IconLamp,
  door: IconDoor,
  window: IconWindow,
  stairs: IconStairs,
  garage: IconCar,
  kitchen: IconChefHat,
  bathroom: IconBath,
  bedroom: IconBed,
  laundry: IconWashMachine,
  appliance: IconMicrowave,
  refrigerator: IconFridge,
  fireplace: IconFlame,
  fire_safety: IconFireExtinguisher,
  smoke_detector: IconAlarm,
  wall: IconWall,
  floor: IconRuler,
  ceiling: IconStack2,
  paint: IconPaint,
  fence: IconFence,
  landscaping: IconTree,
  vegetation: IconLeaf,
  driveway: IconRoad,
  drainage: IconCloudRain,
  pool: IconPool,
  pest: IconBug,
  insulation: IconTemperature,
  sun: IconSun,
  repair: IconHammer,
  tools: IconTool,
  ladder: IconLadder,
  safety: IconShieldCheck,
  waste: IconTrash,
  bathroom_fixture: IconToiletPaper,

  // Roof / wind mitigation forms
  general_information: IconInfoCircle,
  building_code: IconBook2,
  region: IconMapPin,
  roof_slope: IconAngle,
  roof_coverings: IconLayoutGrid,
  product_approval: IconRosetteDiscountCheck,
  roof_deck_attachment: IconLayersLinked,
  roof_to_wall_attachment: IconLayersLinked,
  roof_geometry: IconPolygon,
  secondary_water_resistance: IconUmbrella,
  opening_protection_chart: IconTable,
  opening_protection: IconShieldLock,
  inspector_information: IconIdBadge2,
  inspector_certification: IconCertificate,
  homeowner: IconHomeCheck,
  additional_information: IconNotes,
};

/** Shown when a section has no icon, or its key isn't in ICONS. */
export const PLACEHOLDER_ICON: Icon = IconLayersSubtract;

export function SectionIcon({ icon, size = 18, className }: { icon?: string; size?: number; className?: string }) {
  const Component = (icon && ICONS[icon]) || PLACEHOLDER_ICON;
  return <Component size={size} className={className} />;
}
