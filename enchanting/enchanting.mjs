// LemurSaucePacket enchanting: the Enchanting skill's unlock table, the level-10 caps, the enchanting-table
// progression, and the pack's own enchantments (Telekinesis, Hardness). Edit this file, then run
// `node enchanting/build.mjs` (publish.mjs does). It is the single source for:
//   - the enchantment overrides (pack/kubejs/data/<ns>/enchantment/<id>.json): max levels and table costs;
//   - Telekinesis and Hardness (enchantment JSON, item tags, table/loot tags, the Hardness block tags);
//   - the Hardness tome recipes (pack/kubejs/server_scripts/enchanting_recipes.js);
//   - pack/config/lemursaucepacket/enchanting.json, which the scripts (startup_scripts/enchanting.js and
//     server_scripts/enchanting.js) and the tooltips read.
// The Enchanting skill itself (XP sources, colour, icon) is Project MMO config in skills/build.mjs.
//
// Rules, in one place:
//   allowed level = vanilla max + floor((cap - vanilla max) * Enchanting level / 99)     (every cap at 99)
//   You can't roll (table), make (anvil) or use an enchantment above your allowed level; loot chests and
//   villagers never go above the vanilla max, so the extra levels only come from the skill.
//   Table: the third slot costs vanilla + floor(vanilla * TABLE_BOOST * Enchanting / 99) levels (30 -> 150 at 99).
//   Hardness on a pickaxe works up to the tier your Mining level unlocks; machines get MACHINE_HARDNESS.

export const NAMESPACE = 'lemursaucepacket'

/** Enchanting-skill progression. */
export const TABLE_BOOST = 4 // third-slot cost multiplier at Enchanting 99 (x1 at 1 -> x5 at 99)
export const ENCHANT_XP = 250 // Project MMO ENCHANT xp per enchantable item (table: scaled by level/max per enchantment; anvil with a book: flat)
export const MAX_SKILL_LEVEL = 99

/**
 * Enchantments whose effect keeps growing past the vanilla max, and where that growth stops (`cap`).
 * `effect` is the per-level effect, for the tooltip and the wiki. Anything not listed keeps its vanilla max.
 * Single-level enchantments (Mending, Infinity, Silk Touch, curses...) are never touched.
 */
export const RAISED = {
  // damage
  'minecraft:sharpness': { cap: 10, effect: '+0.5 damage per level above I' },
  'minecraft:smite': { cap: 10, effect: '+2.5 damage per level to undead' },
  'minecraft:bane_of_arthropods': { cap: 10, effect: '+2.5 damage per level to arthropods' },
  'minecraft:impaling': { cap: 10, effect: '+2.5 damage per level to sea creatures' },
  'minecraft:power': { cap: 10, effect: '+0.5 arrow damage per level' },
  'minecraft:density': { cap: 10, effect: '+0.5 mace damage per block fallen, per level' },
  'minecraft:breach': { cap: 6, effect: '-15% armour effectiveness per level (armour is ignored at VI)' },
  'minecraft:wind_burst': { cap: 10, effect: 'stronger launch after each smash' },
  'minecraft:fire_aspect': { cap: 10, effect: 'burns 4 s per level' },
  'minecraft:knockback': { cap: 10, effect: '+1 knockback per level' },
  'minecraft:punch': { cap: 10, effect: '+1 arrow knockback per level' },
  'minecraft:sweeping_edge': { cap: 10, effect: 'sweep does level/(level+1) of the hit' },
  'minecraft:looting': { cap: 10, effect: 'more mob drops per level' },
  // tools
  'minecraft:efficiency': { cap: 10, effect: 'mining speed +level²+1' },
  'minecraft:unbreaking': { cap: 10, effect: 'tools last (level+1)x' },
  'minecraft:fortune': { cap: 10, effect: 'more ore per level (about 5.6x at X)' },
  'minecraft:luck_of_the_sea': { cap: 10, effect: '+1 fishing luck per level' },
  'minecraft:lure': { cap: 5, effect: 'fish bite 5 s sooner per level (VI would never bite)' },
  // armour
  'minecraft:protection': { cap: 10, effect: '+1 protection point per level (all protection together caps at 20 = 80%)' },
  'minecraft:fire_protection': { cap: 10, effect: '+2 fire protection per level, shorter burns' },
  'minecraft:blast_protection': { cap: 10, effect: '+2 blast protection per level' },
  'minecraft:projectile_protection': { cap: 10, effect: '+2 projectile protection per level' },
  'minecraft:feather_falling': { cap: 7, effect: '+3 fall protection per level (80% at VII)' },
  'minecraft:thorns': { cap: 7, effect: '15% per level to hurt attackers (always at VII)' },
  'minecraft:respiration': { cap: 10, effect: 'breath lasts (level+1)x' },
  'minecraft:soul_speed': { cap: 10, effect: 'faster on soul sand per level' },
  'minecraft:swift_sneak': { cap: 5, effect: '+15% sneak speed per level (full speed at V)' },
  'minecraft:frost_walker': { cap: 10, effect: 'freezes a wider circle per level' },
  // trident and crossbow
  'minecraft:loyalty': { cap: 10, effect: 'returns faster per level' },
  'minecraft:riptide': { cap: 10, effect: 'launches further per level' },
  'minecraft:piercing': { cap: 10, effect: 'passes through one more target per level' },
  'minecraft:quick_charge': { cap: 5, effect: '-0.25 s charge per level (instant at V)' },
  // modded
  'create:capacity': { cap: 10, effect: 'more backtank air per level' },
  'create:potato_recovery': { cap: 7, effect: '+12.5% ammo recovery per level (always at VII)' },
  'farmersdelight:backstabbing': { cap: 10, effect: 'backstabs deal +20% per level' },
  'create_ltab:enchantment_luck': { cap: 10, effect: '+1 luck per level' },
  'nova_structures:illagers_bane': { cap: 10, effect: '+2.5 damage per level to illagers' },
  'nova_structures:power': { cap: 10, effect: '+0.5 bolt damage per level' },
  'nova_structures:piercing': { cap: 10, effect: 'arrows pass through one more target per level' },
  'nova_structures:outreach': { cap: 10, effect: '+0.5 block reach per level' },
  'nova_structures:traveler': { cap: 10, effect: 'higher steps and faster sprints per level' },
  'dungeons_arise:purification': { cap: 10, effect: 'cleanses poison and wither sooner per level' },
  'dungeons_arise:discharge': { cap: 7, effect: 'charges speed faster per level' },
  'dungeons_arise:ensnaring': { cap: 5, effect: '+10% per level to root the target' }
}

