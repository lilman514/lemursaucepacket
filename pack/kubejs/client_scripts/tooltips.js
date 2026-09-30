// priority: -10
// LemurSaucePacket: every item's hover tooltip in Hypixel SkyBlock's layout.
//
//   Diamond Sword                name in its rarity colour (COMMON white, UNCOMMON green, RARE blue, EPIC purple)
//   Damage: +7                   stats rebuilt from the item's own attribute modifiers, one per line
//   Attack Speed: +1.6
//
//   Sharpness V                  whatever vanilla and other mods add stays where it was (enchantments go blue;
//                                raised ones say "(needs Enchanting 40 · VIII at 60 · max X at 99)", Hardness
//                                says which Mining level and blocks its tier is for, from enchanting.json)
//
//   Hold Shift for details       Shift: skill XP, "How to get"/"Found in", a set's bonus and relic synergy
//   ❣ Requires Attack 30         Project MMO requirements; green with a tick once the player has the level
//   RARE SWORD                   rarity and type (JEI/Jade add the mod name underneath)
//
// The pack's own gear (lemursaucepacket:*) takes its rarity, sections and extra stats from gearTipSpec() in
// gear_client.js, generated from gear/gear.mjs. Vanilla's "When in Main Hand:" block is switched off for every
// item through NeoForge's GatherSkippedAttributeTooltipsEvent (the gear's own modifiers also carry
// show_in_tooltip=false), so stats never show twice. Project MMO's own requirement and XP lines are off in
// config/pmmo-client.toml; any that still arrive (an older client config) are dropped here by their
// translation keys and drawn in this layout instead.
//
// Priority -10 loads this after the scripts that add plain tooltip lines (jei_sources.js, waystones_client.js),
// so their lines are already in the list when this rewrites it. Only the render thread is touched: the
// creative search and JEI's background indexing get the untouched vanilla tooltip.
// (Rhino: top-level const only, let inside functions. Java lists are rebuilt with clear()/add(), because
// remove(int) and remove(Object) are ambiguous from scripts.)

/** A class that may not exist (another mod's, or a newer Minecraft's); null when it can't be loaded. */
function sbtOptionalClass(name) {
  try {
    return Java.loadClass(name)
  } catch (e) {
    return null
  }
}

function sbtLoadPmmo() {
  try {
    return {
      api: Java.loadClass('harmonised.pmmo.api.APIUtils'),
      utils: Java.loadClass('harmonised.pmmo.core.CoreUtils'),
      req: Java.loadClass('harmonised.pmmo.api.enums.ReqType'),
      event: Java.loadClass('harmonised.pmmo.api.enums.EventType'),
      object: Java.loadClass('harmonised.pmmo.api.enums.ObjectType'),
      // LogicalSide can't be loaded by name (KubeJS's class filter); Project MMO's Core hands it out, see sbtSide()
      core: Java.loadClass('harmonised.pmmo.core.Core')
    }
  } catch (e) {
    console.warn('[LemurSaucePacket] tooltips: Project MMO is not available, no skill lines (' + e + ')')
    return null
  }
}

let sbtSideCache = null
/** Project MMO's LogicalSide for this side, from Core (the enum class itself is off-limits to scripts). */
function sbtSide(level) {
  if (sbtSideCache == null) sbtSideCache = SBT_PMMO.core.get(level).getSide()
  return sbtSideCache
}

const SbtJava = {
  style: Java.loadClass('net.minecraft.network.chat.Style'),
  textColor: Java.loadClass('net.minecraft.network.chat.TextColor'),
  translatable: Java.loadClass('net.minecraft.network.chat.contents.TranslatableContents'),
  components: Java.loadClass('net.minecraft.core.component.DataComponents'),
  attributeUtil: Java.loadClass('net.neoforged.neoforge.common.util.AttributeUtil'),
  resourceLocation: Java.loadClass('net.minecraft.resources.ResourceLocation'),
  armorItem: Java.loadClass('net.minecraft.world.item.ArmorItem'),
  blockItem: Java.loadClass('net.minecraft.world.item.BlockItem'),
  potionItem: Java.loadClass('net.minecraft.world.item.PotionItem')
}
/** The enchanting overhaul's numbers (enchanting/build.mjs writes them); null without the file. */
function sbtLoadEnchanting() {
  try {
    let data = JsonIO.read('config/lemursaucepacket/enchanting.json')
    return data != null && data.enchantments != null ? data : null
  } catch (e) {
    console.warn('[LemurSaucePacket] tooltips: no enchanting.json, enchantment lines stay plain (' + e + ')')
    return null
  }
}

const SbtRelicItem = sbtOptionalClass('it.hurts.sskirillss.relics.api.relics.IRelicItem')
const SbtCurios = sbtOptionalClass('top.theillusivec4.curios.api.CuriosApi')
const SBT_PMMO = sbtLoadPmmo()
const SBT_ENCH = sbtLoadEnchanting()
const SBT_ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']

