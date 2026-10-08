---
description: >-
  Move and sort items fast, find any recipe, and get the most from your backpack: wearing it, its upgrades, this
  server's limits and who can open it.
icon: box-open
---

# Inventory, sorting and storage

Several mods make every inventory screen quicker than vanilla: your inventory, chests, barrels, shulker boxes and backpacks. The tricks below work in nearly all of them. Every key is also on [Keybinds](keybinds.md).

## Move items fast

- **Paint one item per slot.** Pick up a stack, hold the right button and sweep over slots: each gets one item, and passing a slot again adds another. It's the quickest way to lay out a crafting grid.
- **Gather a kind.** Pick up a stack, hold the left button and sweep: every stack of the same item you pass joins the one on your cursor.
- **Shift-click in one sweep.** Hold Shift, hold the left button and sweep over slots: each one is shift-clicked to the other side. Holding a stack, the same sweep moves only that item.
- **Move every stack of a kind.** Ctrl + Shift + click a stack: all of that item moves to the other side, all the cobblestone out of a chest at once.
- **Move everything.** Hold Space and click any item: the whole inventory it's in moves to the other side. Space + right-click moves one of each item.
- **Move one.** Ctrl + click moves a single item.
- **Use the wheel.** Over a stack, roll the wheel down to send its items to the other side one at a time, or up to pull more of that item in.
- **Drop a whole kind.** Ctrl + Shift + Q over a slot drops every stack of that item. Holding a stack, Shift + click outside the window drops it and every stack like it. Careful near lava, and near other players.

{% hint style="info" %}
Two mods move items with the wheel: Mouse Tweaks and Inventory Profiles Next (IPN). If the wheel moves things the wrong way for you, switch one off: **Wheel Tweak** in Mods → Mouse Tweaks → Config, or **Enable Item Scrolling** in IPN's settings (hold R and press C). Mouse Tweaks can also be switched off on the launcher's Mods page.
{% endhint %}

In a vendor's shop and the `/trade` window all of this is off on purpose: there a click buys, sells or offers. See [Coins, vendors and trading](economy.md#vendors).

## Sort and keep things put

Sorting comes from Inventory Profiles Next (IPN). Its keys live in its own settings, not in Controls: see the table below.

- **Sort with R.** In any inventory screen, R sorts the side your mouse is over, the chest or your own inventory. Over an item R also opens its recipes, so point at an empty slot.
- **Sort buttons.** An open chest, barrel or shulker box has small buttons at its top right: sort, sort in columns and sort in rows. Roll the wheel over one to change what it sorts by (name, ID, count and more). Only the container gets them; sort your own half with R.
- **Move All.** The arrow button empties the container into your inventory, or your inventory into it. Your hotbar stays put. Hold a key as you click it to change what moves (see below).
- **Lock a slot.** Hold Left Alt and click a slot in your inventory or hotbar. Sorting, Move All and Shift + click leave a locked slot alone, items you pick up don't fill it while it's empty, and out of menus Q won't throw a tool or weapon from a locked hotbar slot. Locks are kept per server.
- **Auto Refill.** When a hotbar stack runs out, more of the same comes up from your inventory. A tool or a piece of armour about to break (10 durability left) is swapped for a spare. Hold Left Alt while you use a tool to let it break instead.
- **A slot that stopped refilling.** Ctrl + click on a hotbar or armour slot is also IPN's switch for that slot's Auto Refill, and the pack hides the small marks that show which slots refill. Ctrl + click it again, or press Left Ctrl + R in game for the slot in your hand.
- **Keep crafting.** The green tick under the crafting arrow, in your inventory and at a crafting table, refills the grid from your inventory after each craft, so you can keep taking the result. Untick it to stop. Its tooltip names the key that crafts until the ingredients run out.
- **Spot the same item.** Hover an item and every slot holding the same lights up.
- **Rename a whole kind.** At an anvil, tick **Bulk Rename** to rename every stack of that item you carry.

| Hold while you click Move All | What moves |
|---|---|
| Nothing | Everything |
| Left Shift | Only the items the other side already has |
| Left Alt | Your hotbar too |
| Left Ctrl | Only the kind of item under the mouse |
| Caps Lock | Only enough to top up the stacks already there |

### IPN's keys

Hold R and press the second key. Change any of them on the Hotkeys page of IPN's settings.

