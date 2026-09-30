# LemurSaucePacket: custom launcher + auto-synced Create SMP

A branded Minecraft launcher and modpack for the LemurSaucePacket server. Players install the launcher once, sign in with Microsoft, and press **Play**. Before every launch it brings their game in line with the server:
- new mods download and removed mods disappear;
- configs and quests update;
- Minecraft, Java and NeoForge are installed for them.

Then it drops them straight into the server.

The pack is a Create-centred, still-vanilla-feeling SMP: Create 6 with trains, logistics and Aeronautics airships, Create-built structures to explore, vanilla+ mobs and biomes, fair Sophisticated Backpacks, an FTB Quests progression book, and Fabulously Optimized-style performance mods. [PACK_DESIGN.md](PACK_DESIGN.md) explains every choice.

It piggybacks on infrastructure that already exists instead of hosting everything yourself:

| Piece | Comes from |
|---|---|
| Mod files, names, icons | Modrinth (CDN + API) |
| FTB Quests, Library, Teams | CurseForge's CDN (linked, never re-hosted) |
| Performance mod list | Mirrors [Fabulously Optimized](https://modrinth.com/modpack/fabulously-optimized) with NeoForge builds |
| Pack format | Modrinth `.mrpack`, the same file the server installs |
| Pack editing | [packwiz](https://packwiz.infra.link) (`packwiz modrinth add create`) |
| Minecraft, Java runtime | Mojang (the same Java the official launcher uses) |
| NeoForge | Its official installer, run headlessly |
| Hosting | GitHub Pages (pack) + GitHub Releases (launcher auto-updates), both free |

```
 you (admin)                               static host (GitHub Pages)          players' launchers
 ───────────                               ──────────────────────────          ──────────────────
 pack/ (packwiz)  ─┐                       launcher.json  ◄──── polled before every Play
 quests/book.mjs  ─┼── publish.mjs ──►     packs/*.mrpack ────► mod list + configs + quests
 publish/feed.json ┘                             │                 │  mods ← Modrinth / CurseForge CDN (hash-verified)
                                                 │                 │  game ← Mojang, NeoForge installer
                                                 ▼                 ▼
                          your PC: npm run server installs the same pack → versions always match
```

## What's in this folder

| Path | What it is |
|---|---|
| `launcher/` | The launcher (Electron + React + TypeScript) |
| `launcher/brand.json` | **Your settings**: name, feed URL, Microsoft client ID, update repo |
| `launcher/scripts/server.ts` | Installs or updates the dedicated server from the published pack (`npm run server`) |
| `pack/` | The modpack, managed with packwiz (NeoForge 21.1.252, Minecraft 1.21.1) |
| `pack/kubejs/` | Scripts and the pack's resource/data pack: skills, gear behaviour, the ESC menu, backpack recipes, ore-vein balance, fixes for broken mod recipes |
| `mods-src/lemursaucepacket-fixes/` | **The pack's own small mod** (`lsp_fixes`) for fixes that need Java, currently the Project MMO skills panel's scrolling and overlap. `./gradlew copyToPack` puts its jar in `pack/mods/` |
| `quests/book.mjs` | **The quest book**, as readable JavaScript. `quests/build.mjs` turns it into FTB Quests files |
| `skills/build.mjs` | The RuneScape-style skills: curve, perks, level gates (Project MMO configs) |
| `gear/gear.mjs` | **The pack's own gear**: sets, perks, weapons, tools, recipes, loot. `gear/build.mjs` writes the scripts, gates, "How to get" tooltips and JEI pages, and the wiki page |
| `capes/capes.mjs` | **The capes**: unlock rules and perks. `capes/build.mjs` writes the config the scripts read and the wiki page |
| `publish/sources.mjs` | **Where loot-only items come from**: scans the mod jars' loot tables (run it by hand after changing mods) and writes the "Found in" JEI pages and tooltips plus `docs/where-to-find.md` |
| `docs/` | **The wiki** (GitBook layout). `publish/docs.mjs` renders it to `site/wiki/`; GitBook can sync it straight from the repo |
| `art/` | Generated art (title screen, loading screen, logo, quest emblems, icons, gear sprites) and the script that sizes it, plus the pixel widget kit |
| `publish/feed.json` | Server address, description, news and links shown in the launcher |
| `publish/publish.mjs` | Builds `site/` (launcher.json + .mrpack) from `pack/` |
| `publish/serve.mjs` | Serves `site/` on http://localhost:8787 for local testing |
| `server/docker-compose.yml` | Alternative Docker server (see the note under **The server**) |
| `.github/workflows/` | Auto-publish the pack to GitHub Pages; build and release the launcher |

## Try it locally (about 5 minutes)

Prerequisites: Node.js 20+, and packwiz (`go install github.com/packwiz/packwiz@latest`; already installed on this PC in `%USERPROFILE%\go\bin`).

```bash
npm install
```

```bash
node publish/publish.mjs
```

```bash
node publish/serve.mjs
```

In a second terminal:

```bash
cd launcher && npm install && npm run dev
```

Development builds read `http://localhost:8787/launcher.json`. Click the account button (bottom left) and **Sign in with Microsoft**. For quick tests there's also **Use offline account**, which exists only in dev builds and can't join an online-mode server. Then press **Play**.

The first launch downloads about 1.5 GB (Minecraft assets, Java 21, NeoForge, mods). After that, a launch with no pack changes checks everything in well under a second.

## The server (your PC)

The server tool uses the launcher's own sync engine, so the server always runs exactly the published pack. Run it from `launcher/`:

```bash
npm run server -- --dir D:\LemurSaucePacket-Server --accept-eula
```

`--accept-eula` means you accept the [Minecraft EULA](https://aka.ms/MinecraftEULA). The tool then:
- installs NeoForge's server;
- downloads the server-side mods and applies configs;
- writes `start.bat`, which restarts the server if it crashes;
- writes `user_jvm_args.txt` (10 GB and Aikar's G1 flags; change with `--memory 12`);
- writes sensible `server.properties` defaults (PvP on, online mode, 12 slots).

Start the server with `start.bat` in that folder.

**After every publish:** stop the server, run the same `npm run server` command again, and start it. Mods you dropped from the pack are removed, and your world is never touched.

**Letting friends in:** forward these ports on your router to this PC, and allow Java through Windows Firewall when it asks:

| Port | Protocol | For |
|---|---|---|
| 25565 | TCP | Minecraft |
| 24454 | UDP | Simple Voice Chat (proximity voice) |

Put your public address (or a free dynamic-DNS name, since home IPs change) in `publish/feed.json` → `server.address`. The launcher uses it for the Play button's auto-join and for the online/players indicator.

**Playing on the server PC itself:** the launcher notices when this PC is running the server and joins it at `localhost`. The server indicator then says "· this PC". Many home routers can't loop a PC's own public address back to it, so this is how the host plays. It recognises the server by the pack name in its description (`motd` in `server.properties`), so keep "LemurSaucePacket" in there.

With 64 GB of RAM, 10–12 GB for the server is plenty for about 8 players. Chunky (included) can pre-generate the world: `/chunky radius 3000` then `/chunky start` in the server console, run once before opening the server.

*Docker alternative:* `server/docker-compose.yml` uses the itzg image with `MODRINTH_MODPACK`. It was written before FTB Quests came from CurseForge's CDN and hasn't been re-tested since, so prefer the server tool above.

## Managing the modpack

Run these inside `pack/`:

```bash
packwiz modrinth add create-steam-n-rails
```

```bash
packwiz remove create-steam-n-rails
```

```bash
packwiz update --all
```

- **Dependencies** are pulled in automatically when you add a mod (Aeronautics brought in Sable, for example).
- **Betas and wrong versions:** packwiz picks the newest file even when it's a beta or mislabelled for another Minecraft version. Terralith, CEI, Simple Voice Chat and Structory are pinned (`packwiz pin <name>`); check `version_type` and the game version on Modrinth before updating.
- **Client-only mods** need `side = "client"`, or the server crashes on start ("invalid dist DEDICATED_SERVER").
- **Optional mods:** add an `[option]` block with `optional = true`, a `default`, and a one-line `description` (see `mods/mouse-tweaks.pw.toml`). Players toggle these on the launcher's Mods page.
- **Configs and scripts:** put files under `pack/config/…` or `pack/kubejs/…`. They ship as pack overrides. A player's own edit to a file survives until you change that same file. A file you delete from the pack is deleted from everyone's game too, unless they edited it.
- **Versioning:** bump `version` in `pack/pack.toml` whenever you publish. Players see "Updated the pack to 1.0.1".
- **CurseForge mods:** `packwiz curseforge add …` works. `publish.mjs` rewrites those files to download from CurseForge's CDN (hash-checked) instead of bundling the jar.

## Quests

The quest book lives in `quests/book.mjs`: chapters, quests, tasks and rewards as plain data with comments at the top. `publish.mjs` rebuilds it automatically, or you can check it on its own:

```bash
node quests/build.mjs --check
```

Every item, mob, biome, structure and advancement id is checked against `quests/.registry.json`, a dump of the real server's registries, so a typo fails the build instead of producing an impossible quest. After adding mods, refresh that dump:
1. Copy `quests/registry-dump.js` into the server's `kubejs/server_scripts/`.
2. Start the server once.
3. Copy the `kubejs/registry-dump.json` it writes to `quests/.registry.json`.

`book.mjs` is the source of truth. Edits made in-game with FTB's editor are overwritten the next time you publish a changed book. Every quest has a tier (1–5, `TIERS` at the top of `book.mjs`) that sets its XP, its Numismatics coins and the reward table it rolls on (`TABLES`, written to `reward_tables/`); finales add fixed prizes. The Skills chapter is generated from the skill list in `book.mjs`; its milestone quests carry custom tasks that only `pack/kubejs/server_scripts/quest_milestones.js` completes, from the ids the build writes to `pack/config/lemursaucepacket/milestones.json`.

Quest positions are not written by hand (the Skills and Relic Hunter chapters, laid out as grids, are the exception). Each chapter is laid out left to right in unlock order, with no crossing lines. A chapter's `about` and `unlocks` text becomes an info card next to its crest. The card is placed where it's readable as soon as the chapter opens. To look at every chapter without starting Minecraft:

```bash
node quests/build.mjs --preview
```

It writes one SVG per chapter to `quests/preview/` and reports any crossing lines.

## Skills

The RuneScape-style skills are Project MMO configs generated from `skills/build.mjs`. `publish.mjs` runs it. The tables at the top of that file set:

- the skills;
- what each level gives;
- which items each skill gates, and at what level;
- how much XP each action is worth.

Change a number there and publish; don't edit the generated JSON under `pack/kubejs/data/pmmo/` and `pack/kubejs/data/lemursaucepacket/pmmo/`.

Useful admin commands:
- `/pmmo admin <player> set <skill> level <n>` sets a level.
- `/pmmo admin <player> attributes refresh` re-applies level bonuses after a config change.

The level curve is cached per player, so restart the server after changing it.

## Art

`art/generated/` holds the original images, made with Higgsfield (GPT Image 2.5):
- two key-art scenes;
- the logo;
- a 4×4 emblem sheet with the 13 chapter crests, the lemur mascot, a book and tools;
- a 4×4 sheet of ESC-menu and launcher icons, and a 4×4 sheet of skill icons;
- a hi-res brass frame, plaque, button and ring for the launcher.

`art/process.mjs` turns them into every file the pack, launcher and server use:
- title and loading backgrounds, the logo and the ESC menu's icons (`pack/config/fancymenu/assets/`);
- quest crests and skill icons (`pack/kubejs/assets/lemursaucepacket/textures/`);
- `pack/server-icon.png`;
- the launcher's icon, hero image, mascot, icons and frame kit.

It also *draws* the in-game widget kit (`art/pixel-kit.mjs`): brass-and-iron buttons, sliders, tabs, text fields, checkboxes, scrollbars, menu backgrounds and the ESC menu board, pixel by pixel in the palette sampled from the logo. They are written over the vanilla GUI sprites through the pack's resource pack (`pack/kubejs/assets/minecraft/textures/gui/`), so every screen built from vanilla widgets (options, FTB Quests, most mod screens) uses them without per-mod work. The launcher draws its buttons, fields and cards from the same sprites with CSS `border-image` at 3×, which is exactly how the game draws them at GUI scale 3.

Replace an image, or change a colour in `pixel-kit.mjs`, and re-run:

```bash
cd art && npm install && npm run process
```

The ESC menu's geometry lives in `art/hub.mjs`; the same script writes the FancyMenu layout (`lemursaucepacket_pause.txt`), the board texture and `pack/config/lemursaucepacket/hub_layout.json`, which the client script that moves the vanilla pause buttons into the board reads (`pack/kubejs/startup_scripts/pause_hub.js`). The title screen and loading screen layouts are hand-written FancyMenu files in `pack/config/fancymenu/customization/`. You can also edit them in-game: press Ctrl+Alt+C on the title screen to show FancyMenu's editor bar (it's hidden for players). The quest book's colours and background are `pack/kubejs/assets/ftbquests/ftb_quests_theme.txt`.

## Publishing

**GitHub Pages (set up):** this project lives at [github.com/lilman514/lemursaucepacket](https://github.com/lilman514/lemursaucepacket). Every push that touches `pack/`, `quests/` or `publish/` rebuilds the pack and deploys it to `https://lilman514.github.io/lemursaucepacket/launcher.json`. That's the `feedUrl` in `launcher/brand.json`, and the server tool's default `--feed`.

So the everyday loop is: change the pack, commit, push. Players get it on their next Play, and the server gets it the next time you run `npm run server`.

**Any other static host:** run `node publish/publish.mjs` and upload the `site/` folder.

The launcher adds a cache-busting query to `launcher.json`, so a publish reaches players on their next Play, not after the CDN cache expires.

## Microsoft sign-in

Players sign in with the Microsoft account that owns Minecraft, on Microsoft's own page in their browser. Out of the box this needs **no Azure app and no approval from Mojang**:
- The launcher shows a short code and opens microsoft.com/link in the player's browser.
- The player approves there. Usually they're already signed in to Microsoft, so it's one click.
- The launcher notices by itself and closes the dialog.

**How it works:** the launcher uses Microsoft's own client ID for Minecraft (the Nintendo Switch edition) through the device-code flow. That's the same default that open-source Minecraft tools such as Mineflayer (prismarine-auth) rely on.

**The trade-offs:**
- It isn't your launcher's own app registration, so Microsoft could restrict it at any time.
- Microsoft's page may describe the sign-in as Minecraft rather than LemurSaucePacket.
- If Microsoft ever blocks it, players see "Minecraft refused Microsoft's shared sign-in…". Switching to your own app (below) then fixes it.

Players' passwords never touch the launcher either way. It stores only a refresh token, encrypted with Windows DPAPI.

### Your own Azure app (optional, fully official)

1. In the Azure portal (<https://portal.azure.com>), open **App registrations → New registration**. Name it after your launcher and choose **Personal Microsoft accounts only**.
2. Under **Redirect URI**, choose the platform **Public client/native (mobile & desktop)** and enter `https://login.microsoftonline.com/common/oauth2/nativeclient`. No client secret is needed.
3. Request Minecraft API access for that client ID at <https://aka.ms/mce-reviewappid>. Approval has typically taken days to a couple of weeks.
4. Once approved, put the **Application (client) ID** in `launcher/brand.json` → `microsoft.clientId` and ship a new launcher build.

New sign-ins then use your own app, in a Microsoft sign-in window inside the launcher. Players who are already signed in stay signed in until their session expires.

## Branding

`launcher/brand.json`:

| Field | Meaning |
|---|---|
| `name`, `shortName`, `appId` | Window/installer name, sidebar name, Windows app ID. Changing `name` moves the data folder (`%APPDATA%\<name>`). |
| `feedUrl` | Where release builds read `launcher.json` |
| `devFeedUrl` | Where `npm run dev` reads it (the local server) |
| `microsoft.clientId` | Empty: sign in through Microsoft's own Minecraft client (works now). Your approved Azure app ID: sign in through your app (see above) |
| `contact` | Optional email or URL added to the User-Agent (Modrinth asks API clients to identify themselves) |
| `updates.owner`, `updates.repo` | Public GitHub repo whose Releases hold launcher updates |

The icon is `launcher/resources/icon.png` (512×512, made by `art/process.mjs`). Colors live at the top of `launcher/src/renderer/src/styles.css`.

## Shipping the launcher

```bash
cd launcher && npm run dist
```

That produces `launcher/dist/LemurSaucePacket-Setup-<version>.exe`, a branded setup wizard:
- a welcome page listing what players need;
- a choice of install folder;
- desktop and Start menu shortcuts;
- "Run LemurSaucePacket" at the end.

It installs for the current user only (no admin prompt), stops on 32-bit or pre-Windows 10 systems, and warns below 8 GB of RAM. Players' worlds and settings survive reinstalls.

The wizard's look lives in `launcher/resources/`: `installer.nsh` holds the pages, texts and checks, and `installerSidebar.bmp` and `installerHeader.bmp` are made by `art/process.mjs`.

**Giving it to friends:** each launcher release is published to GitHub Releases. Share <https://github.com/lilman514/lemursaucepacket/releases/latest>. A Discord upload won't work, since the installer is about 110 MB.

**Auto-updates:** set `updates.owner` and `updates.repo`, bump `version` in `launcher/package.json`, then push a tag such as `launcher-v0.1.1`. The release workflow builds the installer and publishes it to GitHub Releases, and installed launchers update themselves on their next start. You can also force an update with `minLauncherVersion` in `publish/feed.json`.

**SmartScreen:** unsigned installers show "Windows protected your PC"; players click *More info → Run anyway*. Code signing (for example Azure Trusted Signing) removes that warning.

## What happens when a player presses Play

1. Refresh the Microsoft/Minecraft session (tokens last 24 hours; refreshed silently).
2. Fetch `launcher.json`. If the pack changed, download the new `.mrpack` (a few MB).
3. Compare every mod by SHA-1 and download only what changed, in parallel and hash-verified.
4. Install or verify Minecraft, Java and NeoForge.
5. Launch with `--quickPlayMultiplayer`, straight into the server. The launcher minimizes, and comes back with a crash-report button if the game crashes.

| Files in the game folder | What the launcher does |
|---|---|
| Mods in the pack | Always match the pack; re-downloaded if changed or damaged |
| Mods you removed from the pack | Deleted |
| Other jars a player drops in `mods/` | Moved to `mods-disabled/`, never deleted (turn off with `"strictMods": false`) |
| Configs and scripts shipped in the pack | Updated when your copy changes; player edits kept otherwise; deleted when you remove them (unless edited) |
| `options.txt`, `servers.dat` | Written once, then left to the player |
| Worlds, screenshots, their own resource packs | Never touched |

If the update server can't be reached, players can still launch the version they already have. **Settings → Repair & play** re-hashes every file.

## Developing

```bash
cd launcher && npm test
```

```bash
cd launcher && npm run typecheck
```

```bash
cd launcher && npm run headless -- --launch
```

- `src/core/` is plain Node with no Electron imports: feed, `.mrpack` parsing, sync, downloads, game and loader install, Java, launch, Microsoft auth, server ping. `npm run headless` runs that whole pipeline from a terminal (add `--join host:port` to connect to a server).
- `src/main/` is the Electron main process: the Play pipeline (`controller.ts`), sign-in window, settings and account storage, updater, IPC.
- `src/renderer/` is the React UI. In a plain browser it uses a mock backend (`src/dev/mockLauncher.ts`, dev only); try `#crashed` or `#signedout` in the URL.

**Pinned dependency:** `@xmcl/core` stays at 2.15.1. Its 2026 releases were published to npm with an unbuilt dependency (`@xmcl/unzip@2.2.0`) and fail at install/import time. Check before upgrading.
