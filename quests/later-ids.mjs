// Ids of mods added after quests/.registry.json was dumped, read from their jars, so quests/build.mjs can
// validate quests and our worldgen tags that use them. A fresh dump (quests/registry-dump.js) makes these
// redundant; they stay harmless. The dump of 2026-09-29 (scratch server, pack 1.1.0 + Waystones) already
// covers everything below, plus Relics, When Dungeons Arise, Towers of the Wild and Lootr.

// Waystones 21.1.46 (items registered in net.blay09.mods.waystones.item.ModItems and block.ModBlocks).
const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
const WAYSTONE_STYLES = ['waystone', 'mossy_waystone', 'sandy_waystone', 'deepslate_waystone', 'blackstone_waystone', 'end_stone_waystone', 'red_nether_bricks_waystone', 'purpur_waystone', 'prismarine_waystone', 'mud_bricks_waystone']
export const WAYSTONES_ITEMS = [
  ...WAYSTONE_STYLES,
  ...COLORS.map((c) => `${c}_portstone`),
  ...COLORS.filter((c) => c !== 'white').map((c) => `${c}_sharestone`),
  'warp_plate',
  ...['warp_stone', 'warp_dust', 'warp_scroll', 'return_scroll', 'blank_scroll', 'bound_scroll', 'portal_scroll'],
  ...['dormant_shard', 'attuned_shard', 'crumbling_attuned_shard', 'deepslate_shard', 'twinbound_feather', 'epitaph']
].map((id) => `waystones:${id}`)

// The hearts system's own items (pack/kubejs/startup_scripts/lifesteal.js registers them; docs/lifesteal.md).
export const LIFESTEAL_ITEMS = ['heart', 'incomplete_heart', 'grave_essence', 'lost_item_compass', 'seekers_compass'].map((id) => `lemursaucepacket:${id}`)

// Block tags a quest may observe (FTB Quests observation task). The registry dump has no block tags.
export const BLOCK_TAGS = ['#waystones:waystones', '#waystones:sharestones', '#waystones:portstones']

// Regions Unexplored 0.6.2 biomes (data/regions_unexplored/worldgen/biome in the jar), used by the wild
// waystone tags in pack/kubejs/data/waystones.
export const REGIONS_UNEXPLORED_BIOMES = `alpha_grove ancient_delta arid_mountains ashen_woodland autumnal_maple_forest bamboo_forest
  baobab_savanna barley_fields bayou bioshroom_caves blackstone_basin blackwood_taiga boreal_taiga chalk_cliffs clover_plains
  cold_boreal_taiga cold_deciduous_forest cold_river deciduous_forest dry_bushland eucalyptus_forest fen flower_fields
  frozen_pine_taiga frozen_tundra fungal_fen glistering_meadow golden_boreal_taiga grassland grassy_beach gravel_beach
  highland_fields hyacinth_deeps icy_heights infernal_holt inferno joshua_desert magnolia_woodland maple_forest marsh
  mauve_hills mountains muddy_river mycotoxic_undergrowth old_growth_bayou old_growth_boreal_taiga old_growth_forest
  old_growth_golden_boreal_taiga orchard outback pine_slopes pine_taiga poppy_fields prairie prismachasm pumpkin_fields
  rainforest redstone_abyss redstone_caves redwoods rocky_meadow rocky_reef saguaro_desert scorching_caves shrubland
  silver_birch_forest sparse_rainforest sparse_redwoods spires steppe temperate_grove towering_cliffs tropical_river
  tropics tundra willow_forest windswept_maple_forest wisteria_grove`
  .split(/\s+/)
  .filter(Boolean)
  .map((b) => `regions_unexplored:${b}`)
