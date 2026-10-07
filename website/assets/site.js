// play.limas.ca: the parts of the page that come from elsewhere, fetched in the visitor's browser so the site stays
// plain static files. The download buttons go straight to the installer on GitHub Releases (never through Vercel),
// the pack facts come from the launcher feed on GitHub Pages, and the server's status from mcstatus.io. Every
// value is also written into the HTML, so a failed request leaves a page that still works.
;(() => {
  const REPO = 'lilman514/lemursaucepacket'
  const FEED = 'https://lilman514.github.io/lemursaucepacket/launcher.json'
  const STATUS = 'https://api.mcstatus.io/v2/status/java/mc.limas.ca'
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
  const setText = (sel, text) => $$(sel).forEach((el) => (el.textContent = text))

  /** fetch + JSON, remembered in localStorage for a while (GitHub allows 60 API calls an hour per visitor). */
  async function cached(key, url, maxAgeMs) {
    try {
      const hit = JSON.parse(localStorage.getItem(key) || 'null')
      if (hit && Date.now() - hit.at < maxAgeMs) return hit.data
    } catch {}
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    const data = await res.json()
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
    } catch {}
    return data
  }

  // ------------------------------------------------------------- the latest launcher on GitHub Releases
  cached('lsp.release', `https://api.github.com/repos/${REPO}/releases/latest`, 15 * 60e3)
    .then((release) => {
      const exe = (release.assets || []).find((a) => /\.exe$/i.test(a.name))
      if (!exe) return
      $$('[data-download]').forEach((a) => (a.href = exe.browser_download_url))
      setText('[data-launcher-version]', String(release.tag_name).replace(/^v/, ''))
      setText('[data-launcher-size]', `${Math.round(exe.size / 1048576)} MB`)
    })
    .catch(() => {})

  // ------------------------------------------------------------- pack facts from the launcher feed
  cached('lsp.feed', FEED, 10 * 60e3)
    .then((feed) => {
      if (!feed || !feed.pack) return
      setText('[data-pack-version]', feed.pack.version)
      if (feed.pack.modCount) setText('[data-mod-count]', String(feed.pack.modCount))
      setText('[data-mc-version]', feed.pack.minecraft)
      const mrpack = new URL(feed.pack.url, FEED).href
      $$('[data-mrpack]').forEach((a) => (a.href = mrpack))
    })
    .catch(() => {})

  // ------------------------------------------------------------- is the server up?
  const showStatus = (s) => {
    const online = !!(s && s.online)
    const players = online && s.players ? s.players.online : 0
    const max = online && s.players ? s.players.max : 0
    $$('[data-status]').forEach((el) => (el.dataset.state = online ? 'online' : 'offline'))
    setText('[data-status-text]', online ? 'Online' : 'Offline')
    setText('[data-status-players]', online ? `${players}/${max} playing` : 'back soon')
  }
  if ($('[data-status]')) {
    cached('lsp.status', STATUS, 60e3)
      .then(showStatus)
      .catch(() => $$('[data-status]').forEach((el) => (el.dataset.state = 'unknown')))
  }

  // ------------------------------------------------------------- copy the server address
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.setAttribute('role', 'status')
  document.body.append(toast)
  let toastTimer = 0
  const say = (text) => {
    toast.textContent = text
    toast.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800)
  }
  $$('[data-copy]').forEach((el) =>
    el.addEventListener('click', async () => {
      const text = el.dataset.copy
      try {
        await navigator.clipboard.writeText(text)
        say(`Copied ${text}`)
      } catch {
        say(text)
      }
    })
  )

  // ------------------------------------------------------------- the menu on narrow screens
  const topbar = $('.topbar')
  const toggle = $('.menu-toggle')
  if (topbar && toggle) {
    toggle.addEventListener('click', () => {
      const open = topbar.classList.toggle('open')
      toggle.setAttribute('aria-expanded', String(open))
    })
    $$('.nav a').forEach((a) =>
      a.addEventListener('click', () => {
        topbar.classList.remove('open')
        toggle.setAttribute('aria-expanded', 'false')
      })
    )
  }

  // ------------------------------------------------------------- sections fade in as they scroll up
  const reveals = $$('.reveal')
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { rootMargin: '0px 0px -8% 0px' }
    )
    reveals.forEach((el) => io.observe(el))
  } else reveals.forEach((el) => el.classList.add('in'))

  // ------------------------------------------------------------- screenshots open large
  const links = $$('a[data-lightbox]')
  if (links.length && typeof HTMLDialogElement === 'function') {
    const box = document.createElement('dialog')
    box.className = 'lightbox'
    box.innerHTML =
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="Previous picture">‹</button>' +
      '<button class="lb-btn lb-next" type="button" aria-label="Next picture">›</button>' +
      '<button class="lb-btn lb-close" type="button" aria-label="Close">✕</button>'
    document.body.append(box)
    const img = $('img', box)
    const cap = $('figcaption', box)
    let group = []
    let index = 0
    const visible = (a) => a.offsetParent !== null
    const show = (i) => {
      index = (i + group.length) % group.length
      const a = group[index]
      img.src = a.href
      img.alt = a.querySelector('img')?.alt || ''
      cap.textContent = a.dataset.caption || a.querySelector('figcaption')?.textContent || img.alt
    }
    links.forEach((a) =>
      a.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return
        e.preventDefault()
        group = links.filter((l) => l.dataset.lightbox === a.dataset.lightbox && visible(l))
        show(group.indexOf(a))
        box.showModal()
      })
    )
    $('.lb-prev', box).addEventListener('click', () => show(index - 1))
    $('.lb-next', box).addEventListener('click', () => show(index + 1))
    $('.lb-close', box).addEventListener('click', () => box.close())
    box.addEventListener('click', (e) => {
      if (e.target === box) box.close()
    })
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1)
      if (e.key === 'ArrowRight') show(index + 1)
    })
    box.addEventListener('close', () => img.removeAttribute('src'))
  }

  // ------------------------------------------------------------- gallery filters
  const filters = $$('[data-filter]')
  filters.forEach((btn) =>
    btn.addEventListener('click', () => {
      const tag = btn.dataset.filter
      filters.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)))
      $$('.gallery .shot').forEach((shot) => {
        shot.hidden = tag !== 'all' && !(shot.dataset.tags || '').split(' ').includes(tag)
      })
    })
  )

  // ------------------------------------------------------------- the updates page: pack versions from the commit log
  const timeline = $('[data-timeline]')
  if (timeline) {
    cached('lsp.commits', `https://api.github.com/repos/${REPO}/commits?sha=main&per_page=100`, 30 * 60e3)
      .then((commits) => {
        const seen = new Set($$('[data-ver]', timeline).map((li) => li.dataset.ver))
        const fresh = []
        for (const c of commits) {
          const m = /^Pack (\d+\.\d+(?:\.\d+)?): (.+)$/.exec(String(c.commit.message).split('\n')[0])
          if (!m || seen.has(m[1])) continue
          seen.add(m[1])
          fresh.push({ ver: m[1], text: m[2], date: String(c.commit.author.date).slice(0, 10) })
        }
        for (const f of fresh.reverse()) {
          const li = document.createElement('li')
          li.dataset.ver = f.ver
          li.innerHTML = `<span class="ver"></span><time></time><p></p>`
          $('.ver', li).textContent = f.ver
          $('time', li).textContent = f.date
          $('time', li).dateTime = f.date
          $('p', li).textContent = f.text.charAt(0).toUpperCase() + f.text.slice(1)
          timeline.prepend(li)
        }
      })
      .catch(() => {})
  }

  setText('[data-year]', String(new Date().getFullYear()))
})()
