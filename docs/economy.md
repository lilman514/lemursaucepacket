# Coins, vendors and trading

The server has one currency: **Gold Coins**. Quests pay them, missions pay Coin Pouches that open into them, and vendors in the towns pay them for anything you bring. You spend them at the vendors and on other players.

## Gold Coins

- However many coins you have, they're **one stack**. The slot shows the amount compactly (`2.3k`, `45k`, `1.2M`) and the tooltip shows it exactly. The number is yellow below 100k, white up to 10M and green after that, as in RuneScape. The pile on the icon grows with the amount.
- Coins you pick up join the stack you already carry, even when your inventory is full.
- **Right-click** a coin stack in your inventory to take half. Carrying coins, right-click a slot to put one down and left-click a coin stack to merge them.
- **Shift + right-click** a coin stack to take an exact amount: type `1500`, `1,500`, `1.5k` or `2m`. That's how you put a set amount in a chest.
- `/purse` says how many coins you carry. Vendors and trades count the coins in your inventory only.
- **Coin Pouches** are what missions pay. Right-click one to open the whole stack: 100 coins a pouch. Keep a few unopened, because mission rerolls are paid in pouches.
- Coins are never owned (see [Hearts and graves](lifesteal.md)), so they survive an elimination wherever they're kept.

## Vendors

The townsfolk of Lemurton (and later other towns) have a name and a yellow **CLICK** over their heads.

- **Talk first.** The first time you right-click a vendor, they greet you. Right-click again for their shop. When a quest gives them something new to say, that plays once too, on its own click. The shop never opens on the same click as a talk.
- **Each vendor sells their own line**: the baker bread and pies, the smith tools and weapons, the mason building blocks, the apothecary potions, and so on. Click a good to buy one lot, shift-click for a stack. The tooltip shows the price.
- **Every vendor buys everything.** With a shop open, click something in your own inventory to sell it, or shift-click to sell every stack like it. Its tooltip says what it fetches. A big sale, or anything enchanted, named or rare, asks for a second click first. `/worth` tells you what the item in your hand is worth.
- **Sold the wrong thing?** The hopper slot (Buyback) sells your last few sales back for what you were paid.
- The bottom row also has your **purse**, **Talk to …** (back to their dialog), and **Quests**: where you are in any quest line that vendor is part of. A shopkeeper doubles as a quest journal.

### What things are worth

Prices come from what something is made of. Raw materials have a set value: a wheat is 1 coin, an iron ingot 10, a diamond 150. Things stone generators turn out by the thousand are worth a fraction of a coin, so sell those by the stack. Anything crafted, smelted or made in a Create machine is worth what its cheapest recipe costs, so crafting never makes coins out of nothing. Wear lowers a tool's price and enchantments raise it. Nothing a vendor sells can be sold back for more than half its price.

Vendors won't buy coins, Coin Pouches, Hearts, backpacks or full containers (empty a shulker box first).

## Trading with other players

1. `/trade <player>`, or sneak and right-click them with an empty hand. They get a message with a **Click to trade** button. Asking back opens the trade window for both of you. You need to be within about 24 blocks of each other.
2. Your offer is on the left, theirs on the right. Click things in your inventory to put them up, and click them in your offer to take them back. The **gold button** sets how many coins you offer (right-click it to take them off). Offered coins are held while the trade is open, so they can't be spent meanwhile.
3. When you're both happy, click **Accept trade**. Any change to either offer resets both acceptances and starts a 3-second deal timer, so nobody can swap something at the last second.
4. When both have accepted, everything changes hands. If either of you closes the window, leaves, dies, changes dimension or walks off, the trade is cancelled and everything goes back to its owner.

## Admins

- `/lsp coins give|take|set <players> <amount>`, `/lsp coins balance <players>`
- `/lsp values get <item>` and `/lsp values top`: the value table. It's rebuilt on `/reload`, from `data/*/lsp_economy/*.json` (the pack's comes from `npcs/values.mjs`) and the server's recipes.
- `/lsp npc list`, `/lsp npc talk <npc> <player>` (as a right-click would), `/lsp npc forget <player> [who]` (their talks play again), `/lsp shop open <npc> <player>`
- Shops, talks and quest steps come from `data/*/lsp_npcs/<who>.json`, written by `npcs/build.mjs` from `npcs/npcs.mjs`. An Easy NPC is one of them when it carries the tag `lsp_npc.<who>`.
