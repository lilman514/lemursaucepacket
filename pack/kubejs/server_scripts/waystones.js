// LemurSaucePacket: Waystones, made with Create.
//
// Waystones you find in the world (villages, Structory and Towers of the Wild towers, Dungeons and Taverns
// shrines, and the odd one standing alone) can be mined with a pickaxe and taken home: the mod only protects
// generated waystones when the Unbreakables mod is installed, and it isn't. Building one yourself is the
// expensive route, so every default recipe is replaced:
//
//   Warp dust        ender pearl + amethyst, mixed over a blaze burner (the Brass age gate for everything below)
//   Scrolls, feather, epitaph, shards   crafting table or basin + press: cheap enough to use
//   Warp stone       mechanical crafting: a precision mechanism in amethyst and warp dust
//   Waystone         mechanical crafting: a warp stone, a second precision mechanism, a brass casing, sturdy
//                    sheets and an eye of ender. Ten styles, same recipe with that style's stone.
//   Sharestones, portstones, warp plate   mechanical crafting around a warp stone or a dormant shard
//   Restyling        any waystone + 3 of a style's stone on a crafting table (a found sandy waystone can
//                    become a mossy one for your base)
//
// Teleport costs and wild-waystone spacing are the mod's defaults (config/waystones-common.toml is generated);
// kubejs/data/waystones/tags/worldgen/biome puts wild waystones in Terralith and Regions Unexplored biomes too.

const WS = 'waystones'
const WS_ID = (path) => `lemursaucepacket:waystones/${path}`

// Style -> the stone it's built from (the mod's own choices, so the look matches the block).
const WAYSTONE_STYLES = {
  waystone: 'minecraft:stone_bricks',
  mossy_waystone: 'minecraft:mossy_stone_bricks',
  sandy_waystone: 'minecraft:chiseled_sandstone',
  deepslate_waystone: 'minecraft:deepslate',
  blackstone_waystone: 'minecraft:blackstone',
  end_stone_waystone: 'minecraft:end_stone_bricks',
  red_nether_bricks_waystone: 'minecraft:red_nether_bricks',
  purpur_waystone: 'minecraft:purpur_block',
  prismarine_waystone: 'minecraft:prismarine',
  mud_bricks_waystone: 'minecraft:mud_bricks'
}

const DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']

ServerEvents.recipes((event) => {
  // Every recipe the mod ships (54 in 21.1.46), including any a later version adds, so nothing cheap
  // slips back in with an update. Items a future version adds would then show up in JEI with no recipe.
  let removed = event.countRecipes({ mod: WS })
  event.remove({ mod: WS })

  let NUGGET = 'create:brass_nugget'
  let DUST = `${WS}:warp_dust`

  // ---- materials
  event.recipes.create.mixing([`4x ${DUST}`], ['minecraft:ender_pearl', 'minecraft:amethyst_shard']).heated().id(WS_ID('warp_dust'))
  event.recipes.create.compacting(`${WS}:dormant_shard`, [`2x ${DUST}`, 'minecraft:flint']).id(WS_ID('dormant_shard'))
  event.recipes.create.compacting(`${WS}:deepslate_shard`, ['minecraft:cobbled_deepslate', 'minecraft:flint']).id(WS_ID('deepslate_shard'))

  // ---- consumables: cheap enough to use
  event.shaped(`3x ${WS}:blank_scroll`, ['NFN', 'PPP'], { N: NUGGET, F: 'minecraft:feather', P: 'minecraft:paper' }).id(WS_ID('blank_scroll'))
  event.shaped(`3x ${WS}:return_scroll`, ['NDN', 'PPP'], { N: NUGGET, D: DUST, P: 'minecraft:paper' }).id(WS_ID('return_scroll'))
  event.shaped(`3x ${WS}:warp_scroll`, ['NDN', 'DID', 'PPP'], { N: NUGGET, D: DUST, I: 'minecraft:ink_sac', P: 'minecraft:paper' }).id(WS_ID('warp_scroll'))
  event
    .shaped(`3x ${WS}:portal_scroll`, ['DED', 'AIA', 'PPP'], { D: DUST, E: 'minecraft:ender_eye', A: 'minecraft:amethyst_shard', I: 'minecraft:ink_sac', P: 'minecraft:paper' })
    .id(WS_ID('portal_scroll'))
  event.shapeless(`${WS}:twinbound_feather`, ['minecraft:feather', DUST, NUGGET, 'minecraft:ink_sac']).id(WS_ID('twinbound_feather'))
  event.shaped(`${WS}:epitaph`, ['NNN', 'ADA', 'NNN'], { N: NUGGET, A: 'minecraft:amethyst_shard', D: 'minecraft:deepslate' }).id(WS_ID('epitaph'))

  // ---- the warp stone: reusable, costs XP per jump
  event.recipes.create
    .mechanical_crafting(`${WS}:warp_stone`, ['ADA', 'DPD', 'ADA'], { A: 'minecraft:amethyst_shard', D: DUST, P: 'create:precision_mechanism' })
    .id(WS_ID('warp_stone'))

  // ---- placeable stones: the expensive part
  Object.keys(WAYSTONE_STYLES).forEach((style) => {
    event.recipes.create
      .mechanical_crafting(`${WS}:${style}`, [' E ', 'SWS', 'SPS', 'TCT'], {
        E: 'minecraft:ender_eye',
        S: WAYSTONE_STYLES[style],
        W: `${WS}:warp_stone`,
        P: 'create:precision_mechanism',
        T: 'create:sturdy_sheet',
        C: 'create:brass_casing'
      })
      .id(WS_ID(style))
    // Restyle any waystone, e.g. a found one, to match your build.
    event
      .shapeless(`${WS}:${style}`, [`#${WS}:waystones`, WAYSTONE_STYLES[style], WAYSTONE_STYLES[style], WAYSTONE_STYLES[style]])
      .id(WS_ID(`restyle/${style}`))
  })

  DYES.forEach((color) => {
    // Sharestones link every stone of their colour, for everyone. White has none in this version.
    if (color !== 'white') {
      event.recipes.create
        .mechanical_crafting(`${WS}:${color}_sharestone`, ['SSS', 'DWD', 'TPT'], {
          S: 'minecraft:stone_bricks',
          D: `#c:dyes/${color}`,
          W: `${WS}:warp_stone`,
          T: 'create:sturdy_sheet',
          P: 'create:precision_mechanism'
        })
        .id(WS_ID(`${color}_sharestone`))
    }
    // Portstones only send you off (nothing can warp to them), so they cost less than a waystone.
    event.recipes.create
      .mechanical_crafting(`${WS}:${color}_portstone`, ['DSD', 'SWS', 'CCC'], {
        D: `#c:dyes/${color}`,
        S: 'minecraft:stone_bricks',
        W: `${WS}:warp_stone`,
        C: 'create:andesite_casing'
      })
      .id(WS_ID(`${color}_portstone`))
  })

  event.recipes.create
    .mechanical_crafting(`${WS}:warp_plate`, ['SDS', 'DFD', 'SPS'], {
      S: 'minecraft:stone_bricks',
      D: DUST,
      F: `${WS}:dormant_shard`,
      P: 'create:precision_mechanism'
    })
    .id(WS_ID('warp_plate'))

  console.info(`[LemurSaucePacket] waystones: replaced ${removed} default recipes with Create ones`)
})
