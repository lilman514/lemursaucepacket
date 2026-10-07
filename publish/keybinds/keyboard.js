// The Keybinds page's keyboard. publish/keybinds.mjs writes the markup (the keys, the mouse, the list of every
// keybind); this shows what a key does when you point at it, focus it or tap it, finds an action's key from the
// list, and filters both by group or by a search. publish/docs.mjs puts it into site/wiki/keybinds.html.
;(() => {
  const kb = document.getElementById('keyboard')
  if (!kb) return
  kb.classList.add('is-live')
  const all = (sel, el = kb) => [...el.querySelectorAll(sel)]
  const one = (sel) => kb.querySelector(sel)
  const keys = all('.k')
  const info = one('.kb-info')
  const box = one('.kb-keys')
  const board = one('.kb-board')
  const say = one('.kb-say')
  const find = one('.kb-find')
  const chips = all('.kb-chip')
  const count = one('.kb-count')
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const titles = {}
  for (const c of chips) if (c.dataset.g) titles[c.dataset.g] = c.dataset.t

  // Every keybind, from the list's rows; each action becomes a button that finds its key.
  const binds = {}
  for (const tr of all('tr[data-i]')) {
    const span = tr.querySelector('.kb-act')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'kb-act'
    button.textContent = span.textContent
    span.replaceWith(button)
    const b = { tr, button, key: tr.dataset.k, g: tr.dataset.g, m: tr.dataset.m, combo: tr.cells[0].textContent, action: button.textContent }
    b.small = tr.querySelector('small')?.textContent ?? ''
    b.mod = tr.cells[2].textContent
    b.text = [b.action, b.small, all('.kb-tag', tr).map((t) => t.textContent).join(' '), b.mod, titles[b.g], b.combo].join(' ').toLowerCase()
    binds[tr.dataset.i] = b
    button.addEventListener('click', () => pick(b))
  }
  const list = Object.values(binds)
  const keyOf = {}
  for (const k of keys) {
    k.binds = (k.dataset.b ?? '').split(' ').filter(Boolean).map((i) => binds[i])
    keyOf[k.dataset.k] = k
  }
  // A modifier key's panel also lists what it does held with another key.
  const MODIFIER = { 'left.control': 'CONTROL', 'right.control': 'CONTROL', 'left.shift': 'SHIFT', 'right.shift': 'SHIFT', 'left.alt': 'ALT', 'right.alt': 'ALT' }
  const heldWith = (k) => list.filter((b) => b.m === MODIFIER[k.dataset.k.replace('key.keyboard.', '')])
  // The actions with no key: searchable too, so a search for one says it has none.
  const free = all('.kb-u').map((el) => ({ el, g: el.dataset.g, text: [el.textContent, el.closest('tr').dataset.mod, titles[el.dataset.g]].join(' ').toLowerCase() }))

  let groups = new Set()
  let words = []
  let selected = null
  let picked = null
  let current = null
  let back = null
  const match = (g, text) => (groups.size === 0 || groups.has(g)) && words.every((w) => text.includes(w))
  const shown = (b) => match(b.g, b.text)

  function paint(k) {
    if (k.binds.length === 0) return
    const seen = k.binds.filter(shown)
    k.className = k.className.replace(/\bg-\w+/, `g-${(seen[0] ?? k.binds[0]).g}`)
    k.classList.toggle('is-dim', seen.length === 0)
    k.classList.toggle('is-match', seen.length > 0)
    k.querySelector('.lip').innerHTML = [...new Set((seen.length ? seen : k.binds).map((b) => b.g))].map((g) => `<b class="g-${g}"></b>`).join('')
    const n = k.querySelector('em')
    if (n) n.textContent = seen.length > 1 ? seen.length : ''
  }

  function apply() {
    let n = 0
    for (const b of list) {
      b.tr.hidden = !shown(b)
      if (!b.tr.hidden) n++
    }
    for (const sec of all('.kb-sec[data-g]')) sec.hidden = all('tr[data-i]', sec).every((tr) => tr.hidden)
    for (const f of free) f.el.hidden = !match(f.g, f.text)
    for (const tr of all('.kb-free tr[data-mod]')) tr.hidden = all('.kb-u', tr).every((u) => u.hidden)
    for (const sec of all('.kb-free')) sec.hidden = all('tr[data-mod]', sec).every((tr) => tr.hidden)
    for (const k of keys) paint(k)
    kb.classList.toggle('is-searching', words.length > 0)
    const loose = free.some((f) => !f.el.hidden)
    count.textContent =
      n === list.length ? `All ${n} keybinds, by what they're for.` : n > 0 ? `${n} of ${list.length} keybinds match.` : loose ? 'No key does that by default. Find it under Not bound by default, below.' : 'Nothing matches. Try another word, or show every group.'
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.g ? groups.has(c.dataset.g) : groups.size === 0))
    if (current) show(current)
  }

  const item = (b, withKey) =>
    `<li class="g-${b.g}${b === picked ? ' is-on' : ''}${shown(b) ? '' : ' is-out'}"><b>${esc(withKey || b.m !== 'NONE' ? `${b.combo}: ${b.action}` : b.action)}</b> <span class="mod">${esc(b.mod)}</span>${b.small ? ` <small>${esc(b.small)}</small>` : ''}</li>`

  function show(k) {
    current = k
    if (!k) {
      info.innerHTML = `<p>Point at a key, or tap it, to see what it does. ${list.length} keybinds on ${keys.filter((x) => x.binds.length).length} keys.</p>`
      return
    }
    const held = MODIFIER[k.dataset.k.replace('key.keyboard.', '')] ? heldWith(k) : []
    let html = `<h4><kbd>${esc(k.dataset.n)}</kbd></h4>`
    if (k.binds.length) html += `<ul>${k.binds.map((b) => item(b)).join('')}</ul>`
    else if (!held.length) html += `<p>Nothing is bound to ${esc(k.dataset.n)} by default.</p>`
    if (held.length) html += `<p>Held with another key:</p><ul>${held.map((b) => item(b, true)).join('')}</ul>`
    if (back && k === selected) html += '<button type="button" class="kb-back">Back to the list</button>'
    info.innerHTML = html
    info.scrollTop = 0
  }

  function select(k, b = null, fromList = false) {
    if (selected) selected.classList.remove('is-on')
    selected = k
    picked = b
    back = fromList ? b : null
    for (const x of list) x.tr.classList.toggle('is-on', x === b)
    if (k) {
      k.classList.add('is-on')
      roving(k)
      say.textContent = `${k.dataset.n}: ${k.binds.length ? k.binds.map((x) => `${x.m === 'NONE' ? '' : `${x.combo}, `}${x.action}, ${x.mod}`).join('; ') : 'not bound'}`
    }
    show(k)
  }

  // From the list: light the key up and bring it into view.
  function pick(b) {
    const k = keyOf[b.key]
    if (!k) return
    select(k, b, true)
    const r = k.getBoundingClientRect()
    // The whole board when it fits on screen (the key and what it does), else the key itself.
    if (r.top < 0 || r.bottom > innerHeight) {
      if (board.offsetHeight <= innerHeight) board.scrollIntoView({ block: 'nearest' })
      else k.scrollIntoView({ block: 'center' })
    }
    if (box.contains(k)) {
      const outer = box.getBoundingClientRect()
      if (r.left < outer.left || r.right > outer.right) box.scrollLeft += r.left - outer.left - (outer.width - r.width) / 2
    }
    k.classList.remove('is-hit')
    void k.offsetWidth
    k.classList.add('is-hit')
  }

  // One tab stop for the whole keyboard; the arrow keys move between keys.
  let tab = null
  function roving(k) {
    if (tab) tab.tabIndex = -1
    tab = k
    k.tabIndex = 0
  }
  const centre = (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  const STEP = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  function nav(e) {
    if (e.key === 'Escape') return select(null)
    const d = STEP[e.key]
    if (!d) return
    e.preventDefault()
    const from = centre(e.currentTarget)
    let best = null
    let score = Infinity
    for (const k of keys) {
      const c = centre(k)
      const along = d[0] ? (c.x - from.x) * d[0] : (c.y - from.y) * d[1]
      if (k === e.currentTarget || along < 4) continue
      const s = along + 3 * (d[0] ? Math.abs(c.y - from.y) : Math.abs(c.x - from.x))
      if (s < score) [best, score] = [k, s]
    }
    if (best) {
      roving(best)
      best.focus()
      show(best)
    }
  }

  for (const k of keys) {
    k.addEventListener('mouseenter', () => show(k))
    k.addEventListener('mouseleave', () => show(selected))
    k.addEventListener('focus', () => show(k))
    k.addEventListener('blur', () => setTimeout(() => kb.contains(document.activeElement) || show(selected)))
    k.addEventListener('click', () => select(k === selected && !picked ? null : k))
    k.addEventListener('keydown', nav)
  }
  info.addEventListener('click', (e) => {
    if (!e.target.closest('.kb-back') || !back) return
    back.tr.scrollIntoView({ block: 'center' })
    back.button.focus({ preventScroll: true })
  })
  find.addEventListener('input', () => {
    words = find.value.toLowerCase().split(/\s+/).filter(Boolean)
    apply()
  })
  for (const c of chips)
    c.addEventListener('click', () => {
      const g = c.dataset.g
      if (!g) groups.clear()
      else if (groups.has(g)) groups.delete(g)
      else groups.add(g)
      apply()
    })
  roving(keys.find((k) => k.binds.length) ?? keys[0])
  apply()
  show(null)
})()
