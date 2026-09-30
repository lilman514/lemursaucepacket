// LemurSaucePacket capes: earned cosmetics with perks (capes/capes.mjs; the list is config/lemursaucepacket/
// capes.json). The server owns who has what: unlocks are checked here, the wardrobe is /capes, and every
// client is told who wears which cape (capes_client.js draws them). (Rhino: top-level const only.)

const CAPES = JsonIO.read('config/lemursaucepacket/capes.json').capes
const CapePMMO = Java.loadClass('harmonised.pmmo.api.APIUtils')
const CapeAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const CapeAttributeModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const CapeOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const CapeResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
const CAPE_ATTRIBUTES = {
  armor: [CapeAttributes.ARMOR, CapeOperation.ADD_VALUE, 'lemursaucepacket:cape_armor'],
  toughness: [CapeAttributes.ARMOR_TOUGHNESS, CapeOperation.ADD_VALUE, 'lemursaucepacket:cape_toughness'],
  health: [CapeAttributes.MAX_HEALTH, CapeOperation.ADD_VALUE, 'lemursaucepacket:cape_health'],
  speed: [CapeAttributes.MOVEMENT_SPEED, CapeOperation.ADD_MULTIPLIED_TOTAL, 'lemursaucepacket:cape_speed'],
  luck: [CapeAttributes.LUCK, CapeOperation.ADD_VALUE, 'lemursaucepacket:cape_luck'],
  breakSpeed: [CapeAttributes.BLOCK_BREAK_SPEED, CapeOperation.ADD_MULTIPLIED_TOTAL, 'lemursaucepacket:cape_break_speed']
}
const SKILLS_FOR_CAPES = ['attack', 'strength', 'defence', 'ranged', 'hitpoints', 'mining', 'woodcutting', 'farming', 'fishing', 'cooking', 'smithing', 'crafting', 'agility', 'enchanting']
let capeErrorsLogged = {}
const capeError = (where, e) => {
  if (String(e).indexOf('EventExit') >= 0) throw e
  if (capeErrorsLogged[where]) return
  capeErrorsLogged[where] = true
  console.error(`[LemurSaucePacket] cape error in ${where} (later ones there not logged): ${e}${e && e.stack ? '\n' + e.stack : ''}`)
}

// ---- storage: one JSON string in the player's persistent data ----
const capeData = (player) => {
  let raw = player.persistentData.getString('lsp_capes')
  if (raw == null || raw === '') return { unlocked: [], flags: [], wearing: '' }
  try {
    return JSON.parse(raw)
  } catch (e) {
    return { unlocked: [], flags: [], wearing: '' }
  }
}
const saveCapeData = (player, data) => player.persistentData.putString('lsp_capes', JSON.stringify(data))
const capeWorn = (player) => {
  let data = capeData(player)
  return data.wearing && CAPES[data.wearing] ? data.wearing : ''
}
// gear.js reads this for crit stats.
const capePerk = (player) => {
  let id = capeWorn(player)
  return id ? CAPES[id].perk : null
}

// ---- sync to clients ----
function capeSyncAll(server) {
  let everyone = {}
  server.players.forEach((p) => (everyone[String(p.uuid)] = capeWorn(p)))
  server.players.forEach((p) => p.sendData('lemursaucepacket:capes', { capes: everyone }))
  console.info(`[LemurSaucePacket] capes synced to ${server.players.size()} player(s): ${JSON.stringify(everyone)}`)
}

// ---- unlocking ----
function capeUnlock(player, id, quiet) {
  let cape = CAPES[id]
  if (cape == null) return false
  let data = capeData(player)
  if (data.unlocked.indexOf(id) >= 0) return false
  data.unlocked.push(id)
  saveCapeData(player, data)
  console.info(`[LemurSaucePacket] ${player.username} unlocked the ${cape.name}`)
  if (!quiet) {
    player.tell(Text.of('').append(Text.gold('✦ Cape unlocked: ')).append(Text.yellow(cape.name)).append(Text.gray(' — ' + cape.description + (cape.perkText ? ' Perk: ' + cape.perkText + '.' : ''))).append(Text.of(' ')).append(Text.green('[wear it]').click('command:/capeswear ' + id).hover('Wear the ' + cape.name)))
    player.server.runCommandSilent(`playsound minecraft:ui.toast.challenge_complete player ${player.username} ~ ~ ~ 0.8 1`)
  }
  return true
}

