// LemurSaucePacket enchanting, server side. The numbers come from config/lemursaucepacket/enchanting.json
// (enchanting/build.mjs writes it from enchanting/enchanting.mjs); startup_scripts/enchanting.js has the
// parts both sides need (mining progress, the anvil).
//
//  - The enchanting table: the third slot costs vanilla + floor(vanilla * boost * Enchanting / 99) levels, so a
//    99 enchanter's 30 becomes 150 (and 3 levels at 150 are a lot more XP than 3 at 30); what it rolls above
//    the player's allowed level (vanilla max + floor((cap - vanilla) * Enchanting / 99)) is cut back to it.
//  - Using enchantments above your level: no damage with such a weapon or bow, no mining with such a tool
//    (startup script), Slowness and Weakness while wearing such armour. Project MMO's own enchantment
//    requirements (USE_ENCHANTMENT) stay off: in 2.10.47 they replace an item's own requirements instead of
//    adding to them (Core.getReqMap -> getCommonReqData), which would let anyone wield a netherite sword.
//  - Loot chests and villagers never give more than the vanilla max: the extra levels come from the skill.
//  - Telekinesis: what a block or mob would have dropped appears at the player's feet with no pickup delay,
//    reserved for them, so the normal pickup (and backpack pickup upgrades) takes it straight in; whatever
//    does not fit stays at their feet.
//  - Hardness V's prize: reinforced deepslate drops itself (it has no loot table to override).
// (Rhino: top-level const only; let inside functions. event.cancel() throws, so it is called outside try.)

const ENCH = JsonIO.read('config/lemursaucepacket/enchanting.json')
const EnchPMMO = Java.loadClass('harmonised.pmmo.api.APIUtils')
const EnchHelper = Java.loadClass('net.minecraft.world.item.enchantment.EnchantmentHelper')
const EnchFakePlayer = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayer')
const EnchMenu = Java.loadClass('net.minecraft.world.inventory.EnchantmentMenu')
const EnchAbstractVillager = Java.loadClass('net.minecraft.world.entity.npc.AbstractVillager')
const ENCH_ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const ENCH_ARMOUR_SLOTS = ['head', 'chest', 'legs', 'feet']
let enchErrorsLogged = {}
const enchError = (where, e) => {
  if (String(e).indexOf('EventExit') >= 0) throw e
  if (enchErrorsLogged[where]) return
  enchErrorsLogged[where] = true
  console.error(`[LemurSaucePacket] enchanting error in ${where} (later ones there not logged): ${e}${e && e.stack ? '\n' + e.stack : ''}`)
}

const enchRoman = (level) => (level >= 0 && level < ENCH_ROMAN.length ? ENCH_ROMAN[level] : String(level))

function enchName(id) {
  if (id === ENCH.hardness.id) return ENCH.hardness.name
  if (id === ENCH.telekinesis.id) return ENCH.telekinesis.name
  let path = id.indexOf(':') >= 0 ? id.substring(id.indexOf(':') + 1) : id
  return path
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.substring(1))
    .join(' ')
}

/** The enchantments on a stack (stored ones for books), as { id: level }. */
function enchLevels(stack) {
  let out = {}
  if (stack == null || stack.isEmpty()) return out
  let enchantments = EnchHelper.getEnchantmentsForCrafting(stack)
  if (enchantments.isEmpty()) return out
  enchantments.entrySet().forEach((entry) => {
    out[String(entry.getKey().getRegisteredName())] = entry.getIntValue()
  })
  return out
}

/** Highest level of a raised enchantment this Enchanting level allows (Infinity for the rest). */
function enchAllowed(id, skillLevel) {
  let rule = ENCH.enchantments[id]
  if (rule == null) return Infinity
  let level = Math.max(0, Math.min(ENCH.maxSkillLevel, skillLevel))
  return rule.vanilla + Math.floor(((rule.cap - rule.vanilla) * level) / ENCH.maxSkillLevel)
}

/** Enchanting level needed for a level of a raised enchantment (0 when vanilla allows it, null when nothing does). */
function enchNeeded(id, level) {
  let rule = ENCH.enchantments[id]
  if (rule == null || level <= rule.vanilla) return 0
  if (level > rule.cap) return null
  return rule.unlocks[level - rule.vanilla - 1]
}