// Types for the last line. Tags first, then classes for items outside the tags. [tag or class, type]
const SBT_TYPE_TAGS = [
  ['minecraft:swords', 'SWORD'],
  ['minecraft:axes', 'AXE'],
  ['minecraft:pickaxes', 'PICKAXE'],
  ['minecraft:shovels', 'SHOVEL'],
  ['minecraft:hoes', 'HOE'],
  ['c:tools/bow', 'BOW'],
  ['c:tools/crossbow', 'CROSSBOW'],
  ['c:tools/trident', 'TRIDENT'],
  ['c:tools/spear', 'TRIDENT'],
  ['c:tools/mace', 'MACE'],
  ['c:tools/shield', 'SHIELD'],
  ['minecraft:head_armor', 'HELMET'],
  ['minecraft:chest_armor', 'CHESTPLATE'],
  ['minecraft:leg_armor', 'LEGGINGS'],
  ['minecraft:foot_armor', 'BOOTS']
]
const SBT_TYPE_CLASSES = [
  [sbtOptionalClass('net.minecraft.world.item.BowItem'), 'BOW'],
  [sbtOptionalClass('net.minecraft.world.item.CrossbowItem'), 'CROSSBOW'],
  [sbtOptionalClass('net.minecraft.world.item.TridentItem'), 'TRIDENT'],
  [sbtOptionalClass('net.minecraft.world.item.MaceItem'), 'MACE'],
  [sbtOptionalClass('net.minecraft.world.item.ShieldItem'), 'SHIELD']
].filter((entry) => entry[0] != null)
const SBT_ARMOR_TYPES = { HELMET: 'HELMET', CHESTPLATE: 'CHESTPLATE', LEGGINGS: 'LEGGINGS', BOOTS: 'BOOTS' }

// SkyBlock rarities: the word on the last line, its colour code and the name colour.
const SBT_RARITY = {
  COMMON: { word: 'COMMON', code: 'f', rgb: 0xffffff },
  UNCOMMON: { word: 'UNCOMMON', code: 'a', rgb: 0x55ff55 },
  RARE: { word: 'RARE', code: '9', rgb: 0x5555ff },
  EPIC: { word: 'EPIC', code: '5', rgb: 0xaa00aa },
  LEGENDARY: { word: 'LEGENDARY', code: '6', rgb: 0xffaa00 },
  MYTHIC: { word: 'MYTHIC', code: 'd', rgb: 0xff55ff },
  SPECIAL: { word: 'SPECIAL', code: 'c', rgb: 0xff5555 }
}
Object.keys(SBT_RARITY).forEach((key) => {
  SBT_RARITY[key].color = SbtJava.textColor.fromRgb(SBT_RARITY[key].rgb)
})

// Stats by attribute (or the gear's own crit stats): [label, value colour, order, format].
// Formats: flat (+7), pct (0.1 -> +10%), speed (movement speed, whose base is 0.1: +0.01 -> +10%).
const SBT_STATS = {
  'minecraft:generic.attack_damage': ['Damage', 'c', 10, 'flat'],
  critChance: ['Crit Chance', '9', 20, 'pct'],
  critDamage: ['Crit Damage', '9', 30, 'pct'],
  'minecraft:generic.attack_speed': ['Attack Speed', 'e', 40, 'flat'],
  'minecraft:generic.attack_knockback': ['Knockback', '6', 45, 'flat'],
  'minecraft:generic.max_health': ['Health', 'c', 50, 'flat'],
  'minecraft:generic.armor': ['Defense', 'a', 60, 'flat'],
  'minecraft:generic.armor_toughness': ['Toughness', 'a', 70, 'flat'],
  'minecraft:generic.knockback_resistance': ['Knockback Resistance', 'f', 80, 'pct'],
  'minecraft:generic.movement_speed': ['Speed', 'f', 90, 'speed'],
  'neoforge:swim_speed': ['Swim Speed', 'b', 92, 'pct'],
  'minecraft:generic.step_height': ['Step Height', 'f', 94, 'flat'],
  'minecraft:generic.luck': ['Luck', 'b', 100, 'flat'],
  'minecraft:player.block_break_speed': ['Mining Speed', '6', 110, 'pct'],
  'minecraft:player.mining_efficiency': ['Mining Speed', '6', 111, 'flat'],
  'minecraft:player.entity_interaction_range': ['Reach', 'f', 120, 'flat'],
  'minecraft:player.block_interaction_range': ['Block Reach', 'f', 121, 'flat']
}
// "Base" modifiers (a diamond sword's 1 + 6 = 7 damage) add to the player's own value, as NeoForge shows them.
const SBT_BASE_IDS = [SbtJava.attributeUtil.BASE_ATTACK_DAMAGE_ID, SbtJava.attributeUtil.BASE_ATTACK_SPEED_ID, SbtJava.attributeUtil.BASE_ENTITY_REACH_ID].map((id) => String(id))
const SBT_BASE_VALUES = { 'minecraft:generic.attack_damage': 1, 'minecraft:generic.attack_speed': 4, 'minecraft:player.entity_interaction_range': 3 }
const SBT_SLOT_GROUPS = { any: 'Equipped', mainhand: 'Main Hand', offhand: 'Off Hand', hand: 'Hand', head: 'Head', chest: 'Body', legs: 'Legs', feet: 'Feet', armor: 'Armor', body: 'Body' }

