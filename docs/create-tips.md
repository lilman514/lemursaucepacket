---
description: >-
  Past the basics: the wrench, value panels, filters and the clipboard, what the goggles show, the real numbers
  behind speed and stress, moving items and fluids, and how machines work with your skills.
icon: screwdriver-wrench
---

# Create know-how

[Create basics](create.md) says what each machine is for. This page is the next step: the controls that save you clicks, the numbers behind speed and stress, what processing really gives, and the rules this server adds. Signals, sensors and screens have a page of their own: [Redstone, wired and wireless](redstone.md).

{% hint style="success" %}
**Ponder shows how every block works.** Hold **W** over a Create item. In a scene, the category icons (*Targets for Mechanical Arms*, *Sources for Display Links* and the rest) list every block that works with it. The quest book's First Rotation, Brass Age, Factory Floor and Warehouse chapters take you through Create in order ([Quests](quests.md)).
{% endhint %}

## The wrench

- **Turn a part.** Right-click a Create part with the wrench to turn it around the face you clicked.
- **Pick a part up.** Sneak + right-click with the wrench and the part goes straight into your inventory, no mining needed. It works on vanilla redstone too (dust, torches, repeaters, comparators, levers, buttons, pressure plates, observers, pistons, redstone lamps, daylight detectors, targets, tripwire and tripwire hooks), on hoppers and every kind of rail, and on Create's metal bars and its industrial and weathered iron blocks.
- **Left-click picks up too.** With Create: Cyber Goggles (on by default), a left-click with the wrench in hand also takes a part apart at once. Mind your own machines. To turn it off, press the \ key for Cyber Goggles' settings, then Misc → Wrench.
- **Choose a facing from a ring.** Bind *Open Block Rotation Menu* (Settings → Controls → Key Binds → Create; it has no key at first). Hold the wrench, look at a part or a hopper and press it to pick its axis or facing directly.
- **Move a train or a cart.** Right-click a derailed train with the wrench, then click a track nearby to put it there. A wrench on a minecart contraption picks the whole thing up as an item.

## Panels, filters, clipboard

- **Value panels.** Many blocks have a small labelled panel on one side: a stack size, a speed, a delay, a mode. Hold right-click on it and a board of choices opens; move the mouse to the one you want and let go. Sneaking skips the panel, so you can still place blocks against it. With Cyber Goggles every panel shows its value as you look at it, even the ones that otherwise only show with a wrench in hand.
- **Numbers in Create's screens.** Hover one and scroll; hold Shift to scroll faster.
- **Filter slots.** Right-click a block's filter slot with an item and the block now handles only that item. Your item isn't used: the slot keeps a ghost copy. Right-click with another item to change it.
- **How many at a time.** Hold right-click on a brass funnel's or smart chute's filter slot to choose *Up to* or *Exactly* how many items each move takes. *Any* means a whole stack.
- **List Filter.** Right-click it and put in items, or other filters. *Allow-List* passes only those (an empty one passes nothing); *Deny-List* passes everything else (an empty one passes everything). *Respect Data* also matches durability, enchantments and contents; *Ignore Data* doesn't.
- **Attribute Filter.** It matches what an item is, not which one. Put in a reference item and pick from its attributes: what it can go through (smelting, smoking, blasting, washing, crushing, haunting, composting, eating, burning as fuel), what state it's in (enchanted, damaged, dyed, renamed, unstackable), its tags and the mod it comes from. *Allow-List (All)* needs every attribute, *Allow-List (Any)* one of them, *Deny-List* none. *Add opposite attribute* adds the "not" form.
- **A filter in a slot is used up.** A List or Attribute Filter set in a block's filter slot goes into the block, and comes back to you when you swap it out.
- **The clipboard copies settings.** Hold a Clipboard, right-click a block to copy its settings (filters and panels), then left-click another block of the same kind to paste them. Pasting a List or Attribute Filter takes one filter of that kind from your inventory. Right-click with the clipboard in the air for notes with checkboxes; sneak + right-click hangs it on a surface.

