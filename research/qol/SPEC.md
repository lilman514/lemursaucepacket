# QOL inventory: worker spec

Goal: research for a new wiki guide for the LemurSaucePacket modpack (NeoForge 1.21.1, Create-based SMP, ~8 players,
PvP on, RuneScape-style skills via Project MMO + the pack's own gates, Gold Coins economy, FTB Quests, lifesteal,
Distant Horizons). The guide's goal: players never feel there is something they can't figure out, never find something
already solved tedious or confusing, and never miss a QOL feature or a new redstone/automation possibility.

**You are only researching. Do NOT create, modify or delete anything under C:\Create+Modpack (read-only). Write only
your one notes file in the scratchpad (path given in your task).**

## Where things are

SP = C:\Users\Shawn\AppData\Local\Temp\claude\C--Create-Modpack\ab1859ba-46fb-401e-9816-544fdbbd5524\scratchpad
(in Git Bash: /c/Users/Shawn/AppData/Local/Temp/claude/C--Create-Modpack/ab1859ba-46fb-401e-9816-544fdbbd5524/scratchpad)

- `SP/qol/mods.tsv`: slug, display name, side (client/both), Modrinth id, jar filename. The slug is the pack's
  `pack/mods/<slug>.pw.toml` name.
- `SP/qol/modrinth/<slug>.md`: the mod's Modrinth description (markdown/HTML). Already downloaded: read these, do not
  re-fetch. (FTB Library/Quests/Teams and ReForgedPlay have none: CurseForge mods.)
- `SP/qol/lang/<jar filename without .jar>/<modid>.json`: every en_us.json in the jar, including nested jar-in-jar mods
  (e.g. `lang/create-aeronautics-bundled-1.21.1-1.3.2/dev.simulated_team.simulated.simulated-neoforge-1.21.1-1.3.2/simulated.json`).
  Tooltip / description keys (`*.tooltip*`, `*.desc*`, `*.description*`, `*.summary`, `*.condition*`, `*.behaviour*`,
  `*.hint*`, `*.info*`, `*.jei.*`) are the gold: they say how items work. Item names tell you what exists.
- Jars, if you need more (configs inside, data, ponder text): client `SP/headless/instance/mods/*.jar`, server
  `SP/server-test/mods/*.jar`. `unzip -p <jar> <path>` reads one file; `unzip -Z1 <jar>` lists.
- Generated configs (mod defaults + pack overrides) as a real server/client writes them:
  server `SP/server-test/config/`, client `SP/headless/instance/config/` (ignore leftovers of removed mods:
  aeroclaims, numismatics, openpartiesandclaims, sophisticatedinventoryinteractions).