// Project MMO: the requirement types items carry (block items add PLACE and BREAK) and the XP events Shift lists.
const SBT_REQ_TYPES = ['WEAR', 'WEAPON', 'TOOL', 'USE']
const SBT_REQ_BLOCK_TYPES = ['PLACE', 'BREAK']
const SBT_REQ_WHAT = { WEAR: 'to wear', WEAPON: 'as a weapon', TOOL: 'as a tool', USE: 'to use', PLACE: 'to place', BREAK: 'to break' }
// [event, label, looked up as the block rather than the item]
const SBT_XP_EVENTS = [
  ['BLOCK_BREAK', 'Break', true],
  ['BLOCK_PLACE', 'Place', true],
  ['GROW', 'Grow', true],
  ['CRAFT', 'Craft', false],
  ['SMELT', 'Smelt', false],
  ['SMELTED', 'Furnace output', false],
  ['FISH', 'Catch', false],
  ['CONSUME', 'Consume', false],
  ['BREW', 'Brew', false],
  ['ENCHANT', 'Enchant', false],
  ['ANVIL_REPAIR', 'Repair', false]
]
// Project MMO's own tooltip headers (its TooltipHandler), dropped if a client config still has them on.
const SBT_PMMO_HEADERS = ['pmmo.toWear', 'pmmo.tool', 'pmmo.weapon', 'pmmo.use', 'pmmo.place', 'pmmo.break', 'pmmo.use_enchant', 'pmmo.req_interact', 'pmmo.itemXpBoostHeld', 'pmmo.itemXpBoostWorn', 'pmmo.veintooltip']
const SBT_PMMO_TTL = 20000 // ms: Project MMO's data can arrive after the first tooltips, and /reload changes it

// The pack's own hint lines ("§8§oHow to get: ..." from waystones_client.js, "Found in:"/"Also found in:"/
// "Dropped by:" from jei_sources.js) move under Shift.
const SBT_HINT_PREFIXES = ['How to get:', 'Found in:', 'Also found in:', 'Dropped by:']

const SBT_BLANK = Text.empty()
const SBT_SHIFT_HINT = Text.literal('§8Hold §7Shift §8for details')
const SBT_XP_HEADER = Text.literal('§6Skill XP')
const SBT_BLUE = SbtJava.textColor.fromRgb(0x5555ff)
const SBT_GRAY_VALUE = 0xaaaaaa

let sbtInfoCache = {} // item id -> { type, relic, block }
let sbtPmmoCache = {} // item id -> { at, reqs, xp }
let sbtFooterCache = {}
let sbtSkillCache = {} // skill -> { name, style }
let sbtLabelCache = {} // attribute -> translated name
let sbtErrorsLogged = {}

function sbtError(where, e) {
  if (sbtErrorsLogged[where]) return
  sbtErrorsLogged[where] = true
  console.error('[LemurSaucePacket] tooltip error in ' + where + ' (later ones there not logged): ' + e)
}

// ---------------------------------------------------------------- small helpers

const sbtLine = (line) => (typeof line === 'string' ? Text.literal(line) : line)
const sbtIsBlank = (component) => String(component.getString()).trim() === ''

/** Adds a blank line unless the last line already is one. */
function sbtGap(out) {
  if (out.length > 0 && !sbtIsBlank(out[out.length - 1])) out.push(SBT_BLANK)
}

/** 7 -> "7", 1.6 -> "1.6"; at most two decimals. */
function sbtNumber(value) {
  return String(Math.round(value * 100) / 100)
}

/** Greedy word wrap to about SkyBlock's width; `code` colours every line. */
function sbtWrap(code, text, width) {
  let lines = []
  let line = ''
  String(text)
    .split(' ')
    .forEach((word) => {
      if (word === '') return
      if (line !== '' && line.length + 1 + word.length > width) {
        lines.push('§' + code + line)
        line = word
      } else {
        line = line === '' ? word : line + ' ' + word
      }
    })
  if (line !== '') lines.push('§' + code + line)
  return lines
}

function sbtFooter(rarity, type) {
  let key = rarity.code + rarity.word + '|' + type
  let footer = sbtFooterCache[key]
  if (footer == null) {
    footer = Text.literal('§' + rarity.code + '§l' + rarity.word + (type ? ' ' + type : ''))
    sbtFooterCache[key] = footer
  }
  return footer
}

