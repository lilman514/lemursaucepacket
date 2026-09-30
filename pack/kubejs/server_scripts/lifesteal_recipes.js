// LemurSaucePacket hearts, graves and elimination (docs/lifesteal.md): how the items are made and found.
// Grave Essence is Brass-age (a heated mixer), the compasses need mechanical crafters, and a new Heart is a
// sequenced assembly on a Heart of the Sea: buried treasure only, so it can never be automated end to end.

ServerEvents.recipes((event) => {
  // Grave Essence: soul sand + bone block + 2 experience nuggets, mixed over a blaze burner, make 2.
  event.recipes.create
    .mixing(['2x lemursaucepacket:grave_essence'], ['minecraft:soul_sand', 'minecraft:bone_block', '2x create:experience_nugget'])
    .heated()
    .id('lemursaucepacket:lifesteal/grave_essence')

  // A new Heart. The Heart of the Sea is the bottleneck (one per buried treasure, no farm); the Nether Star
  // and the Totem are the boss and raid gates; liquid experience is Create Enchantment Industry.
  event.recipes.create
    .sequenced_assembly(['lemursaucepacket:heart'], 'minecraft:heart_of_the_sea', [
      event.recipes.create.deploying('lemursaucepacket:incomplete_heart', ['lemursaucepacket:incomplete_heart', 'lemursaucepacket:compacted_diamond']),
      event.recipes.create.deploying('lemursaucepacket:incomplete_heart', ['lemursaucepacket:incomplete_heart', 'minecraft:nether_star']),
      event.recipes.create.filling('lemursaucepacket:incomplete_heart', ['lemursaucepacket:incomplete_heart', Fluid.of('create_enchantment_industry:experience', 1000)]),
      event.recipes.create.deploying('lemursaucepacket:incomplete_heart', ['lemursaucepacket:incomplete_heart', 'minecraft:totem_of_undying']),
      event.recipes.create.pressing('lemursaucepacket:incomplete_heart', 'lemursaucepacket:incomplete_heart')
    ])
    .transitionalItem('lemursaucepacket:incomplete_heart')
    .loops(1)
    .id('lemursaucepacket:lifesteal/heart')

  // Lost Item Compass: a compass, 3 ender pearls, 4 polished rose quartz and a brass sheet.
  event.recipes.create
    .mechanical_crafting('lemursaucepacket:lost_item_compass', ['RER', 'ECE', 'RBR'], {
      R: 'create:polished_rose_quartz',
      E: 'minecraft:ender_pearl',
      C: 'minecraft:compass',
      B: 'create:brass_sheet'
    })
    .id('lemursaucepacket:lifesteal/lost_item_compass')

  // Seeker's Compass: a Lost Item Compass, a sculk sensor (finds players), 2 comparators (read containers)
  // and a precision mechanism.
  event.recipes.create
    .mechanical_crafting('lemursaucepacket:seekers_compass', [' S ', 'CLC', ' P '], {
      S: 'minecraft:sculk_sensor',
      C: 'minecraft:comparator',
      L: 'lemursaucepacket:lost_item_compass',
      P: 'create:precision_mechanism'
    })
    .id('lemursaucepacket:lifesteal/seekers_compass')
})

// A few Grave Essence turn up in dungeon loot before the recipe is reachable.
LootJS.modifiers((event) => {
  event.addTableModifier(/^dungeons_arise:chests\/.*/).randomChance(0.1).addLoot(Item.of('lemursaucepacket:grave_essence', 2))
  event.addTableModifier(/^minecraft:chests\/(simple_dungeon|stronghold_corridor|stronghold_crossing|abandoned_mineshaft)$/).randomChance(0.1).addLoot(Item.of('lemursaucepacket:grave_essence', 1))
  event.addTableModifier(/^minecraft:chests\/ancient_city$/).randomChance(0.25).addLoot(Item.of('lemursaucepacket:grave_essence', 2))
})
