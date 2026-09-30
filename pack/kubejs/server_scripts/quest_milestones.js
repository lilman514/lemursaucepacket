// LemurSaucePacket: skill milestones in the quest book. The Skills chapter (quests/book.mjs) has a quest for every
// Project MMO skill at 10, 25, 50, 75 and 99, plus the total-level ladder, each with a custom task nobody can click.
// quests/build.mjs writes their quest ids to config/lemursaucepacket/milestones.json; this script reads a player's
// levels every ten seconds (and shortly after login, so time away is caught up) and completes the milestones they
// have reached through FTB Quests' own command, so the rewards wait in the book like any other quest's.
// FTB's completed-quest check (TeamData.isCompleted) is what stops a milestone completing twice.
// (Rhino: top-level const only. JsonIO.read gives Java maps and lists: index them with forEach and plain keys.)

const MILESTONES = (() => {
  try {
    // Parsed by Rhino's own JSON.parse: JsonIO.read would turn a quest id that happens to look like a number
    // ("0444095009517E71") into a double.
    let read = JSON.parse(JsonIO.readString('config/lemursaucepacket/milestones.json'))
    // [{ skill, name, milestones: [{ level, quest }] }] and [{ level, quest }].
    let skills = []
    read.skills.forEach((s) => {
      let list = []
      s.milestones.forEach((m) => list.push({ level: Number(m.level), quest: String(m.quest) }))
      skills.push({ skill: String(s.skill), name: String(s.name), milestones: list })
    })
    let total = []
    read.total.forEach((m) => total.push({ level: Number(m.level), quest: String(m.quest) }))
    return { skills: skills, total: total } // (no shorthand properties: Rhino rejects them)
  } catch (e) {
    console.error('[LemurSaucePacket] milestones: config/lemursaucepacket/milestones.json is missing or broken: ' + e)
    return null
  }
})()
const MilestonePMMO = Java.loadClass('harmonised.pmmo.api.APIUtils')
const MilestoneQuestFile = Java.loadClass('dev.ftb.mods.ftbquests.quest.ServerQuestFile')
const MilestoneProgressChange = Java.loadClass('dev.ftb.mods.ftbquests.util.ProgressChange')
const MILESTONE_INTERVAL = 200 // ticks between checks: 10 s
const MILESTONE_LOGIN_DELAY = 60 // ticks after login before the first check (FTB Teams has the team ready by then)

let milestoneQuests = null // hex id -> FTB quest object
let milestoneBuiltAt = 0 // tick of the last lookup rebuild
let milestoneLastSummary = ''
let milestoneErrorsLogged = {}
let milestonePending = {} // uuid -> tick of the catch-up check after login
let milestoneTick = 0

function milestoneError(where, e) {
  if (milestoneErrorsLogged[where]) return
  milestoneErrorsLogged[where] = true
  console.error(`[LemurSaucePacket] milestone error in ${where} (later ones there not logged): ${e}${e && e.stack ? '\n' + e.stack : ''}`)
}

/** Every milestone quest id in milestones.json. */
function milestoneIds() {
  let ids = []
  MILESTONES.skills.forEach((s) => s.milestones.forEach((m) => ids.push(m.quest)))
  MILESTONES.total.forEach((m) => ids.push(m.quest))
  return ids
}

/**
 * The quest objects behind the milestone ids, found by their hex code string (FTB ids are 64-bit longs, which
 * JavaScript numbers cannot hold exactly, so the ids never leave string form here). Rebuilt when FTB loads a new
 * quest file (/ftbquests reload).
 */