/** The first enchantment on the stack above the player's Enchanting level, as [id, level, needed], or null. */
function enchOverLevel(stack, player) {
  let levels = enchLevels(stack)
  let ids = Object.keys(levels)
  if (ids.length === 0) return null
  let skill = EnchPMMO.getLevel('enchanting', player)
  for (let i = 0; i < ids.length; i++) {
    if (levels[ids[i]] > enchAllowed(ids[i], skill)) return [ids[i], levels[ids[i]], enchNeeded(ids[i], levels[ids[i]])]
  }
  return null
}

/** Hardness tier a player's Mining level unlocks (machines get the machine tier). */
function enchHardnessUnlocked(player) {
  if (player instanceof EnchFakePlayer) return ENCH.hardness.machineMax
  let mining = EnchPMMO.getLevel('mining', player)
  let tier = 0
  for (let t = 1; t <= ENCH.hardness.maxLevel; t++) if (mining >= ENCH.hardness.unlock[t]) tier = t
  return tier
}

/** Hardness tier a block needs (0 for most blocks). */
function enchBlockTier(block) {
  if (!block.hasTag(ENCH.hardness.tag + 'gated')) return 0
  for (let t = ENCH.hardness.maxLevel; t >= 1; t--) if (block.hasTag(ENCH.hardness.tag + t)) return t
  return 0
}

/** Action-bar message, at most one every two seconds per player. */
let enchLastMessage = {}
function enchTell(player, text) {
  let key = String(player.uuid)
  let now = Date.now()
  if (enchLastMessage[key] != null && now - enchLastMessage[key] < 2000) return
  enchLastMessage[key] = now
  player.displayClientMessage(Text.of(text), true)
}

/** Cuts every raised enchantment on the stack back to `limit(id)`; returns what was cut as [[id, from, to]]. */
function enchClamp(stack, limit) {
  let cut = []
  if (stack == null || stack.isEmpty()) return cut
  let levels = enchLevels(stack)
  let ids = Object.keys(levels)
  let wanted = {}
  for (let i = 0; i < ids.length; i++) {
    let max = limit(ids[i])
    if (levels[ids[i]] > max) {
      wanted[ids[i]] = max
      cut.push([ids[i], levels[ids[i]], max])
    }
  }
  if (cut.length === 0) return cut
  EnchHelper.updateEnchantments(stack, (mutable) => {
    let holders = []
    mutable.keySet().forEach((holder) => holders.push(holder))
    holders.forEach((holder) => {
      let id = String(holder.getRegisteredName())
      if (wanted[id] !== undefined) mutable.set(holder, wanted[id])
    })
  })
  return cut
}
const enchVanillaMax = (id) => (ENCH.enchantments[id] ? ENCH.enchantments[id].vanilla : Infinity)

// ---------------------------------------------------------------- the enchanting table

/** The player enchanting at this table: the one whose open enchanting menu holds the item, else the nearest. */
function enchTableUser(level, pos, stack) {
  let best = null
  let bestDistance = 64
  level.players().forEach((player) => {
    let menu = player.containerMenu
    if (!(menu instanceof EnchMenu)) return
    if (bestDistance < 0) return
    if (menu.getSlot(0).getItem() == stack) {
      best = player
      bestDistance = -1
      return
    }
    let distance = player.distanceToSqr(pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5)
    if (distance < bestDistance) {
      best = player
      bestDistance = distance
    }
  })
  return best
}

NativeEvents.onEvent('net.neoforged.neoforge.event.enchanting.EnchantmentLevelSetEvent', (event) => {
  try {
    if (event.getEnchantRow() !== 2 || event.getEnchantLevel() <= 0) return
    let player = enchTableUser(event.getLevel(), event.getPos(), event.getItem())
    if (player == null) return
    let skill = EnchPMMO.getLevel('enchanting', player)
    let boost = Math.floor((event.getOriginalLevel() * ENCH.tableBoost * Math.min(skill, ENCH.maxSkillLevel)) / ENCH.maxSkillLevel)
    if (boost > 0) event.setEnchantLevel(event.getEnchantLevel() + boost)
  } catch (e) {
    enchError('table cost', e)
  }
})

