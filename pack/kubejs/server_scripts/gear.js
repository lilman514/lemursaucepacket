// LemurSaucePacket gear: set bonuses, perks and relic synergies for the pack's own items (gear/gear.mjs).
// The numbers come from config/lemursaucepacket/gear.json, written by gear/build.mjs. This file has the
// behaviour: what a full set does, what a perk means, and the crit bonus that skills.js asks for.
// (Rhino: top-level const only; let inside functions.)

const GEAR = JsonIO.read('config/lemursaucepacket/gear.json')
const GearAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const GearAttributeModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const GearOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const GearResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
const GearNeoForgeMod = Java.loadClass('net.neoforged.neoforge.common.NeoForgeMod')
let GearCuriosApi = null
try {
  GearCuriosApi = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')
} catch (e) {}

// Set bonus attributes: [attribute holder, operation, id].
const GEAR_ATTRIBUTES = {
  speed: [GearAttributes.MOVEMENT_SPEED, GearOperation.ADD_MULTIPLIED_TOTAL, 'lemursaucepacket:set_speed'],
  stepHeight: [GearAttributes.STEP_HEIGHT, GearOperation.ADD_VALUE, 'lemursaucepacket:set_step_height'],
  swimSpeed: [GearNeoForgeMod.SWIM_SPEED, GearOperation.ADD_MULTIPLIED_TOTAL, 'lemursaucepacket:set_swim_speed'],
  health: [GearAttributes.MAX_HEALTH, GearOperation.ADD_VALUE, 'lemursaucepacket:set_health']
}
const GEAR_SLOTS = ['head', 'chest', 'legs', 'feet']
// Crops the scythe knows, with the age that means ripe.
const GEAR_CROPS = {
  'minecraft:wheat': 7,
  'minecraft:carrots': 7,
  'minecraft:potatoes': 7,
  'minecraft:beetroots': 3,
  'minecraft:nether_wart': 3,
  'farmersdelight:cabbages': 7,
  'farmersdelight:onions': 7,
  'farmersdelight:tomatoes': 7,
  'farmersdelight:rice_panicles': 3
}
let gearErrorsLogged = {}
// event.cancel() ends a KubeJS handler by throwing EventExit; that one has to pass through.
const gearRethrowExit = (e) => {
  if (String(e).indexOf('EventExit') >= 0) throw e
}
const gearError = (where, e) => {
  gearRethrowExit(e)
  if (gearErrorsLogged[where]) return
  gearErrorsLogged[where] = true
  console.error(`[LemurSaucePacket] gear error in ${where} (later ones there not logged): ${e}${e && e.stack ? '\n' + e.stack : ''}`)
}

/** Item ids in the four armour slots. */
const gearWorn = (player) => GEAR_SLOTS.map((slot) => String(player.getItemBySlot(slot).id))

/** Ids of the Relics items the player has equipped in Curios slots (empty when Curios isn't there). */
function gearRelics(player) {
  let ids = []
  if (GearCuriosApi == null) return ids
  try {
    let inventory = GearCuriosApi.getCuriosInventory(player).orElse(null)
    if (inventory == null) return ids
    let handler = inventory.getEquippedCurios()
    for (let i = 0; i < handler.getSlots(); i++) {
      let stack = handler.getStackInSlot(i)
      if (!stack.isEmpty()) ids.push(String(stack.getItem().kjs$getId ? stack.getItem().kjs$getId() : stack.id))
    }
  } catch (e) {
    gearError('relics', e)
  }
  return ids
}

/**
 * Everything the player's gear adds right now: attribute bonuses, effects, perks and crit stats, from worn
 * pieces, full sets and their relic synergies.
 */
