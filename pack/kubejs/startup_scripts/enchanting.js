// LemurSaucePacket enchanting, the part that client and server must agree on. The numbers come from
// config/lemursaucepacket/enchanting.json (written by enchanting/build.mjs from enchanting/enchanting.mjs).
//
//  - Hardness: a block in #lemursaucepacket:hardness/<tier> needs a pickaxe with Hardness >= tier, and the
//    Hardness on the pickaxe only counts up to the tier the player's Mining level has unlocked. Without it the
//    block makes no mining progress (PlayerEvent.BreakSpeed, so the client shows no cracks and the server
//    rejects the break). Create's deployers are fake players and get the machine tier.
//  - Enchantments above your Enchanting level (allowed = vanilla max + floor((cap - vanilla) * level / 99))
//    don't work as tools either: same event.
//  - The anvil (AnvilUpdateEvent) refuses results above your Enchanting level (combining IX + IX into X),
//    Hardness tomes above your Mining level, and Hardness + Hardness (tomes don't stack: craft a higher one).
// The rest (attacks, armour, drops, the table, loot and villagers) is server-only: server_scripts/enchanting.js.
// (Rhino here only accepts const at the top level, hence the lets below.)

const ENCH = JsonIO.read('config/lemursaucepacket/enchanting.json')
const EnchPMMO = Java.loadClass('harmonised.pmmo.api.APIUtils')
const EnchHelper = Java.loadClass('net.minecraft.world.item.enchantment.EnchantmentHelper')
const EnchTagKey = Java.loadClass('net.minecraft.tags.TagKey')
const EnchRegistries = Java.loadClass('net.minecraft.core.registries.Registries')
const EnchResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
const EnchComponent = Java.loadClass('net.minecraft.network.chat.Component')
const EnchFakePlayer = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayer')
const ENCH_ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const ENCH_GATED_TAG = EnchTagKey.create(EnchRegistries.BLOCK, EnchResourceLocation.parse(ENCH.hardness.tag + 'gated'))
const ENCH_TIER_TAGS = []
for (let tier = 1; tier <= ENCH.hardness.maxLevel; tier++) {
  ENCH_TIER_TAGS[tier] = EnchTagKey.create(EnchRegistries.BLOCK, EnchResourceLocation.parse(ENCH.hardness.tag + tier))
}
let enchStartupErrors = {}
const enchStartupError = (where, e) => {
  if (enchStartupErrors[where]) return
  enchStartupErrors[where] = true
  console.error(`[LemurSaucePacket] enchanting error in ${where} (later ones there not logged): ${e}${e && e.stack ? '\n' + e.stack : ''}`)
}

/** Roman numeral for an enchantment level. */
const enchRoman = (level) => (level >= 0 && level < ENCH_ROMAN.length ? ENCH_ROMAN[level] : String(level))

/** Name of an enchantment for messages, from its id ("minecraft:sharpness" -> "Sharpness"). */
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

/** Highest level of a raised enchantment this Enchanting level allows (Infinity for enchantments not raised). */
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

/** Hardness tier a player's Mining level unlocks (machines get the machine tier). */
function enchHardnessUnlocked(player) {
  if (player instanceof EnchFakePlayer) return ENCH.hardness.machineMax
  let mining = EnchPMMO.getLevel('mining', player)
  let tier = 0
  for (let t = 1; t <= ENCH.hardness.maxLevel; t++) if (mining >= ENCH.hardness.unlock[t]) tier = t
  return tier
}

/** Hardness tier a block state needs (0 for most blocks). */
function enchBlockTier(state) {
  if (!state.is(ENCH_GATED_TAG)) return 0
  for (let t = ENCH.hardness.maxLevel; t >= 1; t--) if (state.is(ENCH_TIER_TAGS[t])) return t
  return 0
}

