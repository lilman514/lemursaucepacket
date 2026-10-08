---
description: >-
  What the panel at the top of your screen tells you, goggle readouts without goggles, the HUD layout, tooltips, video
  settings, frame rate, Distant Horizons, shaders, screenshots and replays.
icon: display
---

# Your screen: HUD, info and settings

Everything on your screen besides the world itself, and where to change it. Most of it can be moved, resized or hidden in ESC → HUD Layout.

## What you're looking at

The panel at the top of the screen (Jade) names the block, mob or player under your crosshair and the mod it comes from, and adds whatever matters about it:

| Look at | Jade shows |
|---|---|
| Any block | The tool that breaks it, and how far you've broken it |
| A chest, barrel or other container | Its first nine items; hold Left Shift for more |
| A furnace, smoker, blast furnace or brewing stand | What goes in, the fuel and what comes out |
| A crop or sapling | How far it has grown |
| A mob or player | Health, armour and status effects |
| An animal | Time to grow up or breed again, a pet's owner, a horse's speed and jump |
| Redstone | The power level, a repeater's delay, a comparator's mode |
| An enchanting table | The enchanting power its bookshelves give |
| A beehive, jukebox, note block or lectern | The bees and honey, the disc, the note, the book |
| A grave or a waystone | Whose grave it is; the waystone's name |

- **Its keys.** Keypad 1 hides or shows the panel: press it if the panel has gone. Hold Left Shift for more detail. Keypad 0 opens Jade's settings, where you choose what it shows and how it looks. No keypad? Rebind them under Jade in Settings → Controls → Key Binds.
- **Everyone can look.** Jade shows anyone what's in a container they look at, yours included, and hiding the panel only hides it on your own screen. See [Combat and PvP](combat.md).
- **Move or resize it** in HUD Layout (below).
- The last line of every item's tooltip names the mod it comes from.

## Goggle info, always on

- **No goggles needed.** Create: Cyber Goggles (on by default; it's one of the optional mods on the launcher's Mods tab) gives you the Engineer's Goggles readout, in every game mode. Look at any Create block for its speed, stress, contents and settings, and keep your helmet slot for armour. The numbers on a block's value panel show without a wrench, too.
- **A whole network's stress.** Hold Left Shift while you look at a kinetic block for the stress of the whole network it's on.
- **Its settings.** Press \ for Cyber Goggles' settings. Leave the options marked "May be considered cheating on server" as they are.
- **Careful with the wrench.** Holding a wrench, a left-click on a Create part dismantles it at once. If that catches you out, turn off **Left Click Fast Dismantle** under Misc → Wrench in those settings.
- The goggle info moves and resizes in HUD Layout. Create itself: [Create basics](create.md) and [Create tips](create-tips.md).

## Your HUD layout