function gearState(player) {
  let worn = gearWorn(player)
  let state = { attributes: {}, effects: [], perks: [], critChance: 0, critDamage: 0, sets: [] }
  const merge = (bonus) => {
    if (bonus == null) return
    Object.keys(bonus.attributes || {}).forEach((k) => (state.attributes[k] = (state.attributes[k] || 0) + bonus.attributes[k]))
    ;(bonus.effects || []).forEach((e) => state.effects.push(e))
    ;(bonus.perks || []).forEach((p) => state.perks.push(p))
    if (bonus.stats) {
      state.critChance += bonus.stats.critChance || 0
      state.critDamage += bonus.stats.critDamage || 0
    }
  }
  worn.forEach((id) => {
    let item = GEAR.items[id]
    if (item == null) return
    if (item.perk) state.perks.push(item.perk)
    state.critChance += item.critChance || 0
    state.critDamage += item.critDamage || 0
  })
  let relics = null
  Object.keys(GEAR.sets).forEach((setId) => {
    let set = GEAR.sets[setId]
    if (!set.pieces.every((id) => worn.indexOf(id) >= 0)) return
    state.sets.push(setId)
    merge(set.bonus)
    if (set.synergy) {
      if (relics == null) relics = gearRelics(player)
      if (relics.indexOf(set.synergy.relic) >= 0) merge(set.synergy)
    }
  })
  let held = GEAR.items[String(player.mainHandItem.id)]
  if (held != null && held.weapon) {
    state.critChance += held.critChance || 0
    state.critDamage += held.critDamage || 0
    if (held.perk) state.perks.push(held.perk)
  }
  // The cape being worn (lsp_fixes capes) can add crit stats too.
  let capeStats = gearCapeStats(player)
  state.critChance += capeStats.critChance
  state.critDamage += capeStats.critDamage
  return state
}

// The cape in the player's Curios cape slot (lsp_fixes capes; 0 without one, or with one they haven't earned).
const GearCapes = Java.loadClass('net.lemursaucepacket.fixes.capes.Capes')
function gearCapeStats(player) {
  try {
    return { critChance: Number(GearCapes.stat(player, 'critChance')), critDamage: Number(GearCapes.stat(player, 'critDamage')) }
  } catch (e) {
    return { critChance: 0, critDamage: 0 }
  }
}

// Critical hits. Strength is the chance of a melee critical, Ranged the chance of a ranged one: 0.3% per
// level (15% at 50, about 30% at 99); gear adds crit chance and crit damage on top. A crit is 1.5x damage,
// plus the gear's crit damage. (KubeJS names DamageSource's getEntity/getDirectEntity/getMsgId
// getActual/getImmediate/getType, and adds getPlayer.)
const GearPMMO = Java.loadClass('harmonised.pmmo.api.APIUtils')
const GearProjectile = Java.loadClass('net.minecraft.world.entity.projectile.Projectile')
const GEAR_CRIT_CHANCE_PER_LEVEL = 0.003

EntityEvents.beforeHurt((event) => {
  try {
    let source = event.getSource()
    let player = source.getPlayer()
    if (player == null) return
    let skill = null
    if (String(source.getType()) === 'player') skill = 'strength'
    else if (source.getImmediate() instanceof GearProjectile) skill = 'ranged'
    if (skill == null) return
    let state = gearState(player)
    if (Math.random() >= GearPMMO.getLevel(skill, player) * GEAR_CRIT_CHANCE_PER_LEVEL + state.critChance) return
    event.setDamage(event.getDamage() * (GEAR.critMultiplier + state.critDamage))
    let target = event.getEntity()
    let x = target.getX()
    let y = target.getY() + target.getBbHeight() * 0.6
    let z = target.getZ()
    event.server.runCommandSilent(`particle minecraft:crit ${x} ${y} ${z} 0.3 0.3 0.3 0.4 18 force`)
    event.server.runCommandSilent(`playsound minecraft:entity.player.attack.crit player @a ${x} ${y} ${z} 1 1.1`)
  } catch (e) {
    gearError('crit', e)
  }
})

