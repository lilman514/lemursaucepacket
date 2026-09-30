// LemurSaucePacket hearts, graves and elimination (docs/lifesteal.md). Numbers: config/lemursaucepacket/
// lifesteal.json. This file is the lifesteal core: a death costs a heart and drops a Heart item, a Heart used is
// a heart back, items become yours the first time they enter your inventory, and a player at zero hearts is
// eliminated. The parts that need Java are in mods-src/lemursaucepacket-fixes (mod id lsp_fixes): the grave
// veto without Grave Essence, keeping an eliminated player on the death screen until they confirm, the
// erasure of their blocks and items, and the compass GUI and needle.
//
// State, all in player.persistentData so lsp_fixes can read and write the same keys:
//   lsp_hearts        int   hearts gained from Heart items minus hearts lost to deaths ("balance")
//   lsp_generation    int   life number; lsp_fixes adds one when a player is erased
//   lsp_eliminated    bool  dead at zero hearts and not yet revived or erased
//   lsp_playtime      int   ticks online, counted here
//   lsp_protect_until int   newcomer protection ends at this lsp_playtime; new players: the config hours
//   lsp_protect_off   bool  protection ended early (the player hit someone)
//   lsp_last_killer   str   uuid of the last player who took a heart, with lsp_last_killer_time (epoch ms)
//   lsp_death_pos     str   "dimension x y z" of the death that eliminated the player
//   lsp_new_life      bool  set by lsp_fixes after an erasure; announced on the next respawn
// Items: minecraft:custom_data holds lsp_owner (uuid string) + lsp_gen (int) on owned items, and lsp_heart
// {id, from, t} on Hearts. (Rhino: top-level const only; let inside functions; no optional chaining.)

const LS = JsonIO.read('config/lemursaucepacket/lifesteal.json')
const LS_HEART = 'lemursaucepacket:heart'
const LS_OWNERLESS_TAG = 'lemursaucepacket:ownerless'
const LS_MODIFIER_ID = 'lemursaucepacket:lifesteal'
const LS_TICKS_PER_HOUR = 72000
const LsPMMO = Java.loadClass('harmonised.pmmo.api.APIUtils')
const LsAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const LsAttributeModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const LsOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const LsResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
const LsItemEntity = Java.loadClass('net.minecraft.world.entity.item.ItemEntity')
const LsUUID = Java.loadClass('java.util.UUID')
const LsGameType = Java.loadClass('net.minecraft.world.level.GameType')
const LsLevel = Java.loadClass('net.minecraft.world.level.Level')
let LsCuriosApi = null
try {
  LsCuriosApi = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')
} catch (e) {}
let LsBackpackWrapper = null
try {
  LsBackpackWrapper = Java.loadClass('net.p3pp3rf1y.sophisticatedbackpacks.backpack.wrapper.BackpackWrapper')
} catch (e) {}
const LS_FIXES_LOADED = Platform.isLoaded('lsp_fixes')

let lsErrorsLogged = {}
const lsError = (where, e) => {
  if (String(e).indexOf('EventExit') >= 0) throw e
  if (lsErrorsLogged[where]) return
  lsErrorsLogged[where] = true
  console.error(`[LemurSaucePacket] lifesteal error in ${where} (later ones there not logged): ${e}${e && e.stack ? '\n' + e.stack : ''}`)
}

