import {
  IconArmchair, IconBath, IconBuildingCottage, IconBuildingEstate, IconBulb, IconDoor,
  IconDroplets, IconFence, IconFileText, IconFlame, IconHammer, IconKey, IconLadder,
  IconPaint, IconPipeline, IconPlug, IconSnowflake, IconSofa, IconStairs, IconToiletPaper,
  IconToolsKitchen, IconTree, IconWall, type Icon,
} from "@tabler/icons-react";

// Picks a property-related icon from keywords in the template name.
const rules: [RegExp, Icon][] = [
  [/plumb|pipe|leak|drain/i, IconPipeline],
  [/toilet|wc|restroom/i, IconToiletPaper],
  [/bath|shower/i, IconBath],
  [/roof|gutter|attic/i, IconBuildingCottage],
  [/exterior|facade|outside/i, IconBuildingEstate],
  [/interior|living|lounge/i, IconSofa],
  [/bed|room/i, IconArmchair],
  [/kitchen/i, IconToolsKitchen],
  [/garden|lawn|yard/i, IconTree],
  [/fence|boundary|gate/i, IconFence],
  [/wall|brick|plaster/i, IconWall],
  [/paint|decor/i, IconPaint],
  [/electric|wiring|plug|socket/i, IconPlug],
  [/light|lamp|bulb/i, IconBulb],
  [/heat|boiler|gas|fire/i, IconFlame],
  [/cool|air.?con|hvac|freez/i, IconSnowflake],
  [/water|damp|flood/i, IconDroplets],
  [/door|entry|window/i, IconDoor],
  [/stair|floor/i, IconStairs],
  [/ladder|scaffold/i, IconLadder],
  [/repair|maintenance|fix|tool/i, IconHammer],
  [/key|tenan|lease|rent|welcome/i, IconKey],
];

export function templateIcon(name: string): Icon {
  return rules.find(([re]) => re.test(name))?.[1] ?? IconFileText;
}
