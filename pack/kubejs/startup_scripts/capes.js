// LemurSaucePacket capes as items: one per cape in config/lemursaucepacket/capes.json (capes/build.mjs writes it from
// capes/capes.mjs). They're worn in the Curios "cape" slot; lsp_fixes (its capes package) decides who may wear which,
// gives the perks, draws them on players and armor stands, and runs the collection screen. The icons are
// textures/item/<id>.png (art/process.mjs, step capeItems). (Rhino: top-level const only.)

const CAPE_ITEMS = JsonIO.read('config/lemursaucepacket/capes.json').capes
const CAPE_RARITY = { skill: 'rare', quest: 'uncommon', achievement: 'uncommon', legendary: 'epic', owner: 'epic' }

StartupEvents.registry('item', (event) => {
  Object.keys(CAPE_ITEMS).forEach((id) => {
    let cape = CAPE_ITEMS[id]
    event
      .create(`lemursaucepacket:${id}`)
      .displayName(cape.name)
      .rarity(CAPE_RARITY[cape.kind] || 'common')
      .unstackable()
      .fireResistant()
  })
})