/** Server-side action-bar message, at most one every two seconds per player. */
let enchLastMessage = {}
function enchTell(player, text) {
  if (player.level.isClientSide()) return
  let key = String(player.uuid)
  let now = Date.now()
  if (enchLastMessage[key] != null && now - enchLastMessage[key] < 2000) return
  enchLastMessage[key] = now
  player.displayClientMessage(EnchComponent.literal(text), true)
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

// Mining: no progress on a block whose Hardness tier the pickaxe (or the player's Mining level) doesn't reach,
// and none with a tool enchanted above the player's Enchanting level.
NativeEvents.onEvent('net.neoforged.neoforge.event.entity.player.PlayerEvent$BreakSpeed', (event) => {
  let cancel = false
  try {
    let player = event.getEntity()
    let state = event.getState()
    let tool = player.getMainHandItem()
    let tier = enchBlockTier(state)
    if (tier > 0) {
      let toolHardness = enchLevels(tool)[ENCH.hardness.id] || 0
      let unlocked = enchHardnessUnlocked(player)
      let effective = Math.min(toolHardness, unlocked)
      if (effective < tier) {
        cancel = true
        if (toolHardness >= tier) {
          enchTell(player, `§cNeeds Mining ${ENCH.hardness.unlock[tier]} to use Hardness ${enchRoman(tier)} (you have Mining ${EnchPMMO.getLevel('mining', player)})`)
        } else {
          enchTell(player, `§cNeeds Hardness ${enchRoman(tier)} (you have ${toolHardness > 0 ? enchRoman(toolHardness) : 'none'})`)
        }
      }
    }
    if (!cancel && !(player instanceof EnchFakePlayer)) {
      let over = enchOverLevel(tool, player)
      if (over != null) {
        cancel = true
        enchTell(player, `§c${enchName(over[0])} ${enchRoman(over[1])} needs Enchanting ${over[2] == null ? '?' : over[2]}`)
      }
    }
  } catch (e) {
    enchStartupError('break speed', e)
  }
  if (cancel) event.setCanceled(true)
})

// Anvil: what the player is about to make must be within their levels. The vanilla rule for a shared
// enchantment is "same level -> one higher, else the higher of the two", capped at the max level.
NativeEvents.onEvent('net.neoforged.neoforge.event.AnvilUpdateEvent', (event) => {
  let refuse = null
  try {
    let player = event.getPlayer()
    let left = event.getLeft()
    let right = event.getRight()
    if (player == null || left == null || right == null || left.isEmpty() || right.isEmpty()) return
    let leftLevels = enchLevels(left)
    let rightLevels = enchLevels(right)
    let ids = Object.keys(rightLevels)
    if (ids.length === 0) return
    let enchanting = EnchPMMO.getLevel('enchanting', player)
    for (let i = 0; i < ids.length && refuse == null; i++) {
      let id = ids[i]
      let have = leftLevels[id] || 0
      let add = rightLevels[id]
      let rule = ENCH.enchantments[id]
      let result = have === add ? add + 1 : Math.max(have, add)
      if (id === ENCH.hardness.id) {
        if (have > 0 && have === add) refuse = `§cHardness tomes don't stack: craft a Hardness ${enchRoman(Math.min(add + 1, ENCH.hardness.maxLevel))} tome`
        else if (result > enchHardnessUnlocked(player)) refuse = `§cNeeds Mining ${ENCH.hardness.unlock[Math.min(result, ENCH.hardness.maxLevel)]} to apply Hardness ${enchRoman(Math.min(result, ENCH.hardness.maxLevel))}`
      } else if (rule != null) {
        result = Math.min(result, rule.cap)
        if (result > enchAllowed(id, enchanting)) refuse = `§c${enchName(id)} ${enchRoman(result)} needs Enchanting ${enchNeeded(id, result)}`
      }
    }
    if (refuse != null) enchTell(player, refuse)
  } catch (e) {
    enchStartupError('anvil', e)
  }
  if (refuse != null) event.setCanceled(true)
})
