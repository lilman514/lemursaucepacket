# structures/: the buildings and the spawn city

The spawn city (Lemurton) is a plan that lsp_fixes' `HubBuilder` builds on a brand-new world (docs/world.md). Its
buildings are [Luki's Grand Capitals](https://modrinth.com/mod/lukis-grand-capitals)' (by Luki, all rights
reserved), placed from the mod's jar, which the pack installs; this folder only catalogues them. The walls and towers
are ours: drawn in code, baked in a scratch server, and shipped as structure templates in
`pack/kubejs/data/lemursaucepacket/structure/`.

## Files

| File | What it does |
|---|---|
| `lib/blocks.mjs` | Block states, checked against `.blocks.json` (every block the pack registers, with its properties and defaults). A typo fails the build instead of placing air. |
| `lib/nbt.mjs` | NBT writer and reader (structure templates are gzipped NBT). |
| `lib/canvas.mjs` | A sparse 3D grid of block states; `toTemplate()` writes Minecraft's structure format. Unset positions keep the terrain; air clears it. |
| `lib/parts.mjs` | Walls, timber frames, gable and hip roofs (Macaw's pieces, three pitches), doors, windows, shutters, flower boxes, furniture, lights, chimneys, a seeded rng. |
| `lib/house.mjs` | `house(spec)`: foundation, storeys (rough stone, dressed stone or timber frame, upper floors jettied), roof, door, windows, chimney and interior. Most houses are one spec. |
| `buildings/*.mjs` | The buildings. Each module exports `buildings: [{ name, kind, notes, build(canvas) }]`; `00-*.mjs` are samplers, built only with `--samplers`. |
| `build.mjs` | Draws every building into a raw template in `raw/` plus `raw/manifest.json` (sizes, solid bounds, marks such as the door and NPC spots). `node structures/build.mjs [name-regex] [--samplers]`. |
| `bake.mjs`, `bake/bake.js` | Bakes the raw templates in a scratch server: each is placed on a bed of structure void so the game works out every neighbour-dependent shape (stair corners, fence and pane joins, Macaw's roof ridges, window and lamp parts), then saved back. Worldgen and the hub place templates with known shapes, so this step is required. Copies the baked templates into the pack (samplers excepted). `node structures/bake.mjs --server <scratch server> [--keep seconds]`. |
| `preview.mjs`, `bake/preview_client.js` | Photographs every baked building on the showroom with the headless test client (two angles each) into `previews/`. Run while the bake's server is still up. |
| `external.mjs`, `external.json` | Catalogues other mods' buildings for the city: reads the jar the pack pins (`pack/mods/<slug>.pw.toml`, cached in the git-ignored `.external/`) and records each template's id, size, solid bounds, entrance and the way it faces, a shopkeeper's spot, market-stall spots, its waystone, and vanilla stand-ins for blocks from mods the pack doesn't have. Nothing of the mod's is copied. `node structures/external.mjs`. |
| `import.mjs` | Copies other mods' templates (from an extracted jar) into a raw folder, jigsaws resolved, so `bake.mjs --raw` and `preview.mjs --raw` can put them in the showroom next to ours. For comparing only: the copies stay in the git-ignored `raw-import/`. |
| `lib/zip.mjs` | A minimal zip reader for mod jars. |
| `hub.mjs` | Lays out the city and writes `pack/config/lemursaucepacket/hub_plan.json`: paving, placements (by the spot outside each door, with Minecraft's rotation maths; other mods' buildings are turned from the way they face), single blocks (including the stand-ins), commands (trees, NPCs), waystone, spawn, safe zone. Rows of buildings are filled greedily and checked for overlaps. It also removes our templates the city doesn't use from the pack. |
| `bake/hub_preview_client.js` | Test-only client script: waits for the city's waystone, then takes aerial and street shots. |
| `.blocks.json` | Regenerate after adding a mod with blocks: a scratch-server script that walks `BuiltInRegistries.BLOCK` (see the visual-testing notes) writes it. |

`raw/`, `raw-import/`, `baked/`, `previews/` and `.external/` are build outputs (git-ignored).

## Making a change

The city: change `hub.mjs` (or the shop map in `npcs/npcs.mjs`) and run `node structures/hub.mjs`. After updating Luki's
Grand Capitals in the pack, run `node structures/external.mjs` first. To compare other mods' buildings, extract their
jars and use `import.mjs`, then `bake.mjs --raw structures/raw-import` and `preview.mjs --raw structures/raw-import
--views a`.

Our walls and towers:

1. Edit or add a building in `buildings/`, then `node structures/build.mjs`.
2. `node structures/bake.mjs --server <scratch server dir>` (a server made with
   `npm run server -- --dir <dir> --feed http://localhost:8787/launcher.json --offline`, never the real one).
3. Optional: `node structures/preview.mjs --client <headless client dir> --server <scratch server dir>`.
4. `node structures/hub.mjs` if the city should use it, then publish as usual.

## Conventions

- x east, y up, z south. Buildings face south (front door on the south side) with the ground floor at y 0 and
  foundations below; the hub and worldgen rotate them.
- Mark useful spots with `c.mark(name, x, y, z, data)`: `door`, `front` (outside the door, used to place the
  building), `npc` (a shopkeeper's or merchant's spot), `board`, `water`.
- Street surfaces must be full blocks: Macaw's `*_paving` blocks are thin overlays.
