# play.limas.ca

The pack's website: plain static files on Vercel (project `lemursaucepacket`, domain `play.limas.ca`). There is no
build step, no framework and no serverless function. What changes often is fetched in the visitor's browser:

| What | From | Fallback in the HTML |
|---|---|---|
| The download button | the latest GitHub release's `.exe` (`api.github.com/.../releases/latest`) | a direct link to the installer of the day the page was written |
| Pack version, mod count, `.mrpack` link | the launcher feed on GitHub Pages | the values of the day |
| Server status and players | `api.mcstatus.io` (checks mc.limas.ca over IPv4) | "Server" |
| The updates page | `Pack x.y.z:` commits on `main` (GitHub API) | the list in `updates.html` |

## Keeping Vercel's bill at zero

- **Downloads never touch Vercel.** The installer (about 110 MB) and the `.mrpack` come straight from GitHub Releases and
  GitHub Pages. Only the page itself is served by Vercel.
- **Pictures are WebP**, three widths each (640, 1280, 1920), lazy-loaded with `srcset`, so a phone fetches the small
  ones and nothing loads until it scrolls into view. A whole visit is well under 2 MB; the 1920 versions only load in the
  lightbox.
- `vercel.json` caches `/assets` in browsers for a day and lets them reuse it for a week while revalidating.
- Fonts come from Google Fonts, not from Vercel.
- Nothing here uses Vercel's image optimisation, functions, middleware or analytics.

## Redirects

`vercel.json` keeps a few short links: `/wiki` (and `/wiki/<page>`), `/download` and `/github`. `/wiki` points at the wiki
rendered on GitHub Pages until the GitBook site is connected; then change the two `/wiki` destinations to the GitBook
URL (pages keep their file names: `docs/quests.md` is `<gitbook>/quests`).

## Pictures

- `assets/art`, `assets/emblems`, `assets/icons`, `assets/skills`, `assets/ui`, `assets/pixel`, the favicons and
  `og.jpg` come from the pack's own art: `cd art && node process.mjs website`.
- `assets/shots` are in-game screenshots, made in a photo session on a test instance (a copy of the live world, with
  the launcher's Fancy shaders on their top preset and 32 chunks of render distance), then converted with
  `node website/tools/shots.mjs <folder of shot_*.png>`. The same script writes the wiki's copies to `docs/images`.
- `node website/tools/gallery.mjs` rewrites `gallery.html` from its list.

## Working on it

```bash
node website/tools/serve.mjs
```

serves the site on http://localhost:5050 with Vercel's clean URLs and redirects. To publish:

```bash
cd website && vercel deploy --prod
```