/**
 * Enchantments left at their vanilla max but kept available at high table power: their vanilla cost window
 * closes above a few dozen levels, and a skilled enchanter's table runs far past that.
 */
export const KEEP_AVAILABLE = [
  'minecraft:aqua_affinity',
  'minecraft:channeling',
  'minecraft:depth_strider',
  'minecraft:flame',
  'minecraft:infinity',
  'minecraft:multishot',
  'minecraft:silk_touch',
  'piglinproliferation:bang',
  'piglinproliferation:turning'
]

/** Table cost policy for the enchantments above (see build.mjs costFor). */
export const COST = {
  aboveVanillaAt: 45, // level (vanilla max + 1) needs at least this much table power: out of a plain table's reach
  capAt: 140, // the cap should need no more than this: what the third slot reaches at Enchanting 99
  window: 100 // max_cost = min_cost + window, so an enchantment never vanishes from a powerful table
}

/** The pack's own enchantments. */
export const TELEKINESIS = {
  id: 'telekinesis',
  name: 'Telekinesis',
  description: 'Blocks you break and mobs you kill drop straight into your inventory (at your feet when it is full).',
  weight: 2,
  anvilCost: 4,
  minCost: 15,
  maxCost: 115,
  // Tools and melee weapons: vanilla's enchantable/mining (pickaxes, axes, shovels, hoes, shears) and
  // enchantable/weapon (swords, axes, mace). The pack's own tools and swords carry the vanilla tool tags.
  supportedTags: ['#minecraft:enchantable/mining', '#minecraft:enchantable/weapon'],
  // In minecraft:non_treasure: enchanting table, villagers, loot books, mob gear.
  tableAndLoot: true
}

