#!/usr/bin/env node
// The LemurSaucePacket server's distant-land pre-build, with a page to watch and pause it (http://localhost:8790):
// a progress bar, the speed and the time left, and a Pause / Resume button.
//
// Distant Horizons does the building (`dh pregen start <dimension> <x> <z> <radius in chunks>`, which picks up where
// it stopped); this panel only starts and stops it. It builds while nobody is on the server, on all of the PC's
// threads with the server at below-normal priority, so the PC's own programs come first. As soon as anyone joins it
// pauses, and puts Distant Horizons back on its own thread count and the server back on normal priority. It reads
// the server's log and types its commands into the server's console window (console.ps1): the server needs nothing
// extra. Its state (paused by you, done, how far it got) is kept in <server>/pregen-panel.json.
//
//   node server/pregen/panel.mjs [--open] [--server C:\LemurSaucePacket-Server] [--port 8790]
//        [--dim minecraft:overworld] [--x 0] [--z 0] [--radius 625] [--fast <logical CPUs>] [--gentle 12]
//        [--jobs spots.json]   (a list of areas, [{ "name", "dim", "x", "z", "radius" }], built one after another)
//
// or double-click panel.cmd. Keep its window open while the pre-build runs: it is what pauses it for players.

import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}
const SERVER = arg('server', 'C:\\LemurSaucePacket-Server')
const PORT = Number(arg('port', '8790'))
// One area, or with --jobs a JSON list of them ([{ name, dim, x, z, radius }]), built one after another.
const JOBS = arg('jobs', null)
  ? JSON.parse(fs.readFileSync(arg('jobs'), 'utf8'))
  : [{ name: '', dim: arg('dim', 'minecraft:overworld'), x: Number(arg('x', '0')), z: Number(arg('z', '0')), radius: Number(arg('radius', '625')) }]
// Distant Horizons' own thread count on this PC is 12 (half the logical CPUs); the pre-build gets all of them.
const FAST = Number(arg('fast', String(os.cpus().length)))
const GENTLE = Number(arg('gentle', '12'))
const LOG = path.join(SERVER, 'logs', 'latest.log')
const STATE_FILE = path.join(SERVER, 'pregen-panel.json')

// ---- what happened (shown on the page and in this window) ----

const events = []
function note(text) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false })
  events.unshift({ time, text })
  events.length = Math.min(events.length, 40)
  console.log(`${time}  ${text}`)
}

// ---- saved state ----

function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    if (JSON.stringify(saved.jobs) === JSON.stringify(JOBS)) return saved
  } catch {}
  return { jobs: JOBS, index: 0, paused: false, done: false, best: 0, builtMs: 0 }
}
const state = loadState()
const job = () => JOBS[Math.min(state.index, JOBS.length - 1)]
const startCommand = () => `dh pregen start ${job().dim} ${job().x} ${job().z} ${job().radius}`
function save() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n')
  } catch (e) {
    note(`Couldn't save ${STATE_FILE}: ${e.message}`)
  }
}

// ---- the server's log: is it up, who is on, how far the pre-build is ----

let run
function newRun(header) {
  run = { header, offset: 0, rest: '', up: false, players: new Set(), pregen: 'idle', progress: null, threads: null, priority: 'Normal', samples: [] }
}
newRun('')

function parse(line) {
  if (/\]: Done \(\d/.test(line)) run.up = true
  let m = line.match(/\]: ([A-Za-z0-9_.]{2,20}) joined the game/)
  if (m) run.players.add(m[1])
  m = line.match(/\]: ([A-Za-z0-9_.]{2,20}) left the game/)
  if (m) run.players.delete(m[1])
  m = line.match(/Generated radius: ([\d.]+) \/ ([\d.]+) chunks \((\d+) cps, ([\d.]+)%\), ETA: (.+?)\s*$/)
  if (m) {
    run.progress = { radius: Number(m[1]), of: Number(m[2]), cps: Number(m[3]), percent: Number(m[4]), eta: m[5] }
    run.pregen = 'running'
  }
  if (/Starting pregen/.test(line)) run.pregen = 'running'
  if (/Pregen is cancelled/.test(line)) run.pregen = 'stopped'
  if (/Pregen is complete/.test(line)) {
    run.pregen = 'complete'
    run.completeAt = line.slice(0, 26)
  }
  m = line.match(/threading\.numberOfThreads\] to \[(\d+)\]/)
  if (m) run.threads = Number(m[1])
}

