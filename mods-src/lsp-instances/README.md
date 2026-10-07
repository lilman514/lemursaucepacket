# LemurSaucePacket Instances (`lsp_instances`)

Instanced events for the LemurSaucePacket modpack (NeoForge 21.1.252, Minecraft 1.21.1): boss fights and the like that
every party gets its own copy of, started by speaking to an NPC. It's its own mod so other events can use it later; the
first is Elvarg's Lair (Dragon Slayer I), set up by `lsp_fixes`.

## How it plays

- An NPC with the entity tag `lsp_event.<namespace>.<name>` opens that event's window when right-clicked (before any
  other mod's handler, so it works on Easy NPC townsfolk).
- The window offers **Fight alone**, **Open a co-op fight** and **Join *someone*'s fight** for co-op fights others have
  opened at that event. A co-op host sees who has joined and presses **Begin**; members can leave, the host can call it
  off. Only the host needs the event's start requirement. A lobby closes after five minutes, or when its host leaves.
- The party is taken to its own copy of the arena and the event's spawns appear (a boss gets a health bar). It's won when
  every boss is dead; after the loot time, or when time runs out, or when nobody is left, everyone still inside goes
  back where they started from. `/instance leave` leaves early.
- **Deaths:** for an event with a keeper, everything that would drop (inventory, armour, Curios slots) goes to the keeper
  instead: nothing falls, nothing goes into a grave. The player is told where to collect it. The window then shows
  **Take back your things**: armour goes back on, the rest into the inventory, and whatever doesn't fit stays with the
  keeper. The pack's lifesteal script sends the Heart lost in an event the same way (`InstanceApi.keep`).
- In an arena you can't break or place blocks, use buckets, blow anything up, or pearl or chorus out of it. Anyone who
  strays beyond the event's radius (or falls off) is brought back, and so are bosses.

## How it works

One empty dimension, `lsp_instances:instances` (a flat generator with no layers, the void biome, always noon). Each run
gets a slot 2048 blocks along x; its chunks are kept loaded while it runs, the arena template is placed afresh (chests and
other containers left out), and data markers in the template (structure blocks in DATA mode) are read and removed: a
`player_spawn` marker is where the party arrives, facing the middle. Nothing about a run survives a restart except where
to send people back and what keepers hold (`data/lsp_instances.dat` in the overworld); anyone who logs in inside the
dimension with no run going is sent back.

## Events

`data/<namespace>/lsp_instances/event/<name>.json` (reloadable), for example the pack's `lemursaucepacket:elvarg`:

| Field | Meaning |
|---|---|
| `name`, `description` | the window's title and lines; chat uses the name |
| `arena` | a structure template id (a datapack's, or one saved in the world's `generated` folder) |
| `strip_containers` | leave out blocks that hold items (default true) |
| `player_spawn`, `player_yaw` | where the party arrives, from the arena's centre (`x`, `z`, `dy` above the ground there), unless the arena has a `player_spawn` marker |
| `spawns` | `nbt` (SNBT with its `id`; `{x}`, `{y}`, `{z}` and `{ground}` are filled in), `at`, `boss`, `full_health` (top up mobs whose max health comes from their NBT) |
| `max_players`, `time_limit`, `loot_time` | party size (host included), seconds before the party is sent back, seconds after the win |
| `start_requires` | `tags` the host must have, `not_tags` they mustn't, and the `message` that says why not |
| `keeper`, `keeper_place` | who keeps the things of those who die in it, and where (empty: deaths are ordinary) |
| `radius` | how far from the centre players and bosses may go |
| `replace` | `blocks` (ids or `#tags`) within `radius` of the centre become `with` as the arena is placed: Elvarg's clears the trees round her hoard and scorches the ground |

## Commands

`/instance leave` (anyone in a fight). Admins: `/instances list`, `/instances start <event> <players>`,
`/instances end <run>`, `/instances open <event> <player>` (the window without an NPC; its buttons need one),
`/instances keeper <player>`.

## API

`net.lemursaucepacket.instances.InstanceApi`: `inInstance(entity)`, `inEvent(player)`, `keep(player, stack)` (give the
keeper a stack for a player who is in, or has just died in, an event), `keeperName(player)`, `keeperPlace(player)`.

## Build

Like `lsp_fixes`: `./gradlew build copyToPack` puts `lsp_instances-<version>.jar` into `pack/mods/`.