- **Move and resize.** ESC → **HUD Layout** (or `/hudlayout`) moves and resizes the parts other mods draw: the minimap, Jade, the voice chat icons, the goggle info, the XP gains, pinned quests, status effects and boss bars. Drag a box, roll the wheel over it to resize it, press **H** to hide or show it, then **Save**. Everything else about it is in [The ESC menu](esc-menu.md#hud-layout).
- **Hide it all.** F1 hides the HUD until you press it again.
- **The minimap** has its own settings on **Y**. How the maps and waypoints work: [Getting around](travel.md).
- **Skill XP** shows on cards under the block info: [Skills](skills.md).
- **Inventory buttons.** The small buttons at the top left of your inventory open the quest book and your team screen. Right-click the gear beside them to edit them.

## Reading tooltips

- **Rarity and stats.** An item's name is coloured by its rarity, its stats come under it, and the bold last line repeats its rarity and type. Hold **Shift** for the details: which skills it trains, how to get it, set bonuses.
- **Skill levels.** A red **❣ Requires** line names a skill level the item waits for; it turns green with a tick once you have it. A "Making it needs" line names the level it takes to make one. See [Skills](skills.md).
- **Enchantments** each carry a short grey line saying what they do.
- **Advanced tooltips.** F3 + H adds item ids, durability and whose item it is ([What is yours](lifesteal.md#what-is-yours)). With them on, Shift also lists the item's tags and Alt its data.
- **Status effects.** Click an active effect in your inventory for its page in JEI: what it does and what gives it.
- **What's inside.** Shulker boxes, ender chests and backpacks preview their contents: see [Inventory, sorting and storage](inventory-tips.md#peek-inside-containers).

## Video settings

ESC → **Settings** → **Video Settings** opens Sodium's options, with a search box and a page for each mod that adds settings: Sodium, Sodium Extra, Iris and more.

- **FPS counter.** Video Settings → Sodium Extra → **Show FPS** (off by default). **Show FPS Extended** adds the average and the lows, **Show Coordinates** adds your position, and **Overlay Corner** moves it from the top left.
- **Pop-ups.** Sodium Extra's **Toasts** switches turn off advancement, recipe, system and tutorial pop-ups.
- **Name tags.** Sodium Extra can hide player name tags, on your own screen only.
- **Signs far away look blank.** Their text only draws within 16 blocks; raise **Sign Text Render Distance** on the Better Block Entities page.

## More frames per second

The big ones:

1. **Render distance**, in Video Settings.
2. **Distant Horizons' distance**, or switch it off (below).
3. **Shaders off** with K, or the **Lite** preset on the launcher's Settings page.
4. **More memory**, on the launcher's Settings page.
5. With shaders on, a lower **Max Shadow Distance** in Video Settings; some shader packs set their own.
6. In a big Create base, Nowheel's **Tick culling** and **Distance culling** (Mods → Nowheel → Config), both off by default. If a machine stops moving on screen, turn tick culling off again.

**In the background the game slows itself down** (Dynamic FPS): 1 frame a second and a quarter of the volume when you alt-tab, nothing at all while it's minimised, 60 frames with the mouse over the window. It's back to full speed the moment you click in. Bind **Disable Dynamic FPS (Toggle)** to keep it at full speed in the background, for recording or for watching a farm on a second screen.

## Distant Horizons

Distant Horizons draws the land past your render distance as simpler scenery, 128 chunks (2,048 blocks) out by default. The server builds it and sends it to you.

- **Its settings.** The small Distant Horizons button beside the FOV slider (ESC → Settings). There: **Enable Rendering** (off saves the most frames), **Quality Preset** (1 Minimum to 5 Extreme), **CPU Load** (1 Minimal Impact to 5 I Paid For The Whole CPU) and **Show LOD Gen/Import Progress**. Its distance is **LOD Chunk Render Distance Radius**.
- **It fills in bit by bit.** After a long warp or a fast flight you may see gaps on the horizon for a while, until the land arrives.
- **It's scenery.** Out there you see the land and what's built on it, not mobs, players or moving machines.
- **No fog.** It switches Minecraft's own fog off.
- **Disk space.** It keeps a copy of the far land in the game folder, in `Distant_Horizons_server_data`, which grows as you explore.
- **With shaders.** All three of the pack's shader packs draw the far land too.

## Shaders

- **Off by default.** Pick **Lite**, **Balanced** or **Fancy** on the launcher's Settings page ([The launcher](launcher.md#settings)), or switch them in game: **K** turns shaders on and off, **I** opens the shader pack list and **R** reloads them.
- **A pack's options.** In the list, pick a pack and press **Apply**; **Shader Pack Settings...** holds its own options. Hold Shift and click **Reset** there to put them all back.
- **Something looks wrong?** Press K to see it without shaders.

## Screenshots

- **F2** saves one. The launcher's **Settings → Files & repair → Screenshots** opens the folder.
- **Clean shots.** F1 hides the HUD; HUD Layout can hide single parts instead.
- **Zoom.** Hold **Z** to zoom in four times; roll the wheel while you hold it to zoom further or back out, and it remembers where you left it. Just Zoom adds a button for its options to the ESC menu.
- **Shaders for the shot.** K on, F2, K off.
- **Wide views.** Raise Distant Horizons' distance and quality, then wait in one place while the far land fills in.
- **The world map as a picture.** On the world map (M), right-click → **Export Map as PNG**: the whole map, or an area you've selected.

## Replays and recordings

- **Recording is off.** ReForgedPlay (Replay Mod) is installed but records nothing until you switch it on: Mods → ReForgedPlay → Config → Recording → **Record Server**. From then on each session records itself, with an indicator on screen, and when you leave it asks you to name the replay.
- **Watch and edit** in the Replay Viewer, from its button on the title screen. Its keys only work in the viewer: see [Keybinds](keybinds.md#kb-replay).
- **Rendering a video needs FFmpeg** installed on your computer. Without it the render stops with "To render a video, you need to have ffmpeg installed".
- **Where they go.** Replays are saved in the game folder's `replay_recordings`, rendered videos in `replay_videos`. The launcher's **Settings → Files & repair** opens the game folder.
- **Turn Record Server off again** when you're done: replays get big.
- **Airships play back too.** Ships and other moving builds move in replays made with this pack.
- **Voice.** The voice chat menu (V) has a record button that saves voice chat to the game folder's `voicechat_recordings`. The server allows it, so others can record what you say, too. See [Chat, voice and teams](social.md).

## When the screen acts up

| What happens | What to do |
|---|---|
| The panel at the top is gone | Press Keypad 1 (Jade) |
| JEI's item list is gone | Press Ctrl + O |
| The game drops to 1 frame a second | It's in the background: click into the window |
| There are gaps in the far land | Wait: it fills in |
| Signs far away look blank | Their text draws within 16 blocks (Better Block Entities page in Video Settings) |
| Create machines or moving builds draw wrongly | Type `/create clearRenderBuffers` |
| Something looks wrong with shaders on | Press K to check without them |
| A menu bar appears on the title or ESC screen | Ctrl + Alt + C hides it again |
| The game crashed | A Crash Assistant window shows what went wrong; **Upload all...** puts the logs online and gives you a link to pass on. See the [FAQ](faq.md) |

{% hint style="warning" %}
**Don't bind Project MMO's Open Glossary.** It has no key on purpose: in this pack it crashes the game. Your inventory's skills panel (E) and ESC → Skills show the same.
{% endhint %}