/** The stack's rarity as vanilla works it out (enchanting bumps it), in SkyBlock's words and colours. */
function sbtRarityOf(stack) {
  let rarity = stack.getRarity()
  let name = String(rarity.name())
  let known = SBT_RARITY[name]
  if (known != null) return known
  // A rarity another mod added: its own name and colour.
  let key = 'X_' + name
  if (SBT_RARITY[key] == null) {
    let format = rarity.color()
    SBT_RARITY[key] = {
      word: String(rarity.getSerializedName()).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(),
      code: String(format).charAt(1) || 'f',
      color: SbtJava.textColor.fromLegacyFormat(format)
    }
  }
  return SBT_RARITY[key]
}

function sbtSkill(skill) {
  let entry = sbtSkillCache[skill]
  if (entry != null) return entry
  let style = null
  try {
    if (SBT_PMMO != null) style = SBT_PMMO.utils.getSkillStyle(skill)
  } catch (e) {}
  if (style == null) style = Text.of(' ').color(SbtJava.textColor.fromRgb(0x55ff55)).getStyle()
  let name = String(Text.translatable('pmmo.' + skill).getString())
  if (name === 'pmmo.' + skill) name = skill.charAt(0).toUpperCase() + skill.slice(1)
  entry = { name: name, style: style }
  sbtSkillCache[skill] = entry
  return entry
}

/** A skill's name, with text before and after it, all in the skill's own colour: "Mining 35", "+12 Woodcutting". */
function sbtSkillText(skill, before, after) {
  let entry = sbtSkill(skill)
  return Text.literal(before + entry.name + after).setStyle(entry.style)
}

/** The player's level in a skill, or -1 when there is no player or Project MMO. */
function sbtSkillLevel(skill, player) {
  try {
    if (SBT_PMMO != null && player != null) return Number(SBT_PMMO.api.getLevel(skill, player))
  } catch (e) {}
  return -1
}

/** Colour for "needs <skill> N": green once the player has it, red while they don't, grey when unknown. */
const sbtNeedCode = (have, needed) => (have < 0 ? '7' : have >= needed ? 'a' : 'c')
const sbtRoman = (level) => (level >= 0 && level < SBT_ROMAN.length ? SBT_ROMAN[level] : String(level))

// ---------------------------------------------------------------- what kind of item this is (cached per id)

function sbtInfo(stack, id) {
  let info = sbtInfoCache[id]
  if (info != null) return info
  info = { type: '', relic: false, block: false }
  try {
    let item = stack.getItem()
    info.block = item instanceof SbtJava.blockItem
    if (SbtRelicItem != null ? item instanceof SbtRelicItem : id.indexOf('relics:') === 0) {
      info.relic = true
      info.type = 'RELIC'
    } else if (item instanceof SbtJava.armorItem) {
      info.type = SBT_ARMOR_TYPES[String(item.getType().name())] || ''
    }
    if (info.type === '') {
      let tagged = SBT_TYPE_TAGS.find((entry) => stack.hasTag(entry[0]))
      if (tagged != null) info.type = tagged[1]
    }
    if (info.type === '') {
      let byClass = SBT_TYPE_CLASSES.find((entry) => item instanceof entry[0])
      if (byClass != null) info.type = byClass[1]
    }
    if (info.type === '' && SbtCurios != null && !SbtCurios.getItemStackSlots(stack).isEmpty()) info.type = 'ACCESSORY'
    if (info.type === '' && item instanceof SbtJava.potionItem) info.type = 'POTION'
    if (info.type === '' && stack.get(SbtJava.components.FOOD) != null) info.type = 'FOOD'
    if (info.type === '' && info.block) info.type = 'BLOCK'
  } catch (e) {
    sbtError('item type', e)
  }
  sbtInfoCache[id] = info
  return info
}

// ---------------------------------------------------------------- stats from attribute modifiers

function sbtAttributeLabel(attribute, holder) {
  let label = sbtLabelCache[attribute]
  if (label == null) {
    label = String(Text.translatable(holder.value().getDescriptionId()).getString())
    sbtLabelCache[attribute] = label
  }
  return label
}

/** "+7", "+10%", "+5 +10%": a stat's value in its format (see SBT_STATS). */
function sbtValueText(format, flat, percent) {
  if (format === 'speed') {
    percent += flat * 1000
    flat = 0
  } else if (format === 'pct') {
    percent += flat * 100
    flat = 0
  }
  let parts = []
  if (Math.abs(flat) > 0.0001) parts.push((flat < 0 ? '-' : '+') + sbtNumber(Math.abs(flat)))
  if (Math.abs(percent) > 0.0001) parts.push((percent < 0 ? '-' : '+') + sbtNumber(Math.abs(percent)) + '%')
  return parts.join(' ')
}

/**
 * SkyBlock stat lines ("§7Damage: §c+7"): the item's attribute modifiers, merged per attribute the way NeoForge
 * merges them, plus `extra` stats that aren't attributes (the gear's crit chance and damage). Modifiers for a
 * second slot group (rare: main hand and off hand) get the group's name after them.
 */