| Keys | What they do |
|---|---|
| R | Sort the side under the mouse |
| R + C | IPN's settings |
| R + T | Move All, like the arrow button |
| R + M | Throw All: throws items from the side under the mouse onto the floor (hold Left Shift for all of them). Easy to press by mistake |
| R + G | IPN's button layout editor |
| Left Alt + click | Lock or unlock a slot |
| Ctrl + click a hotbar or armour slot | Switch its Auto Refill off or on |
| Left Ctrl + R, no screen open | The same for the slot in your hand |
| Wheel over a stack | IPN's own scrolling: hold Left Shift for the whole stack, Z to leave one behind, X to spread it over free slots, C to throw it out, Left Ctrl to pause |

## Find any recipe

JEI is the item list down the right of every inventory screen. Hover an item in any menu and press **R** for its recipes or **U** for what it's used in; left- and right-click in JEI's list do the same.

- **Fill the grid.** On a recipe page, the **+** button beside the recipe moves the ingredients from your inventory into the open grid: your inventory's 2×2, a crafting table, a backpack's crafting upgrade or Create's crafting blueprint. Shift + click it to fill as many sets as you have. If you're short of something, its tooltip says *Missing Items*.
- **Bookmark what you're after.** Press A over an item to pin it to the list on the left (A again takes it off). Press A over a recipe's result to bookmark the recipe itself. Bookmarked and craftable recipes are listed first, and a bookmarked recipe's tooltip shows the keys to craft it once or many times.
- **Set a filter without the item.** Drag an item from JEI's list onto a backpack upgrade's filter slot, or into a Create filter's screen.
- **Where it comes from.** The **i** tab on an item's page says how to get it ([Where to find things](where-to-find.md)). An ore also has a **World Generation** page: the heights and biomes it turns up in ([Tools and mining](tools-and-mining.md)).
- **JEI vanished?** Ctrl + O brings it back.

### Search tricks

Click the search bar at the bottom right (or press Ctrl + F) and type. Plain words match item names and tooltip text. Right-click the bar to clear it; the Up and Down arrows bring back earlier searches. These narrow it down:

- `@create`: items from one mod
- `#c:ingots`: items with a tag
- `$heals`: tooltip text only
- `-stairs`: leave those out
- `oak|birch`: either word
- `"iron ore"`: the exact phrase

## Your backpack

Backpacks carry far more than your inventory, and their upgrades pick up, sort, feed and craft for you. Here they don't turn up in loot chests or on mobs: you make them, and the quest book's reward crates hand out upgrades. The **Backpack Workshop** chapter of the [quest book](quests.md) walks through it all.

### Tiers

A leather backpack is 4 string, 4 leather and a chest. Each better tier is the one below it in the middle of a crafting grid, ringed with its Create age's parts, and keeps its contents and upgrades.

| Tier | Ring it with | Slots | Upgrade slots | Needs |
|---|---|---|---|---|
| Leather | (4 string, 4 leather, a chest) | 18 | 1 | — |
| Copper | 6 copper sheets, 2 andesite alloy | 27 | 1 | Crafting 10 |
| Iron | 6 iron sheets, 2 andesite casings | 36 | 2 | Crafting 20 |
| Gold | 6 golden sheets, 2 brass casings | 54 | 2 | Crafting 35 |
| Diamond | 6 diamonds, 2 precision mechanisms | 72 | 3 | Crafting 50 |
| Netherite | At a smithing table: a netherite upgrade template and a netherite ingot | 90 | 4 | Smithing 55 |

### Wear it

