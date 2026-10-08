// LemurSaucePacket: Create Ore Excavation veins give exploration a purpose (find a vein, build a
// drilling rig on it), but infinite diamonds, emeralds or netherite would flatten progression and the
// villager economy. Those four veins are removed; coal, copper, iron, gold, nether gold, zinc, lapis,
// redstone, quartz, glowstone and water remain.

ServerEvents.recipes((event) => {
  ;['diamond', 'hardened_diamond', 'emerald', 'netherite'].forEach((vein) => {
    event.remove({ id: `createoreexcavation:ore_vein_type/${vein}` })
    event.remove({ id: `createoreexcavation:drilling/${vein}` })
  })
  event.remove({ id: 'createoreexcavation:cutting/diamond_cutting' })
  event.remove({ id: 'createoreexcavation:cutting/emerald_cutting' })

  // The vein finder's own recipe wants an eye of ender (Brewing 55) and a redstone ore block (Silk Touch): far past
  // its Mining 35 gate (skills/modded.mjs) and the Prospector quest. A compass points the way just as well.
  event.remove({ id: 'createoreexcavation:vein_finder' })
  event
    .shaped('createoreexcavation:vein_finder', ['ca ', 'rs ', '  s'], {
      c: 'minecraft:compass',
      a: '#c:gems/amethyst',
      r: 'minecraft:redstone',
      s: '#c:rods/wooden'
    })
    .id('lemursaucepacket:vein_finder')
})