function readLog() {
  let size
  try {
    size = fs.statSync(LOG).size
  } catch {
    return
  }
  const fd = fs.openSync(LOG, 'r')
  try {
    // A restarted server starts a new log: its first line (a timestamp) changes.
    const head = Buffer.alloc(30)
    fs.readSync(fd, head, 0, 30, 0)
    const header = head.toString('latin1')
    if (header !== run.header || size < run.offset) {
      if (run.header) note('The server restarted')
      newRun(header)
    }
    while (run.offset < size) {
      const length = Math.min(size - run.offset, 4 << 20)
      const buffer = Buffer.alloc(length)
      fs.readSync(fd, buffer, 0, length, run.offset)
      run.offset += length
      const lines = (run.rest + buffer.toString('utf8')).split('\n')
      run.rest = lines.pop()
      for (const line of lines) parse(line)
    }
  } finally {
    fs.closeSync(fd)
  }
}

// ---- telling the server ----

function powershell(script, args) {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, script), ...args], { windowsHide: true, timeout: 60000 }, (error, out, err) => {
      const text = String(out || '').trim() || String(err || '').trim() || (error ? error.message : '')
      resolve(text.split(/\r?\n/).pop())
    })
  })
}
// One PowerShell stays open to type commands (console.ps1 -Serve): starting one per command took a second or two,
// which added up between short areas. It answers each line with one line, in order.
let sender = null
let waiting = []
function typeLine(command) {
  if (!sender) {
    let buffer = ''
    sender = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'console.ps1'), '-ServerDir', SERVER, '-Serve'], { windowsHide: true })
    sender.stdout.setEncoding('utf8')
    sender.stdout.on('data', (chunk) => {
      buffer += chunk
      let end
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim()
        buffer = buffer.slice(end + 1)
        const answer = waiting.shift()
        if (answer) answer(line)
      }
    })
    const lost = (why) => {
      sender = null
      for (const answer of waiting.splice(0)) answer(why)
    }
    sender.on('exit', () => lost('the command sender stopped'))
    // A sender that can't start (out of memory, say) must not take the panel down with it.
    sender.on('error', (e) => lost(`couldn't start the command sender: ${e.message}`))
    sender.stdin.on('error', () => {})
  }
  return new Promise((resolve) => {
    if (!sender) return resolve("couldn't start the command sender")
    waiting.push(resolve)
    sender.stdin.write(command + '\n')
    // A sender that stops answering is replaced (answers are matched in order, so it can't just skip one).
    setTimeout(() => {
      if (waiting.includes(resolve) && sender) sender.kill()
    }, 30000)
  })
}
async function send(command) {
  note(`Server: ${command} (${await typeLine(command)})`)
}
async function priority(level) {
  run.priority = level
  note(`Server priority ${level === 'BelowNormal' ? 'below normal' : 'normal'} (${await powershell('priority.ps1', ['-ServerDir', SERVER, '-Priority', level])})`)
}

// ---- deciding ----

let busy = false
let lastStart = 0
let lastStop = 0
let lastThreads = 0
let lastTick = Date.now()

// Distant Horizons rounds the radius up to its 4-chunk sections; a progress line with another radius is another job.
const ours = () => run.progress && Math.abs(run.progress.of - job().radius) <= 4
const catchingUp = () => run.pregen === 'running' && ours() && run.progress.percent < state.best - 0.2
const wantsToBuild = () => !state.done && run.up && !state.paused && run.players.size === 0

async function gentle() {
  if (run.threads !== GENTLE && Date.now() - lastThreads > 20000) {
    lastThreads = Date.now()
    await send(`dh config threading.numberOfThreads ${GENTLE}`)
  }
  if (run.priority !== 'Normal') await priority('Normal')
}