// ---- state ----
const lsData = (player) => player.persistentData
const lsBalance = (player) => lsData(player).getInt('lsp_hearts')
const lsGen = (player) => lsData(player).getInt('lsp_generation')
const lsEliminated = (player) => lsData(player).getBoolean('lsp_eliminated')
// Ticks online, counted here once a second (the vanilla play_time stat is reachable, but getStats() is
// shadowed by KubeJS's own getStats in Rhino).
const lsPlayTime = (player) => lsData(player).getInt('lsp_playtime')
// "minecraft:overworld" for a level. Where a KubeJS bean property and a vanilla method share a name, Rhino
// resolves it one way or the other per name (player.level is the property: player.level() fails; server.overworld
// is vanilla's method: it has to be called), so these helpers accept either.
const lsDim = (level) => {
  let dimension = level.dimension
  if (typeof dimension === 'function') dimension = level.dimension().location()
  return String(dimension)
}
const lsOverworld = (server) => {
  let level = server.overworld
  if (typeof level === 'function') level = server.overworld()
  return level
}
/** The world spawn, or null if this build hides both ways of reading it. */
function lsWorldSpawn(level) {
  try {
    return level.getSharedSpawnPos()
  } catch (e) {
    lsError('world spawn (getSharedSpawnPos)', e)
  }
  try {
    return level.getLevelData().getSpawnPos()
  } catch (e) {
    lsError('world spawn (level data)', e)
  }
  return null
}
function lsLevelOf(server, dim) {
  let found = null
  server.getAllLevels().forEach((level) => {
    if (found == null && lsDim(level) === dim) found = level
  })
  return found
}
const lsSkillHearts = (player) => {
  try {
    return Math.floor((LsPMMO.getLevel('hitpoints', player) * LS.hitpointsHpPerLevel) / 2)
  } catch (e) {
    return 0
  }
}
/** Full hearts of the player's own health bar: base + Hitpoints + balance. Zero means eliminated. */
const lsLives = (player) => LS.startingHearts + lsSkillHearts(player) + lsBalance(player)
const lsMaxLives = (player) => LS.startingHearts + LS.maxBonusHearts + lsSkillHearts(player)
const lsProtected = (player) => {
  let data = lsData(player)
  if (data.getBoolean('lsp_protect_off')) return false
  let play = lsPlayTime(player)
  if (play < LS.newcomerProtectionHours * LS_TICKS_PER_HOUR) return true
  return data.contains('lsp_protect_until') && play < data.getInt('lsp_protect_until')
}
const lsProtectionLeft = (player) => {
  let data = lsData(player)
  let play = lsPlayTime(player)
  let until = Math.max(LS.newcomerProtectionHours * LS_TICKS_PER_HOUR, data.contains('lsp_protect_until') ? data.getInt('lsp_protect_until') : 0)
  return Math.max(0, until - play)
}

// ---- log: the KubeJS log plus a ring buffer an admin can read in game ----
function lsLog(server, line) {
  console.info('[LemurSaucePacket] lifesteal: ' + line)
  try {
    let raw = server.persistentData.getString('lsp_lifesteal_log')
    let list = raw ? JSON.parse(raw) : []
    list.push(new Date().toISOString().slice(0, 19) + ' ' + line)
    while (list.length > 300) list.shift()
    server.persistentData.putString('lsp_lifesteal_log', JSON.stringify(list))
  } catch (e) {
    lsError('log', e)
  }
}

// ---- max health: one permanent modifier, balance * 2 HP ----
function lsApplyHealth(player) {
  let instance = player.getAttribute(LsAttributes.MAX_HEALTH)
  if (instance == null) return
  let amount = lsBalance(player) * 2
  let id = LsResourceLocation.parse(LS_MODIFIER_ID)
  let current = instance.getModifier(id)
  if (current == null && amount === 0) return
  if (current != null && Math.abs(current.amount() - amount) < 0.0001) return
  // removeModifier(ResourceLocation) is ambiguous for Rhino, so an unwanted modifier becomes a zero one.
  instance.addOrReplacePermanentModifier(new LsAttributeModifier(id, amount, LsOperation.ADD_VALUE))
}

function lsTitle(player, title, subtitle, color) {
  let name = player.username
  let server = player.server
  server.runCommandSilent(`title ${name} times 10 70 20`)
  server.runCommandSilent(`title ${name} subtitle {"text":${JSON.stringify(subtitle)},"color":"gray"}`)
  server.runCommandSilent(`title ${name} title {"text":${JSON.stringify(title)},"color":"${color || 'red'}"}`)
}

function lsBroadcast(server, text) {
  if (!LS.broadcastHeartEvents) return
  server.tell(Text.of('').append(Text.darkRed('♥ ')).append(text))
}

// ---- the Heart item ----
function lsMakeHeart(fromName, fromUuid) {
  let stack = Item.of(LS_HEART)
  let data = stack.customData
  let heart = NBT.compoundTag()
  heart.putString('id', String(LsUUID.randomUUID()))
  heart.putString('from', fromName || '')
  heart.putString('from_uuid', fromUuid || '')
  heart.putLong('t', Date.now())
  data.put('lsp_heart', heart)
  stack.setCustomData(data)
  if (fromName) {
    stack.setItemName(Text.of(fromName + "'s Heart"))
    stack.setLore([Text.gray('Taken from ' + fromName + '.')])
  } else {
    stack.setLore([Text.gray('Forged, not taken.')])
  }
  return stack
}

/** A Heart that never despawns, survives anything but the void, and floats above the void. */
function lsSpawnHeart(level, x, y, z, stack) {
  let minY = level.getMinBuildHeight()
  let floating = y < minY + 1
  let entity = new LsItemEntity(level, x, floating ? minY + 2 : y + 0.5, z, stack)
  entity.setUnlimitedLifetime()
  entity.setInvulnerable(true)
  entity.setPickUpDelay(LS.heartPickupDelayTicks)
  if (floating) entity.setNoGravity(true)
  else {
    // A small hop, through KubeJS's setter: vanilla setDeltaMovement(x, y, z) isn't reachable from scripts in
    // this build ("Can't find method"). Cosmetic, so it may never stop the Heart from spawning.
    try {
      entity.setMotionY(0.25)
    } catch (e) {
      lsError('heart hop', e)
    }
  }
  level.addFreshEntity(entity)
  return entity
}

