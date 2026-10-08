// The LemurSaucePacket wiki's page behaviour (publish/docs.mjs writes it to site/wiki/assets): search over every page
// (search.json, loaded on first use; "/" or Ctrl+K to focus), the mobile contents drawer, "On this page" following the
// reading position, the picture viewer, copy buttons on commands, tabs, and the atlas pages' filters. In the game
// (the ESC menu's Guide opens the wiki in FancyMenu's browser with ?ingame), it also dresses itself for the game.
;(() => {
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  // ------------------------------------------------------------- in the game
  // ?ingame on the first page, remembered for the visit: the pixel cursor, and no links that leave for the website.
  let ingame = new URLSearchParams(location.search).has('ingame')
  try {
    if (ingame) sessionStorage.setItem('lsp-ingame', '1')
    else ingame = sessionStorage.getItem('lsp-ingame') === '1'
  } catch (e) {}
  if (ingame) document.documentElement.classList.add('ingame')

  // ------------------------------------------------------------- the contents drawer (narrow screens)
  const toggle = $('.menu-toggle')
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open')
      toggle.setAttribute('aria-expanded', String(open))
    })
    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('nav-open')) return
      if (e.target.closest('.wk-side') || e.target.closest('.menu-toggle')) return
      document.body.classList.remove('nav-open')
      toggle.setAttribute('aria-expanded', 'false')
    })
  }
  // Sections of the contents with children open and close.
  $$('.wk-nav li.parent > a .caret').forEach((caret) =>
    caret.addEventListener('click', (e) => {
      e.preventDefault()
      caret.closest('li').classList.toggle('closed')
    })
  )

  // ------------------------------------------------------------- search
  let index = null
  const loadIndex = async (url) => {
    if (!index) index = await fetch(url).then((r) => r.json())
    return index
  }
  const words = (q) =>
    q
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ''))
      .filter(Boolean)
  function search(entries, q) {
    const terms = words(q)
    if (!terms.length) return []
    const scored = []
    for (const e of entries) {
      const title = e.s ? e.s.toLowerCase() : e.t.toLowerCase()
      const page = e.t.toLowerCase()
      const text = e.x.toLowerCase()
      let score = 0
      let all = true
      for (const t of terms) {
        const inTitle = title.includes(t)
        const inPage = page.includes(t)
        const inText = text.includes(t)
        if (!inTitle && !inPage && !inText) {
          all = false
          break
        }
        score += (inTitle ? (title.startsWith(t) || title.includes(` ${t}`) ? 12 : 8) : 0) + (inPage ? 3 : 0) + (inText ? 1 : 0)
      }
      if (all) scored.push([score + (e.s ? 0 : 2), e])
    }
    return scored.sort((a, b) => b[0] - a[0]).slice(0, 14).map((s) => s[1])
  }
  const mark = (text, terms) => {
    let out = esc(text)
    for (const t of terms) out = out.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>')
    return out
  }
  const snippet = (text, terms) => {
    const lower = text.toLowerCase()
    let at = -1
    for (const t of terms) {
      at = lower.indexOf(t)
      if (at >= 0) break
    }
    const start = Math.max(0, at - 50)
    return (start > 0 ? '…' : '') + text.slice(start, start + 150) + (start + 150 < text.length ? '…' : '')
  }
  $$('[data-search]').forEach((input) => {
    const box = input.parentElement.querySelector('.wk-results')
    let results = []
    let on = -1
    const render = () => {
      if (!input.value.trim()) {
        box.hidden = true
        return
      }
      const terms = words(input.value)
      box.innerHTML = results.length
        ? results
            .map(
              (r, i) =>
                `<a href="${r.u}"${i === on ? ' class="on"' : ''}><small>${esc(r.s ? r.t : r.g || 'Page')}</small><b>${mark(r.s || r.t, terms)}</b>${r.x ? `<span>${mark(snippet(r.x, terms), terms)}</span>` : ''}</a>`
            )
            .join('')
        : `<div class="none">Nothing found for “${esc(input.value)}”.</div>`
      box.hidden = false
    }
    input.addEventListener('focus', () => loadIndex(input.dataset.search).catch(() => {}))
    input.addEventListener('input', async () => {
      const entries = await loadIndex(input.dataset.search).catch(() => [])
      results = search(entries, input.value)
      on = results.length ? 0 : -1
      render()
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (!results.length) return
        on = (on + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length
        render()
        box.querySelectorAll('a')[on]?.scrollIntoView({ block: 'nearest' })
      } else if (e.key === 'Enter' && results[on]) {
        e.preventDefault()
        location.href = results[on].u
      } else if (e.key === 'Escape') {
        input.value = ''
        box.hidden = true
        input.blur()
      }
    })
    document.addEventListener('click', (e) => {
      if (!input.parentElement.contains(e.target)) box.hidden = true
    })
  })
  document.addEventListener('keydown', (e) => {
    const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '')
    if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      const input = $('.portal-search input') || $('.wk-search input')
      if (!input) return
      e.preventDefault()
      if (window.matchMedia('(max-width: 980px)').matches && input.closest('.wk-side')) document.body.classList.add('nav-open')
      input.focus()
      input.select()
    }
  })

  // ------------------------------------------------------------- on this page
  const tocLinks = $$('.wk-toc a')
  const heads = tocLinks.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean)
  if (heads.length && 'IntersectionObserver' in window) {
    const visible = new Set()
    const pick = () => {
      let current = null
      for (const h of heads) if (h.getBoundingClientRect().top < 140) current = h
      if (!current) current = [...visible][0] ?? heads[0]
      tocLinks.forEach((a) => a.classList.toggle('on', a.hash === `#${encodeURIComponent(current.id)}` || a.hash === `#${current.id}`))
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)
        pick()
      },
      { rootMargin: '-70px 0px -60% 0px' }
    )
    heads.forEach((h) => io.observe(h))
    window.addEventListener('scroll', pick, { passive: true })
    pick()
  }

  // ------------------------------------------------------------- the picture viewer
  const box = $('.lightbox')
  if (box) {
    const img = $('img', box)
    const cap = $('p', box)
    let list = []
    let at = 0
    const pictures = () => $$('.wk-article figure img, .wk-article p > img, .infobox .ib-image img, .atlas-pic img').filter((i) => !i.closest('a.card'))
    const show = (i) => {
      at = (i + list.length) % list.length
      const el = list[at]
      img.src = el.dataset.full || el.currentSrc || el.src
      img.alt = el.alt
      const fig = el.closest('figure')
      const card = el.closest('.atlas-card')
      cap.textContent = (fig && fig.querySelector('figcaption')?.textContent.trim()) || (card && card.querySelector('h3')?.textContent.trim()) || el.alt || ''
    }
    const close = () => {
      box.hidden = true
      img.src = ''
      document.body.style.overflow = ''
    }
    document.addEventListener('click', (e) => {
      const el = e.target.closest('img')
      if (!el || box.contains(el)) return
      list = pictures()
      const i = list.indexOf(el)
      if (i < 0) return
      e.preventDefault()
      show(i)
      box.hidden = false
      document.body.style.overflow = 'hidden'
    })
    $('.lb-close', box).addEventListener('click', close)
    $('.lb-prev', box).addEventListener('click', () => show(at - 1))
    $('.lb-next', box).addEventListener('click', () => show(at + 1))
    box.addEventListener('click', (e) => {
      if (e.target === box) close()
    })
    document.addEventListener('keydown', (e) => {
      if (box.hidden) return
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') show(at - 1)
      else if (e.key === 'ArrowRight') show(at + 1)
    })
  }

  // ------------------------------------------------------------- copy buttons, tabs
  $$('.code .copy').forEach((b) =>
    b.addEventListener('click', () => {
      const text = b.parentElement.querySelector('code').textContent
      navigator.clipboard?.writeText(text).then(() => {
        b.textContent = 'Copied'
        setTimeout(() => (b.textContent = 'Copy'), 1400)
      })
    })
  )
  $$('.tabs').forEach((tabs) => {
    const buttons = $$('.tab-bar button', tabs)
    const panels = $$('.tab-panel', tabs)
    buttons.forEach((b, i) =>
      b.addEventListener('click', () => {
        buttons.forEach((x, j) => x.setAttribute('aria-selected', String(i === j)))
        panels.forEach((p, j) => (p.hidden = i !== j))
      })
    )
  })

  // ------------------------------------------------------------- the atlas: filter by mod, kind and name
  $$('[data-atlas]').forEach((tools) => {
    const grid = document.getElementById(tools.dataset.atlas)
    if (!grid) return
    const cards = $$('.atlas-card', grid)
    const input = $('input', tools)
    const count = $('.atlas-count', tools)
    const chips = $$('.chip', tools)
    const menus = $$('select[data-key]', tools)
    const apply = () => {
      const q = (input?.value || '').toLowerCase().trim()
      const filters = {}
      chips.filter((c) => c.getAttribute('aria-pressed') === 'true' && c.dataset.value).forEach((c) => (filters[c.dataset.key] = c.dataset.value))
      menus.filter((m) => m.value).forEach((m) => (filters[m.dataset.key] = m.value))
      let shown = 0
      for (const card of cards) {
        let ok = !q || card.dataset.search.includes(q)
        for (const [k, v] of Object.entries(filters)) if (ok && !(card.dataset[k] || '').split(' ').includes(v)) ok = false
        card.hidden = !ok
        if (ok) shown++
      }
      if (count) count.textContent = `${shown} of ${cards.length}`
    }
    chips.forEach((c) =>
      c.addEventListener('click', () => {
        chips.filter((o) => o.dataset.key === c.dataset.key).forEach((o) => o.setAttribute('aria-pressed', String(o === c)))
        apply()
      })
    )
    menus.forEach((m) => m.addEventListener('change', apply))
    input?.addEventListener('input', apply)
    apply()
  })
})()
