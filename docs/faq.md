---
description: >-
  Quick answers: joining and the launcher, crashes and frame rate, skills and machines, your things in PvP, getting
  around, voice and recording.
icon: circle-question
faq: true
---

# FAQ and troubleshooting

## Joining and the launcher

### "Connection lost: channel missing"

Your mods and the server's don't match. Close the game and press **Play** in the launcher again: it re-syncs the pack first. If it still happens, use **Repair & play** on the launcher's Settings page.

### Can I add my own mods?

Only the optional ones listed in the launcher's **Mods** tab (minimap tweaks and the like). Anything else breaks the sync with the server.

### Where are my screenshots?

Launcher → **Settings** → **Files & repair** → **Screenshots**.

### The Guide shows a blank page

The Guide is this wiki, in a browser inside the game. The first time the game starts, that browser downloads its engine (a few hundred megabytes) in the background, and the page stays blank until it's ready. Meanwhile **Open in browser** shows the wiki in your own browser, and `/guide` opens the book version.

## Crashes and frame rate

### The game crashed

The launcher shows the last lines of the crash on its **Home** page and can open the crash-reports folder. Send the newest crash report to an admin.

### My frames are low

- **Render distance.** Lower it in **Settings → Video Settings**.
- **Memory.** Give the game more on the launcher's **Settings** page.
- **Shaders.** They're off by default. If you turned them on, press **K** in game to switch them off, or pick **Lite** under the launcher's **Settings → Graphics**.
- **Distant Horizons.** It draws the land past your render distance, 2,048 blocks out. Turn its distance down, or switch it off, with the small Distant Horizons button beside the FOV slider in **Settings**.

## Skills, items and machines

### Why can't I use this item?

Skills gate items. A red "❣ Requires" line on the tooltip names the skill and the level; it turns green with a tick once you have it. Train that skill, or use a lower tier. See [Skills](skills.md).

### What do tooltip colours mean?

The name's colour is its rarity: white common, green uncommon, blue rare, purple epic, gold legendary. Stats come under it, and the bold last line repeats the rarity and what the item is. Hold **Shift** over an item for the details: which skills it trains, how to get it, and set bonuses.

### Why am I getting no skill XP?

- **Blocks you placed pay you nothing** when you break them again (someone else's still pay, and fully grown crops always do). Train on fresh ground.
- **Machines pay only whoever is near.** A Create machine's work pays every player within 16 blocks of it. With nobody near, the XP is lost, unless an [XP Bank](create-tips.md#the-xp-bank) is in reach. A block lava and water made pays a machine a tenth.
- See [Skills](skills.md) for what pays what.

### Do machines give XP?

Yes, to whoever is near. When a drill, saw, harvester, mechanical crafter, Crafter, basin or fan does a skill's work, every player within 16 blocks of it gets the XP the same work pays by hand, each of them all of it. A block someone placed pays nothing, and one lava and water made (a cobblestone generator's) pays a tenth. To keep some of it while you're away, build an [XP Bank](create-tips.md#the-xp-bank) within 8 blocks of the machines: it keeps 10%, 25% or 50% by tier, and you take it at the tier you could make yourself.

### Why won't my machine make it?

Create machines (mechanical crafters, basins with their mixer or press, spouts) and the Crafter work at the skill levels of the player who last placed or right-clicked them. If that player doesn't have the level a recipe needs, the machine won't make it, and they get a chat message with a ding naming the skill. Drills and saws work the same way: they leave a block past their operator's level standing (a contraption's keep the operator they had when it was put together). Right-click the machine to make it run at your levels.

### Why did my backpack upgrade stop?

A backpack upgrade only works once you have the level it takes to make it; until then a chat message with a ding tells you which. A backpack set down as a block works at the levels of whoever last placed or opened it.

### Why didn't my totem save me?

A Totem of Undying only works at **Hitpoints 50** or higher, and a chat message tells you when it didn't. Relics are the same: an ability waits for the level it needs. See [Hearts, graves and elimination](lifesteal.md) for what dying costs.

## Your things in PvP

### Can players open my backpack?

Not unless you let them. Every backpack starts on **Another player can NOT open**, so right-clicking your back gets nobody into it. To share one with a teammate, switch **Another player can open** on in that backpack's settings (the Player tab covers all your backpacks). See [Combat and PvP](combat.md).

### Can someone take my grave?

Yes. Graves aren't locked to their owner: whoever breaks yours gets its items. A **Latest Death** waypoint on your minimap and world map points the way back, so go straight there. See [Hearts, graves and elimination](lifesteal.md).

## Getting around

### How do I get home fast?

Use a waystone. Activate one at home (take a found one, or build one), then warp there from any other waystone, with a warp stone or with a scroll. See [Waystones](waystones.md) and [Getting around](travel.md).

## Voice and recording

### Voice chat isn't working

Press **V**: the first time, a setup guide picks your microphone and how you talk. **Push to talk** has no key until you choose one (in the guide, or Controls → Key Binds → Voice Chat), and **voice activation** starts muted: press **O** to unmute. Voice chat needs UDP, so behind a strict firewall ask the host to check the voice port. More in [Chat, voice and teams](social.md).

### How do I record a video?

ReForgedPlay (Replay Mod) is installed but records nothing until you turn it on: **Mods → ReForgedPlay → Config → Recording**, then **Record Server**. From then on every session is saved, and the circling-arrows button at the top right of the title screen's panel opens the Replay Viewer to edit and render them. Its keys (keyframes, play and pause) only work in the viewer. Turn **Record Server** off again when you're done: replays get big.
