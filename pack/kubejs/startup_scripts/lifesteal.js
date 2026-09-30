// LemurSaucePacket hearts, graves and elimination (docs/lifesteal.md): the items. The rules live in
// server_scripts/lifesteal.js, the recipes in server_scripts/lifesteal_recipes.js, and the parts that need Java
// (grave veto, erasure, compass GUI and needle) in mods-src/lemursaucepacket-fixes.
//
// Textures: assets/lemursaucepacket/textures/item/, drawn by art/items.mjs in the Relics style. The compasses
// point with 32 needle frames of their own (<id>_00..31, recoloured from vanilla's compass_00..31; their item
// models are static files in assets/lemursaucepacket/models/item/). (Rhino: top-level const only.)

const LIFESTEAL_COMPASS_FRAME_MODEL = (id, frame) => `lemursaucepacket:item/${id}_${frame < 10 ? '0' + frame : frame}`

// Vanilla's compass model: frame 0 at 0, frame i from (i - 0.5) / 32, and back to frame 0 from 31.5 / 32. The
// "angle" property that drives it is registered for these two items by lsp_fixes on the client; without it the
// plain texture shows.
function lifestealCompassModel(id) {
  return (m) => {
    m.parent('minecraft:item/generated')
    m.texture('layer0', `lemursaucepacket:item/${id}`)
    m.override(LIFESTEAL_COMPASS_FRAME_MODEL(id, 0), (o) => o.predicate('angle', 0))
    for (let frame = 1; frame < 32; frame++) {
      m.override(LIFESTEAL_COMPASS_FRAME_MODEL(id, frame), (o) => o.predicate('angle', (frame - 0.5) / 32))
    }
    m.override(LIFESTEAL_COMPASS_FRAME_MODEL(id, 0), (o) => o.predicate('angle', 31.5 / 32))
  }
}

StartupEvents.registry('item', (event) => {
  // One heart of maximum health. Dropped on death, used by right-click (server_scripts/lifesteal.js). It never
  // despawns and only the void can destroy it; the server also marks dropped ones invulnerable.
  event
    .create('lemursaucepacket:heart')
    .displayName('Heart')
    .rarity('epic')
    .glow(true)
    .unstackable()
    .fireResistant()
    .getEntityLifespan(2147483647)
    .canBeHurtBy((stack, source) => {
      let type = String(source.getType())
      return type === 'outOfWorld' || type === 'genericKill'
    })
    .tooltip(Text.gray('Right-click to gain a heart.'))
    .tooltip(Text.gray('Dropped when a player dies. Anyone can use it.'))

  // The Heart recipe's half-made item (Create sequenced assembly, lifesteal_recipes.js).
  event
    .create('lemursaucepacket:incomplete_heart', 'create:sequenced_assembly')
    .displayName('Incomplete Heart')
    .rarity('rare')
    .unstackable()

  // One per grave. Without one in your inventory or backpack you drop your items like vanilla.
  event
    .create('lemursaucepacket:grave_essence')
    .displayName('Grave Essence')
    .rarity('uncommon')
    .maxStackSize(16)
    .tooltip(Text.gray('Used up when you die, so your items wait in a grave.'))
    .tooltip(Text.gray('Counts in your inventory, hotbar, off-hand or a backpack you carry.'))

  // Points at your own items lying on the ground (right-click: the list; lsp_fixes draws the GUI).
  event
    .create('lemursaucepacket:lost_item_compass')
    .displayName('Lost Item Compass')
    .rarity('uncommon')
    .unstackable()
    .modelGenerator(lifestealCompassModel('lost_item_compass'))
    .tooltip(Text.gray('Right-click: pick one of your dropped items to point at.'))

  // The same, plus a switch to also point at containers and players holding the item.
  event
    .create('lemursaucepacket:seekers_compass')
    .displayName("Seeker's Compass")
    .rarity('rare')
    .unstackable()
    .modelGenerator(lifestealCompassModel('seekers_compass'))
    .tooltip(Text.gray('Right-click: pick one of your items to point at.'))
    .tooltip(Text.gray('Can also follow it into chests and pockets. It never says which.'))
})