- The PACK's own config overrides (what the pack changed from mod defaults; these matter most):
  `C:\Create+Modpack\pack\config\` (only: brassworksmissions-server.toml, DistantHorizons.toml, duperautowalk.json,
  everycomp-hazardous.toml, fallingtree.json, fancymenu/, ftbquests/, iceandfire/iaf-common.json,
  inventoryprofilesnext/inventoryprofiles.json, lemursaucepacket/*.json, lithium.properties, pmmo-client.toml,
  replaymod.json, rinku/, shouldersurfing-client.toml, sophisticatedbackpacks-common.toml,
  sophisticatedbackpacks-server.toml, sophisticatedcore-common.toml, xaero/*/server_profiles/default.cfg).
  Everything else runs on the mod's defaults.
- Pack key changes: `C:\Create+Modpack\pack\options.txt` and `C:\Create+Modpack\pack\kubejs\client_scripts\keybinds.js`.
  Every default key (after the pack's changes) is listed in `C:\Create+Modpack\publish\keybinds\defaults.json` and
  already documented in `C:\Create+Modpack\docs\keybinds.md` (a key listed there counts as documented for the key
  itself, but NOT for the mechanic behind it, e.g. "Left Alt: access nearby toolboxes" is documented, how a toolbox
  works is not).
- KubeJS scripts that change recipes/behaviour: `C:\Create+Modpack\pack\kubejs\` (server_scripts, startup_scripts,
  client_scripts; e.g. backpacks.js re-tiers backpacks, waystones.js replaces waystone recipes, ore_veins.js removes
  diamond/emerald/netherite veins, jei_hidden*.js hides items). Items hidden from JEI are usually disabled content:
  don't recommend them.
- Design notes: `C:\Create+Modpack\PACK_DESIGN.md` (long; grep it for your mods).

## The wiki (to mark documented / MISSING)

`C:\Create+Modpack\docs\*.md` (GitBook; SUMMARY.md is the TOC). Pages: README, getting-started, first-week, launcher,
faq, keybinds (every key + sorting + HUD layout), commands, world (rules, what's different from vanilla), biomes*
(10 biome pages), nether, end, structures, creatures, lemurton, waystones, economy, lifesteal (hearts, graves, Lost
Item/Seeker's compasses), quests, elvarg, fight-pits, where-to-find (loot-only items), skills, enchanting, gear
(pack's tools/armour + Relics' Climbing Boots), capes, hiscores, create (Create basics + add-ons table), esc-menu
(+HUD Layout), mods (a generated LIST of every mod: being listed there does NOT count as documented).

Mark an entry **documented** only if a page explains how to use that feature (cite `file.md`, plus the heading when
useful). If a page only names the mod or the item, write `MISSING (named in x.md)`. Use grep, e.g.
`grep -n -i "toolbox" /c/Create+Modpack/docs/*.md`.

## What to collect

For each mod in your group: player-facing features that are
1. **QOL** (saves time/clicks, removes tedium),
2. **controls** (keys, sneak-clicks, scroll-wheel, modifier+click, drag, middle-click; hidden interactions),
3. **redstone / automation possibilities** (new components, what they let you build, what they react to or output:
   comparator readings, redstone signals in/out, automation-friendly blocks),
4. **"good to know" mechanics** a player would never discover alone (non-obvious behaviour, gotchas, limits,
   things that look broken but aren't, things the pack disabled or changed),
5. **useful items/blocks** worth knowing exist, and **settings** worth knowing (where to find them).

Skip pure libraries (say so in one line), and for world-gen/structure/mob mods keep only what a player can act on
(e.g. a mob that can be tamed/used, a structure with a special mechanic). Note when the pack changed a default
(disabled a feature, rebound a key, changed a recipe) — always check the pack config + kubejs for your mod.

Be concrete and exact: "Sneak + right-click a belt with an empty hand removes the item" beats "belts are easy to use".
Verify claims against the lang/tooltip text or the Modrinth page; if something is uncertain (e.g. a feature the
Modrinth page describes but the 1.21.1 version may lack, or a config default you could not confirm), say "(unverified)".

## Output

Write `SP/qol/notes/<your group>.md`. Structure:

1. `## Mods covered` — one line per mod: display name | Modrinth slug | side | one-phrase role (or "library, no
   player features").
2. One `## <Topic>` section per topic you have entries for, using EXACTLY these topic names:
   Controls & keys; Inventory, sorting & storage; Building & decoration; Movement & travel; Maps & navigation;
   Combat & PvP; Farming, food & animals; Redstone; Create automation tips; Tools & mining; UI, HUD & settings;
   Chat & social; Server-specific systems; Performance & video settings; Recording & screenshots.
   (Redstone = new redstone components and what they enable; Create automation tips = non-obvious Create behaviour.)
3. In each topic a markdown table:
   `| Feature | How to use (keys, clicks, recipe, setting path) | Mod | Docs | Value |`
   - Docs: `file.md` (or `file.md#heading`) if explained; `MISSING`; or `MISSING (named in x.md)`.
   - Value for an average player on this server: `high` (most players use it often, or are stuck/lose things without
     knowing), `medium` (useful to many, occasionally), `low` (niche, cosmetic, or rarely matters).
   - Keep each row to one feature; split multi-feature items. No duplicate rows across topics: put each feature where a
     player would look for it.
4. `## Pack changes found` — bullet list of every default the pack changed for your mods (config/kubejs/options), with
   the file.
5. `## Top gaps` — your 10 most valuable MISSING entries, one line each.

Aim for completeness over brevity: a big mod (Create, Sophisticated Backpacks, Xaero, JEI, Farmer's Delight) can
easily have 20-60 rows. No emojis. Finish by replying with a 5-line summary (rows per topic, how many MISSING).
