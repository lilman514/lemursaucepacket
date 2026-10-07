// play.limas.ca/hiscores: everyone who plays on mc.limas.ca, ranked RuneScape-style. The game server uploads each
// player's record (lsp_fixes, every ten minutes) to /api/hiscores-ingest; /api/hiscores hands them all over, and this
// works the tables out, the same way /hiscores does in game: Overall by total level then XP, skills by XP, everything
// else by count (nobody with none is ranked), ties A to Z. ?table=mining shows a table, ?player=Name a player.
;(() => {
  const $ = (sel, root = document) => root.querySelector(sel)
  const main = $('[data-hs-main]')
  const side = $('[data-hs-tables]')
  const pick = $('[data-hs-pick]')
  const find = $('[data-hs-find]')
  const search = $('[data-hs-search]')
  if (!main) return

  const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const pretty = (id) => String(id).split(':').pop().split(/[_/]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const ago = (ms) => {
    if (!ms) return 'never'
    const s = Math.max(0, (Date.now() - ms) / 1000)
    if (s < 90) return 'just now'
    if (s < 5400) return `${Math.round(s / 60)} minutes ago`
    if (s < 129600) return `${Math.round(s / 3600)} hours ago`
    return `${Math.round(s / 86400)} days ago`
  }

  let defs = null
  let data = { players: [], totals: {} }
  let tables = []
  /** The non-skill groups' emblems (the skills have their own icons). */
  const EMBLEM = {
    Skills: '/assets/icons/skills.webp',
    Activities: '/assets/emblems/quest_book.webp',
    Bosses: '/assets/emblems/crown_of_fire.webp',
    Collections: '/assets/emblems/backpack_workshop.webp'
  }

  /** Every table, in the order the side list shows them. */
  function buildTables() {
    tables = [
      { ...defs.overall, kind: 'overall', group: 'Skills' },
      ...defs.skills.map((s) => ({ ...s, kind: 'skill', group: 'Skills' })),
      { ...defs.combat, kind: 'combat', group: 'Skills' },
      ...defs.activities.map((a) => ({ ...a, kind: 'activity', group: 'Activities' })),
      ...defs.bosses.map((b) => ({ ...b, kind: 'boss', group: 'Bosses' })),
      ...defs.collections.map((c) => ({ ...c, kind: 'collection', group: 'Collections' }))
    ]
  }

  const num = (o, k) => (o && o[k] != null ? Number(o[k]) : 0)
  /** One table's rows: [{ player, value, level }], ranked. */
  function rank(t) {
    const rows = []
    for (const p of data.players) {
      if (!p || !p.skills) continue
      let row
      if (t.kind === 'overall') row = { player: p, value: num(p.total, 'xp'), level: num(p.total, 'level') }
      else if (t.kind === 'skill') row = p.skills[t.id] ? { player: p, value: num(p.skills[t.id], 'xp'), level: num(p.skills[t.id], 'level') } : null
      else if (t.kind === 'combat') row = { player: p, value: num(p, 'combat'), level: num(p, 'combat') }
      else if (t.kind === 'activity') row = { player: p, value: num(p.activities, t.id), level: 0 }
      else if (t.kind === 'boss') row = { player: p, value: num(p.bosses, t.id), level: 0 }
      else row = { player: p, value: num(p.collections, t.id), level: 0 }
      if (!row || (t.kind !== 'overall' && t.kind !== 'combat' && row.value <= 0)) continue
      rows.push(row)
    }
    rows.sort((a, b) => (t.kind === 'overall' ? b.level - a.level || b.value - a.value : b.value - a.value) || a.player.name.localeCompare(b.player.name, 'en', { sensitivity: 'base' }))
    return rows
  }
  const rankOf = (t, p) => rank(t).findIndex((r) => r.player.uuid === p.uuid) + 1

  /** What a table counts out of, where there's a whole to collect: the capes, the quest points, each collection. */
  const total = (t) => (t.kind === 'collection' ? num(data.totals.collections, t.id) : t.id === 'capes' || t.id === 'quest_points' ? num(data.totals, t.id) : 0)
  const icon = (t) => (t.icon ? `<img src="${esc(t.icon)}" width="24" height="24" alt="">` : `<span class="hs-dot hs-${t.kind}" aria-hidden="true"></span>`)
  const emblem = (t) => `<img src="${esc(t.icon || EMBLEM[t.group])}" width="48" height="48" alt="">`
  const link = (p) => `<a href="?player=${encodeURIComponent(p.name)}" data-player="${esc(p.name)}">${esc(p.name)}</a>`

  // ------------------------------------------------------------- views

  /** The list of tables (and the narrow screens' select), drawn once. */
  function buildSide() {
    let html = ''
    let group = ''
    for (const t of tables) {
      if (t.group !== group) {
        group = t.group
        html += `<h3><img src="${EMBLEM[group]}" width="20" height="20" alt="">${esc(group)}</h3>`
      }
      html += `<a href="?table=${t.id}" data-table="${t.id}">${icon(t)}<span>${esc(t.name)}</span></a>`
    }
    side.innerHTML = html
    pick.innerHTML = `<option value="" hidden>Choose a table</option>` + tables.map((t) => `<option value="${t.id}">${esc(t.group === 'Skills' ? t.name : `${t.group}: ${t.name}`)}</option>`).join('')
  }

  /** Marks the table on show ('' on a player's page). */
  function renderSide(current) {
    side.querySelectorAll('a[data-table]').forEach((a) => (a.dataset.table === current ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')))
    pick.value = current
  }

  function renderTable(id) {
    const t = tables.find((x) => x.id === id) || tables[0]
    renderSide(t.id)
    const rows = rank(t)
    const levelled = t.kind === 'overall' || t.kind === 'skill'
    const out = total(t)
    const head = levelled ? '<th class="num">Level</th><th class="num">XP</th>' : `<th class="num">${t.kind === 'boss' ? 'Kills' : t.kind === 'combat' ? 'Level' : 'Score'}</th>`
    const body = rows
      .slice(0, 200)
      .map((r, i) => {
        const cells = levelled ? `<td class="num">${fmt(r.level)}</td><td class="num">${fmt(r.value)}</td>` : `<td class="num">${fmt(r.value)}${out ? `<span class="hs-of"> / ${fmt(out)}</span>` : ''}</td>`
        return `<tr><td class="rank">${i + 1}</td><td>${link(r.player)}</td>${cells}</tr>`
      })
      .join('')
    main.innerHTML = `
      <div class="hs-head">${emblem(t)}<div><h2>${esc(t.name)}</h2><p>${t.note ? `${esc(t.note)} · ` : ''}${rows.length} ${rows.length === 1 ? 'player' : 'players'} ranked</p></div></div>
      ${rows.length ? `<table class="hs-table"><thead><tr><th class="rank">Rank</th><th>Player</th>${head}</tr></thead><tbody>${body}</tbody></table>` : '<p class="hs-note">Nobody on this table yet.</p>'}`
    document.title = `${t.name} · Hiscores · LemurSaucePacket`
  }

  function renderPlayer(name) {
    const p = data.players.find((x) => x.name.toLowerCase() === String(name).toLowerCase())
    renderSide('')
    if (!p) {
      main.innerHTML = `<div class="hs-head"><div><h2>${esc(name)}</h2><p>Nobody called ${esc(name)} is on the hiscores yet. They show up once they've played since the hiscores began.</p></div></div>`
      return
    }
    const byKind = (kind) => tables.filter((t) => t.kind === kind)
    const overall = tables.find((t) => t.kind === 'overall')
    const skillRows = [overall, ...byKind('skill')]
      .map((t) => {
        const s = t.kind === 'overall' ? { level: num(p.total, 'level'), xp: num(p.total, 'xp') } : p.skills[t.id] || { level: 1, xp: 0 }
        const r = rankOf(t, p)
        return `<tr><td>${icon(t)}<a href="?table=${t.id}" data-table="${t.id}">${esc(t.name)}</a></td><td class="num">${r ? fmt(r) : '–'}</td><td class="num">${fmt(s.level)}</td><td class="num">${fmt(s.xp)}</td></tr>`
      })
      .join('')
    const counts = (kind, label, one) => {
      const rows = byKind(kind).map((t) => {
        const v = num(kind === 'activity' ? p.activities : kind === 'boss' ? p.bosses : p.collections, t.id)
        const r = v > 0 ? rankOf(t, p) : 0
        const out = total(t)
        const bar = out ? `<span class="hs-bar"><span style="width:${Math.min(100, (100 * v) / out).toFixed(1)}%"></span></span>` : ''
        return `<tr${v > 0 ? '' : ' class="none"'}><td><a href="?table=${t.id}" data-table="${t.id}">${esc(t.name)}</a>${bar}</td><td class="num">${r ? fmt(r) : '–'}</td><td class="num">${fmt(v)}${out ? `<span class="hs-of"> / ${fmt(out)}</span>` : ''}</td></tr>`
      })
      return `<section class="hs-card"><h3><img src="${EMBLEM[label]}" width="28" height="28" alt="">${label}</h3><table class="hs-table"><thead><tr><th>${one}</th><th class="num">Rank</th><th class="num">${label === 'Bosses' ? 'Kills' : 'Score'}</th></tr></thead><tbody>${rows.join('')}</tbody></table></section>`
    }
    // The database keeps JSON objects in an order of its own, so the counts are sorted again here.
    const kills = Object.entries(p.kills || {})
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 15)
      .map(([id, n]) => `<tr><td>${esc(pretty(id))}</td><td class="num">${fmt(n)}</td></tr>`)
      .join('')
    main.innerHTML = `
      <div class="hs-head"><div><h2>${esc(p.name)}</h2><p>Total level ${fmt(num(p.total, 'level'))} · ${fmt(num(p.total, 'xp'))} XP · combat level ${fmt(p.combat)} · overall rank ${fmt(rankOf(overall, p))} · seen ${ago(p.seen)}</p></div></div>
      <div class="hs-grid">
        <section class="hs-card wide"><h3><img src="${EMBLEM.Skills}" width="28" height="28" alt="">Skills</h3><table class="hs-table"><thead><tr><th>Skill</th><th class="num">Rank</th><th class="num">Level</th><th class="num">XP</th></tr></thead><tbody>${skillRows}</tbody></table></section>
        ${counts('boss', 'Bosses', 'Boss')}
        ${counts('activity', 'Activities', 'Activity')}
        ${counts('collection', 'Collections', 'Collection')}
        <section class="hs-card"><h3><img src="/assets/emblems/bestiary.webp" width="28" height="28" alt="">Slain most</h3>${kills ? `<table class="hs-table"><thead><tr><th>Creature</th><th class="num">Kills</th></tr></thead><tbody>${kills}</tbody></table>` : '<p class="hs-note">Nothing yet.</p>'}<p class="hs-note">Deaths: ${fmt(p.deaths)}</p></section>
      </div>`
    document.title = `${p.name} · Hiscores · LemurSaucePacket`
  }

  // ------------------------------------------------------------- routing

  function show() {
    const q = new URLSearchParams(location.search)
    if (q.get('player')) renderPlayer(q.get('player'))
    else renderTable(q.get('table') || 'overall')
    const updated = $('[data-hs-updated]')
    if (updated) updated.textContent = data.uploaded ? `Updated ${ago(Number(data.uploaded))}.` : ''
  }
  function go(query) {
    history.pushState(null, '', `${location.pathname}?${query}`)
    show()
    window.scrollTo({ top: Math.min(window.scrollY, main.getBoundingClientRect().top + window.scrollY - 90), behavior: 'smooth' })
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-table], a[data-player]')
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    go(a.dataset.table ? `table=${a.dataset.table}` : `player=${encodeURIComponent(a.dataset.player)}`)
  })
  window.addEventListener('popstate', show)
  pick.addEventListener('change', () => go(`table=${pick.value}`))
  find.addEventListener('submit', (e) => {
    e.preventDefault()
    if (search.value.trim()) go(`player=${encodeURIComponent(search.value.trim())}`)
  })

  // ------------------------------------------------------------- data

  Promise.all([
    fetch('/assets/hiscores-defs.json').then((r) => r.json()),
    fetch('/api/hiscores', { headers: { Accept: 'application/json' } }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
  ])
    .then(([d, h]) => {
      defs = d
      data = { players: h.players || [], totals: h.totals || {}, uploaded: h.uploaded }
      buildTables()
      buildSide()
      $('#hs-names').innerHTML = data.players.map((p) => `<option value="${esc(p.name)}">`).join('')
      show()
    })
    .catch(() => {
      main.innerHTML = '<p class="hs-note">The hiscores aren’t available right now. In game, /hiscores always works.</p>'
    })
})()
