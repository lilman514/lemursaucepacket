// LemurSaucePacket: where waystones come from, on the tooltip and as a JEI information page (like the gear
// line's "How to get"). The recipes themselves are in server_scripts/waystones.js.

const WAYSTONE_BLOCKS = ['waystone', 'mossy_waystone', 'sandy_waystone', 'deepslate_waystone', 'blackstone_waystone', 'end_stone_waystone', 'red_nether_bricks_waystone', 'purpur_waystone', 'prismarine_waystone', 'mud_bricks_waystone'].map((id) => `waystones:${id}`)

const WAYSTONE_HOW_TO_GET = 'found in villages, on towers and at shrines (mine it with a pickaxe to take it), or mechanical crafting.'
const WAYSTONE_INFO = [
  'Found in villages, on top of lone towers (Towers of the Wild, Structory), at Dungeons and Taverns shrines, and now and then alone in the wild.',
  'Mine one with a pickaxe to take it home. Silk Touch keeps its name and everyone\'s activation.',
  'Or build one on mechanical crafters. Any waystone plus 3 of a style\'s stone changes its style.'
]

ItemEvents.modifyTooltips((event) => {
  WAYSTONE_BLOCKS.forEach((id) => {
    event.modify(id, (tooltip) => tooltip.add(Text.of('§8§oHow to get: ' + WAYSTONE_HOW_TO_GET)))
  })
})

if (typeof RecipeViewerEvents !== 'undefined') {
  RecipeViewerEvents.addInformation('item', (event) => {
    WAYSTONE_BLOCKS.forEach((id) => {
      try {
        event.add(id, WAYSTONE_INFO)
      } catch (e) {
        console.error('[LemurSaucePacket] JEI info for ' + id + ': ' + e)
      }
    })
  })
}