async function step() {
  if (busy) return
  busy = true
  try {
    readLog()
    const now = Date.now()
    if (run.pregen === 'running' && ours()) {
      state.builtMs += now - lastTick
      if (!catchingUp()) {
        state.best = Math.max(state.best, run.progress.percent)
        run.samples.push({ t: now, percent: run.progress.percent })
        while (run.samples.length > 2 && now - run.samples[0].t > 90000) run.samples.shift()
      } else run.samples = []
    }
    lastTick = now
    if (state.done) return
    // Each "Pregen is complete" counts once (by its time in the log), so a restarted panel doesn't skip an area.
    if (run.pregen === 'complete' && ours() && run.completeAt !== state.lastCompleteAt) {
      state.lastCompleteAt = run.completeAt
      if (state.index < JOBS.length - 1) {
        note(JOBS.length > 1 ? `Spot ${state.index + 1} of ${JOBS.length} done${job().name ? ` (${job().name})` : ''}` : 'Area done')
        state.index++
        state.best = 0
        run.pregen = 'idle'
        run.samples = []
        lastStart = 0
        save()
      } else {
        state.done = true
        state.best = 100
        save()
        note('Done: the pre-build is complete')
        await gentle()
        return
      }
    }
    if (!run.up) return
    if (wantsToBuild()) {
      if (run.pregen !== 'running') {
        if (now - lastStart > 45000) {
          lastStart = now
          if (run.threads !== FAST) {
            lastThreads = now
            await send(`dh config threading.numberOfThreads ${FAST}`)
          }
          if (run.priority !== 'BelowNormal') await priority('BelowNormal')
          await send(startCommand())
        }
      } else {
        // The server can be too busy to answer for a few seconds; ask again until it confirms.
        if (run.threads !== FAST && now - lastThreads > 60000) {
          lastThreads = now
          await send(`dh config threading.numberOfThreads ${FAST}`)
        }
        if (run.priority !== 'BelowNormal') await priority('BelowNormal')
      }
    } else {
      if (run.pregen === 'running' && now - lastStop > 20000) {
        lastStop = now
        await send('dh pregen stop')
      }
      if (run.pregen !== 'running') await gentle()
    }
  } catch (e) {
    note(`Error: ${e.message}`)
  } finally {
    busy = false
  }
}
setInterval(save, 30000)

// ---- the page ----