const lsHeartSerial = (stack) => {
  let data = stack.customData
  if (!data.contains('lsp_heart')) return ''
  return data.getCompound('lsp_heart').getString('id')
}

/** Crafted Hearts get their serial the first time they are seen in an inventory. */
function lsEnsureHeartSerial(stack) {
  if (String(stack.id) !== LS_HEART) return
  let data = stack.customData
  if (data.contains('lsp_heart')) return
  let heart = NBT.compoundTag()
  heart.putString('id', String(LsUUID.randomUUID()))
  heart.putString('from', '')
  heart.putString('from_uuid', '')
  heart.putLong('t', Date.now())
  data.put('lsp_heart', heart)
  stack.setCustomData(data)
}

const lsSpent = (server) => {
  let raw = server.persistentData.getString('lsp_spent_hearts')
  return raw ? JSON.parse(raw) : []
}
function lsMarkSpent(server, serial) {
  let list = lsSpent(server)
  list.push(serial)
  while (list.length > 5000) list.shift()
  server.persistentData.putString('lsp_spent_hearts', JSON.stringify(list))
}

// ---- who killed whom ----
function lsKiller(player, source) {
  let killer = null
  try {
    killer = source.getPlayer()
  } catch (e) {}
  if (killer == null) {
    try {
      let credit = player.getKillCredit()
      if (credit != null && credit.isPlayer()) killer = credit
    } catch (e) {}
  }
  if (killer == null || String(killer.uuid) === String(player.uuid)) return null
  return killer
}

// ---- death: lose a heart, drop a Heart, maybe be eliminated ----
// On the drops event, not the death event: the death is final here, and a Heart spawned straight into the
// level is never in the drop list, so it never goes into a grave (the gravestone mod reads the drops after us).
EntityEvents.drops('minecraft:player', (event) => {
  if (!LS.enabled) return
  let player = event.entity
  if (player == null || !player.isPlayer() || player.level.isClientSide()) return
  try {
    lsDeath(player, event.source)
  } catch (e) {
    lsError('death', e)
  }
})

function lsDeath(player, source) {
  let server = player.server
  let data = lsData(player)
  let name = player.username
  let killer = lsKiller(player, source)
  let now = Date.now()
  if (lsProtected(player)) {
    player.tell(Text.gray('Newcomer protection: you lost no heart and dropped none.'))
    lsLog(server, `${name} died protected (${killer ? 'killed by ' + killer.username : 'no player killer'})`)
    return
  }
  if (killer != null && data.getString('lsp_last_killer') === String(killer.uuid)) {
    let since = now - data.getLong('lsp_last_killer_time')
    if (since < LS.sameKillerCooldownMinutes * 60000) {
      let minutes = Math.ceil((LS.sameKillerCooldownMinutes * 60000 - since) / 60000)
      player.tell(Text.gray(`${killer.username} already took a heart from you. No heart lost for another ${minutes} min.`))
      killer.tell(Text.gray(`You already took ${name}'s heart. Nothing drops for another ${minutes} min.`))
      lsLog(server, `${name} killed again by ${killer.username} within the cooldown: no heart`)
      return
    }
  }
  if (killer != null) {
    data.putString('lsp_last_killer', String(killer.uuid))
    data.putLong('lsp_last_killer_time', now)
  }
  data.putInt('lsp_hearts', lsBalance(player) - 1)
  let lives = lsLives(player)
  let heart = lsMakeHeart(name, String(player.uuid))
  lsSpawnHeart(player.level, player.x, player.y, player.z, heart)
  lsLog(server, `${name} lost a heart (${lives} left)${killer ? ', killed by ' + killer.username : ''}; Heart ${lsHeartSerial(heart)} dropped at ${lsDim(player.level)} ${Math.floor(player.x)} ${Math.floor(player.y)} ${Math.floor(player.z)}`)
  if (lives <= 0) {
    data.putBoolean('lsp_eliminated', true)
    data.putString('lsp_death_pos', `${lsDim(player.level)} ${Math.floor(player.x)} ${Math.floor(player.y)} ${Math.floor(player.z)}`)
    player.tell(Text.red('That was your last heart. You are eliminated.'))
    player.tell(Text.gray('Wait for a friend to /revive you with a Heart, or accept elimination on the death screen: everything you placed and everything that is yours is erased.'))
    lsBroadcast(server, Text.of('').append(Text.yellow(name)).append(Text.gray(' has lost their last heart' + (killer ? ' to ' : '') )).append(killer ? Text.yellow(killer.username) : Text.of('')).append(Text.gray('. A Heart can still bring them back.')))
    lsLog(server, `${name} is eliminated`)
    return
  }
  player.tell(Text.of('').append(Text.red('You lost a heart. ')).append(Text.gray(`${lives} left. Your Heart is on the ground where you died.`)))
  if (killer != null) {
    killer.tell(Text.of('').append(Text.gold(`${name}'s Heart dropped where they died. `)).append(Text.gray('Pick it up and right-click it.')))
    lsBroadcast(server, Text.of('').append(Text.yellow(killer.username)).append(Text.gray(' took a heart from ')).append(Text.yellow(name)).append(Text.gray(`. ${name} has ${lives} left.`)))
  }
  if (LS.warnAtHearts.indexOf(lives) >= 0) {
    data.putBoolean('lsp_warn_pending', true)
    data.putInt('lsp_warn_lives', lives)
  }
}