NativeEvents.onEvent('net.neoforged.neoforge.event.entity.player.PlayerEnchantItemEvent', (event) => {
  try {
    let player = event.getEntity()
    if (player == null || player.level.isClientSide()) return
    let skill = EnchPMMO.getLevel('enchanting', player)
    let cut = enchClamp(event.getEnchantedItem(), (id) => enchAllowed(id, skill))
    cut.forEach((c) => {
      let needed = enchNeeded(c[0], c[1])
      player.tell(Text.of(`§e${enchName(c[0])} ${enchRoman(c[1])} needs Enchanting ${needed == null ? '?' : needed}: you got ${enchRoman(c[2])}`))
    })
  } catch (e) {
    enchError('table clamp', e)
  }
})

// ---------------------------------------------------------------- using enchantments above your level

// Weapons, bows and tridents: the hit does nothing.
EntityEvents.beforeHurt((event) => {
  let cancel = false
  try {
    let source = event.getSource()
    let player = source.getPlayer()
    if (player == null || player instanceof EnchFakePlayer || player.isCreative()) return
    let weapon = source.getWeaponItem()
    if (weapon == null || weapon.isEmpty()) weapon = player.mainHandItem
    let over = enchOverLevel(weapon, player)
    if (over != null) {
      cancel = true
      enchTell(player, `§c${enchName(over[0])} ${enchRoman(over[1])} needs Enchanting ${over[2] == null ? '?' : over[2]}`)
    }
  } catch (e) {
    enchError('hurt', e)
  }
  if (cancel) event.cancel()
})

// Blocks: the safety net behind the startup script's break-speed check (the Excavator's 3x3 and other direct
// breaks skip mining progress), plus the Hardness V prize.
BlockEvents.broken((event) => {
  let cancel = false
  try {
    let player = event.player
    if (player == null || player.level.isClientSide() || player.isCreative()) return
    let block = event.block
    let tool = player.mainHandItem
    let tier = enchBlockTier(block)
    let toolHardness = enchLevels(tool)[ENCH.hardness.id] || 0
    let effective = Math.min(toolHardness, enchHardnessUnlocked(player))
    if (tier > 0 && effective < tier) {
      cancel = true
      if (toolHardness >= tier) enchTell(player, `§cNeeds Mining ${ENCH.hardness.unlock[tier]} to use Hardness ${enchRoman(tier)}`)
      else enchTell(player, `§cNeeds Hardness ${enchRoman(tier)} (you have ${toolHardness > 0 ? enchRoman(toolHardness) : 'none'})`)
    }
    if (!cancel && !(player instanceof EnchFakePlayer)) {
      let over = enchOverLevel(tool, player)
      if (over != null) {
        cancel = true
        enchTell(player, `§c${enchName(over[0])} ${enchRoman(over[1])} needs Enchanting ${over[2] == null ? '?' : over[2]}`)
      }
    }
    if (!cancel && String(block.id) === 'minecraft:reinforced_deepslate' && effective >= ENCH.hardness.maxLevel) {
      block.popItem(Item.of('minecraft:reinforced_deepslate'))
    }
  } catch (e) {
    enchError('break', e)
  }
  if (cancel) event.cancel()
})

// Using what you can't yet mine: a gated material (loot, another player's chest) can be carried, kept in a chest
// or dropped, but recipes, machines and other containers refuse it until the Mining level is there. Menus are
// the companion mod's job (lsp_fixes UseGateMixin checks every click); this is the other way in, right-clicking
// a machine with the item (Create basins, depots, deployers, belts, decorated pots...). Blocks that open a menu
// are left alone (the menu handles it), and so is placing the item as a block.
const EnchMenuProvider = Java.loadClass('net.minecraft.world.MenuProvider')
const EnchEnderChestBlock = Java.loadClass('net.minecraft.world.level.block.EnderChestBlock')
const EnchTriState = Java.loadClass('net.neoforged.neoforge.common.util.TriState')

/** Hardness tier an item needs before it can be used (0 for most items). */
function enchMaterialTier(stack) {
  if (stack.isEmpty() || !stack.hasTag(ENCH.hardness.tag + 'gated')) return 0
  for (let t = ENCH.hardness.maxLevel; t >= 1; t--) if (stack.hasTag(ENCH.hardness.tag + t)) return t
  return 0
}