export const HARDNESS = {
  id: 'hardness',
  name: 'Hardness',
  description: 'Lets a pickaxe break harder blocks. Each tier needs a Mining level to work.',
  maxLevel: 5,
  anvilCost: 4,
  supportedTags: ['#minecraft:pickaxes'],
  /** Mining level that unlocks each tier (index 1..5). */
  unlock: [0, 10, 20, 30, 40, 50],
  /** Blocks per tier: block ids and block tags (tags may be missing, they are optional entries). */
  tiers: {
    1: ['#c:ores/iron', '#c:ores/zinc', '#c:ores/lapis'],
    2: ['#c:ores/gold', '#c:ores/redstone'],
    // Obsidian sits with diamond: an enchanting table, an ender chest and Create's sturdy sheets all need it, so
    // tier IV would have pushed enchanting itself behind Mining 40.
    3: ['#c:ores/diamond', '#c:ores/emerald', 'minecraft:obsidian', 'minecraft:crying_obsidian'],
    4: ['#c:ores/netherite_scrap'],
    5: ['minecraft:reinforced_deepslate', 'minecraft:budding_amethyst']
  },
  /** Create drills, saws and deployers can break blocks up to this tier (an automation reward). */
  machineMax: 2,
  /**
   * What comes out of those blocks, as item ids and tags. A player who hasn't unlocked the tier can still get
   * these (loot chests, witches, another player's chest, TNT: the owner's call is that none of that matters) and
   * carry them, keep them in a chest or drop them, but recipes, machines and other containers refuse them until
   * the Mining level is there (the use-gate: lsp_fixes UseGateMixin for menus, server_scripts/enchanting.js for
   * right-clicking machines). Emeralds are money and stay free; ingots too, since loot, mobs and villagers hand
   * them out; only the raw ore, dust, gem or block that comes out of the ground is listed.
   */
  materials: {
    1: ['#c:raw_materials/iron', '#c:raw_materials/zinc', '#c:storage_blocks/raw_iron', '#c:storage_blocks/raw_zinc', '#c:ores/iron', '#c:ores/zinc', '#c:ores/lapis', 'minecraft:lapis_lazuli', 'minecraft:lapis_block'],
    2: ['#c:raw_materials/gold', '#c:storage_blocks/raw_gold', '#c:ores/gold', '#c:ores/redstone', 'minecraft:redstone', 'minecraft:redstone_block'],
    3: ['minecraft:diamond', 'minecraft:diamond_block', '#c:ores/diamond', 'minecraft:obsidian', 'minecraft:crying_obsidian'],
    4: ['minecraft:ancient_debris', '#c:ores/netherite_scrap'],
    5: ['minecraft:reinforced_deepslate', 'minecraft:budding_amethyst']
  },
  /** The menu half of the use-gate (class names, since the mod can't know every container). */
  useGate: {
    /** Menus that count as "a chest" besides vanilla's ChestMenu (chests, barrels, ender chests, minecarts) and ShulkerBoxMenu. */
    allowedMenus: [],
    /** Menus whose shift-click only moves items between the player's own slots, besides InventoryMenu and CraftingMenu. */
    inventoryMenus: ['top.theillusivec4.curios.common.inventory.container.CuriosContainer'],
    /** Items that are containers themselves (a gated item can't be clicked into them, nor they onto it). Missing ids are fine. */
    containerItems: ['sophisticatedbackpacks:backpack', 'sophisticatedbackpacks:copper_backpack', 'sophisticatedbackpacks:iron_backpack', 'sophisticatedbackpacks:gold_backpack', 'sophisticatedbackpacks:diamond_backpack', 'sophisticatedbackpacks:netherite_backpack', '#c:shulker_boxes', 'minecraft:bundle']
  },
  /**
   * Hardness tomes: enchanted books. Tier I is a plain crafting-table recipe from ungated materials (copper,
   * andesite, a book): iron is behind it, and every Create machine (even andesite alloy) needs iron or zinc, so
   * a mechanical recipe here would have been circular. The rest are mechanical crafting (Create-first, like
   * the gear), each using only materials from lower tiers; brass is post-Nether and not used.
   */
  recipes: {
    1: { type: 'crafting', pattern: ['ACA', 'CBC', 'ACA'], key: { A: 'minecraft:andesite', C: 'minecraft:copper_ingot', B: 'minecraft:book' } },
    2: { pattern: ['ILI', 'LBL', 'ILI'], key: { I: 'create:iron_sheet', L: 'minecraft:lapis_lazuli', B: 'minecraft:book' } },
    3: { pattern: ['GRG', 'RBR', 'GRG'], key: { G: 'create:golden_sheet', R: 'minecraft:redstone', B: 'minecraft:book' } },
    4: { pattern: ['DPD', 'SBS', 'DPD'], key: { D: 'minecraft:diamond', P: 'create:precision_mechanism', S: 'create:iron_sheet', B: 'minecraft:book' } },
    5: { pattern: ['SDS', 'DBD', 'SDS'], key: { S: 'create:sturdy_sheet', D: 'minecraft:diamond', B: 'minecraft:book' } }
  }
}

/** The use-gate penalty for wearing armour enchanted above your level (Project MMO style). */
export const PENALTY_EFFECTS = [
  { effect: 'minecraft:slowness', amplifier: 1 },
  { effect: 'minecraft:weakness', amplifier: 0 }
]

/** Allowed level of a raised enchantment at an Enchanting level. */
export function allowedLevel(vanillaMax, cap, skillLevel) {
  const level = Math.max(0, Math.min(MAX_SKILL_LEVEL, skillLevel))
  return vanillaMax + Math.floor(((cap - vanillaMax) * level) / MAX_SKILL_LEVEL)
}

/** Enchanting level at which a raised enchantment's level `wanted` becomes allowed (null if never). */
export function unlockLevel(vanillaMax, cap, wanted) {
  if (wanted <= vanillaMax) return 0
  if (wanted > cap) return null
  for (let skill = 1; skill <= MAX_SKILL_LEVEL; skill++) if (allowedLevel(vanillaMax, cap, skill) >= wanted) return skill
  return null
}