function capeHasAdvancement(player, id) {
  try {
    let holder = player.server.getAdvancements().get(CapeResourceLocation.parse(id))
    if (holder == null) return false
    return player.getAdvancements().getOrStartProgress(holder).isDone()
  } catch (e) {
    return false
  }
}

function capeCheckUnlocks(player) {
  let data = capeData(player)
  Object.keys(CAPES).forEach((id) => {
    if (data.unlocked.indexOf(id) >= 0) return
    let u = CAPES[id].unlock
    let earned = false
    if (u.type === 'skill') earned = CapePMMO.getLevel(u.skill, player) >= u.level
    else if (u.type === 'all_skills') earned = SKILLS_FOR_CAPES.every((s) => CapePMMO.getLevel(s, player) >= u.level)
    else if (u.type === 'advancement') earned = capeHasAdvancement(player, u.id)
    else if (u.type === 'flags') earned = u.flags.every((f) => data.flags.indexOf(f) >= 0)
    else if (u.type === 'flags_prefix') earned = data.flags.filter((f) => f.indexOf(u.prefix) === 0).length >= u.count
    if (earned) capeUnlock(player, id, false)
  })
}

// Once a second for every player, from the server tick with our own counter (the server's tickCount is not
// reliably readable from scripts).
let capeTick = 0
ServerEvents.tick((event) => {
  capeTick++
  if (capeTick % 20 !== 0) return
  event.server.players.forEach((player) => {
    try {
      if (capeTick % 100 === 0) capeCheckUnlocks(player)
      capeApplyPerk(player, capeTick)
    } catch (e) {
      capeError('tick', e)
    }
  })
})

PlayerEvents.loggedIn((event) => {
  try {
    capeSyncAll(event.server)
  } catch (e) {
    capeError('login', e)
  }
})

// ---- perks while worn ----
function capeApplyPerk(player, tick) {
  let perk = capePerk(player) || {}
  let attributes = perk.attributes || {}
  Object.keys(CAPE_ATTRIBUTES).forEach((key) => {
    let [attribute, operation, idText] = CAPE_ATTRIBUTES[key]
    let instance = player.getAttribute(attribute)
    if (instance == null) return
    let id = CapeResourceLocation.parse(idText)
    let current = instance.getModifier(id)
    let amount = attributes[key] || 0
    if (current == null && amount === 0) return
    if (current != null && Math.abs(current.amount() - amount) < 0.0001) return
    // removeModifier(ResourceLocation) is ambiguous for Rhino; replace with a zero modifier instead.
    instance.addOrReplacePermanentModifier(new CapeAttributeModifier(id, amount, operation))
  })
  ;(perk.effects || []).forEach((e) => player.potionEffects.add(e.effect, 45, e.amplifier, true, false))
  if (perk.special === 'mend' && tick % 200 === 0) {
    let held = player.mainHandItem
    if (!held.isEmpty() && held.damageValue > 0) held.setDamageValue(held.damageValue - 1)
  }
}

// Enchanting Cape: a fifth more Enchanting XP. Project MMO posts XpEvent before it applies the amount, and the
// amount is a public field.
NativeEvents.onEvent('harmonised.pmmo.api.events.XpEvent', (event) => {
  try {
    if (String(event.skill) !== 'enchanting') return
    let player = event.getEntity()
    if (player == null) return
    let perk = capePerk(player)
    if (perk && perk.special === 'enchant_xp') event.amountAwarded = Math.round(event.amountAwarded * 1.2)
  } catch (e) {
    capeError('xp', e)
  }
})

ItemEvents.foodEaten((event) => {
  try {
    let player = event.player
    if (player == null || player.level.isClientSide()) return
    let perk = capePerk(player)
    if (perk && perk.special === 'eat_heal') player.heal(4)
  } catch (e) {
    capeError('eat', e)
  }
})

BlockEvents.broken((event) => {
  let player = event.player
  if (player == null || player.level.isClientSide()) return
  try {
    let perk = capePerk(player)
    if (perk == null) return
    if (perk.special === 'log_xp' && event.block.hasTag('minecraft:logs')) CapePMMO.addXp('woodcutting', player, 3)
    if (perk.special === 'double_crops' && event.block.hasTag('minecraft:crops') && Math.random() < 0.2) {
      event.block.getDrops(player, player.mainHandItem).forEach((stack) => event.block.popItem(stack))
    }
  } catch (e) {
    capeError('break', e)
  }
})

