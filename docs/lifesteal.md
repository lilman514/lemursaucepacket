# Hearts, graves and elimination

Every player has a stock of hearts. Dying costs one and drops it on the ground as an item. Anyone can pick it up and use it, including the person who killed you. Run out and you are eliminated: everything you ever placed and everything you own is erased. Graves are not free either: each one costs a Grave Essence.

## Your hearts

Your hearts are the full hearts of your own health bar: 10 to start, plus one per ten levels of [Hitpoints](skills.md), plus any Hearts you have used, minus any you have lost. Armour, capes, relics and potions add health on top but never count as hearts.

| | |
|---|---|
| Starting hearts | 10 |
| Hitpoints | +1 heart per 10 levels (up to +9 at level 99) |
| Most you can hold | 20, plus your Hitpoints hearts |
| Fewest | 0: you are eliminated |
| A death costs | 1 heart, dropped as a Heart item where you died |
| A Heart used | +1 heart |

`/hearts` shows the count and where it comes from.

## Dying

When you die you lose one heart of maximum health and a **Heart** drops where you fell. If a grave is placed (see below), the Heart is never inside it. It lies on the ground next to the grave, where anyone can take it.

Hearts never despawn. Fire, lava, cactus and explosions cannot destroy them. A Heart that would fall into the void floats where you died instead.

**Every death counts**, whatever killed you, from your first minute on the server. The one exception: **the same player killed you less than 30 minutes ago.** Spawn-camping pays once.

You get a warning at three, two and one heart. At one heart your next death eliminates you.

## The Heart item

Right-click a Heart to use it: +1 heart, up to the limit above. The item is used up. A Heart says who it came from.

Every Heart carries a serial number. A serial can only be used once, so a duplicated Heart is worthless: the copy crumbles when you try to use it.

Hearts are never anyone's property (see [What is yours](#what-is-yours)), so a Heart you took stays yours even if its previous owner is eliminated.

### Stealing hearts

PvP is on. Kill a player, pick up the Heart they dropped, use it. Hearts move between players but are never created this way: one player's loss is another's gain. Kill the same player again within 30 minutes and nothing drops.

### Getting hearts back

- Walk back and pick up your own Heart. If nobody took it, it is still there.
- Train Hitpoints. Every ten levels adds a heart, up to level 99.
- Make a new one. This is meant to be very hard and it can never be automated end to end.

**A new Heart** is a Create sequenced assembly on a **Heart of the Sea** (buried treasure only, one per treasure; treasure maps come from shipwrecks and ocean ruins). Over five stations:

1. Deploy a **Compacted Diamond** (4 diamonds, pressed).
2. Deploy a **Nether Star** (kill the Wither).
3. Fill with **1,000 mB of Liquid Experience** (Create Enchantment Industry).
4. Deploy a **Totem of Undying** (raids).
5. Press.

The Heart of the Sea is the bottleneck. There is no farm for it: you find one, you make one Heart.

## Graves and Grave Essence

When you die with a **Grave Essence** in your inventory, hotbar, off-hand or directly inside a backpack you carry, a grave is placed where you fell with your items in it, and one Grave Essence is used up. Without one, your items drop on the ground like vanilla Minecraft.

Grave Essence is not craftable on day one:

- **Recipe:** 1 soul sand, 1 bone block and 2 experience nuggets, mixed in a basin over a **blaze burner**, make 2. That means a trip to the Nether and a heated mixer, roughly the Brass age.
- **Loot:** a few turn up in dungeon chests (Dungeons Arise, YUNG's dungeons and strongholds) and ancient cities.

Keep a small stack on you. It stacks to 16. Your Heart never goes into the grave.

## Elimination

Lose your last heart and you are **eliminated**. Nothing is erased yet. You stay on the death screen and have two choices:

- **Wait for a revive.** Leave the server or stay on the death screen. A friend can bring you back: they hold a Heart and run `/revive <your name>`. The Heart is used up and you respawn with one heart, and nothing is erased. This works while you are offline too.
- **Accept elimination.** The respawn button is replaced by *Accept elimination*. It warns you, shows what will be erased (how many blocks you placed, how many items are yours), asks you to type ERASE, and then asks you to hold a button for five seconds. Only then does it happen.

If you accept, this happens:

- **Every block you ever placed is removed**, in every dimension, even in chunks nobody has visited since. Blocks you broke are not touched. Blocks placed with a schematicannon or moved by contraptions and ships are not tracked and stay.
- **Every item that is yours is deleted**, wherever it is: in your inventory, in any chest, machine, vault, backpack, bundle or shulker box, on the ground, in your ender chest, and in other players' inventories, online or not.
- **Containers you placed break.** Anything inside that belongs to someone else drops on the floor.
- You respawn at world spawn with 10 hearts, an empty inventory. Your skills, quests and capes stay.

Admins keep an archive of everything erased and can put it back if the erasure was a bug.

## What is yours

An item becomes yours the first time it enters your inventory. That is the whole rule. It stays yours forever, even if you give it away, sell it or drop it. So:

- Things a machine made and left in a chest belong to nobody until someone picks them up.
- Anything you crafted, mined, looted or picked up is yours.
- A gift stays the giver's. If the giver is eliminated, the gift vanishes too.
- Ownership is written on the item, so items owned by different people do not stack together. Sorting an inventory merges the ones that match.

Some things are never owned: Hearts, coins, the guide book, the quest book and obituaries.

Hover an item with advanced tooltips on (F3+H) to see whose it is.

## The compasses

Two compasses find your own items.

**Lost Item Compass** points at your items lying on the ground. Right-click it: a list of everything of yours that is on the floor, anywhere in the world, opens. Pick one and the needle points to it, at any distance in the same dimension. In another dimension the needle spins.

| | |
|---|---|
| Made on | Mechanical crafters |
| From | A compass, 3 ender pearls, 4 polished rose quartz, a brass sheet |

**Seeker's Compass** does the same and has a switch: *only things on the ground* or *anything*. With *anything* it also points at containers and players that hold the item you picked. It never says which it is pointing at, or whether the item sits in a chest or in someone's pocket. Go and find out.

| | |
|---|---|
| Made on | Mechanical crafters |
| From | A Lost Item Compass, a sculk sensor, 2 comparators, a precision mechanism |

The compass follows the item as it moves. Once someone picks the item up, a Lost Item Compass loses it; a Seeker's Compass keeps following.

## Rules against farming

- Hearts are conserved. Deaths move them, the recipe is the only source, Hitpoints regrows at most nine, and elimination puts the loser's last Heart on the ground like any other.
- The same killer gets one Heart per victim per 30 minutes.
- Duplicated Hearts do not work: serial numbers.
- The server is whitelisted. Alt accounts are the admins' problem, and every heart that changes hands is logged.

## Commands

| Command | What it does |
|---|---|
| `/hearts` | Your hearts and where they come from |
| `/revive <player>` | Bring an eliminated player back with the Heart in your hand |
| `/lsp hearts get\|set\|add <player> [n]` | Admin: read or change a player's stock |
| `/lsp lifesteal protect <player> <hours>` | Admin: give newcomer protection (only when `newcomerProtectionHours` in lifesteal.json is above 0; it is 0) |
| `/lsp lifesteal eliminate\|revive <player>` | Admin: force or undo elimination |
| `/lsp lifesteal log [lines]` | Admin: recent heart events |
| `/lsp erase preview <player>` | Admin: what an erasure would remove |
| `/lsp archive list` and `/lsp restore ...` | Admin: put erased blocks or items back |