function sbtStats(stack, extra, ignoreHidden) {
  let rows = []
  try {
    let component = stack.get(SbtJava.components.ATTRIBUTE_MODIFIERS)
    if (ignoreHidden || component == null || component.showInTooltip()) {
      let modifiers = stack.getAttributeModifiers().modifiers()
      let buckets = {}
      let order = []
      let groups = []
      for (let i = 0; i < modifiers.size(); i++) {
        let entry = modifiers.get(i)
        let holder = entry.attribute()
        let modifier = entry.modifier()
        let attribute = String(holder.getRegisteredName())
        let group = String(entry.slot().getSerializedName())
        let key = group + '|' + attribute
        let bucket = buckets[key]
        if (bucket == null) {
          bucket = { attribute: attribute, holder: holder, group: group, base: null, add: 0, multiplyBase: 0, multiplyTotal: 1 }
          buckets[key] = bucket
          order.push(key)
          if (groups.indexOf(group) < 0) groups.push(group)
        }
        let amount = Number(modifier.amount())
        let operation = String(modifier.operation().name())
        if (SBT_BASE_VALUES[attribute] != null && SBT_BASE_IDS.indexOf(String(modifier.id())) >= 0) bucket.base = SBT_BASE_VALUES[attribute] + amount
        else if (operation === 'ADD_VALUE') bucket.add += amount
        else if (operation === 'ADD_MULTIPLIED_BASE') bucket.multiplyBase += amount
        else bucket.multiplyTotal *= 1 + amount
      }
      order.forEach((key) => {
        let bucket = buckets[key]
        let stat = SBT_STATS[bucket.attribute] || [sbtAttributeLabel(bucket.attribute, bucket.holder), 'a', 200, 'flat']
        let text
        let negative
        if (bucket.base !== null) {
          // As NeoForge shows "7 Attack Damage": base plus additions, then multipliers.
          let value = (bucket.base + bucket.add + SBT_BASE_VALUES[bucket.attribute] * bucket.multiplyBase) * bucket.multiplyTotal
          text = (value < 0 ? '-' : '+') + sbtNumber(Math.abs(value))
          negative = value < 0
        } else {
          let percent = (bucket.multiplyBase + bucket.multiplyTotal - 1) * 100
          text = sbtValueText(stat[3], bucket.add, percent)
          negative = bucket.add + percent < 0
        }
        if (text === '') return
        let where = bucket.group === groups[0] ? '' : ' §8(' + (SBT_SLOT_GROUPS[bucket.group] || bucket.group) + ')'
        rows.push({ order: stat[2], text: '§7' + stat[0] + ': §' + (negative ? 'c' : stat[1]) + text + where })
      })
    }
  } catch (e) {
    sbtError('stats', e)
  }
  if (extra != null) {
    Object.keys(extra).forEach((key) => {
      let stat = SBT_STATS[key]
      if (stat == null || !extra[key]) return
      rows.push({ order: stat[2], text: '§7' + stat[0] + ': §' + stat[1] + sbtValueText(stat[3], extra[key], 0) })
    })
  }
  rows.sort((a, b) => a.order - b.order)
  return rows.map((row) => Text.literal(row.text))
}

// ---------------------------------------------------------------- Project MMO: requirements and XP

