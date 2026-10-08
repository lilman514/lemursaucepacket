---
description: >-
  The Lumber Axe and whole trees, finding ore and the veins that never run out, what your tools and blocks need, and
  the tools and machines that save you time.
icon: hammer
---

# Tools and mining

Mining and chopping run on your [skills](skills.md): better tools, harder ores and rarer trees each wait on a level. This page is the how-to: whole trees from one chop, finding ore, the ore veins that never run out, and the tools and machines that save you time.

## What your tools need

- **A level to use them.** Pickaxes and shovels need Mining, axes need Woodcutting and hoes need Farming: stone tools at 5, golden at 10, iron at 15, diamond at 30, netherite at 50 ([Skills](skills.md#using-gear)). A red "❣ Requires" line on the tooltip names the skill and the level; it turns green with a tick once you have it.
- **Hardness for harder ores.** A better pickaxe isn't enough here: harder blocks need a Hardness tome on the pickaxe and a Mining level. Iron, zinc and lapis take Hardness I (Mining 10), gold and redstone II (20), diamonds, emeralds and obsidian III (30), ancient debris IV (40). The tomes are on [Enchanting](enchanting.md#hardness-what-your-pickaxe-can-break).
- **Woodcutting for rarer trees.** Oak, birch and spruce come down for anyone. Jungle trees need Woodcutting 15, cherry 50, redwoods 70; without the level the log won't break. Every tree's level is in [Skills](skills.md#woodcutting).

## Getting the XP

- **Fresh ground only.** Breaking a block you placed yourself pays no skill XP, so pulling up your own blocks and putting them back earns nothing. Train on what the world made.
- **Machines pay whoever is near.** When a Create drill, saw or harvester does the work, every player within 16 blocks of it gets the Mining, Woodcutting or Farming, as if they'd done it by hand ([Machine XP](create-tips.md#machine-xp)). A cobblestone generator's blocks pay a machine a tenth. Tools that break many blocks at once (the Lumber Axe, the Excavator's Pickaxe, the Harvester's Scythe) pay too, for every block.
- **Hold Shift** over a block in your inventory: its tooltip lists the XP it pays to break. Iron ore pays 25 Mining, a log 12 Woodcutting.
- **No vein mining.** Project MMO's vein miner is switched off.

## Felling trees

The **Lumber Axe** (Woodcutting 30; made in mechanical crafters, see [Gear](gear.md#tools)) brings a whole tree down from one log. Every other axe chops one log at a time.

- **Sneak** to chop a single log.
- **Everything lands where you cut.** The logs drop at the block you broke, and the leaves around the tree break at once, so saplings and apples fall too. Leaves you placed yourself stay.
- **Durability.** Felling costs about one point of durability for every four logs. A worn axe fells as many logs as it has durability for, then breaks: mend it before a big tree.
- **Giant trees don't fall.** A tree of more than 200 logs is too big. A message above your hotbar says so, and you chop it log by log.
- **One kind of log at a time.** Only logs of the kind you cut come down. Crimson and warped trees bring their wart blocks with them, mangroves their roots.
- **Mind your builds.** To the axe, logs with leaves beside the top one are a tree. Sneak when you take apart anything built of logs.
- **Turn it off** for yourself with `/fallingtree toggle`, and back on the same way.
- **A mechanical saw** (Woodcutting 15 to make) fells a whole tree when it cuts the bottom log. On a moving contraption it cuts every tree it runs into. It works at the Woodcutting level of whoever placed it or last right-clicked it: a tree past that level stays standing.

## Finding ore

- **Where an ore generates.** Press **U** over an ore in JEI (or **R** over what it drops, like raw iron) and open the **World Generation** tab. It shows the heights the ore generates at, the biomes (click for the full list), how big its clusters are and how many a chunk gets, and what it drops with Fortune or Silk Touch. It reads this server's real world generation.
- **Which tool a block takes.** Look at a block: the block info at the top of your screen (Jade) shows the tool that harvests it. Hardness comes on top of that.
- **Create's coloured stones.** Crimsite, veridium, asurine and ochrum come in big striped bands underground, between about Y −30 and 70. They're stone, so any pickaxe takes them without Hardness, and crushing wheels turn them into crushed ore now and then:

| Stone | Each block crushes into |
|---|---|
| Veridium | Crushed copper 80 % of the time, and a copper nugget 80 % |
| Crimsite | Crushed iron 40 %, and an iron nugget 40 % |
| Asurine | Crushed zinc 30 %, and a zinc nugget 30 % |
| Ochrum | Crushed gold 20 %, and a gold nugget 20 % |

- **The Lost Candle** (from Labyrinth chests; Mining 40 to use). Right-click a block with it: if coal, copper, iron, gold or diamond ore is within 8 blocks, it rings and names the ore. It works every 3 seconds.
- **Light as you go.** A torch, lantern or other light in either hand lights the area around you. It's on your screen only: the real light level doesn't change, so monsters still spawn wherever you haven't placed torches. A torch held underwater goes dark.
- **Desert temples** give you Mining Fatigue while you're inside, until someone slays the temple's Pharaoh. Then the curse lifts for good.

## Ore veins that never run out

Create Ore Excavation hides ore veins underground that never run out: find one with an **Ore Vein Finder**, then drill it with a **Drilling Machine**. A vein fills one chunk, and any number of machines can share it.

| Where | Veins |
|---|---|
| Overworld | Coal, copper, iron, gold, zinc, lapis, redstone, and water (for the Fluid Well Extractor) |
| Nether | Quartz, glowstone and gold nuggets |

There are no diamond, emerald or netherite veins in this pack. Veins are rare: expect one of each kind in every 2,000 by 2,000 blocks or so, water veins four times as often and Nether gold a quarter as often.

### The Ore Vein Finder

- **Right-click** with it, anywhere. It reports a vein in the chunk you're in ("Found in Chunk"), in one next to it ("Found nearby"), or traces of one farther off, with a rough distance ("Found traces of: Raw Iron (~300 blocks away)"). Use it again as you walk: the distance tells you whether you're getting closer. It works every 5 seconds.
- **Making one** takes Mining 35, an eye of ender, an amethyst shard, a redstone ore block and two sticks. Eyes of ender need Brewing 55 to craft, and a redstone ore block needs Silk Touch and Mining 20, so a team or a trade helps.
- **The Ore Vein Atlas** (Mining 35: a chest, an amethyst shard, a map and a book and quill) keeps a record of veins. Click a finished Sample Drill or a running Drilling Machine with it. In the atlas, set a target vein, or exclude and hide others; with the atlas in your inventory, the finder reports only your target.
- **A Sample Drill** reads a vein you've found. Place it on the spot with a Copper Backtank (with air in it) on top, click it to start, and when it has finished one cycle, click it with the atlas.

### The Drilling Machine

- **Build it** in mechanical crafters (brass blocks and sheets, casings, a mechanical drill, precision mechanisms, sturdy sheets and more; JEI has the recipe). It places as one big machine, which has to stand on solid ground over the vein.
- **Run it.** Put a drill head in, turn its rotation input at 30 RPM or more, and take the ore out of its IO block with a funnel or a chute. Faster rotation drills faster, and the head never wears out.
- **The Iron Drill head** (Mining 50 to make) drills every vein in this pack. None of them needs the diamond or netherite head.
- **Water veins** take the Fluid Well Extractor instead: endless water for your pipes.
- **Hold W** over the machine, the finder or the sample drill for its Ponder lesson.
- **Hardness still counts.** Raw ore from a vein is gated like ore you dig. Below the Mining level its tier needs, you can carry it and keep it in a chest, but recipes, machines and other containers won't take it from you. Funnels, chutes and belts still move it. See [Enchanting](enchanting.md#hardness-what-your-pickaxe-can-break).

## Tool helpers

| Tool | What it does |
|---|---|
| Excavator's Pickaxe (Mining 40) | Mines a 3 by 3: a wall in front of you, or a floor or ceiling when you look steeply up or down (more than 60°). Sneak to mine a single block. It only takes blocks a pickaxe mines. |
| Prospector's Pickaxe (Mining 30) | Ores come out already smelted |
| Telekinesis | An enchantment: what you break drops straight into your inventory ([Enchanting](enchanting.md#telekinesis)) |
| Tool Swapper upgrade (Crafting 25) | In the backpack you wear: left-click a block or a mob with the wrong tool and it swaps the right one into your hand |
| A spare tool | When a tool breaks, a matching one from your inventory takes its place |
| Extendo Grip (Attack 40 to hold) | In your off-hand: 3 more blocks of reach, 5 with one in each hand. With a backtank on, it uses air instead of durability. |
| Nuggets of Experience | Crushing raw ore in Create often gives one. Right-click it for experience, for the enchanting table and the anvil. |

## Mining by machine

- **Mechanical drill** (Mining 15 to make). It breaks the block in front of it, faster the faster it turns. On a moving contraption (a piston, bearing, gantry, minecart or train) it mines whatever it runs into, and what it digs goes into the contraption's chests.
- **Borehead Bearing** (Mining 40, with its Rock Cutting Wheels): a tunnel bore. The wheels break blocks all around themselves and attach without glue. What they dig goes into a storage block on the bore, and the bore stops when that's full. It spins at a quarter of the speed you give it, and the more it cuts at once, the slower it goes: use more than one bearing.
- **How hard machines dig.** Create's drills, saws and rollers, and deployers holding a pickaxe, break blocks up to Hardness II: gold and redstone yes, diamonds and obsidian no ([Enchanting](enchanting.md#hardness-what-your-pickaxe-can-break)).
- **Whose levels.** A drill or saw works at the levels of its operator: whoever placed it or last right-clicked it. On a contraption, it keeps the operator it had when the contraption was put together. A log past the operator's Woodcutting stays standing. See [Good to know](good-to-know.md#machines-run-at-a-level).
- **XP for whoever is near.** A drill pays its Mining to every player within 16 blocks of it. Build an [XP Bank](create-tips.md#the-xp-bank) by your drills to keep a share while you're away.