## Reading your machines

- **Goggle info is always on.** Create: Cyber Goggles (an optional mod, on by default in the launcher's **Mods** tab) gives you the Engineer's Goggles readouts without wearing them. Look at any Create part for its speed, stress, contents, heat or boiler status, in exact numbers. Your helmet slot stays free for armour.
- **The whole network's stress.** Hold **Left Shift** while you look at any turning part: it shows the stress of everything on that network, as a stressometer would.
- **Move or resize the readout** in ESC → HUD Layout ([The ESC menu](esc-menu.md#hud-layout)).
- **Tooltips.** Hold **Shift** over a Create item for a summary. Where it says *Hold [Ctrl] for Controls*, hold Ctrl for its clicks: the wrench, the clipboard, filters, the linked controller and the toolbox all have some.
- **A stuck machine says why.** Look at it: *No Targets* (an arm with nothing selected), *Deployer cannot activate* (it's holding items it picked up: pull them out with a funnel or hopper), *Overstressed* (see [the numbers](#speed-and-stress-numbers)), *Derailed Train* (wrench it back onto a track).
- **JEI by machine.** Press **U** over a machine for everything it does. Create's recipes are sorted by machine: crushing, milling, pressing, mixing (with the heat it needs), the fan's bulk washing, smoking, blasting and haunting, deploying, spouts, sequenced assembly and more.

## Machines and your skills

A machine works at the skill levels of its **operator**: the player who placed it, or the last one to right-click it.

- **Which machines.** Mechanical crafters, basins (with the mixer or press above them), spouts, the vanilla Crafter, and drills and saws.
- **Below the level, it waits.** If the operator lacks the level a recipe needs, the machine won't make it, and they get a chat message with a ding naming the skill. A mixer brews only with ingredients the operator's Brewing allows. A drill or saw leaves standing what its operator couldn't break by hand, such as a log past their Woodcutting chop level.
- **Click the right block.** For a mixer or press, right-click the basin under it (with an empty hand that also gives you what's inside). In a grid of mechanical crafters, the one at the exit, whose arrow points out of the grid, makes the item: right-click that one.
- **On a contraption,** each drill and saw keeps the operator it had when the contraption was put together. Place or right-click them yourself before you start it.
- **While you're offline,** your machines work at the levels you had when you last placed or right-clicked them. While you're online they use your levels as they are.
- **Whoever right-clicks takes over.** A friend who takes an item out of your basin becomes its operator, and it then runs at their levels. If a machine stops making something, right-click it again. A machine a schematicannon placed has no operator, and makes nothing that needs a level until someone right-clicks it.
- **The operator decides what a machine can make, not who gets its XP.** That goes to whoever is near ([Machine XP](#machine-xp)).
- **Making the machines** takes levels too: see [Create basics](create.md#milestones-your-skills-unlock) and [Skills](skills.md#create-machines).

## Machine XP

When a machine does a skill's work, every player within **16 blocks** of it gets the XP that work pays by hand. Two of you standing by it both get all of it, whoever owns it.

- **What pays.** Drills, saws, mechanical harvesters, ploughs and rollers pay the Mining, Woodcutting or Farming for each block they break, standing still or on a contraption. A saw pays for every log of the tree it fells. Mechanical crafters, the Crafter and basins under a mixer or press pay what crafting their result by hand pays. A fan that blasts or smokes pays what a furnace or smoker would, for every item.
- **What pays less.** A block someone placed pays nothing, as it does by hand; a fully grown crop still pays. A block lava and water made, such as a cobblestone generator's, pays a tenth: a cobblestone pays 1 Mining by hand, and a machine gets that 1 for about one cobblestone in ten, so a generator levels you, slowly.
- **What pays nothing.** Crushing wheels, millstones, deployers, spouts, fans that wash or haunt, and the ore vein drilling machine. Blocks a deployer or a schematicannon places pay no Construction XP.
- **Nobody near?** The XP is lost, unless an [XP Bank](#the-xp-bank) is in reach.

## The XP Bank

An XP Bank keeps a share of the XP that machines within **8 blocks** of it earn while nobody is within 16 blocks of them. Come back and right-click it to take the XP.

| Tier | Keeps | How you get it | To make it |
|---|---|---|---|
| I | 10% | An XP Bank: brass sheets, Blocks of Experience, framed glass, a brass casing and a precision mechanism | Crafting 40 |
| II | 25% | A Tier II upgrade used on a Tier I bank: diamonds, Blocks of Experience and an echo shard | Crafting 60 |
| III | 50% | A Tier III upgrade used on a Tier II bank: netherite ingots, Blocks of Experience, echo shards and a nether star | Crafting 80 |

- **Right-click** it with an empty hand to take what it holds; **sneak-right-click** to see what it holds and what you'd take. Its window glows green while it holds anything, and a comparator reads how much.
- **You take at your own tier.** Someone who can make only a Tier I bank takes 10% from a Tier III one, and a chat line with a ding says why. Until you can make an XP Bank at all, you can't take from one. Taking empties the bank, and the share your tier can't take is lost.
- **Upgrades go on in place.** Use the upgrade on the bank. What it held already stays at the share it came in at.
- **Break it and it keeps everything.** The item carries its tier and its XP, and places back the same.
- **The nearest bank catches the XP;** of two as near, the higher tier. A bank doesn't ride on a contraption: a moving drill's XP goes to a bank within 8 blocks of where the drill is.
- **Anyone can take from your bank**, as from your chests (there are no claims), so build it where you can keep an eye on it.

## Guarding your machines

There are no land claims, so whatever you build can be used or taken by whoever comes by.

- **Anyone can wrench your machines** into their own inventory in a second, use your toolbox from 10 blocks away (holding **Left Alt**), pick up your minecart contraptions, and board, fly or take apart your airship. Build where you can watch, or where nobody will look.
- **Lock your stock network.** Click the lock in the Stock Keeper's screen and other players can no longer order from your network directly. A table cloth shop on it still sells to them, through shopping lists.
- **Your trains are on everyone's map.** Every track and train shows on the world map (**M**); hover a train for whose it is and where it's going.

## Speed and stress numbers

- **Minimum speeds are rare.** In Create itself only the mechanical mixer and the display board need a minimum speed: 30 RPM (*Moderate* on their tooltip). Everything else works at any speed, just slower. A few add-ons have their own: Slice & Dice's slicer and Create Ore Excavation's drilling machine need 30 RPM too, and Crafts & Additions' alternator needs 32.
- **Getting to 30.** A water wheel turns at 8 RPM, so a mixer on one needs two big-to-small cogwheel steps: 8 to 16 to 32. A rotation speed controller sets any speed on its panel. Nothing turns faster than 256 RPM.
- **Stress is per RPM.** A machine's load is its stress impact times its speed, so doubling a machine's speed doubles its load. A source gives its capacity times its own speed. Gearing up never adds power, it only spends it faster: a mixer at 32 RPM takes 128 SU, half of what a water wheel gives.

| Load per RPM | Parts |
|---|---|
| 8 SU | Mechanical press; each crushing wheel |
| 4 SU | Mechanical mixer, millstone, saw, drill, deployer, mechanical pump, bearings, pistons, rope, hose and elevator pulleys, turntable, a backtank being filled |
| 2 SU | Encased fan, mechanical crafter, mechanical arm, weighted ejector |
| 1 SU | Chain conveyor, cuckoo clock |
| None | Shafts, cogwheels, gearboxes, belts, clutches, gearshifts, chain drives, gauges, display boards |

| Source | Speed | Stress it gives |
|---|---|---|
| Water wheel | 8 RPM | 256 SU |
| Large water wheel | 4 RPM | 512 SU |
| Windmill | 1 RPM for every 8 sail blocks, up to 16 RPM | 512 SU per RPM, up to 8,192 |
| Hand crank | 32 RPM while you hold it (it costs hunger) | 256 SU |
| Steam engine | Up to 64 RPM at full power | Up to 16,384 SU each |

- **One wet side is enough.** More water around a water wheel adds nothing: build more wheels instead.
- **Steam.** A boiler needs at least four fluid tanks. Each boiler level lets one more engine run at full power, and goggles show its level and what holds it back: heat, water or size. A fed blaze burner under the tank counts as 1 heat, a superheated one (fed a Blaze Cake) as 2.
- **Overstressed?** If the load is more than the capacity, the whole network stops. Add a source, or slow the heavy machines down.
- **Sources that disagree break things.** Joining two networks that turn a shaft opposite ways, or at different speeds, breaks the block where they meet. Line up their directions first, with a gearbox or a gearshift.

## Moving items

- **Funnels go one way.** Placed normally, a funnel pulls items out of the block it's on; place it while sneaking and it puts items in. A wrench flips it. On a belt it takes items off or puts them on, depending on which way the belt runs. A redstone signal stops it.
- **Funnels never link two containers.** A funnel can't move items straight from one chest to another: put a chute (going down) or a belt (going sideways) between them.
- **Andesite or brass.** An andesite funnel moves one item at a time. A brass funnel moves up to a stack, with a filter and an amount.
- **Chutes** drop items between inventories. An encased fan at the top or bottom blows them up instead. A chute placed against another's side runs diagonally, and a smart chute adds a filter and a stack size.
- **Mechanical arms are set up before you place them.** Hold the arm and right-click what it should take from (blue); right-click again to make it a drop-off (yellow); left-click to unselect. Then place the arm within 5 blocks of them. An arm can't filter, but pointed at a brass funnel it follows that funnel's filter, and it won't pick up what it can't drop off. Its panel chooses Round Robin, Forced Round Robin or Prefer First (in the order you selected them).
- **Tunnels split belts.** An andesite tunnel over a belt, with belts or funnels at its sides, sends exactly one item of each passing stack to the side. A brass tunnel has a filter on every side and a panel for how it shares (Split, Round Robin, Prefer Nearest, Randomize and more). Brass tunnels on belts side by side work as one group; *Synchronize Inputs* holds items until every belt in the group has one.
- **Exact amounts.** A brass tunnel on *Prefer Nearest* with a weighted ejector at its side exit splits off exactly the ejector's set stack size.
- **Weighted ejectors** throw items, and anyone who steps on them, up to 32 blocks, at any height but only straight ahead: sneak + right-click the landing spot holding the ejector, then place it. Aimed at an inventory it waits for room, and its panel sets how many items it waits for.
- **Item vaults** hold 20 stacks a block and merge with their neighbours (up to 3x3 across and three times that long). They have no screen: fill and empty them with funnels, chutes, arms or packagers, or put an **item hatch** on one. Right-click the hatch with a stack to put it in; sneak + right-click puts in everything but your hotbar.
- **Packages and stock.** Packagers, stock links, the stock keeper, frogports and postboxes each have Ponder scenes. Worth knowing: a stock link's network reaches any distance, but packages still have to travel there; and entries starting with # on a clipboard you hold help fill in addresses.
- **Some of these take skill to make:** mechanical arms, item vaults, the stock ticker, redstone requesters and factory gauges need Crafting levels. See [Skills](skills.md#crafting).

## What processing gives

**Crushing raw ore gives no extra metal.** Raw ore crushes one for one: a crushed ore, and a 75% chance of an experience nugget (two for gold). Washing that crushed ore gives 9 nuggets, the same one ingot a furnace would, plus a chance of a byproduct; smelting it gives one ingot. Extra metal only comes from ore blocks mined with Silk Touch:

| Crushing | Crushed ore you get |
|---|---|
| Raw iron, copper, gold or zinc | 1, and a 75% chance of an experience nugget (2 for gold) |
| Iron, gold or zinc ore | 1, and a 75% chance of a second |
| Deepslate iron, gold or zinc ore | 2, and a 25% chance of a third |
| Copper ore | 5, and a 25% chance of a sixth |
| Deepslate copper ore | 7, and a 25% chance of an eighth |
| A block of raw ore | 9 |

- **Washing byproducts.** Crushed iron gives redstone (75% chance), crushed copper clay (50%), crushed gold nether quartz (50%), crushed zinc gunpowder (25%).
- **Ore blocks are Hardness materials:** a machine only takes them from you once your Mining level reaches their tier ([Hardness](enchanting.md#hardness-what-your-pickaxe-can-break)).
- **Metal from stone.** Create's own stones underground crush into ore too: veridium into copper (80% chance), crimsite into iron (40%), asurine into zinc (30%) and ochrum into gold (20%), each with the same chance of a nugget on top.

**What a fan does** depends on what its air passes through:

| In front of the fan | Processing |
|---|---|
| Lava, or a blaze burner with fuel | Bulk blasting: smelts ores and the like |
| Fire, a lit campfire, or a blaze burner with no fuel | Bulk smoking: cooks food |
| Water | Bulk washing |
| Soul fire or a lit soul campfire | Bulk haunting |
| Powder snow | Bulk freezing (Create: Dragons Plus) |
| Dragon's breath or a dragon head | Bulk ending (Create: Dragons Plus) |
| Liquid dye (a dye mixed with 250 mB of water) | Bulk colouring (Create: Dragons Plus) |

- **Food in a blasting stream burns to nothing.** Smoke it instead.
- **Speed is reach, not time.** A fan reaches 3 blocks when slow and 20 at 256 RPM. Processing always takes 7.5 seconds for up to 16 items, and longer for bigger stacks: a full stack of 64 takes four times as long. It works on items lying in the stream, on belts and on depots, and the air passes through fences, bars, leaves and campfires.
- **No fire, no flooding.** Create: Connected's fan catalysts hold the job inside a block, so nothing spreads or flows. Right-click an empty one with a lava bucket (blasting), netherrack (smoking), a water bucket (washing), soul sand (haunting), a powder snow bucket (freezing), sand (sanding, like sandpaper) or a dragon head (ending).
- **Basins hand their results down.** After each step a basin puts the result into an inventory, belt or depot below it or diagonally below (a little faucet shows when it has somewhere to go). With nowhere to go it keeps the results, so you can use them again as ingredients; take them out with a filtered funnel so the ingredients stay.
- **Two recipes, one basin?** The filter slot on a mixer or press picks which one to make. A mixer makes any shapeless crafting recipe; a press over a basin compacts any 2x2 or 3x3 recipe of one item.
- **Saws** facing up process items on a belt, and results leave against the saw's rotation. When an item has several outcomes (a stonecutter's), set the saw's filter or it cycles through them all.
- **Mechanical crafters.** Wrench each crafter's front so the arrows meet at one exit. Wrench their backs to join their inputs, so one funnel feeds them all. Slot covers make a crafter count as an empty slot, and a redstone pulse starts a recipe that doesn't fill every crafter.
- **Sequenced assembly.** A half-done item's tooltip shows its next step and its progress. Some recipes go round several times, and a share of the output comes out as random salvage (JEI's recipe shows what).
- **Blaze burners** take any furnace fuel for heat, from your hand, an arm or a deployer; a Blaze Cake superheats them. A blaze burner with no fuel, or an empty one lit with flint and steel, isn't hot enough for heated recipes. Crafts & Additions: right-click a blaze burner with Straw and it takes liquid fuel (lava and the like) by bucket or pipe.

| Process | Turns | Into |
|---|---|---|
| Crushing | Gravel, netherrack | Sand (and a chance of flint or clay); cinder flour |
| Crushing | Blaze rod, wool | 3 or more blaze powder; 2 or 3 string |
| Crushing | Glowstone, amethyst block | Their dust and shards back |
| Milling | Cobblestone, gravel, wheat | Gravel; flint; wheat flour |
| Washing | Gravel, red sand, soul sand, sand | A chance of flint and iron nuggets; gold nuggets; nether quartz; clay |
| Washing | Wheat flour, magma block | Dough; obsidian (using obsidian still needs Mining 30) |
| Haunting | Sand, dirt, cobblestone, brick | Soul sand, soul soil, blackstone, nether brick |
| Haunting | Red and brown mushrooms, sweet berries, ink sacs | Crimson and warped fungus, glow berries, glow ink sacs |
| Haunting | Torches, lanterns, campfires | Their soul versions |
| Freezing | Ice, packed ice, blaze rod, magma cream | Packed ice, blue ice, breeze rod, slime ball |
| Ending | Cobblestone, stone bricks, apple, leather | End stone, end stone bricks, chorus fruit, phantom membrane |
| Spout | 25 mB of potion onto cinder flour | Strength: redstone; Night Vision: glowstone dust; Harming: gunpowder |
| Spout | 500 mB of water onto dirt | A grass block |

Careful with haunting: it turns stone and stone bricks into infested blocks, which hide silverfish.

## Fluids

- **Pumps push the way their arrow points.** A wrench reverses a pump; turning its shaft the other way doesn't. A pump reaches pipes up to 16 blocks on each side, a faster pump moves fluid faster, and pumps on one network add up if they all face the same way.
- **Pipes only connect.** They never hold fluid themselves. An open pipe end picks up a source block in front of it, or pours one out when pushing. A wrench gives a straight pipe a window, and a windowed pipe doesn't connect sideways.
- **You can't fill or empty a tank by hand.** Use a spout, an item drain or a basin, or put a **fluid hatch** (Create: Dragons Plus) on the tank: right-click it with a bucket or bottle to pour in, sneak + right-click to fill your container.
- **Bank your experience.** Right-click a placed fluid hatch with a Block of Experience to turn it into an **experience hatch** (Create Enchantment Industry). On a tank, right-click it to pour your XP in as liquid experience and sneak + right-click to take it back; its panel sets how much each click moves.
- **Endless water and lava.** A hose pulley lowered into 10,000 or more blocks of water or lava (an ocean, a Nether lava sea) never drains it. Looking at it says *Bottomless Supply*.
- **Item drains** empty items rolled onto them from the side, and take your held bucket or bottle with a right-click.
- **Tanks** grow up to 3x3 across and 32 high, 8 buckets a block, and a comparator reads how full they are.

## Moving builds

- **Glue it, or it stays.** A bearing, piston, pulley or gantry moves only the block in front of it, plus what's glued to it. Hold Super Glue and click two corners to glue the box between them (click again to confirm, sneak-click to discard); punch a glued box with the glue in hand to remove it. Blocks that hang on others (torches, ladders, levers) come along by themselves, and sails stick without glue (wool doesn't).
- **Windmills** need at least 8 sail blocks.
- **What won't move.** A contraption takes up to 2,048 blocks. Obsidian and reinforced deepslate never move. A minecart contraption carrying a spawner or budding amethyst can't be picked up. Blocks from the Mason's Palette, and blocks the Construction perk saved you, stay behind ([Construction](skills.md#construction)).
- **Machines that work on the move.** Drills, saws, harvesters, ploughs, rollers and deployers work as the contraption travels, and chests and barrels on board collect what they gather. Contraption Controls on board switch them on and off as you go.
- **Unload without stopping.** Two portable storage interfaces facing each other with a 1 or 2 block gap connect as the contraption passes, and the fixed one then reaches every inventory on board. The contraption waits until nothing has moved for a moment.
- **Back to blocks.** When a piston, pulley or bearing stops, its build turns back into blocks. Its panel can make that happen only where it started, or never.

## Building faster

- **Placement assist.** Hold a shaft, cogwheel, piston pole, gantry shaft, girder, metal ladder, sail, drill, saw, deployer, roller, steam engine, display board, rotation speed controller, copycat panel or step, or table cloth, and look at one already placed: a ghost shows where the next one goes. Right-click to put it there, even out over thin air, up to 12 blocks on. With a cogwheel, the ghost also shows where it would mesh with the cog you're looking at.
- **Casings by hand.** Right-click a stripped log or stripped wood with andesite alloy for andesite casing, a copper ingot for copper casing, or a brass ingot for brass casing; a sturdy sheet on brass casing makes train casing. JEI lists these under *Manual Item Application*, and a deployer can do them.
- **Encased shafts and cogs** are made in place: right-click a shaft or cogwheel with andesite or brass casing. JEI hides them because they can't be crafted.
- **Belts** join two shafts 2 to 20 blocks apart: right-click both with a belt (sneak + right-click cancels). A belt costs no stress, and an empty-hand right-click takes an item off it.

## Add-ons worth knowing

| Add-on | Part | What it's for |
|---|---|---|
| Create: Connected | Brass gearbox | Set each face's direction on its own, with a wrench |
| Create: Connected | 6-way gearbox | Shafts on all six faces; top and bottom turn at half speed |
| Create: Connected | Overstress clutch | Lets go when its network overstresses, like a circuit breaker; reset it with a wrench |
| Create: Connected | Kinetic battery | Charges from rotation while unpowered and gives it back while powered |
| Create: Connected | Kinetic bridge | Lends a set amount of stress capacity to a separate network |
| Create: Connected | Brass chute | Moves up to 64 items at a time |
| Create: Connected | Item silo | An item vault that stacks upward |
| Create: Connected | Inventory access port, inventory bridge | Reach an inventory in a tight spot; a bridge sorts between two by its filters |
| Create: Dragons Plus | Fluid hatch | Fill and empty a tank by hand |
| Create Enchantment Industry | Experience hatch | Keep your XP in a tank as liquid experience |

- **Craft one alone to swap.** With Create: Connected, crafting a part on its own turns it into its sibling: clutch and inverted clutch, gearshift and inverted gearshift, item vault and item silo, fluid tank and fluid vessel, redstone link and linked transmitter, and each gearbox and its vertical version.
- **Electricity** (Crafts & Additions). An alternator turns rotation into electricity: it needs at least 32 RPM and gives more the faster it turns. An electric motor turns it back into rotation, at the RPM you scroll on its back panel. Wire them up by right-clicking two connectors with a spool: a small connector links to up to 4 others, 16 blocks away at most; a large one takes only gold or electrum spools and links to up to 6, 32 blocks away. A wrench switches a connector between push, pull and neither.
- **Cooking by machine** (Create: Central Kitchen, Slice & Dice). Packagers and mechanical arms load Farmer's Delight cooking pots, which cook at the Cooking level of whoever last opened them. A saw, or a deployer holding a knife, does cutting-board recipes on a belt, and so does Slice & Dice's slicer (right-click it with a knife to fit one; it needs 30 RPM). A mixer over a heated basin cooks pot meals at its basin operator's Cooking level.

## Trains and airships

[Getting around](travel.md) covers laying track, schedules, signals and flying. The Create side in brief:

- **Stations and train controls** need **Agility 35** to make.
- **Scheduled trains run with nobody near.** They keep going through unloaded land and still stop at stations and red signals, but drills and other machines on board stop working there.
- **Nether portals can kick riders.** Track laid against a portal crosses to the other side, but send freight across unmanned.
- **Trains hurt.** A moving train damages any player or mob in its way.

## Good to know

| Thing | What to know |
|---|---|
| Experience nuggets | Crushing and other Create steps drop them. Right-click for the XP; 9 make a Block of Experience |
| Riding chains | Right-click a chain conveyor holding a wrench to hang from it and ride along; at a junction, look at the chain you want |
| Seats | A hostile mob that walks past an empty seat sits down on it |
| Renewable dragon's breath | Dragon's breath above pointed dripstone slowly fills a cauldron below it, like lava (Create: Dragons Plus) |
| Concrete from lava | Liquid dye flowing into lava makes concrete of that colour (Create: Dragons Plus) |