// After a respawn the attribute map is fresh: put the modifier back at once, and fill the new bar.
PlayerEvents.respawned((event) => {
  let player = event.player
  try {
    lsApplyHealth(player)
    player.setHealth(player.getMaxHealth())
    let data = lsData(player)
    if (data.getBoolean('lsp_new_life')) {
      data.putBoolean('lsp_new_life', false)
      lsTitle(player, 'A new life', `${lsLives(player)} hearts. ${LS.newcomerProtectionHours} hours of protection.`, 'gold')
      player.tell(Text.gray('You start over. Your skills, quests and capes are still yours.'))
    } else if (data.getBoolean('lsp_warn_pending')) {
      data.putBoolean('lsp_warn_pending', false)
      let lives = data.getInt('lsp_warn_lives')
      lsTitle(player, lives === 1 ? 'LAST HEART' : `${lives} hearts left`, lives === 1 ? 'Your next death eliminates you.' : 'Careful.', lives === 1 ? 'dark_red' : 'red')
    }
    if (lsEliminated(player) && !LS_FIXES_LOADED) lsLimboRespawn(player)
  } catch (e) {
    lsError('respawn', e)
  }
})

// Limbo without lsp_fixes (which keeps an eliminated player on the death screen instead): a spectator held at
// the death spot, who can wait for a revive or type /lifesteal accept.
function lsLimboRespawn(player) {
  player.setGameMode(LsGameType.SPECTATOR)
  lsLimboTick(player)
  player.tell(Text.red('You have no hearts left.'))
  player.tell(Text.gray('You are a ghost until a friend uses a Heart on you (/revive). Or type ').append(Text.red('/lifesteal accept')).append(Text.gray(' to start over.')))
}

function lsLimboTick(player) {
  if (!player.isSpectator()) player.setGameMode(LsGameType.SPECTATOR)
  let pos = String(lsData(player).getString('lsp_death_pos')).split(' ')
  if (pos.length !== 4) return
  let dx = player.x - Number(pos[1])
  let dz = player.z - Number(pos[3])
  if (lsDim(player.level) !== pos[0] || dx * dx + dz * dz > 24 * 24) {
    let level = lsLevelOf(player.server, pos[0])
    if (level == null) return
    player.teleportToLevel(level, Number(pos[1]) + 0.5, Number(pos[2]) + 1, Number(pos[3]) + 0.5, player.yaw, player.pitch)
    player.tell(Text.gray('Ghosts stay where they fell.'))
  }
}

/** A fresh life: the keys lsp_fixes also writes after an erasure. */
function lsNewLife(player, erased) {
  let data = lsData(player)
  data.putInt('lsp_generation', lsGen(player) + 1)
  data.putInt('lsp_hearts', 0)
  data.putBoolean('lsp_eliminated', false)
  data.putBoolean('lsp_protect_off', false)
  data.putInt('lsp_protect_until', lsPlayTime(player) + LS.newcomerProtectionHours * LS_TICKS_PER_HOUR)
  data.remove('lsp_last_killer')
  data.remove('lsp_last_killer_time')
  data.putBoolean('lsp_new_life', false)
  player.setGameMode(LsGameType.SURVIVAL)
  // Back to world spawn. The new life's numbers are already saved above, so a failure here only leaves the
  // player where they respawned (logged), never half-restarted.
  try {
    player.setRespawnPosition(LsLevel.OVERWORLD, null, 0, false, false)
    let overworld = lsOverworld(player.server)
    let spawn = lsWorldSpawn(overworld)
    if (spawn != null) player.teleportToLevel(overworld, spawn.getX() + 0.5, spawn.getY() + 1, spawn.getZ() + 0.5, 0, 0)
  } catch (e) {
    lsError('new life: back to spawn', e)
  }
  lsApplyHealth(player)
  player.setHealth(player.getMaxHealth())
  lsTitle(player, 'A new life', `${lsLives(player)} hearts. ${LS.newcomerProtectionHours} hours of protection.`, 'gold')
  lsLog(player.server, `${player.username} starts life ${lsGen(player)}${erased ? ' (erased)' : ' (nothing erased: lsp_fixes not loaded)'}`)
}

