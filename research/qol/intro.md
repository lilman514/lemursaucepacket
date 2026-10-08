# LemurSaucePacket: QOL, controls, redstone and good-to-know inventory

Research for a new wiki guide whose goal is that players never feel there is something they can't figure out, never find something already solved tedious or confusing, and never miss a QOL feature or a new redstone possibility. Pack 1.14.3 (lsp_fixes 1.15.1), Minecraft 1.21.1, NeoForge 21.1.252; researched 2026-10-08. Nothing under `C:\Create+Modpack` was changed.

**How it was made.** Every mod in `pack/mods` (184 `.pw.toml` files and the pack's two own jars). For each: its Modrinth description (from the public API), the jar's `en_us.json` (item names, tooltips, Ponder scenes, config labels; nested jar-in-jar mods included), the configs a real server and client generate (mod defaults), and what the pack changes: `pack/config`, `pack/options.txt`, `pack/kubejs` (recipes, the keybind rules in `client_scripts/keybinds.js`, items hidden from JEI because they're disabled). Key defaults come from `publish/keybinds/defaults.json`.

**How to read the tables.**

- **How to use:** keys, clicks, recipes or the setting's path. "Pack:" marks something the pack changed from the mod's default or gates by skill. "(unverified)" marks something read from a mod's description, or from its code (some defaults were read from the class files with javap), that wasn't confirmed in a config or in game.
- **Docs:** the wiki page (and heading) that explains the feature; **MISSING** when no page explains it ("named in x.md" when a page only names the mod or item); **PARTIAL** when a page covers part of it and the rest is missing; **WRONG** when a page says something the pack doesn't do (listed again near the end). Being listed in `mods.md`, or a key being listed in `keybinds.md`, doesn't count as explaining the mechanic behind it.
- **Value**, for an average player on this server: **high** = most players use it often, or get stuck or lose things without knowing it; **medium** = useful to many, now and then; **low** = niche or cosmetic.
- Within each topic, rows are sorted by value, then mod.
