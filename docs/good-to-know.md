---
description: >-
  The server's own rules that catch new players out: graves, skill XP, machines that run at your level, weekly missions and shops that sell while you're away.
icon: lightbulb
---

# Good to know on this server

These are the rules this server adds, or changes from the mods' defaults, that you wouldn't work out just by playing. Each one links to the page with the whole story.

## After you die

- **A grave needs Grave Essence.** Carry one and your items wait in a grave where you fell; without one they drop on the ground ([Graves and Grave Essence](lifesteal.md#graves-and-grave-essence)). Your Heart is never in the grave: it lies beside it.
- **Latest Death.** Your minimap and world map get a **Latest Death** waypoint where you fell. It deletes itself once you're within 4 blocks of it, and an older one stays as **Old Death**.
- **The Obituary.** A grave also hands you an Obituary. Right-click it for where you died (X, Y, Z and dimension), when, and every item you had. Keep it until you're back.
- **Anyone can break your grave.** Whoever breaks it gets the items, sorted into their own inventory, so get there first ([Graves aren't locked](combat.md#graves-arent-locked)). When you break it yourself, everything goes back into the slots it was in, armour on, and what doesn't fit drops.
- **Right-click a grave** to see whose it is and when they died. Explosions and mobs can't break one.

## Training skills

- **Blocks you placed pay nothing.** Breaking a block you placed yourself pays no skill XP. Someone else's placed blocks still pay, and fully grown crops always do.
- **Create machines train nobody.** Whatever drills, saws, harvesters, fans, crushing wheels, mechanical crafters and deployers mine, chop, cook or make earns no one skill XP. Train by hand.
- **Machines don't build for XP either.** Blocks a deployer or a schematicannon places pay no Construction XP.
- **Quest XP isn't skill XP.** It's the vanilla kind, for enchanting ([Quests](quests.md#how-rewards-scale)).
- **Train together.** A skill party gives everyone in it within 50 blocks the XP any of you earns ([Skill party](social.md#skill-party)).

## Gear that needs a level

Skills gate making, wielding and wearing things ([Skills](skills.md)). A few things also stop working until you have the level:

- **Backpack upgrades** work only once you have the level it takes to make them: a Magnet Upgrade needs Crafting 30. Until then it does nothing. Stack and tank upgrades always work.
- **A relic's abilities** wait for the relic's level ([Relics in a fight](combat.md#relics-in-a-fight)).
- **A Totem of Undying** saves you only at Hitpoints 50 or higher ([Totems](combat.md#totems)).
- **Ores your Mining can't use yet** can wait in a chest, barrel, shulker box or ender chest, but recipes, machines and backpacks refuse them; a backpack's pickup upgrade leaves them for your own pickup ([Enchanting](enchanting.md)).
- **Every refusal tells you.** A gold line in chat and a ding say what it needs and what you have, such as "Your Magnet Upgrade won't work until you have Crafting 30 (you have 12)." The same reminder doesn't repeat for a while.

## Machines run at a level

A machine that works on its own runs at the skill levels of its **operator**: whoever placed it, or last right-clicked it. [What each skill unlocks](skills.md#what-each-skill-unlocks) has the whole rule.

- **What it covers.** Mechanical crafters, mixers and presses (through their basin), spouts and the Crafter won't make a skill-gated thing past their operator's level. A drill or saw won't break a block that needs a level its operator doesn't have: a log past their Woodcutting chop level stays standing. A placed backpack's upgrades work at its operator's level too.
- **Whose level.** The operator's own while they're online; while they're away, the levels they had when they last placed or right-clicked it. On a moving contraption, a drill or saw keeps the operator it had when the contraption was put together.
- **Built by a schematicannon?** Then nobody has placed it, and it makes nothing gated until someone right-clicks it.
- **When it can't,** its operator gets a chat line once a minute, with the machine's place: "Your Mechanical Crafter at 120 64 -30 can't make Cake: it runs at your level, and that needs Cooking 20 (you have 12)."
- **Anyone's right-click counts,** a visitor's too. If a machine stops after someone has been round, right-click it yourself. For a mixer or a press, right-click the basin.
- **Brewing stands and cooking pots** fed by hoppers work at the level of whoever last opened them.

## Weekly missions

Open them with **H**, ESC → **Missions**, or `/missions`.

- **Six at a time.** A new set comes every Sunday at 00:00 UTC, and the screen counts down to it. Scroll the list to pick one.
- **Claim what you finish.** A finished mission pays only when you press **Claim Reward**: 1 to 32 Coin Pouches, by mission, and each pouch opens into 100 coins. Rewards you haven't claimed are kept through the reset.
- **Rerolls.** The first two each week are free; after that they cost 2, 4, 6 pouches and so on, 2 more each time. The 18th costs 32, and then there are no more until Sunday. The pouches must be in your inventory, not a backpack, and a finished mission can't be rerolled.
- **Reroll what you can't do yet.** Some missions ask for something you may not have: diamond tools (Crafting 30), mechanical crafting, drilling, sawing or harvesting with machines, flying with an elytra (Agility 30), or using a Totem of Undying (Hitpoints 50).
- **Track one** with **Track/Untrack** to see its progress on your screen. The Track key is unbound (T is chat), so bind it in Controls if you want one.
- **Claimed missions count** towards the Contracts quests ([Quests](quests.md)).

## Selling while you're away

Create's table cloths turn a stock network into a shop that sells while you're offline:

1. Give the shop's inventory (chests or vaults) a Packager and a Stock Link.
2. Bind a Stock Ticker to the link and put it in the shop. Making one takes Crafting 45.
3. Seat a mob in front of the ticker, or put a blaze burner there: that's your shopkeeper.
4. Fill the inventory with what you sell.
5. Hold a Table Cloth and right-click the shopkeeper to make a trade. Place the cloth and put the price in the slot on its side: an item, and how many.
6. Buyers right-click cloths to fill a Shopping List and hand it to the shopkeeper. What they bought comes out in a package, and their payment collects in the stock ticker.

Hold **W** over a table cloth for Create's Ponder scene of the whole thing.

{% hint style="warning" %}
**Lock your network.** In the Stock Keeper screen, click the lock until it says **Network is locked**. Others can then no longer order from it directly or link new blocks to it, and your table cloths still sell. Unlocked, anyone at your shopkeeper can order anything in the network.
{% endhint %}

## Loot chests

- **Every loot chest is yours alone.** Each player gets their own loot from it. They look gold until you've opened one, and blue after, for you.
- **Also per player:** minecart chests in mineshafts, the elytra in an End ship's item frame (everyone can take one), decorated pots, and suspicious sand and gravel.
- **Don't break them.** Hitting a loot chest only gives a warning. Breaking it while sneaking removes it for everyone, and none of its loot drops. Explosions can destroy them too.
- **A second Heart of the Sea.** The ocean towers that stand in deep oceans, with a waystone on top, have a chest at the top that sometimes holds a Heart of the Sea: about one chest in six. Like every loot chest, each player gets their own roll. It's the base of a new Heart ([Getting hearts back](lifesteal.md#getting-hearts-back)).

## Small things

- **Your backpack is closed to others.** Nobody else can open the backpack you're wearing unless you switch it on ([Sharing your backpack](combat.md#sharing-your-backpack)).
- **Create Deco's coins aren't money.** Its gold, brass, copper, iron, zinc, industrial iron and netherite coins and coin stacks are decoration. The server's money is Gold Coins ([Coins, vendors and trading](economy.md)).
- **Shops switch off the inventory shortcuts.** In a vendor's shop and the trade window, sorting, scroll-moving, drag-moving and Ctrl- or Space-clicks are off on purpose: every click there buys, sells or offers something.
- **Quest items aren't taken.** An item task only checks what you carry, and nothing is used up. Some steps are a checkmark: click it to tick it. Most rewards wait in the book until you claim them ([Quests](quests.md)).
- **Nothing is claimed.** What you build isn't locked to you: see [What others can do](combat.md#what-others-can-do).
