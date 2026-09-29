// LemurSaucePacket: Sophisticated Backpacks, balanced around Create's ages.
//
// Each backpack tier is crafted from parts of the Create age you've reached, and the upgrade keeps
// everything inside (sophisticatedbackpacks:backpack_upgrade recipes copy the contents over).
//   Leather   default recipe (day one)
//   Copper    copper sheets + andesite alloy        (Andesite age: you have a press)
//   Iron      iron sheets + andesite casing         (Andesite age, later)
//   Gold      golden sheets + brass casing          (Brass age)
//   Diamond   diamonds + precision mechanisms       (Brass age, late)
//   Netherite default smithing recipe
// Slot counts, the one-stack-upgrade cap and disabled upgrades live in config/sophisticated*.toml.

ServerEvents.recipes((event) => {
  const SB = 'sophisticatedbackpacks'

  // One upgrade path per tier, always from the tier below.
  ;['copper_backpack', 'iron_backpack', 'iron_backpack_from_copper', 'gold_backpack', 'diamond_backpack'].forEach((id) =>
    event.remove({ id: `${SB}:${id}` })
  )

  const tier = (result, from, pattern, key) =>
    event
      .custom({
        type: `${SB}:backpack_upgrade`,
        category: 'misc',
        pattern: pattern,
        key: Object.assign({ B: { item: `${SB}:${from}` } }, key),
        result: { id: `${SB}:${result}`, count: 1 }
      })
      .id(`lemursaucepacket:backpacks/${result}`)

  tier('copper_backpack', 'backpack', ['CAC', 'CBC', 'CAC'], {
    C: { item: 'create:copper_sheet' },
    A: { item: 'create:andesite_alloy' }
  })
  tier('iron_backpack', 'copper_backpack', ['IKI', 'IBI', 'IKI'], {
    I: { item: 'create:iron_sheet' },
    K: { item: 'create:andesite_casing' }
  })
  tier('gold_backpack', 'iron_backpack', ['GRG', 'GBG', 'GRG'], {
    G: { item: 'create:golden_sheet' },
    R: { item: 'create:brass_casing' }
  })
  tier('diamond_backpack', 'gold_backpack', ['DPD', 'DBD', 'DPD'], {
    D: { tag: 'c:gems/diamond' },
    P: { item: 'create:precision_mechanism' }
  })

  // Stack upgrades stop at tier 2 (4x). Tier 2 now needs brass, so it arrives with the Brass age.
  event.remove({ id: `${SB}:stack_upgrade_tier_2` })
  event
    .shaped(`${SB}:stack_upgrade_tier_2`, ['GRG', 'RSR', 'GRG'], {
      G: '#c:storage_blocks/gold',
      R: 'create:brass_casing',
      S: `${SB}:stack_upgrade_tier_1`
    })
    .id('lemursaucepacket:backpacks/stack_upgrade_tier_2')
})
