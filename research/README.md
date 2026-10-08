# Research and plans

Work done before building, kept so it isn't lost (it lived in a session's temporary folder until 2026-10-08). Three
bodies of research, each with what's been built from it so far and what's still to do. Raw third-party material
behind them (the mods' lang files, Modrinth descriptions, Nekoma's Fixed's sources and wiki text, jar scans) is kept in
`research/.local/`, which git ignores: it isn't ours to publish, and it can be fetched again.

The scripts were run from the session folder and still name its paths; change those before running one again.

## `qol/`: QOL, controls, redstone and good-to-know inventory

**What it is.** Every mod in the pack (186) read for what a player would want to know: controls, inventory and
storage, building, travel, maps, combat and PvP, farming, redstone, Create tips, tools, UI, chat, the server's own
systems, performance, recording. 957 entries, each tied to a mod and checked against the jars and configs, with what
the wiki already covers. Asked for by the owner: players should never feel there is something they can't figure out,
never find something already solved tedious or confusing, and never miss a QOL feature or a new redstone possibility.

- `inventory.md`: the inventory (start here). Its last two sections list **wrong wiki statements** (9) and
  **pack issues** (8), then the **25 biggest gaps** in priority order.
- `SPEC.md`: how entries were gathered and judged. `gaps.md`, `intro.md`: drafts for the guide.
- `merged.json` / `merged.md`: the same entries as data. `qa-missing*.txt`: entries no wiki page covers.
- Scripts: `merge.mjs`, `dupes.mjs`, `dedupe-apply.mjs`, `anchors.mjs`, `roles.mjs`, `qa-docs.mjs`, `build-final.mjs`,
  `fetch-modrinth.mjs`, `extract-lang.sh`.

**Done from it (2026-10-08, unreleased until pack 1.15.0):**
- Pack issue 1: the vendor shop and /trade duplication (locked slots and an Inventory Essentials ignore list).
- Pack issue 2: Ice and Fire's axes no longer fell whole trees (the registry dump behind FallingTree's deny list was
  refreshed: `quests/.registry.json`, 9,743 items).
- Pack issue 3: `fallingtree.json` uses values FallingTree accepts (NORMAL, ROUND_DOWN).
- Pack issue 5: the vein finder's recipe takes a compass and redstone dust (its Mining 35 gate is the hurdle), and
  the Prospector quest moved to the Factory Floor chapter.
- Pack issue 6: drills and saws, stationary and on contraptions, break only what their operator could
  (`mixin/create/BreakerGateMixin`, `MovingBreakerGateMixin`; test kit scratchpad breakers-run.sh, 8/8).
- Pack issue 7: Crash Assistant's help button points at the pack's GitHub issues (`pack/config/crash_assistant`).
- All 9 wrong wiki statements (the unbound-keys one was intentional: pack-maker tools stay off the list).
- The FAQ: grouped questions as cards with a filter (`faq: true` front matter, publish/docs.mjs `faqCards`), with
  answers from the gaps list (backpacks, graves, skill XP, the new gate messages).
- One inventory claim was wrong: Project MMO draws no red outline on blocks you placed (the penalty applies only to
  blocks you placed yourself, and fully grown crops are exempt).

**Still to do:**
- Done 2026-10-08: 11 QOL and good-to-know pages (inventory-tips, interface, create-tips, redstone, travel, building,
  combat, social, good-to-know, farming, tools-and-mining: the "Tips and tricks" group, plus Create and building),
  each checked against the jars; and the follow-up fixes their writers found in older pages. Next: the gaps they
  left out as unverified (each page's writer listed them), in-game checks of those, and pictures.
- Found while writing them, for the owner: redstone dust is in the Hardness II item tag (crafting with it needs
  Mining 20: repeaters, comparators, rose quartz and the brass-tier parts behind them); Create's table-cloth shops
  probably can't price in Gold Coins (a coin stack is one item carrying its amount); Jade may show anyone a player's
  whole inventory (needs a two-player check); Project MMO skill parties copy XP to everyone within 50 blocks rather
  than splitting it.
- Issue 8, decided by the owner 2026-10-08: backpacks start closed to other players (lsp_fixes
  `BackpackClosedByDefaultMixin` flips Sophisticated Backpacks' "Another player can open" default); graves stay open to
  whoever breaks them, and the wiki says so.
- For the owner to decide: issue 4 (ocean tower chests give a per-player Heart of the Sea). The wiki states it.

## `progression/`: progression and Hardness for every modded item

**What it is.** Every modded item and block in the pack (from the jars and the registry dump), classed by what it is
and how useful it is, with a proposed skill gate (making, wearing, holding, using, placing, chopping, brewing) or
Hardness tier, on the pack's existing tier logic.

- `proposal.md`: the reasoning, the tier logic, the decisions for the owner and the gates per mod (start here).
- `proposal.json`, `items.csv`: the per-item result. `gates.json`: the gates as data.
- Scripts: `scan.mjs`, `items.mjs`, `recipes.mjs`, `classify.mjs`, `proposals.mjs`, `gates.mjs`, `gen.mjs`,
  `to-modded.mjs` (writes `skills/modded.mjs`).

**Done from it (unreleased, in the working tree):** `skills/modded.mjs` (147 gates over 496 items, plus the totem),
the generated rules and guide data, the Hardness tiers for Ice and Fire's silver and sapphire, Regions Unexplored's
cobalt obsidian and Create Ore Excavation's raw ores, and the gate system that enforces them (machines run at their
operator's level, backpack upgrades, relic abilities, the totem, a chat notice with a ding). Ships as pack 1.15.0.

**Also done 2026-10-08:** Friends & Foes' Totems of Freezing and Illusion now wait for their wear level (they fire
from Friends & Foes' own code, hooked by lsp_fixes' mixin plugin), and backpacks worn in the chest slot are counted as
carried.

**Still to do:** gating Nekoma's Fixed's items as they're ported. (The drills and saws gate is done, above.)

## `nekomas-fixed/`: porting Nekoma's Fixed

**What it is.** A plan to rebuild Nekoma's Fixed (GreenJAB, Fabric only, Minecraft 1.21.10+) inside lsp_fixes for
1.21.1, the owner's choice ("everything that fits 1.21.1"). 60 features in three stages: blocks, items and mechanic
tweaks; mobs; worldgen and the Wildfire boss. Upstream has an unreleased 1.21.1 branch that covers about a third.

- `port-plan.md`: the plan, per feature (start here), with what Vanilla Backport already covers, overlaps with the
  pack's mods, what 1.21.1 lacks, and credits and licence.

**Still to do:** everything. Decisions for the owner first: tipped arrows coming back as plain arrows, longer range for
every pillager, horns making tamed animals glow (a PvP information leak), the target dummy as a combat-XP farm, and
the overlaps (Friends & Foes' Wildfire and Moobloom, Variants & Ventures' mobs, Regions Unexplored's baobab). Then
stage 1, with skill gates for each new item and wiki pages for its features.