// ---- using a Heart ----
ItemEvents.rightClicked(LS_HEART, (event) => {
  let player = event.player
  if (player == null || player.level.isClientSide()) return
  try {
    lsUseHeart(player, event.hand === 'main_hand' ? player.mainHandItem : player.offHandItem)
  } catch (e) {
    lsError('use', e)
  }
})

function lsUseHeart(player, stack) {
  if (stack.isEmpty() || String(stack.id) !== LS_HEART) return
  let server = player.server
  lsEnsureHeartSerial(stack)
  let serial = lsHeartSerial(stack)
  if (lsSpent(server).indexOf(serial) >= 0) {
    stack.setCount(0)
    player.tell(Text.red('This Heart was already used once. It crumbles in your hand.'))
    server.runCommandSilent(`playsound minecraft:block.glass.break player ${player.username} ~ ~ ~ 0.7 0.6`)
    lsLog(server, `${player.username} tried a spent Heart ${serial}`)
    return
  }
  if (lsBalance(player) >= LS.maxBonusHearts) {
    player.tell(Text.gray(`You can't hold more than ${lsMaxLives(player)} hearts.`))
    return
  }
  let heart = stack.customData.getCompound('lsp_heart')
  let from = heart.getString('from')
  let fromUuid = heart.getString('from_uuid')
  lsMarkSpent(server, serial)
  lsData(player).putInt('lsp_hearts', lsBalance(player) + 1)
  stack.setCount(0)
  lsApplyHealth(player)
  player.heal(2)
  let lives = lsLives(player)
  player.tell(Text.of('').append(Text.red('♥ ')).append(Text.gold(`+1 heart. `)).append(Text.gray(`You have ${lives}.`)))
  server.runCommandSilent(`playsound minecraft:entity.player.levelup player ${player.username} ~ ~ ~ 0.8 0.7`)
  server.runCommandSilent(`particle minecraft:heart ${player.x} ${player.y + 1.2} ${player.z} 0.5 0.5 0.5 0.1 12 force`)
  if (from && fromUuid !== String(player.uuid)) {
    lsBroadcast(server, Text.of('').append(Text.yellow(player.username)).append(Text.gray(' used ')).append(Text.yellow(from)).append(Text.gray("'s heart.")))
  }
  lsLog(server, `${player.username} used Heart ${serial}${from ? ' from ' + from : ''} (${lives} hearts)`)
}

// ---- revive: a Heart in hand brings an eliminated player back with one heart ----
/**
 * A player who has joined before, by name, online or not; null if unknown. getProfileCache().get() has String and
 * UUID overloads and KubeJS turns a string argument into a UUID ("UUID string must be 32 or 36 characters"), so
 * the String one is called by its signature.
 */
function lsProfileByName(server, name) {
  try {
    let found = server.getProfileCache()['get(java.lang.String)'](name)
    return found.isPresent() ? found.get() : null
  } catch (e) {
    lsError('profile lookup', e)
    return null
  }
}

function lsRevive(reviver, targetName) {
  let server = reviver.server
  let stack = reviver.mainHandItem
  if (stack.isEmpty() || String(stack.id) !== LS_HEART) {
    reviver.tell(Text.red('Hold a Heart in your main hand.'))
    return 0
  }
  lsEnsureHeartSerial(stack)
  let serial = lsHeartSerial(stack)
  if (lsSpent(server).indexOf(serial) >= 0) {
    stack.setCount(0)
    reviver.tell(Text.red('This Heart was already used once. It crumbles in your hand.'))
    return 0
  }
  let target = server.playerList.getPlayerByName(targetName)
  if (target != null) {
    if (!lsEliminated(target)) {
      reviver.tell(Text.red(`${target.username} is not eliminated.`))
      return 0
    }
    lsMarkSpent(server, serial)
    stack.setCount(0)
    lsData(target).putInt('lsp_hearts', lsBalance(target) + 1)
    lsData(target).putBoolean('lsp_eliminated', false)
    lsData(target).remove('lsp_last_killer')
    if (target.isSpectator()) {
      target.setGameMode(LsGameType.SURVIVAL)
      lsApplyHealth(target)
      target.setHealth(target.getMaxHealth())
    }
    target.tell(Text.of('').append(Text.gold(`${reviver.username} gave you a heart. `)).append(Text.gray('You are back, with one heart. Respawn when ready.')))
  } else {
    let profile = lsProfileByName(server, targetName)
    if (profile == null) {
      reviver.tell(Text.red(`No player called ${targetName}.`))
      return 0
    }
    // Offline: remembered and applied when they log in (lsp_fixes reads the same key for its respawn gate).
    let key = 'lsp_revive_' + String(profile.getId())
    lsMarkSpent(server, serial)
    stack.setCount(0)
    server.persistentData.putInt(key, server.persistentData.getInt(key) + 1)
  }
  lsBroadcast(server, Text.of('').append(Text.yellow(reviver.username)).append(Text.gray(' gave a heart to ')).append(Text.yellow(targetName)).append(Text.gray('.')))
  lsLog(server, `${reviver.username} revived ${targetName} with Heart ${serial}${target == null ? ' (offline, pending)' : ''}`)
  reviver.tell(Text.gold(`You gave ${targetName} a heart.`))
  return 1
}

