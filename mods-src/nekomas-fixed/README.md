# Nekoma's Fixed (LemurSaucePacket port)

A NeoForge 1.21.1 port of [Nekoma's Fixed](https://modrinth.com/mod/nekomas-fixed), a Fabric-only content mod, for the
LemurSaucePacket modpack. This is **batch 1**: new blocks, items and tools only. It changes no vanilla behaviour except
that the vanilla clock can be placed and can record a time.

Mod id and namespace are upstream's, `nekomasfixed`, so its assets and data fit unchanged. Version `0.5.2+lsp.1`.

## Credits and licence

Nekoma's Fixed is by **GreenJAB**, built on the ideas of YouTuber Nekoma, with developers CyberMODDER, Gear, Akshaj and
engholm and textures by velocyblue. This port starts from the mod's unreleased Fabric 1.21.1 branch by **Strikey5852**
(the kiln comes from the main branch). Upstream is MIT licensed; its licence is in [LICENSE](LICENSE) and travels in the
jar as `LICENSE_nekomasfixed`. The port is MIT too.

## What's in it

| Feature | Notes |
|---|---|
| Amber, aqua, indigo and maroon dyes | 2 torchflowers make 4 maroon, 2 pitcher plants 4 indigo; maroon or indigo with white make amber or aqua. Crafting only: no sign text or firework colours (those need vanilla changes). |
| The four colours' wool, carpet, terracotta, glazed terracotta, concrete, concrete powder, stained glass and panes, candles (and candle cakes), beds and shulker boxes | Vanilla recipes in the new colours. Dyeing a shulker box keeps its contents; washing one in a cauldron and dispensers work as for vanilla boxes. Our beds, wool and carpets dye back to the vanilla colours. Glass tints beacon beams with its real colour. |
| Dyed bricks, slabs, stairs and walls in all 20 colours | 8 bricks (slabs, stairs, walls) around a dye, plus the usual shapes and stonecutting. Named "Dyed ... Bricks" (Create Deco has "Blue Bricks"). |
| 17 new froglights | Any froglight plus a dye makes another, 20 colours in all. |
| Glow Torch | The underwater torch: a glow ink sac on a stick, lit only in water. |
| Redstone Striker | Strike a block: that spot is powered at 15 for 16 ticks (1 when sneaking). |
| Placeable clock | Right-click a block with a vanilla clock to place it on the floor or a wall. Right-click it for an HH:MM label; add a bell to a floor clock for an alarm (shears take it off). Right-click the air with a clock to record the time: placed, it pulses redstone at that time each day. |
| Kiln | A furnace for building blocks (glazed terracotta, stone, glass, cracked bricks...), twice as fast. Its recipes are in JEI. |

All items are in the "Nekoma's Fixed" creative tab.

## Differences from upstream

- **Dye recipes take two flowers.** Upstream turns 1 torchflower into 2 maroon (and 1 pitcher plant into 2 indigo) and
  switches off vanilla's torchflower-to-orange and pitcher-to-cyan recipes. A single flower can't make both, so while
  vanilla stays untouched ours take 2 flowers for 4 dyes.
- **The kiln pays vanilla's smelting XP** (0.1 for most, 0.3 a brick, 0.35 terracotta, 0.15 a sponge), not upstream's 0.4
  for everything: it's a faster furnace for building blocks, not a richer one (a cobblestone generator feeding it would
  otherwise be an XP farm).
- **Nothing is registered under `minecraft:`.** The clock blocks are `nekomasfixed:clock`/`wall_clock` and the recorded
  time is `nekomasfixed:stored_time`; the vanilla clock item isn't replaced, events add its new uses.
- **Beds and shulker boxes** have their own block entity types and renderers instead of mixins into vanilla's.
- **Fixes:** candles on cakes no longer crash, dyeing a shulker box no longer empties it, a bell comes back when an
  alarm clock is broken, terracotta, concrete and bricks need a pickaxe, new beds no longer lower your jump, the kiln gives light
  when lit, the Redstone Striker isn't a flint and steel (no fire starting in other mods) and works with Lithium's dust.

## Building

```
export JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-21.0.3.9-hotspot"
./gradlew build          # build/libs/nekomasfixed-<version>.jar
```

`src/main/resources/assets` and `data` are generated: `python tools/port_data.py [upstream clone]` copies upstream's
textures, models and blockstates for the ported content and writes the recipes, loot tables, tags, advancements and
lang (the clone defaults to `research/.local/nekomas-fixed/source`). `python tools/check_jar.py` checks that everything
the built jar's data and assets point at exists. Both need Python 3.