/** Keeps a player's attribute modifiers equal to what their sets say, once a second. */
function gearApplyAttributes(player, wanted) {
  Object.keys(GEAR_ATTRIBUTES).forEach((key) => {
    let [attribute, operation, idText] = GEAR_ATTRIBUTES[key]
    let instance = player.getAttribute(attribute)
    if (instance == null) return
    let id = GearResourceLocation.parse(idText)
    let current = instance.getModifier(id)
    let amount = wanted[key] || 0
    if (current == null && amount === 0) return
    if (current != null && Math.abs(current.amount() - amount) < 0.0001) return
    // removeModifier has two overloads and Rhino calls the ResourceLocation one ambiguous, so a modifier that
    // is no longer wanted is replaced by a zero one rather than removed.
    instance.addOrReplacePermanentModifier(new GearAttributeModifier(id, amount, operation))
  })
}

// Once a second for every player, from the server tick with our own counter (PlayerEvents.tick and the
// server's tickCount both proved unreliable from scripts on the dedicated server).
let gearTick = 0
ServerEvents.tick((event) => {
  gearTick++
  if (gearTick % 20 !== 0) return
  event.server.players.forEach((player) => {
    try {
      let state = gearState(player)
      gearApplyAttributes(player, state.attributes)
      state.effects.forEach((e) => player.potionEffects.add(e.effect, 45, e.amplifier, true, false))
      if (state.perks.indexOf('night_vision_underground') >= 0 && player.y < 32) player.potionEffects.add('minecraft:night_vision', 260, 0, true, false)
      if (state.perks.indexOf('fire_immunity') >= 0) player.potionEffects.add('minecraft:fire_resistance', 45, 0, true, false)
    } catch (e) {
      gearError('tick', e)
    }
  })
})

// Fall damage, Bulwark and the Stormcaller's shock all sit on the hurt event.
function gearHurt(event) {
  let entity = event.entity
  let source = event.source
  if (entity.isPlayer()) {
    let state = gearState(entity)
    if (String(source.getType()) === 'fall' && state.perks.indexOf('no_fall_damage') >= 0) return true
    if (state.perks.indexOf('damage_reduction_10') >= 0) event.setDamage(event.getDamage() * 0.9)
  }
  let attacker = source.getPlayer()
  if (attacker != null && String(attacker.mainHandItem.id) === 'lemursaucepacket:stormcallers_sabre' && String(source.getType()) === 'player' && Math.random() < 0.1) {
    event.setDamage(event.getDamage() + 3)
    let x = entity.getX()
    let y = entity.getY() + entity.getBbHeight() * 0.6
    let z = entity.getZ()
    event.server.runCommandSilent(`particle minecraft:electric_spark ${x} ${y} ${z} 0.4 0.5 0.4 0.2 30 force`)
    event.server.runCommandSilent(`playsound minecraft:entity.lightning_bolt.impact player @a ${x} ${y} ${z} 0.6 1.6`)
  }
  return false
}
EntityEvents.beforeHurt((event) => {
  let cancel = false
  try {
    cancel = gearHurt(event)
  } catch (e) {
    gearError('hurt', e)
  }
  if (cancel) event.cancel()
})

// Block breaking: the Excavator's 3x3 and the Prospector set's double ore drops.
let gearBreaking = false
BlockEvents.broken((event) => {
  if (gearBreaking) return
  let player = event.player
  if (player == null || player.level.isClientSide()) return
  try {
    let block = event.block
    let held = String(player.mainHandItem.id)
    if (held === 'lemursaucepacket:excavators_pickaxe' && !player.isCrouching()) {
      // The 3x3 is the plane facing the player: floor/ceiling when looking steeply, a wall otherwise.
      let pitch = Number(player.pitch)
      let yaw = ((Number(player.yaw) % 360) + 360) % 360
      let facing = yaw >= 45 && yaw < 135 ? 'west' : yaw >= 135 && yaw < 225 ? 'north' : yaw >= 225 && yaw < 315 ? 'east' : 'south'
      let offsets = []
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          if (a === 0 && b === 0) continue
          if (pitch > 60 || pitch < -60) offsets.push([a, 0, b])
          else if (facing === 'east' || facing === 'west') offsets.push([0, a, b])
          else offsets.push([a, b, 0])
        }
      }
      gearBreaking = true
      try {
        offsets.forEach(([dx, dy, dz]) => {
          let other = block.offset(dx, dy, dz)
          if (other.blockState.isAir() || other.hardness < 0 || !other.hasTag('minecraft:mineable/pickaxe')) return
          if (player.mainHandItem.isEmpty()) return
          player.gameMode.destroyBlock(other.pos)
        })
      } finally {
        gearBreaking = false
      }
    }
    if (block.hasTag('c:ores') && gearState(player).perks.indexOf('ore_double_drops') >= 0 && Math.random() < 0.15) {
      let drops = block.getDrops(player, player.mainHandItem)
      drops.forEach((stack) => block.popItem(stack))
    }
  } catch (e) {
    gearError('break', e)
  }
})

