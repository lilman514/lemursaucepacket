package net.lemursaucepacket.fixes.capes;

import java.util.List;

import javax.annotation.Nullable;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import net.lemursaucepacket.fixes.economy.Coins;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.BlockTags;
import net.minecraft.world.effect.MobEffect;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.entity.ai.attributes.AttributeInstance;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.neoforged.neoforge.event.entity.living.LivingEntityUseItemEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.level.BlockEvent;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * The server side of capes: what each player has earned, handing over the items, wearing one by command, buying another
 * from the NPC who makes them, and the perks a worn cape gives (attributes are Curios's job, see {@link CapeCurio}).
 */
public final class Capes {
    /** The skills an "all_skills" unlock counts (skills/build.mjs). */
    static final List<String> SKILLS = List.of("attack", "strength", "defence", "ranged", "hitpoints", "mining", "woodcutting", "farming", "fishing",
            "cooking", "smithing", "crafting", "agility", "enchanting", "brewing", "construction");
    /** The client's copy of its own player's capes ({@link CapeNet.State}). */
    public static final CapeData CLIENT = new CapeData();
    /** Where the KubeJS capes kept a player's capes (persistent data, a JSON string), before capes were items. */
    private static final String LEGACY = "lsp_capes";
    /** The attribute modifiers the KubeJS capes put on players permanently; Curios applies a worn cape's now. */
    private static final List<Holder<Attribute>> OLD_ATTRIBUTES = List.of(Attributes.ARMOR, Attributes.ARMOR_TOUGHNESS, Attributes.MAX_HEALTH,
            Attributes.MOVEMENT_SPEED, Attributes.LUCK, Attributes.BLOCK_BREAK_SPEED);
    private static final List<String> OLD_MODIFIERS = List.of("cape_armor", "cape_toughness", "cape_health", "cape_speed", "cape_luck", "cape_break_speed");
    /** How close the NPC who makes capes must be when buying another. */
    private static final double SHOP_REACH = 8;

    public static CapeData data(Player p) {
        return p.level().isClientSide() ? CLIENT : p.getData(CapesModule.DATA);
    }

    public static boolean owns(Player p, String id) {
        return data(p).unlocked.contains(id);
    }

    /** The cape this player wears (and has earned), or null. */
    @Nullable
    public static CapeDefs.Def worn(Player p) {
        if (!CapesModule.CURIOS) return null;
        CapeDefs.Def def = CapeDefs.of(CapeCurio.worn(p));
        return def != null && owns(p, def.id()) ? def : null;
    }

    /** What's in an entity's cape slot (a player's or an armor stand's), earned or not. */
    public static ItemStack wornStack(net.minecraft.world.entity.LivingEntity e) {
        return CapesModule.CURIOS ? CapeCurio.worn(e) : ItemStack.EMPTY;
    }

    /** Whether the cape slot is set to show (the eye in the Curios panel). */
    public static boolean shown(net.minecraft.world.entity.LivingEntity e) {
        return CapesModule.CURIOS && CapeCurio.shown(e);
    }

    // ---------------------------------------------------------------- unlocking

    static void checkUnlocks(ServerPlayer p) {
        CapeData d = data(p);
        for (CapeDefs.Def def : CapeDefs.all()) {
            if (!d.unlocked.contains(def.id()) && earned(p, d, def.unlock())) unlock(p, def.id(), false);
        }
    }

    private static boolean earned(ServerPlayer p, CapeData d, JsonObject u) {
        String type = u.has("type") ? u.get("type").getAsString() : "";
        return switch (type) {
            case "skill" -> CapePmmo.level(p, u.get("skill").getAsString()) >= u.get("level").getAsInt();
            case "all_skills" -> SKILLS.stream().allMatch(s -> CapePmmo.level(p, s) >= u.get("level").getAsInt());
            case "advancement" -> hasAdvancement(p, u.get("id").getAsString());
            case "flags" -> {
                for (JsonElement f : u.getAsJsonArray("flags")) if (!d.flags.contains(f.getAsString())) yield false;
                yield true;
            }
            case "flags_prefix" -> d.flagsStartingWith(u.get("prefix").getAsString()) >= u.get("count").getAsInt();
            default -> false;
        };
    }

    private static boolean hasAdvancement(ServerPlayer p, String id) {
        var holder = p.server.getAdvancements().get(ResourceLocation.parse(id));
        return holder != null && p.getAdvancements().getOrStartProgress(holder).isDone();
    }

    /** Marks a cape earned and hands its item over. False if it was earned already (or there's no such cape). */
    public static boolean unlock(ServerPlayer p, String id, boolean quiet) {
        CapeDefs.Def def = CapeDefs.get(id);
        CapeData d = data(p);
        if (def == null || !d.unlocked.add(id)) return false;
        give(p, def);
        CapesModule.LOGGER.info("{} earned the {}", p.getGameProfile().getName(), def.name());
        if (!quiet) {
            MutableComponent line = Component.literal("✦ Cape earned: ").withStyle(ChatFormatting.GOLD)
                    .append(Component.literal(def.name()).withStyle(ChatFormatting.YELLOW))
                    .append(Component.literal(" — " + def.description() + (def.perkText() != null ? " Perk: " + def.perkText() + "." : "") + " It's in your bag. ").withStyle(ChatFormatting.GRAY))
                    .append(link("[wear it]", "/capes wear " + id, "Put it on now", ChatFormatting.GREEN))
                    .append(Component.literal(" "))
                    .append(link("[your capes]", "/capes", "Every cape, and how to earn the rest", ChatFormatting.AQUA));
            p.sendSystemMessage(line);
            p.playNotifySound(SoundEvents.UI_TOAST_CHALLENGE_COMPLETE, SoundSource.PLAYERS, 0.8f, 1f);
        }
        sync(p);
        return true;
    }

    static MutableComponent link(String text, String command, String hover, ChatFormatting colour) {
        return Component.literal(text).withStyle(s -> s.withColor(colour).withClickEvent(new ClickEvent(ClickEvent.Action.RUN_COMMAND, command))
                .withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, Component.literal(hover))));
    }

    /** A quest reward's flag (chapter:landfall, ...): set it, then see what it unlocks. */
    public static void flag(ServerPlayer p, String flag) {
        if (data(p).flags.add(flag)) sync(p);
        checkUnlocks(p);
    }

    public static boolean revoke(ServerPlayer p, String id) {
        CapeData d = data(p);
        boolean had = d.unlocked.remove(id);
        d.given.remove(id);
        if (had) sync(p);
        return had;
    }

    /**
     * A trial won (the Fight Pits, the Inferno): the first win earns the cape, and every win after hands over another, as the
     * Fight Caves do in RuneScape.
     */
    public static void award(ServerPlayer p, String id) {
        CapeDefs.Def def = CapeDefs.get(id);
        if (def == null || unlock(p, id, false)) return;
        if (give(p, def)) p.sendSystemMessage(Component.literal("Another " + def.name() + " for your collection.").withStyle(ChatFormatting.GOLD));
    }

    /** Hands a cape's item over (into the bag, or at their feet if it's full). */
    public static boolean give(ServerPlayer p, CapeDefs.Def def) {
        ItemStack stack = def.stack();
        if (stack.isEmpty()) {
            CapesModule.LOGGER.warn("The {} has no item (is startup_scripts/capes.js loaded?)", def.id());
            return false;
        }
        data(p).given.add(def.id());
        if (!p.getInventory().add(stack)) p.drop(stack, false);
        // A cape that comes with something (the Construction Cape's Mason's Palette): that too, each time.
        ItemStack kit = def.kitStack();
        if (!kit.isEmpty() && !p.getInventory().add(kit)) p.drop(kit, false);
        return true;
    }

    public static void sync(ServerPlayer p) {
        CapeData d = data(p);
        PacketDistributor.sendToPlayer(p, new CapeNet.State(List.copyOf(d.unlocked), List.copyOf(d.flags)));
    }

    // ---------------------------------------------------------------- wearing, by command or from the screen

    /** Puts on a cape from the bag (the one worn goes into the bag). */
    public static boolean wear(ServerPlayer p, String id) {
        CapeDefs.Def def = CapeDefs.get(id);
        if (!CapesModule.CURIOS || def == null) return false;
        if (!owns(p, id)) {
            p.sendSystemMessage(Component.literal("You haven't earned the " + def.name() + ".").withStyle(ChatFormatting.RED));
            return false;
        }
        var inv = p.getInventory();
        for (int i = 0; i < inv.getContainerSize(); i++) {
            ItemStack s = inv.getItem(i);
            if (s.isEmpty() || s.getItem() != def.item()) continue;
            ItemStack cape = s.split(1);
            ItemStack old = CapeCurio.worn(p);
            CapeCurio.setWorn(p, cape);
            if (!old.isEmpty() && !inv.add(old)) p.drop(old, false);
            p.level().playSound(null, p.getX(), p.getY(), p.getZ(), SoundEvents.ARMOR_EQUIP_LEATHER, SoundSource.PLAYERS, 1f, 1f);
            return true;
        }
        if (def == worn(p)) return true;
        p.sendSystemMessage(Component.literal("Your " + def.name() + " isn't in your bag. ").withStyle(ChatFormatting.RED)
                .append(link("[your capes]", "/capes", "Where to get another", ChatFormatting.AQUA)));
        return false;
    }

    public static boolean takeOff(ServerPlayer p) {
        if (!CapesModule.CURIOS) return false;
        ItemStack old = CapeCurio.worn(p);
        if (old.isEmpty()) return false;
        CapeCurio.setWorn(p, ItemStack.EMPTY);
        if (!p.getInventory().add(old)) p.drop(old, false);
        return true;
    }

    // ---------------------------------------------------------------- another one, from the NPC who makes them

    /** The collection screen, opened from an NPC's "I've lost a cape" (npc is its entity id) or on its own (-1). */
    public static void open(ServerPlayer p, int npc, String npcId) {
        sync(p);
        PacketDistributor.sendToPlayer(p, new CapeNet.Open(npc, npcId));
    }

    static void buy(ServerPlayer p, String id, int npcEntity) {
        CapeDefs.Def def = CapeDefs.get(id);
        if (def == null || def.reclaim() == null || def.reclaim().coins() <= 0) return;
        if (!owns(p, id)) {
            p.sendSystemMessage(Component.literal("Only someone who has earned the " + def.name() + " can have one made.").withStyle(ChatFormatting.RED));
            return;
        }
        Entity npc = p.serverLevel().getEntity(npcEntity);
        if (npc == null || !npc.getTags().contains("lsp_npc." + def.reclaim().npc()) || npc.distanceToSqr(p) > SHOP_REACH * SHOP_REACH) {
            p.sendSystemMessage(Component.literal(def.reclaim().where() + " makes the " + def.name() + ": ask there.").withStyle(ChatFormatting.RED));
            return;
        }
        long price = def.reclaim().coins();
        if (!Coins.take(p, price)) {
            p.sendSystemMessage(Component.literal("Another " + def.name() + " costs ").withStyle(ChatFormatting.RED).append(Coins.text(price))
                    .append(Component.literal(".").withStyle(ChatFormatting.RED)));
            return;
        }
        give(p, def);
        p.sendSystemMessage(Component.literal(npc.getName().getString() + " hands you a new " + def.name() + ".").withStyle(ChatFormatting.GOLD));
        p.level().playSound(null, p.getX(), p.getY(), p.getZ(), SoundEvents.ARMOR_EQUIP_LEATHER, SoundSource.PLAYERS, 1f, 1f);
        CapesModule.LOGGER.info("{} bought another {} for {} coins", p.getGameProfile().getName(), def.name(), price);
        sync(p);
    }

    // ---------------------------------------------------------------- login: capes from before they were items

    static void onLogin(ServerPlayer p) {
        CapeData d = data(p);
        String wearing = "";
        CompoundTag persistent = p.getPersistentData();
        if (persistent.contains(LEGACY)) {
            try {
                JsonObject old = JsonParser.parseString(persistent.getString(LEGACY)).getAsJsonObject();
                if (old.has("unlocked")) old.getAsJsonArray("unlocked").forEach(e -> d.unlocked.add(e.getAsString()));
                if (old.has("flags")) old.getAsJsonArray("flags").forEach(e -> d.flags.add(e.getAsString()));
                if (old.has("wearing")) wearing = old.get("wearing").getAsString();
                CapesModule.LOGGER.info("Moved {}'s capes over from KubeJS: {} earned, wearing '{}'", p.getGameProfile().getName(), d.unlocked.size(), wearing);
            } catch (Exception ex) {
                CapesModule.LOGGER.warn("Couldn't read {}'s old capes", p.getGameProfile().getName(), ex);
            }
            persistent.remove(LEGACY);
        }
        for (Holder<Attribute> attribute : OLD_ATTRIBUTES) {
            AttributeInstance instance = p.getAttribute(attribute);
            if (instance == null) continue;
            for (String m : OLD_MODIFIERS) instance.removeModifier(ResourceLocation.fromNamespaceAndPath(CapeDefs.NAMESPACE, m));
        }
        for (String id : List.copyOf(d.unlocked)) {
            CapeDefs.Def def = CapeDefs.get(id);
            if (def == null || d.given.contains(id) || def.stack().isEmpty()) continue;
            if (id.equals(wearing) && CapesModule.CURIOS && CapeCurio.worn(p).isEmpty()) {
                CapeCurio.setWorn(p, def.stack());
                d.given.add(id);
            } else {
                give(p, def);
            }
        }
        sync(p);
    }

    /** An elimination's next life: the inventory starts empty, but earned capes don't go, so their items come again. */
    public static void newLife(ServerPlayer p) {
        CapeData d = data(p);
        d.given.clear();
        int n = 0;
        for (String id : List.copyOf(d.unlocked)) {
            CapeDefs.Def def = CapeDefs.get(id);
            if (def != null && give(p, def)) n++;
        }
        if (n > 0) p.sendSystemMessage(Component.literal("Your " + (n == 1 ? "cape comes" : n + " capes come") + " with you into your new life.").withStyle(ChatFormatting.GOLD));
        sync(p);
    }

    // ---------------------------------------------------------------- perks

    /** Effects and mending while worn (Curios ticks the cape; attributes are {@link CapeCurio}'s). */
    static void tickPerks(ServerPlayer p, CapeDefs.Def def) {
        JsonObject perk = def.perk();
        if (p.tickCount % 20 == 0 && perk.has("effects")) {
            for (JsonElement e : perk.getAsJsonArray("effects")) {
                JsonObject effect = e.getAsJsonObject();
                Holder<MobEffect> holder = BuiltInRegistries.MOB_EFFECT.getHolder(ResourceLocation.parse(effect.get("effect").getAsString())).orElse(null);
                if (holder != null) p.addEffect(new MobEffectInstance(holder, 45, effect.has("amplifier") ? effect.get("amplifier").getAsInt() : 0, true, false));
            }
        }
        if (p.tickCount % 200 == 0 && "mend".equals(special(def))) {
            ItemStack held = p.getMainHandItem();
            if (!held.isEmpty() && held.isDamaged()) held.setDamageValue(held.getDamageValue() - 1);
        }
    }

    @Nullable
    static String special(CapeDefs.Def def) {
        return def.perk().has("special") ? def.perk().get("special").getAsString() : null;
    }

    static void onBreak(BlockEvent.BreakEvent e) {
        if (!(e.getPlayer() instanceof ServerPlayer p) || !(e.getLevel() instanceof ServerLevel level)) return;
        CapeDefs.Def def = worn(p);
        String special = def == null ? null : special(def);
        if (special == null) return;
        BlockState state = e.getState();
        BlockPos pos = e.getPos();
        if ("log_xp".equals(special) && state.is(BlockTags.LOGS)) CapePmmo.addXp(p, "woodcutting", 3);
        if ("double_crops".equals(special) && state.is(BlockTags.CROPS) && p.getRandom().nextFloat() < 0.2f) {
            for (ItemStack drop : Block.getDrops(state, level, pos, level.getBlockEntity(pos), p, p.getMainHandItem())) Block.popResource(level, pos, drop);
        }
    }

    static void onEat(LivingEntityUseItemEvent.Finish e) {
        if (!(e.getEntity() instanceof ServerPlayer p)) return;
        CapeDefs.Def def = worn(p);
        if (def == null) return;
        if (e.getItem().has(DataComponents.FOOD) && "eat_heal".equals(special(def))) p.heal(4);
        // Brewing Cape: what a drunk potion gave lasts half as long again (instant effects aside).
        var contents = e.getItem().get(DataComponents.POTION_CONTENTS);
        if (contents != null && e.getItem().is(net.minecraft.world.item.Items.POTION) && "potion_duration".equals(special(def))) {
            for (MobEffectInstance drunk : contents.getAllEffects()) {
                if (drunk.getEffect().value().isInstantenous()) continue;
                MobEffectInstance now = p.getEffect(drunk.getEffect());
                if (now == null || now.getAmplifier() != drunk.getAmplifier()) continue;
                p.forceAddEffect(new MobEffectInstance(drunk.getEffect(), now.getDuration() + drunk.getDuration() / 2, now.getAmplifier(), now.isAmbient(), now.isVisible(), now.showIcon()), null);
            }
        }
    }

    /** Right-clicking a cape you haven't earned says why nothing happens. */
    static void onUse(PlayerInteractEvent.RightClickItem e) {
        if (!(e.getEntity() instanceof ServerPlayer p)) return;
        CapeDefs.Def def = CapeDefs.of(e.getItemStack());
        if (def == null || owns(p, def.id())) return;
        p.displayClientMessage(Component.literal("Only someone who has earned the " + def.name() + " can wear it. It can still go on an armor stand.").withStyle(ChatFormatting.RED), true);
    }

    /** A skill's level (Project MMO), for the collection's progress lines. */
    public static long skillLevel(Player p, String skill) {
        return CapePmmo.level(p, skill);
    }

    /** How many skills count for the Maxed Cape. */
    public static int skillCount() {
        return SKILLS.size();
    }

    /** How many skills are at {@code level} or more. */
    public static long skillsAt(Player p, int level) {
        return SKILLS.stream().filter(s -> CapePmmo.level(p, s) >= level).count();
    }

    /** A worn cape's crit stat ("critChance", "critDamage") for KubeJS (server_scripts/gear.js): 0 without one. */
    public static double stat(Player p, String key) {
        CapeDefs.Def def = worn(p);
        if (def == null || !def.perk().has("stats")) return 0;
        JsonObject stats = def.perk().getAsJsonObject("stats");
        return stats.has(key) ? stats.get(key).getAsDouble() : 0;
    }

    private Capes() {
    }
}