/** Requirements and XP lines for an item, from Project MMO's client-side data; cached for SBT_PMMO_TTL. */
function sbtPmmo(stack, id, info, player) {
  let now = Date.now()
  let cached = sbtPmmoCache[id]
  if (cached != null && now - cached.at < SBT_PMMO_TTL) return cached
  cached = { at: now, reqs: [], xp: [] }
  sbtPmmoCache[id] = cached
  if (SBT_PMMO == null || player == null) return cached
  let bySkill = {}
  let level = player.level
  try {
    let types = info.block ? SBT_REQ_TYPES.concat(SBT_REQ_BLOCK_TYPES) : SBT_REQ_TYPES
    types.forEach((type) => {
      let it = SBT_PMMO.api.getRequirementMap(stack, level, SBT_PMMO.req[type], sbtSide(level)).entrySet().iterator()
      while (it.hasNext()) {
        let entry = it.next()
        let skill = String(entry.getKey())
        let needed = Number(entry.getValue())
        if (!(needed > 0)) continue
        let req = bySkill[skill]
        if (req == null) {
          req = { skill: skill, level: 0, what: [] }
          bySkill[skill] = req
          cached.reqs.push(req)
        }
        if (needed > req.level) req.level = needed
        if (req.what.indexOf(type) < 0) req.what.push(type)
      }
    })
  } catch (e) {
    sbtError('requirements', e)
  }
  // The Hardness use-gate: a material from a block you can't mine yet needs the tier's Mining level to be used
  // (recipes, machines, containers other than chests); config/lemursaucepacket/enchanting.json has the tiers.
  try {
    if (SBT_ENCH != null && SBT_ENCH.hardness != null) {
      let prefix = String(SBT_ENCH.hardness.tag)
      if (stack.hasTag(prefix + 'gated')) {
        for (let t = Number(SBT_ENCH.hardness.maxLevel); t >= 1; t--) {
          if (!stack.hasTag(prefix + t)) continue
          let needed = Number(SBT_ENCH.hardness.unlock[t])
          let req = bySkill.mining
          if (req == null) {
            req = { skill: 'mining', level: 0, what: [] }
            bySkill.mining = req
            cached.reqs.push(req)
          }
          if (needed > req.level) req.level = needed
          if (req.what.indexOf('USE') < 0) req.what.push('USE')
          break
        }
      }
    }
  } catch (e) {
    sbtError('use-gate', e)
  }
  try {
    let location = SbtJava.resourceLocation.parse(id)
    SBT_XP_EVENTS.forEach((xpEvent) => {
      if (xpEvent[2] && !info.block) return
      let type = SBT_PMMO.event[xpEvent[0]]
      let map = xpEvent[2] ? SBT_PMMO.api.getXpAwardMap(SBT_PMMO.object.BLOCK, type, location, sbtSide(level), player) : SBT_PMMO.api.getXpAwardMap(stack, type, sbtSide(level), player)
      let line = null
      let it = map.entrySet().iterator()
      while (it.hasNext()) {
        let entry = it.next()
        let xp = Number(entry.getValue())
        if (!(xp > 0)) continue
        if (line == null) line = Text.literal('§7' + xpEvent[1] + ': ')
        else line.append(Text.literal('§7, '))
        line.append(sbtSkillText(String(entry.getKey()), '+' + sbtNumber(xp) + ' ', ''))
      }
      if (line != null) cached.xp.push(line)
    })
  } catch (e) {
    sbtError('skill xp', e)
  }
  return cached
}

/** "❣ Requires Mining 35": red with the player's level while they lack it, green with a tick once they have it. */
function sbtRequirementLines(reqs, player, info) {
  let lines = []
  reqs.forEach((req) => {
    let have = sbtSkillLevel(req.skill, player)
    let met = have >= req.level
    let line = Text.literal(met ? '§2❣ §aRequires ' : '§4❣ §cRequires ')
    line.append(sbtSkillText(req.skill, '', ' ' + req.level))
    let after = ''
    if (reqs.length > 1 && req.what.length > 0) {
      after += ' §8(' + req.what.map((type) => (type === 'WEAR' && SBT_ARMOR_TYPES[info.type] == null ? 'to hold' : SBT_REQ_WHAT[type] || type.toLowerCase())).join(', ') + ')'
    }
    if (met) after += ' §a✔'
    else if (have >= 0) after += ' §8(' + have + '/' + req.level + ')'
    if (after !== '') line.append(Text.literal(after))
    lines.push(line)
  })
  return lines
}

// ---------------------------------------------------------------- reading the lines already there

/** Project MMO's own requirement/XP block: a header, then "   Mining 35" lines. */
const sbtIsPmmoHeader = (key) => SBT_PMMO_HEADERS.indexOf(key) >= 0 || key.indexOf('pmmo.xpValue') === 0

const sbtIsAttributeKey = (key) => key.indexOf('neoforge.modifier.') === 0 || key.indexOf('attribute.modifier.') === 0 || key.indexOf('neoforge.attribute.') === 0

/** A vanilla/NeoForge attribute line; only met when the skip event didn't run for this tooltip. */
function sbtIsAttributeLine(component) {
  let contents = component.getContents()
  if (contents instanceof SbtJava.translatable) return sbtIsAttributeKey(String(contents.getKey()))
  let siblings = component.getSiblings()
  if (siblings.size() === 0) return false
  let first = siblings.get(0).getContents()
  return first instanceof SbtJava.translatable && sbtIsAttributeKey(String(first.getKey()))
}

/** An enchantment line's key: "enchantment.<namespace>.<path>" (the level is a sibling, "enchantment.level.N"). */
const sbtIsEnchantmentKey = (key) => key.indexOf('enchantment.') === 0 && key.indexOf('enchantment.level.') !== 0 && key.split('.').length === 3

/** "#c:ores/diamond" -> "diamond", "minecraft:crying_obsidian" -> "crying obsidian", for the Hardness note. */
function sbtBlockName(id) {
  let name = String(id)
  if (name.indexOf('#c:ores/') === 0) name = name.substring(8)
  else if (name.indexOf(':') >= 0) name = name.substring(name.indexOf(':') + 1)
  if (name === 'netherite_scrap') return 'ancient debris'
  return name.replace(/_/g, ' ')
}