// Right-click tools: the Harvester's Scythe and the Builder's Wand.
// (event.cancel() throws EventExit, so it is called after the try/catch, never inside one.)
BlockEvents.rightClicked((event) => {
  let player = event.player
  if (player == null || player.level.isClientSide() || event.hand !== 'main_hand') return
  let handled = false
  try {
    let held = String(player.mainHandItem.id)
    if (held === 'lemursaucepacket:harvesters_scythe') {
      try {
        handled = gearScythe(event, player)
      } catch (e) {
        gearError('scythe', e)
      }
    } else if (held === 'lemursaucepacket:builders_wand') {
      try {
        handled = gearWand(event, player)
      } catch (e) {
        gearError('wand', e)
      }
    }
  } catch (e) {
    gearError('use', e)
  }
  if (handled) event.cancel()
})

function gearScythe(event, player) {
  let centre = event.block
  let harvested = 0
  gearBreaking = true
  try {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        let crop = centre.offset(dx, 0, dz)
        let id = String(crop.id)
        let ripe = GEAR_CROPS[id]
        if (ripe === undefined) continue
        let age = crop.properties.age
        if (age === undefined || Number(age) < ripe) continue
        if (player.mainHandItem.isEmpty()) break
        player.gameMode.destroyBlock(crop.pos)
        crop.set(id, { age: '0' })
        harvested++
      }
    }
  } finally {
    gearBreaking = false
  }
  if (harvested > 0) {
    player.swing()
    return true
  }
  return false
}

function gearWand(event, player) {
  let origin = event.block
  let id = String(origin.id)
  if (origin.blockState.isAir() || origin.hasTag('minecraft:shulker_boxes') || origin.blockState.hasBlockEntity()) return
  let face = String(event.facing)
  let dir = { up: [0, 1, 0], down: [0, -1, 0], north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] }[face]
  if (dir == null) return
  // Walk the face's plane outwards from the clicked block, over blocks of the same kind with air in front.
  let plane = face === 'up' || face === 'down' ? [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] : face === 'east' || face === 'west' ? [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] : [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]]
  let seen = {}
  let queue = [origin]
  let targets = []
  seen[`${origin.x},${origin.y},${origin.z}`] = true
  while (queue.length > 0 && targets.length < 32) {
    let block = queue.shift()
    let front = block.offset(dir[0], dir[1], dir[2])
    if (front.blockState.isAir()) targets.push(front)
    plane.forEach(([dx, dy, dz]) => {
      let next = block.offset(dx, dy, dz)
      let key = `${next.x},${next.y},${next.z}`
      if (seen[key] || String(next.id) !== id) return
      seen[key] = true
      queue.push(next)
    })
  }
  if (targets.length === 0) return
  let inventory = player.inventory
  let placed = 0
  for (let t = 0; t < targets.length; t++) {
    if (inventory.count(id) <= 0) break
    targets[t].set(id)
    let removed = false
    for (let slot = 0; slot < inventory.getSlots() && !removed; slot++) {
      let stack = inventory.getStackInSlot(slot)
      if (String(stack.id) === id) {
        inventory.extractItem(slot, 1, false)
        removed = true
      }
    }
    placed++
  }
  if (placed > 0) {
    player.mainHandItem.setDamageValue(player.mainHandItem.damageValue + placed)
    if (player.mainHandItem.damageValue >= player.mainHandItem.maxDamage) player.mainHandItem.setCount(0)
    player.swing()
    return true
  }
  return false
}