PlayerEvents.loggedIn((event) => {
  let player = event.player
  try {
    let server = player.server
    let key = 'lsp_revive_' + String(player.uuid)
    let pending = server.persistentData.getInt(key)
    if (pending > 0) {
      server.persistentData.remove(key)
      let data = lsData(player)
      data.putInt('lsp_hearts', lsBalance(player) + pending)
      data.putBoolean('lsp_eliminated', false)
      data.remove('lsp_last_killer')
      player.tell(Text.gold('While you were away someone gave you a heart. You are back.'))
      lsLog(server, `${player.username} logged in with ${pending} pending revive(s)`)
    }
    lsApplyHealth(player)
    if (lsEliminated(player) && player.isSpectator() && !LS_FIXES_LOADED) lsLimboTick(player)
  } catch (e) {
    lsError('login', e)
  }
})

// Hitting another player ends your own newcomer protection.
EntityEvents.beforeHurt('minecraft:player', (event) => {
  if (!LS.protectionEndsOnAttack) return
  try {
    let attacker = event.source.getPlayer()
    let victim = event.entity
    if (attacker == null || victim == null || String(attacker.uuid) === String(victim.uuid)) return
    if (attacker.level.isClientSide() || !lsProtected(attacker)) return
    lsData(attacker).putBoolean('lsp_protect_off', true)
    attacker.tell(Text.red('You attacked a player: your newcomer protection is over.'))
    lsLog(attacker.server, `${attacker.username} ended their protection by hitting ${victim.username}`)
  } catch (e) {
    lsError('hurt', e)
  }
})

// ---- ownership: an item is yours from the first time it enters your inventory ----
function lsStamp(stack, player) {
  if (stack == null || stack.isEmpty()) return false
  if (String(stack.id) === LS_HEART) {
    lsEnsureHeartSerial(stack)
    return false
  }
  if (stack.hasTag(LS_OWNERLESS_TAG)) return false
  let data = stack.customData
  if (data.contains('lsp_owner')) return false
  data.putString('lsp_owner', String(player.uuid))
  data.putInt('lsp_gen', lsGen(player))
  stack.setCustomData(data)
  return true
}

function lsStampHandler(handler, player) {
  let stamped = 0
  for (let i = 0; i < handler.getSlots(); i++) {
    let stack = handler.getStackInSlot(i)
    if (lsStamp(stack, player)) {
      stamped++
      // Backpack handlers only save what they are told about.
      try {
        handler.setStackInSlot(i, stack)
      } catch (e) {}
    }
  }
  return stamped
}

const lsIsBackpack = (stack) => {
  if (LsBackpackWrapper == null || stack.isEmpty()) return false
  let id = String(stack.id)
  return id.indexOf('sophisticatedbackpacks:') === 0 && id.lastIndexOf('backpack') === id.length - 8
}

function lsStampInventory(player) {
  if (!LS.ownership.enabled) return
  let inventory = player.inventory
  let backpacks = []
  for (let i = 0; i < inventory.getSlots(); i++) {
    let stack = inventory.getStackInSlot(i)
    lsStamp(stack, player)
    if (lsIsBackpack(stack)) backpacks.push(stack)
  }
  try {
    lsStamp(player.containerMenu.getCarried(), player)
  } catch (e) {}
  if (LsCuriosApi != null) {
    try {
      let curios = LsCuriosApi.getCuriosInventory(player).orElse(null)
      if (curios != null) {
        let handler = curios.getEquippedCurios()
        for (let i = 0; i < handler.getSlots(); i++) {
          let stack = handler.getStackInSlot(i)
          lsStamp(stack, player)
          if (lsIsBackpack(stack)) backpacks.push(stack)
        }
      }
    } catch (e) {
      lsError('curios', e)
    }
  }
  backpacks.forEach((backpack) => {
    try {
      let wrapper = LsBackpackWrapper.fromStack(backpack)
      lsStampHandler(wrapper.getInventoryHandler(), player)
    } catch (e) {
      lsError('backpack', e)
    }
  })
}