NativeEvents.onEvent('net.neoforged.neoforge.event.entity.player.PlayerInteractEvent$RightClickBlock', (event) => {
  try {
    let player = event.getEntity()
    if (player.level.isClientSide() || player.isCreative() || player instanceof EnchFakePlayer) return
    let stack = event.getItemStack()
    let tier = enchMaterialTier(stack)
    if (tier <= 0 || tier <= enchHardnessUnlocked(player)) return
    let level = player.level
    let entity = level.getBlockEntity(event.getPos())
    if (entity == null || entity instanceof EnchMenuProvider || level.getBlockState(event.getPos()).getBlock() instanceof EnchEnderChestBlock) return
    event.setUseBlock(EnchTriState.FALSE)
    enchTell(player, `§cNeeds Mining ${ENCH.hardness.unlock[tier]} to use ${stack.getHoverName().getString()} there`)
  } catch (e) {
    enchError('use on block', e)
  }
})

// Armour: Slowness and Weakness while any worn piece is enchanted above your level, once a second.
let enchTick = 0
let enchLastArmourMessage = {}
ServerEvents.tick((event) => {
  enchTick++
  if (enchTick % 20 !== 0) return
  event.server.players.forEach((player) => {
    try {
      if (player.isCreative()) return
      let over = null
      for (let i = 0; i < ENCH_ARMOUR_SLOTS.length && over == null; i++) over = enchOverLevel(player.getItemBySlot(ENCH_ARMOUR_SLOTS[i]), player)
      if (over == null) return
      ENCH.penalty.forEach((p) => player.potionEffects.add(p.effect, 45, p.amplifier, true, false))
      let key = String(player.uuid)
      if (enchLastArmourMessage[key] == null || enchTick - enchLastArmourMessage[key] >= 200) {
        enchLastArmourMessage[key] = enchTick
        player.displayClientMessage(Text.of(`§c${enchName(over[0])} ${enchRoman(over[1])} needs Enchanting ${over[2] == null ? '?' : over[2]}: it weighs you down`), true)
      }
    } catch (e) {
      enchError('armour', e)
    }
  })
})

// ---------------------------------------------------------------- loot and villagers stay at vanilla levels

LootJS.modifiers((event) => {
  event.addTableModifier(LootType.CHEST, LootType.FISHING, LootType.VAULT, LootType.ARCHAEOLOGY, LootType.GIFT).modifyLoot(ItemFilter.ANY, (stack) => {
    try {
      enchClamp(stack, enchVanillaMax)
    } catch (e) {
      enchError('loot', e)
    }
    return stack
  })
})

ItemEvents.entityInteracted((event) => {
  try {
    let target = event.target
    if (!(target instanceof EnchAbstractVillager)) return
    let offers = target.getOffers()
    for (let i = 0; i < offers.size(); i++) enchClamp(offers.get(i).getResult(), enchVanillaMax)
  } catch (e) {
    enchError('villager', e)
  }
})

// ---------------------------------------------------------------- Telekinesis

const enchHasTelekinesis = (stack) => enchLevels(stack)[ENCH.telekinesis.id] > 0

/** Moves dropped item entities to the player's feet, reserved for them, ready to pick up. */
function enchPull(drops, player) {
  let uuid = player.uuid
  let x = player.x
  let y = player.y
  let z = player.z
  drops.forEach((entity) => {
    // KubeJS's single-value setters: vanilla setPos(x, y, z) / setDeltaMovement(x, y, z) sit next to Vec3
    // overloads, and this Rhino build fails to resolve setDeltaMovement(number, number, number) at all.
    entity.setX(x)
    entity.setY(y)
    entity.setZ(z)
    entity.setMotionX(0)
    entity.setMotionY(0)
    entity.setMotionZ(0)
    entity.setNoPickUpDelay()
    entity.setTarget(uuid)
  })
}

BlockEvents.drops((event) => {
  try {
    let breaker = event.entity
    if (breaker == null || !breaker.isPlayer() || breaker instanceof EnchFakePlayer) return
    if (!enchHasTelekinesis(event.tool)) return
    let drops = event.itemEntities
    if (drops.isEmpty()) return
    enchPull(drops, breaker)
  } catch (e) {
    enchError('block drops', e)
  }
})

EntityEvents.drops((event) => {
  try {
    let victim = event.entity
    if (victim.isPlayer()) return
    let source = event.source
    let killer = source.getPlayer()
    if (killer == null || killer instanceof EnchFakePlayer) return
    let weapon = source.getWeaponItem()
    if (weapon == null || weapon.isEmpty()) weapon = killer.mainHandItem
    if (!enchHasTelekinesis(weapon)) return
    let drops = event.drops
    if (drops.isEmpty()) return
    enchPull(drops, killer)
  } catch (e) {
    enchError('mob drops', e)
  }
})