/** " (needs Enchanting 40 · VIII at 60 · max X at 99)" for a level above the vanilla maximum, else null. */
function sbtRaisedNote(rule, level, player) {
  let vanilla = Number(rule.vanilla)
  let cap = Number(rule.cap)
  if (!(level > vanilla) || level > cap) return null
  let needed = Number(rule.unlocks[level - vanilla - 1])
  let note = ' §8(§' + sbtNeedCode(sbtSkillLevel('enchanting', player), needed) + 'needs Enchanting ' + needed + '§8'
  if (level < cap) {
    let nextNeeded = Number(rule.unlocks[level - vanilla])
    if (level + 1 < cap) note += ' · ' + sbtRoman(level + 1) + ' at ' + nextNeeded + ' · max ' + sbtRoman(cap) + ' at ' + Number(rule.unlocks[cap - vanilla - 1])
    else note += ' · max ' + sbtRoman(cap) + ' at ' + nextNeeded
  } else {
    note += ' · max level'
  }
  return note + ')'
}

/** " (Mining 30: diamond, emerald, obsidian, crying obsidian)" for a Hardness tier, else null. */
function sbtHardnessNote(tier, player) {
  let hardness = SBT_ENCH.hardness
  if (hardness == null || hardness.unlock == null || hardness.unlock[tier] == null) return null
  let unlock = Number(hardness.unlock[tier])
  let blocks = []
  if (hardness.tiers != null && hardness.tiers[String(tier)] != null) hardness.tiers[String(tier)].forEach((id) => blocks.push(sbtBlockName(id)))
  return ' §8(§' + sbtNeedCode(sbtSkillLevel('mining', player), unlock) + 'Mining ' + unlock + '§8' + (blocks.length > 0 ? ': ' + blocks.join(', ') : '') + ')'
}

/**
 * The lines for one enchantment: the line itself in SkyBlock blue (curses stay red), with the enchanting
 * overhaul's note after a raised level or a Hardness tier, and Telekinesis's description under it unless the
 * next line already shows it (Enchantment Descriptions does, from the same lang text).
 */
function sbtEnchantmentLines(component, key, player, next) {
  let line = component
  let copied = false
  let color = component.getStyle().getColor()
  if (color != null && color.getValue() === SBT_GRAY_VALUE) {
    line = component.copy()
    copied = true
    line.color(SBT_BLUE)
  }
  let out = [line]
  if (SBT_ENCH == null) return out
  let parts = key.split('.')
  let id = parts[1] + ':' + parts[2]
  let level = 1
  let siblings = component.getSiblings()
  for (let i = 0; i < siblings.size(); i++) {
    let contents = siblings.get(i).getContents()
    if (contents instanceof SbtJava.translatable && String(contents.getKey()).indexOf('enchantment.level.') === 0) {
      level = Number(String(contents.getKey()).substring(18)) || level
      break
    }
  }
  let note = null
  if (SBT_ENCH.hardness != null && id === String(SBT_ENCH.hardness.id)) note = sbtHardnessNote(level, player)
  else if (SBT_ENCH.enchantments[id] != null) note = sbtRaisedNote(SBT_ENCH.enchantments[id], level, player)
  if (note != null) {
    if (!copied) line = component.copy()
    line.append(Text.literal(note))
    out[0] = line
  }
  if (SBT_ENCH.telekinesis != null && id === String(SBT_ENCH.telekinesis.id) && SBT_ENCH.telekinesis.description) {
    let description = String(SBT_ENCH.telekinesis.description)
    let shown = next != null && String(next.getString()).indexOf(description.substring(0, 24)) >= 0
    if (!shown) sbtWrap('7', description, 40).forEach((text) => out.push(Text.literal(text)))
  }
  return out
}

/** The text after a pack hint line's "§8§o", or null when the line isn't one. */
function sbtPackHint(text) {
  if (text.indexOf('§8§o') !== 0) return null
  let rest = text.substring(4)
  return SBT_HINT_PREFIXES.some((prefix) => rest.indexOf(prefix) === 0) ? rest : null
}

// ---------------------------------------------------------------- the layout