// Before the pickup merges into a stack, so stamped items stack with what you already carry.
ItemEvents.canPickUp((event) => {
  let player = event.player
  if (player == null || player.level.isClientSide() || !LS.ownership.enabled) return
  try {
    lsStamp(event.item, player)
  } catch (e) {
    lsError('pickup', e)
  }
})

PlayerEvents.inventoryChanged((event) => {
  let player = event.player
  if (player == null || player.level.isClientSide() || !LS.ownership.enabled) return
  try {
    lsStampInventory(player)
  } catch (e) {
    lsError('inventory', e)
  }
})

ServerEvents.tags('item', (event) => {
  event.add(LS_OWNERLESS_TAG, LS.ownership.ownerless)
})

// ---- once a second ----
let lsTick = 0
ServerEvents.tick((event) => {
  lsTick++
  if (lsTick % 20 !== 0) return
  event.server.players.forEach((player) => {
    try {
      lsData(player).putInt('lsp_playtime', lsPlayTime(player) + 20)
      lsApplyHealth(player)
      if (lsEliminated(player) && !LS_FIXES_LOADED && player.isAlive()) lsLimboTick(player)
      if (LS.ownership.enabled && lsTick % (LS.ownership.scanEverySeconds * 20) === 0) lsStampInventory(player)
    } catch (e) {
      lsError('tick', e)
    }
  })
})

// ---- commands ----
// `out` is a function that shows one line: player.tell for /hearts, the command source for /lsp hearts.
function lsStatus(player, out) {
  let skill = lsSkillHearts(player)
  let balance = lsBalance(player)
  let lives = lsLives(player)
  out(Text.of('').append(Text.red('♥ ')).append(Text.gold(`${player.username}: ${lives} hearts`)).append(Text.gray(` (${LS.startingHearts} base, ${skill} from Hitpoints, ${balance >= 0 ? '+' : ''}${balance} from Hearts). Max ${lsMaxLives(player)}.`)))
  if (lsProtected(player)) out(Text.gray(`Newcomer protection: ${Math.ceil((lsProtectionLeft(player) / LS_TICKS_PER_HOUR) * 60)} minutes left. No hearts lost until then.`))
  if (lsEliminated(player)) out(Text.red('Eliminated: waiting for a revive or for the death screen choice.'))
  if (lsGen(player) > 0) out(Text.gray(`Life number ${lsGen(player) + 1}.`))
}
const lsSourceOut = (ctx) => (text) => ctx.source.sendSuccess(text, false)