- **Wear it to make it work.** Put it in the **Back** slot (G opens your Curios slots) or in the chest armour slot. Only a backpack you wear runs the upgrades that work by themselves, such as pickup, magnet, feeding and the furnaces. Others you carry are plain storage.
- **Open it.** B opens the backpack you wear (so does ESC → Backpack). Right-click one in your hand, or hover any backpack in an inventory screen and press B.
- **The Back slot is shared.** The Relics mantles (Midnight, Leafy, Glitchy and Ghostly) go there too. With a mantle on, wear your backpack in the chest slot, or its upgrades stop.
- **Three at most.** Carry a fourth backpack and you get Slowness, a level for each extra one.
- **Set it down.** Sneak + right-click a block with the backpack in your hand to place it; on a chest, its deposit and restock upgrades run instead. Right-click it to open it, and sneak + right-click it with an empty hand to pick it up. Broken, it keeps everything inside. Hoppers and funnels can fill and empty a placed backpack, and a comparator reads how full it is.
- **When you die.** A Grave Essence inside a backpack you carry still counts for your grave ([Hearts, graves and elimination](lifesteal.md#graves-and-grave-essence)). Graves aren't locked to their owner: whoever breaks yours gets what's in it.

{% hint style="info" %}
**Your backpack is closed to other players.** Every backpack starts with **Another player can NOT open**, so right-clicking your back opens nothing. To let a teammate reach in, switch **Another player can open** on in the backpack's settings (the settings button in the backpack screen); on the **Player** tab it covers all your backpacks. While it's on, anyone who right-clicks your back can take what's inside, so switch it off again afterwards. See [Combat and PvP](combat.md).
{% endhint %}

### Upgrades

Upgrades go in the backpack's upgrade slots. Each one adds a tab at the side with its filter and options, and most have an ON/OFF switch; Alt + Z and Alt + X switch the upgrades in the first two slots on and off. Most are made on an Upgrade Base (4 string, 4 iron ingots and a leather), and an advanced one from the basic one. JEI shows every recipe.

{% hint style="info" %}
**Upgrades follow your skills.** An upgrade only works once you have the level it takes to make it: the level after its name below, also on its tooltip. Until then it sits idle, and a chat message with a ding says what it needs. One from a quest crate or a friend waits for your level too. A backpack set down as a block works at the levels of whoever last placed or opened it. Stack and tank upgrades always work.
{% endhint %}

- **Pickup** (Crafting 5; advanced 30). Items you pick up go straight into the backpack, and a placed backpack takes items that touch it. Its filter allows or blocks a list; the advanced one can also match by mod or tag, or take only what the backpack already holds.
- **Magnet** (Crafting 30; advanced 45). Pulls dropped items within 3 blocks into the backpack (the advanced one 4), with the same filters.
- **Deposit and restock** (Crafting 20; advanced 40). Sneak + right-click a chest with the backpack in your hand, or wear it, look at the chest and press C. Deposit puts the filtered items in the chest, and can be set to only what the chest already holds; restock takes them out into the backpack.
- **Refill** (Crafting 20; advanced 40). Keeps the items in its filter topped up in your inventory, so torches, food and blocks never run out. The advanced one lets you choose the slot, and middle-click (pick block) takes a block from the backpack.
- **Feeding** (Cooking 25; advanced 40). Eats food from the backpack when you get hungry. Its filter decides which foods.
- **Crafting** (Crafting 15). A crafting grid in a tab that keeps its items when you close it. JEI's + button fills it.

| Upgrade | What it does | Needs |
|---|---|---|
| Stack | More of each item per slot: starter ×1.5, tier 1 ×2, tier 2 ×4. Tier 2 is 4 gold blocks and 4 brass casings around a tier 1 | Crafting 15, 25, 40 |
| Compacting | Turns items into their compact form as they come in, nuggets into ingots and ingots into blocks (2×2 recipes; advanced, 3×3 too) | Crafting 30; advanced 45 |
| Void | Deletes the items in its filter as they come in: cobblestone, gravel, rotten flesh | Crafting 25; advanced 40 |
| Tool swapper | Left-click a block or mob and the right tool from the backpack swaps into your hand | Crafting 25; advanced 40 |
| Filter | Decides what hoppers and pipes may put into or take out of a placed backpack | Crafting 5; advanced 30 |
| Smelting, smoking, blasting | A furnace in a tab. The auto kinds take fuel and items from the backpack by filter and put the results back | Smithing 15, Cooking 15, Smithing 25; auto: Smithing 40, Cooking 40, Smithing 45 |
| Anvil, smithing, stonecutter | The station in a tab, no block needed | Smithing 25, Smithing 50, Construction 10 |
| Pressing, mixing | Create's press and mixer in a tab. Pressing needs no rotation. Mixing heats with its own blaze burner (give it fuel) and takes fluid from a tank upgrade | Crafting 30, 35 |
| Alchemy | Uses potions, effect foods and milk buckets from the backpack by itself | Brewing 45; advanced 60 |
| Tank | Turns part of the backpack's slots into a fluid tank, 4,000 mB a row; those slots must be empty | Crafting 25 |
| Experience pump | Stores your experience in a tank upgrade. It doesn't mend here | — |
| Jukebox | Plays music discs | — |
| Everlasting | The backpack can't be destroyed or despawn, and won't fall into the void | — |

**Ender Linker** (Crafting 50): right-click a backpack with it, or craft the two together, then right-click an empty backpack with the linker to join it. Linked backpacks share one inventory.

### Server limits

- One stack upgrade per backpack, tier 2 (×4) at most: tiers 3, 4 and Omega are switched off.
- One furnace upgrade (smelting, smoking, blasting or an auto one), one jukebox, one tool swapper and one everlasting per backpack, and two tanks at most.
- Switched off: inception (backpacks inside backpacks), the pumps, the battery, the mob catchers and infinity.
- No shulker boxes or other item containers inside a backpack, and no backpack inside a shulker box or bundle.
- Materials past your Mining level's Hardness don't go in: a pickup upgrade leaves them to your normal pickup and tells you why. See [Enchanting](enchanting.md#hardness-what-your-pickaxe-can-break).

### In the backpack screen

- **Search.** Type in its search box to show only matching slots; start with @ to search by mod.
- **Sort.** Middle-click, or press its sort button; the button beside it switches between by name, by mod, by count and by tags.
- **Move what it already holds.** The [ key moves the items the backpack already has from your inventory into it, and ] moves them back out; hold Shift to move everything. The two arrow buttons do the same. Both keys only work in a backpack screen.
- **Dye it.** Craft it with dyes: dyes to the left of the backpack colour the main cloth, to the right the trim, above or below it both. Right-click a water cauldron with it to wash it.

The settings button opens **Backpack Settings**:

| Setting | What it does |
|---|---|
| Another player can open | Off by default. On, anyone can open it from your back (see above) |
| Memory | Slots you pick remember their item and only take that item, so sorting and pickups keep things in place |
| No Sort | Slots that sorting leaves alone |
| Item Display | Shows one slot's item on the backpack, a label for a placed one |
| Player and Backpack tabs | Player settings cover all your backpacks; Backpack overrides them for this one |
| Save and load | Keeps these settings in numbered slots (scroll to pick one) to load on another backpack |

## Peek inside containers

- **Shulker boxes.** Hover one and hold Left Shift for a preview of what's inside; add Left Alt for the full layout, and hold Left Ctrl to keep the preview still. The tooltip lists these keys.
- **Your ender chest.** An ender chest's tooltip previews your own ender chest.
- **Backpacks.** Their tooltip names the key that lists their contents and upgrades.
- **Bundles.** String over leather makes one (Crafting 10). In a menu, right-click items into it; roll the wheel over it to choose an item, then right-click to take that one out.

## Curios slots

- **G** (or the small button by your character in the inventory) opens the Curios panel: Head, Necklace, Back, Cape, two Hands, Ring, Belt, Charm and two Feet.
- **Back** takes a backpack or a Relics mantle, not both. **Cape** takes your earned cape ([Capes](capes.md)). The rest take relics ([Gear](gear.md#relics)) and other trinkets.
- **Head** takes Engineer's Goggles, so you can wear goggles and a helmet together. You may not need them at all: see [Your screen](interface.md#goggle-info-always-on).
- The eye on a slot hides that item on your character without taking it off.

## More storage

| Storage | Good to know |
|---|---|
| Create's item vaults, toolboxes, item hatches and stock network | See [Create tips](create-tips.md) |
| Shulker box | Keeps its contents when broken. Crafting 65 to make. Can't go in a backpack |
| Ender chest | The same contents, yours alone, in every ender chest. Crafting 50 to make |
| Farmer's Delight cabinet | 27 slots, like a barrel |
| Macaw's drawers, wardrobes, kitchen cabinets, drawer and cupboard counters | 27 slots each |
| Crates and bales | Nine carrots, potatoes, beetroots, cabbages, tomatoes or onions make a crate; nine rice a bag; nine rice panicles or nine straw a bale. Each crafts back into nine |

## When something looks odd

| What you see | Why, and what to do |
|---|---|
| Two stacks of the same item won't merge | They belong to different players. Sorting merges the ones that match. See [What is yours](lifesteal.md#what-is-yours) |
| An ore won't go into a backpack, hopper or machine | Its Hardness is past your Mining level. A chest, barrel or shulker box takes it. See [Enchanting](enchanting.md#hardness-what-your-pickaxe-can-break) |
| A backpack upgrade does nothing | Wear the backpack (Back or chest slot), and check you have the upgrade's level |
| A hotbar slot stopped refilling | Ctrl + click it in your inventory (or press Left Ctrl + R in game) to switch its Auto Refill back on |
| Your half of a chest has no sort buttons | Only the container gets them. Press R over your half |
| The wheel moves items the wrong way | Two mods use it: switch one off (see Move items fast) |
| The inventory tricks don't work in a shop | On purpose: every click there buys or sells |
| You're walking slowly | You carry more than three backpacks |
| All your coins sit in one stack | Coins always do. Shift + right-click the stack to take an exact amount. See [Gold Coins](economy.md#gold-coins) |
| JEI's item list is gone | Press Ctrl + O |
