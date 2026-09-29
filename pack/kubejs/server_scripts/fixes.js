// LemurSaucePacket: recipes that ship broken in mod jars, restored the way their authors wrote them.
// Remove an entry once the mod fixes it upstream (the server log stops showing the parse error).

ServerEvents.recipes((event) => {
  // Piglin Proliferation 2.0.16 ships all ten fire-ring recipes as empty stubs, so fire rings (campfires
  // you can infuse with potion effects) cannot be crafted. Restored from the mod's 1.20.6 sources.
  ;[
    ['stone', 'minecraft:cobblestone'],
    ['blackstone', 'minecraft:blackstone'],
    ['deepslate', 'minecraft:cobbled_deepslate'],
    ['end_stone', 'minecraft:end_stone'],
    ['netherrack', 'minecraft:netherrack']
  ].forEach((pair) => {
    const name = pair[0]
    const block = pair[1]
    event.shaped(`piglinproliferation:${name}_fire_ring`, [' C ', 'BBB'], { C: '#minecraft:coals', B: block }).id(`piglinproliferation:${name}_fire_ring`)
    event
      .shaped(`piglinproliferation:${name}_soul_fire_ring`, [' C ', 'BBB'], { C: '#minecraft:soul_fire_base_blocks', B: block })
      .id(`piglinproliferation:${name}_soul_fire_ring`)
  })

  // Create Deco 2.1.3: "wash a coloured placard with white dye" uses an ingredient format 1.21 rejects.
  event.shapeless('create:placard', ['#createdeco:placards', 'minecraft:white_dye']).id('createdeco:placard')
})