ServerEvents.commandRegistry((event) => {
  let Commands = event.commands
  let Arguments = event.arguments
  event.register(
    Commands.literal('hearts').executes((ctx) => {
      let player = ctx.source.playerOrException
      lsStatus(player, (text) => player.tell(text))
      return 1
    })
  )
  event.register(
    Commands.literal('revive').then(
      Commands.argument('player', Arguments.STRING.create(event)).executes((ctx) => {
        return lsRevive(ctx.source.playerOrException, Arguments.STRING.getResult(ctx, 'player'))
      })
    )
  )
  event.register(
    Commands.literal('lifesteal').then(
      Commands.literal('accept').executes((ctx) => {
        let player = ctx.source.playerOrException
        if (!lsEliminated(player)) {
          player.tell(Text.gray('You are not eliminated.'))
          return 0
        }
        if (LS_FIXES_LOADED) {
          player.tell(Text.gray('Use the death screen: it warns you and erases your blocks and items.'))
          return 0
        }
        let data = lsData(player)
        if (!data.getBoolean('lsp_accept_once')) {
          data.putBoolean('lsp_accept_once', true)
          player.tell(Text.red('Are you sure? This starts you over with nothing. Type /lifesteal accept again to confirm.'))
          return 1
        }
        data.putBoolean('lsp_accept_once', false)
        lsNewLife(player, false)
        return 1
      })
    )
  )
  let target = (ctx) => Arguments.PLAYER.getResult(ctx, 'player')
  event.register(
    Commands.literal('lsp')
      .requires((source) => source.hasPermission(2))
      .then(
        Commands.literal('hearts')
          .then(
            Commands.literal('get').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).executes((ctx) => {
                lsStatus(target(ctx), lsSourceOut(ctx))
                return 1
              })
            )
          )
          .then(
            Commands.literal('set').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).then(
                Commands.argument('hearts', Arguments.INTEGER.create(event)).executes((ctx) => {
                  let player = target(ctx)
                  let wanted = Arguments.INTEGER.getResult(ctx, 'hearts')
                  lsData(player).putInt('lsp_hearts', wanted - LS.startingHearts - lsSkillHearts(player))
                  lsData(player).putBoolean('lsp_eliminated', lsLives(player) <= 0)
                  lsApplyHealth(player)
                  lsLog(ctx.source.server, `admin set ${player.username} to ${lsLives(player)} hearts`)
                  lsStatus(player, lsSourceOut(ctx))
                  return 1
                })
              )
            )
          )
          .then(
            Commands.literal('add').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).then(
                Commands.argument('hearts', Arguments.INTEGER.create(event)).executes((ctx) => {
                  let player = target(ctx)
                  lsData(player).putInt('lsp_hearts', lsBalance(player) + Arguments.INTEGER.getResult(ctx, 'hearts'))
                  lsData(player).putBoolean('lsp_eliminated', lsLives(player) <= 0)
                  lsApplyHealth(player)
                  lsLog(ctx.source.server, `admin changed ${player.username} to ${lsLives(player)} hearts`)
                  lsStatus(player, lsSourceOut(ctx))
                  return 1
                })
              )
            )
          )
          .then(
            Commands.literal('give').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).executes((ctx) => {
                target(ctx).give(lsMakeHeart('', ''))
                return 1
              })
            )
          )
      )
      .then(
        Commands.literal('lifesteal')
          .then(
            Commands.literal('protect').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).then(
                Commands.argument('hours', Arguments.INTEGER.create(event)).executes((ctx) => {
                  let player = target(ctx)
                  let hours = Arguments.INTEGER.getResult(ctx, 'hours')
                  lsData(player).putInt('lsp_protect_until', lsPlayTime(player) + hours * LS_TICKS_PER_HOUR)
                  lsData(player).putBoolean('lsp_protect_off', hours <= 0)
                  lsLog(ctx.source.server, `admin protected ${player.username} for ${hours} h`)
                  lsStatus(player, lsSourceOut(ctx))
                  return 1
                })
              )
            )
          )
          .then(
            Commands.literal('eliminate').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).executes((ctx) => {
                let player = target(ctx)
                lsData(player).putInt('lsp_hearts', -LS.startingHearts - lsSkillHearts(player))
                lsData(player).putBoolean('lsp_eliminated', true)
                lsData(player).putString('lsp_death_pos', `${lsDim(player.level)} ${Math.floor(player.x)} ${Math.floor(player.y)} ${Math.floor(player.z)}`)
                lsApplyHealth(player)
                player.kill()
                lsLog(ctx.source.server, `admin eliminated ${player.username}`)
                return 1
              })
            )
          )
          .then(
            Commands.literal('revive').then(
              Commands.argument('player', Arguments.PLAYER.create(event)).executes((ctx) => {
                let player = target(ctx)
                lsData(player).putInt('lsp_hearts', Math.max(lsBalance(player), 1 - LS.startingHearts - lsSkillHearts(player)))
                lsData(player).putBoolean('lsp_eliminated', false)
                if (player.isSpectator()) player.setGameMode(LsGameType.SURVIVAL)
                lsApplyHealth(player)
                lsLog(ctx.source.server, `admin revived ${player.username}`)
                lsStatus(player, lsSourceOut(ctx))
                return 1
              })
            )
          )
          .then(
            Commands.literal('log')
              .executes((ctx) => {
                let raw = ctx.source.server.persistentData.getString('lsp_lifesteal_log')
                let list = raw ? JSON.parse(raw) : []
                list.slice(-15).forEach((line) => ctx.source.sendSuccess(Text.gray(line), false))
                return 1
              })
              .then(
                Commands.argument('lines', Arguments.INTEGER.create(event)).executes((ctx) => {
                  let raw = ctx.source.server.persistentData.getString('lsp_lifesteal_log')
                  let list = raw ? JSON.parse(raw) : []
                  list.slice(-Arguments.INTEGER.getResult(ctx, 'lines')).forEach((line) => ctx.source.sendSuccess(Text.gray(line), false))
                  return 1
                })
              )
          )
      )
      .then(
        Commands.literal('owner').executes((ctx) => {
          let player = ctx.source.playerOrException
          let stack = player.mainHandItem
          if (stack.isEmpty()) {
            player.tell(Text.gray('Hold an item.'))
            return 0
          }
          let data = stack.customData
          if (!data.contains('lsp_owner')) {
            player.tell(Text.gray('Nobody owns this item.'))
            return 1
          }
          let uuid = data.getString('lsp_owner')
          let profile = player.server.getProfileCache()['get(java.util.UUID)'](LsUUID.fromString(uuid)).orElse(null)
          player.tell(Text.gray(`Owned by ${profile != null ? profile.getName() : uuid}, life ${data.getInt('lsp_gen') + 1}.`))
          return 1
        })
      )
  )
})