const DIMENSIONS = { 'minecraft:overworld': 'the Overworld', 'minecraft:the_nether': 'the Nether', 'minecraft:the_end': 'the End' }
function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s % 60}s`
  return `${s}s`
}
function status() {
  const p = ours() ? run.progress : null
  const many = JOBS.length > 1
  // This area's share, and with several areas the whole list's (areas count equally).
  const area = state.done ? 100 : Math.max(state.best, p ? p.percent : 0)
  const percent = state.done ? 100 : many ? ((state.index + area / 100) / JOBS.length) * 100 : area
  const total = Math.pow(2 * (p ? p.of : job().radius), 2)
  let rate = null
  if (run.samples.length > 1) {
    const a = run.samples[0]
    const b = run.samples[run.samples.length - 1]
    if (b.t - a.t > 8000) rate = Math.round((((b.percent - a.percent) / 100) * total) / ((b.t - a.t) / 1000))
  }
  let key
  let text
  const players = [...run.players]
  const where = many ? ` spot ${state.index + 1} of ${JOBS.length}${job().name ? `: ${job().name}` : ''}` : ''
  if (state.done) [key, text] = ['done', 'Done: everything is built']
  else if (!run.up) [key, text] = ['waiting', 'Waiting for the server to start']
  else if (state.paused) [key, text] = ['paused', run.pregen === 'running' ? 'Pausing…' : 'Paused by you']
  else if (players.length) [key, text] = ['paused', `Paused while ${players.join(', ')} ${players.length === 1 ? 'is' : 'are'} on the server`]
  else if (run.pregen !== 'running') [key, text] = ['running', `Starting${where}…`]
  else if (catchingUp()) [key, text] = ['running', 'Catching up to where it stopped']
  else [key, text] = ['running', `Building${where}`]
  const building = key === 'running' && run.pregen === 'running' && !catchingUp()
  // With several areas, time left comes from the average time an area has taken so far (overlapping areas go faster,
  // so it tends to run long); with one, from the current speed.
  let eta = null
  if (many && state.index > 0 && !state.done) eta = duration((state.builtMs / (state.index + area / 100)) * (JOBS.length - state.index - area / 100))
  else if (building && rate > 0) eta = duration((((100 - area) / 100) * total * 1000) / rate)
  return {
    key,
    text,
    percent,
    paused: state.paused,
    done: state.done,
    rate: building ? rate : null,
    eta,
    etaLabel: many && state.index === 0 ? 'left on this spot' : many ? 'left for all spots' : 'left at this speed',
    reach: p ? Math.round(p.radius * 16) : null,
    reachLabel: many ? 'out from this spot' : 'built out so far',
    builtFor: duration(state.builtMs),
    subtitle: many
      ? `${JOBS.length} spots, ${(job().radius * 16).toLocaleString('en-US')} blocks around each`
      : `Everything within ${(job().radius * 16).toLocaleString('en-US')} blocks of ${job().x}, ${job().z} in ${DIMENSIONS[job().dim] || job().dim}`,
    note: `Pauses by itself while anyone is on the server and carries on when they leave. While it builds it uses all ${FAST} threads with the server at below-normal priority, so your own programs come first. Keep the panel's window open.`,
    events: events.slice(0, 12),
  }
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Distant land</title>
<style>
  :root { --bg: #14161b; --card: #1d2129; --line: #2f3540; --text: #ebe8e1; --muted: #9aa1ac; --green: #7fc241; --amber: #e2a63c; --gold: #f2cf5b }
  * { box-sizing: border-box }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; color: var(--text);
    background: radial-gradient(1100px 560px at 50% -12%, #27324a 0%, var(--bg) 62%); font: 15px/1.45 system-ui, "Segoe UI", sans-serif }
  .card { width: min(640px, 100%); background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 24px 24px 18px; box-shadow: 0 22px 60px rgba(0, 0, 0, .45) }
  h1 { margin: 0; font-size: 21px }
  .sub { color: var(--muted); margin-top: 3px; font-size: 13.5px }
  .status { display: inline-flex; align-items: center; gap: 8px; margin: 18px 0 12px; padding: 5px 12px; border-radius: 999px; background: #2a303a; font-weight: 600; font-size: 13.5px }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted) }
  .running .dot { background: var(--green); animation: pulse 1.6s infinite }
  .paused .dot { background: var(--amber) }
  .done .dot { background: var(--gold) }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(127, 194, 65, .7) } 70%, 100% { box-shadow: 0 0 0 8px rgba(127, 194, 65, 0) } }
  .bar { position: relative; height: 32px; background: #0d0f13; border: 2px solid #000; box-shadow: inset 0 0 0 2px #3b414c }
  .fill { position: absolute; left: 2px; top: 2px; bottom: 2px; width: 0; overflow: hidden; background: linear-gradient(#a3e563, #72b836 55%, #4e8b21); transition: width .8s ease }
  .running .fill::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(-45deg, rgba(255, 255, 255, .13) 0 10px, transparent 10px 20px); background-size: 28.28px 28.28px; animation: slide 1s linear infinite }
  @keyframes slide { to { background-position: 28.28px 0 } }
  .paused .fill { background: linear-gradient(#f2c468, #d69c31 55%, #a57220) }
  .done .fill { background: linear-gradient(#ffe68f, #f2cf5b 55%, #c49d2f) }
  .pct { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 800; font-size: 15px; text-shadow: 0 1px 0 #000, 0 0 6px rgba(0, 0, 0, .7) }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0 }
  .stat { background: #252a33; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px }
  .stat b { display: block; font-size: 18px; font-variant-numeric: tabular-nums }
  .stat span { color: var(--muted); font-size: 12.5px }
  button { width: 100%; padding: 12px; cursor: pointer; color: #fff; font: 700 16px system-ui, "Segoe UI", sans-serif; text-shadow: 0 2px 0 #3c3c3c;
    background: #6f6f6f; border: 2px solid #000; box-shadow: inset -2px -3px 0 #4b4b4b, inset 2px 2px 0 #aaaaaa }
  button:hover:not(:disabled) { background: #7c86b9; box-shadow: inset -2px -3px 0 #545d8f, inset 2px 2px 0 #bcc3e8 }
  button:disabled { opacity: .5; cursor: default }
  .note { color: var(--muted); font-size: 12.5px; margin-top: 12px }
  .log { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--line); max-height: 170px; overflow: auto; color: #b9bec8; font: 12px/1.6 ui-monospace, Consolas, monospace }
  @media (max-width: 480px) { .stats { grid-template-columns: 1fr 1fr } }
</style>
</head>
<body>
<main class="card" id="card">
  <h1>Distant land</h1>
  <div class="sub" id="sub"></div>
  <div class="status"><span class="dot"></span><span id="text">Connecting…</span></div>
  <div class="bar"><div class="fill" id="fill"></div><div class="pct" id="pct">0%</div></div>
  <div class="stats">
    <div class="stat"><b id="rate">–</b><span>chunks a second</span></div>
    <div class="stat"><b id="eta">–</b><span id="etaLabel">left at this speed</span></div>
    <div class="stat"><b id="reach">–</b><span id="reachLabel">built out so far</span></div>
  </div>
  <button id="button" disabled>Pause</button>
  <div class="note" id="note"></div>
  <div class="log" id="log"></div>
</main>
<script>
  const $ = (id) => document.getElementById(id)
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  let last = null
  function render(s) {
    $('card').className = 'card ' + s.key
    $('text').textContent = s.text
    $('sub').textContent = s.subtitle
    $('fill').style.width = 'calc((100% - 4px) * ' + s.percent / 100 + ')'
    $('pct').textContent = s.percent.toFixed(1) + '%'
    $('rate').textContent = s.rate == null ? '–' : s.rate.toLocaleString('en-US')
    $('eta').textContent = s.eta || '–'
    $('etaLabel').textContent = s.etaLabel
    $('reach').textContent = s.reach == null ? '–' : s.reach.toLocaleString('en-US') + ' blocks'
    $('reachLabel').textContent = s.reachLabel + ' · ' + s.builtFor + ' building'
    $('button').textContent = s.paused ? 'Resume' : 'Pause'
    $('button').disabled = s.done
    $('note').textContent = s.note
    $('log').innerHTML = s.events.map((e) => '<div>' + e.time + '  ' + esc(e.text) + '</div>').join('')
  }
  async function refresh() {
    try {
      const response = await fetch('/status', { cache: 'no-store' })
      last = await response.json()
      render(last)
    } catch (e) {
      $('card').className = 'card'
      $('text').textContent = 'The panel has stopped (its window was closed)'
      $('button').disabled = true
    }
  }
  $('button').onclick = async () => {
    $('button').disabled = true
    await fetch(last && last.paused ? '/resume' : '/pause', { method: 'POST', headers: { 'X-Pregen': '1' } })
    setTimeout(refresh, 300)
  }
  refresh()
  setInterval(refresh, 2000)
</script>
</body>
</html>
`

// ---- serving it (this PC only) ----

let lastPoll = 0

const server = http.createServer((req, res) => {
  // Only pages opened on this PC, by its own address (a page elsewhere can't reach in through a renamed host).
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers.host || ''))) {
    res.writeHead(403)
    return res.end('forbidden')
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(PAGE)
  }
  if (req.method === 'GET' && req.url === '/status') {
    lastPoll = Date.now()
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    return res.end(JSON.stringify(status()))
  }
  if (req.method === 'POST' && (req.url === '/pause' || req.url === '/resume')) {
    // Other sites can't send this header here without the browser asking first, and nothing here says yes.
    if (req.headers['x-pregen'] !== '1') {
      res.writeHead(403)
      return res.end('forbidden')
    }
    state.paused = req.url === '/pause'
    save()
    note(state.paused ? 'Paused from the panel' : 'Resumed from the panel')
    step()
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(status()))
  }
  res.writeHead(404)
  res.end('not found')
})
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is in use: is the panel already open?` : e.message)
  process.exit(1)
})
server.listen(PORT, '127.0.0.1', () => {
  note(`Panel open at http://localhost:${PORT} (server ${SERVER})`)
  // A page left open from before reconnects within a few seconds; only open one if none does.
  if (argv.includes('--open')) {
    setTimeout(() => {
      if (Date.now() - lastPoll > 4000) execFile('cmd.exe', ['/c', 'start', '', `http://localhost:${PORT}`], { windowsHide: true })
    }, 4500)
  }
  step()
  setInterval(step, 1000)
})
// Anything unexpected is noted and the panel carries on: it is what keeps the pre-build going.
process.on('uncaughtException', (e) => note(`Error: ${e.message}`))
process.on('unhandledRejection', (e) => note(`Error: ${e && e.message ? e.message : e}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  save()
  if (sender) sender.kill()
  process.exit(0)
})