function sbtRender(event) {
  let lines = event.lines
  let count = lines.size()
  if (count === 0) return
  let stack = event.item
  let id = String(stack.id)
  let player = Client.player
  let shift = event.shift
  let info = sbtInfo(stack, id)

  // The pack's own gear brings its rarity, sections and extra stats (gear_client.js).
  let gear = null
  if (typeof GEAR_TIPS !== 'undefined' && GEAR_TIPS[id] != null && typeof gearTipSpec === 'function') {
    try {
      gear = gearTipSpec(id, player, shift)
    } catch (e) {
      sbtError('gear', e)
    }
  }
  let rarity = gear != null ? SBT_RARITY[gear.rarity] || SBT_RARITY.COMMON : sbtRarityOf(stack)
  let type = gear != null ? gear.type : info.type

  // 1. Sort the lines already there: keep, drop (attribute and Project MMO blocks) or move (the pack's hint
  //    lines go under Shift, F3+H's debug lines go under the last line).
  let middle = []
  let debug = []
  let hints = []
  let otherShift = info.relic // holding Shift on a relic researches it (Relics' own hold-to-open)
  let i = 1
  while (i < count) {
    let line = lines.get(i)
    let contents = line.getContents()
    if (contents instanceof SbtJava.translatable) {
      let key = String(contents.getKey())
      if (key.indexOf('item.modifiers.') === 0) {
        if (middle.length > 0 && sbtIsBlank(middle[middle.length - 1])) middle.pop()
        i++
        while (i < count && sbtIsAttributeLine(lines.get(i))) i++
        continue
      }
      if (sbtIsPmmoHeader(key)) {
        i++
        while (i < count && String(lines.get(i).getString()).indexOf('   ') === 0) i++
        continue
      }
      if (event.advanced && (key === 'item.durability' || key === 'item.components')) {
        debug.push(line)
        i++
        continue
      }
      if (key === 'create.tooltip.holdForDescription' || key === 'create.tooltip.holdForControls') otherShift = true
      if (sbtIsEnchantmentKey(key)) sbtEnchantmentLines(line, key, player, i + 1 < count ? lines.get(i + 1) : null).forEach((enchanted) => middle.push(enchanted))
      else middle.push(line)
      i++
      continue
    }
    let text = String(line.getString())
    if (event.advanced && text === id) {
      debug.push(line)
      i++
      continue
    }
    let hint = info.relic ? null : sbtPackHint(text)
    if (hint !== null) {
      hints.push(hint)
      i++
      continue
    }
    if (!otherShift && text.indexOf('Shift') >= 0) otherShift = true
    middle.push(line)
    i++
  }

  // 2. Shift details: skill XP, then the gear's "How to get" and the moved hints.
  let pmmo = sbtPmmo(stack, id, info, player)
  let hasDetails = !info.relic && ((gear != null && (gear.more || gear.details.length > 0)) || pmmo.xp.length > 0 || hints.length > 0)
  let details = []
  if (shift && hasDetails) {
    if (pmmo.xp.length > 0) {
      details.push(SBT_XP_HEADER)
      pmmo.xp.forEach((line) => details.push(line))
    }
    let notes = []
    if (gear != null) gear.details.forEach((line) => notes.push(sbtLine(line)))
    hints.forEach((hint) => sbtWrap('8', hint, 40).forEach((line) => notes.push(Text.literal(line))))
    if (notes.length > 0 && details.length > 0) details.push(SBT_BLANK)
    notes.forEach((line) => details.push(line))
  }

  // 3. Requirements: Project MMO's data, or the gear's own while Project MMO has none (not synced yet).
  let reqs = pmmo.reqs
  if (reqs.length === 0 && gear != null && gear.req != null) reqs = [{ skill: gear.req[0], level: gear.req[1], what: [] }]
  let requirementLines = sbtRequirementLines(reqs, player, info)

  // 4. Put it together: name, stats, the other lines, the gear's sections, then the tail and the last line.
  let name = lines.get(0).copy()
  name.color(rarity.color)
  let out = [name]
  let stats = sbtStats(stack, gear != null ? gear.stats : null, gear != null)
  stats.forEach((line) => out.push(line))
  if (stats.length > 0 && middle.length > 0 && !sbtIsBlank(middle[0])) out.push(SBT_BLANK)
  middle.forEach((line) => out.push(line))
  if (gear != null) {
    gear.sections.forEach((section) => {
      sbtGap(out)
      section.forEach((line) => out.push(sbtLine(line)))
    })
  }
  let tail = []
  if (details.length > 0) {
    details.forEach((line) => tail.push(line))
    if (requirementLines.length > 0) tail.push(SBT_BLANK)
  } else if (hasDetails && !shift && !otherShift) {
    tail.push(SBT_SHIFT_HINT)
  }
  requirementLines.forEach((line) => tail.push(line))
  if (out.length > 1 || tail.length > 0) sbtGap(out)
  tail.forEach((line) => out.push(line))
  out.push(sbtFooter(rarity, type))
  debug.forEach((line) => out.push(line))

  lines.clear()
  out.forEach((line) => lines.add(line))
}

// ---------------------------------------------------------------- hooks

ItemEvents.modifyTooltips((event) => {
  event.modifyAll((text) => text.dynamic('lemursaucepacket_skyblock'))
})

ItemEvents.dynamicTooltips('lemursaucepacket_skyblock', (event) => {
  if (!Client.isSameThread()) return
  try {
    sbtRender(event)
  } catch (e) {
    sbtError('render', e)
  }
})

// Vanilla's attribute block ("When in Main Hand:", "+6 Attack Damage") gives way to the stat lines above.
NativeEvents.onEvent('net.neoforged.neoforge.client.event.GatherSkippedAttributeTooltipsEvent', (event) => {
  try {
    if (Client.isSameThread()) event.setSkipAll(true)
  } catch (e) {
    sbtError('attribute lines', e)
  }
})

// Per-world data (Project MMO's rules, tags) starts over on every join.
ClientEvents.loggedIn(() => {
  sbtInfoCache = {}
  sbtPmmoCache = {}
})