function milestoneLookup(force) {
  let file = MilestoneQuestFile.INSTANCE
  if (file == null) return null
  // Rebuilt every five minutes and whenever a quest is missing (a /ftbquests reload makes new objects).
  if (!force && milestoneQuests != null && milestoneTick - milestoneBuiltAt < 6000) return milestoneQuests
  milestoneBuiltAt = milestoneTick
  let wanted = {}
  milestoneIds().forEach((id) => (wanted[id] = true))
  let found = {}
  file.getAllObjects().forEach((object) => {
    let code = String(object.getCodeString())
    if (wanted[code]) found[code] = object
  })
  milestoneQuests = found
  let missing = Object.keys(wanted).filter((id) => found[id] == null)
  let summary = `${Object.keys(found).length} found, ${missing.length} missing`
  if (summary !== milestoneLastSummary) {
    milestoneLastSummary = summary
    if (missing.length > 0) console.warn(`[LemurSaucePacket] milestones: ${missing.length} quest id(s) are not in the quest book (rebuild it with quests/build.mjs): ${missing.join(', ')}`)
    else console.info(`[LemurSaucePacket] milestones: ${Object.keys(found).length} milestone quests found in the quest book`)
  }
  return found
}

/** Completes one milestone quest for a player (once), and tells them. */
function milestoneComplete(server, player, teamData, quests, id, label) {
  let quest = quests[id]
  if (quest == null) {
    quest = milestoneLookup(true)[id]
    if (quest == null) return
  }
  if (teamData.isCompleted(quest)) return
  // FTB's own command first; if it changed nothing (it did nothing from a script's server source in testing,
  // while the same command typed by an op works), do what the command does: QuestObject.forceProgress with a
  // non-resetting ProgressChange, straight through FTB's API.
  let route = 'command'
  server.runCommand(`ftbquests change_progress ${player.username} complete ${id}`)
  if (!teamData.isCompleted(quest)) {
    route = 'api'
    quest.forceProgress(teamData, new MilestoneProgressChange(quest, player.uuid).setReset(false))
  }
  if (!teamData.isCompleted(quest)) {
    milestoneError('complete ' + id, `neither ftbquests change_progress nor forceProgress completed quest ${id} (${label}) for ${player.username}`)
    return
  }
  console.info(`[LemurSaucePacket] ${player.username} reached the ${label} milestone (quest ${id}, via ${route})`)
  try {
    // The click event as the object form ClickEvent's codec reads; the "command:..." string form is not parsed
    // reliably by KubeJS 2101.7.
    player.tell(
      Text.of('')
        .append(Text.gold('✦ Milestone: '))
        .append(Text.yellow(label))
        .append(Text.gray(' — a reward is waiting in the quest book. '))
        .append(Text.green('[open]').click({ action: 'run_command', value: '/ftbquests open_book ' + id }).hover('Open the Skills chapter'))
    )
    server.runCommandSilent(`playsound minecraft:ui.toast.challenge_complete player ${player.username} ~ ~ ~ 0.8 1.2`)
  } catch (e) {
    milestoneError('notify', e)
  }
}

function milestoneCheck(server, player) {
  let quests = milestoneLookup(false)
  if (quests == null) return
  let data = MilestoneQuestFile.INSTANCE.getTeamData(player)
  if (!data.isPresent()) return
  let teamData = data.get()
  let total = 0
  MILESTONES.skills.forEach((s) => {
    let level = MilestonePMMO.getLevel(s.skill, player)
    total += level
    s.milestones.forEach((m) => {
      if (level >= m.level) milestoneComplete(server, player, teamData, quests, m.quest, `${s.name} ${m.level}`)
    })
  })
  MILESTONES.total.forEach((m) => {
    if (total >= m.level) milestoneComplete(server, player, teamData, quests, m.quest, `Total level ${m.level}`)
  })
}

ServerEvents.tick((event) => {
  if (MILESTONES == null) return
  milestoneTick++
  let regular = milestoneTick % MILESTONE_INTERVAL === 0
  if (!regular && Object.keys(milestonePending).length === 0) return
  event.server.players.forEach((player) => {
    try {
      let uuid = String(player.uuid)
      let due = milestonePending[uuid]
      if (!regular && (due == null || milestoneTick < due)) return
      delete milestonePending[uuid]
      milestoneCheck(event.server, player)
    } catch (e) {
      milestoneError('tick', e)
    }
  })
})

PlayerEvents.loggedIn((event) => {
  if (MILESTONES == null) return
  milestonePending[String(event.player.uuid)] = milestoneTick + MILESTONE_LOGIN_DELAY
})