// ---- the wardrobe and the admin commands ----
function capeWardrobe(player) {
  let data = capeData(player)
  let worn = capeWorn(player)
  player.tell(Text.gold('— Your capes —'))
  if (data.unlocked.length === 0) player.tell(Text.gray('None yet. Skill capes come at level 99, quest capes for finishing chapters, and a few for real feats. See the wiki.'))
  data.unlocked.forEach((id) => {
    let cape = CAPES[id]
    if (cape == null) return
    let line = Text.of('').append(id === worn ? Text.green('● ') : Text.darkGray('○ ')).append(Text.yellow(cape.name)).append(Text.gray(cape.perkText ? ' — ' + cape.perkText : ''))
    if (id !== worn) line = line.append(Text.of(' ')).append(Text.aqua('[wear]').click('command:/capeswear ' + id).hover(cape.description))
    player.tell(line)
  })
  let locked = Object.keys(CAPES).length - data.unlocked.length
  player.tell(Text.gray(`${locked} more to earn. `).append(worn ? Text.red('[take off]').click('command:/capesoff') : Text.of('')))
}

ServerEvents.commandRegistry((event) => {
  const Commands = event.commands
  const Arguments = event.arguments
  event.register(
    Commands.literal('capes')
      .executes((ctx) => {
        capeWardrobe(ctx.source.playerOrException)
        return 1
      })
      .then(
        Commands.literal('wear').then(
          Commands.argument('cape', Arguments.STRING.create(event)).executes((ctx) => {
            let player = ctx.source.playerOrException
            let id = Arguments.STRING.getResult(ctx, 'cape')
            let data = capeData(player)
            if (data.unlocked.indexOf(id) < 0 || CAPES[id] == null) {
              player.tell(Text.red("You haven't earned that cape."))
              return 0
            }
            data.wearing = id
            saveCapeData(player, data)
            capeSyncAll(player.server)
            player.tell(Text.of('').append(Text.gold('Wearing the ')).append(Text.yellow(CAPES[id].name)).append(Text.gold('.')))
            return 1
          })
        )
      )
      .then(
        Commands.literal('off').executes((ctx) => {
          let player = ctx.source.playerOrException
          let data = capeData(player)
          data.wearing = ''
          saveCapeData(player, data)
          capeSyncAll(player.server)
          player.tell(Text.gold('Cape off.'))
          return 1
        })
      )
  )
  const target = (ctx) => Arguments.PLAYER.getResult(ctx, 'player')
  event.register(
    Commands.literal('lsp')
      .requires((source) => source.hasPermission(2))
      .then(
        Commands.literal('cape')
          .then(
            Commands.literal('unlock').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).then(
                Commands.argument('cape', Arguments.STRING.create(event)).executes((ctx) => {
                  let player = target(ctx)
                  let id = Arguments.STRING.getResult(ctx, 'cape')
                  console.info(`[LemurSaucePacket] /lsp cape unlock ${player.username} ${id}`)
                  if (CAPES[id] == null) {
                    ctx.source.sendFailure(Text.red('No such cape: ' + id))
                    return 0
                  }
                  capeUnlock(player, id, false)
                  return 1
                })
              )
            )
          )
          .then(
            Commands.literal('flag').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).then(
                Commands.argument('flag', Arguments.STRING.create(event)).executes((ctx) => {
                  let player = target(ctx)
                  let flag = Arguments.STRING.getResult(ctx, 'flag')
                  let data = capeData(player)
                  if (data.flags.indexOf(flag) < 0) data.flags.push(flag)
                  saveCapeData(player, data)
                  capeCheckUnlocks(player)
                  return 1
                })
              )
            )
          )
          .then(
            Commands.literal('list').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).executes((ctx) => {
                let player = target(ctx)
                let data = capeData(player)
                ctx.source.sendSuccess(Text.of(`${player.username}: wearing ${data.wearing || 'nothing'}; unlocked ${data.unlocked.join(', ') || 'none'}; flags ${data.flags.join(', ') || 'none'}`), false)
                return 1
              })
            )
          )
      )
  )
})
