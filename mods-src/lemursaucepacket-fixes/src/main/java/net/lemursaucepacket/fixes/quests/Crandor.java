package net.lemursaucepacket.fixes.quests;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.hub.HubState;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.GlobalPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.Registries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.TagKey;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.LodestoneTracker;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.structure.Structure;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.phys.AABB;

/**
 * Crandor, Elvarg's isle for Dragon Slayer I: the nearest fire dragon roost to Lemurton (any structure in the
 * {@code lemursaucepacket:crandor} tag), found once per world the way /locate finds things, and saved. The Map to Crandor
 * is a compass that points there. When a player who has the map and hasn't slain her comes close, Elvarg (a stage-four
 * fire dragon tagged {@code lsp_elvarg}) rises over the roost; when she dies, everyone nearby on that step of the quest gets
 * her head.
 */
public final class Crandor {
    public static final String ELVARG_TAG = "lsp_elvarg";
    /** Set on Elvarg's body once her slayers have been credited, so it happens once (Ice and Fire leaves a corpse). */
    static final String SLAIN_BODY = "lsp_elvarg_slain";
    static final String HAS_MAP = "q_ds_map";
    static final String SLAIN = "q_ds_elvarg";
    private static final TagKey<Structure> CRANDOR = TagKey.create(Registries.STRUCTURE, ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "crandor"));
    private static final int WAKE_RANGE = 72;
    private static final int CREDIT_RANGE = 160;
    private static final long RESPAWN_TICKS = 6000;
    /** Stage four (75 to 100 days old): a real fight for a well-equipped party, not a world-ender. */
    private static final int ELVARG_AGE_TICKS = 80 * 24000;

    /** Where Crandor is in this world (saved), found on first use. */
    public static final class Site extends SavedData {
        boolean found;
        int x;
        int z;
        long lastDeath = -RESPAWN_TICKS;

        static Site load(CompoundTag tag, HolderLookup.Provider registries) {
            Site s = new Site();
            s.found = tag.getBoolean("found");
            s.x = tag.getInt("x");
            s.z = tag.getInt("z");
            s.lastDeath = tag.getLong("lastDeath");
            return s;
        }

        @Override
        public CompoundTag save(CompoundTag tag, HolderLookup.Provider registries) {
            tag.putBoolean("found", found);
            tag.putInt("x", x);
            tag.putInt("z", z);
            tag.putLong("lastDeath", lastDeath);
            return tag;
        }
    }

    static Site state(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(new SavedData.Factory<>(Site::new, Site::load, null), "lsp_crandor");
    }

    /** Crandor's position (y is the surface once loaded, else 64). Finding it the first time can take a moment. */
    public static BlockPos site(MinecraftServer server) {
        Site s = state(server);
        if (!s.found) {
            ServerLevel level = server.overworld();
            HubState hub = HubState.get(server);
            BlockPos origin = hub.status() == HubState.Status.BUILT ? hub.centre() : level.getSharedSpawnPos();
            long started = System.nanoTime();
            BlockPos roost = level.findNearestMapStructure(CRANDOR, origin, 100, false);
            if (roost == null) {
                // No roost within reach: Crandor is a spot well away from the city instead; Elvarg comes all the same.
                roost = origin.offset(1500, 0, 0);
                QuestModule.LOGGER.warn("No fire dragon roost within 1,600 blocks of {}; Crandor falls back to {}", origin.toShortString(), roost.toShortString());
            }
            s.found = true;
            s.x = roost.getX();
            s.z = roost.getZ();
            s.setDirty();
            QuestModule.LOGGER.info("Crandor is at {} {} ({} blocks from {}), found in {} ms", s.x, s.z, (int) Math.sqrt(roost.distSqr(origin.atY(roost.getY()))), origin.toShortString(), (System.nanoTime() - started) / 1_000_000);
        }
        return new BlockPos(s.x, 64, s.z);
    }

    /** Clears Elvarg off Crandor (living or dead) and the wait before she can rise again: /lsp crandor reset. */
    static int reset(MinecraftServer server) {
        Site s = state(server);
        s.lastDeath = -RESPAWN_TICKS;
        s.setDirty();
        if (!s.found) return 0;
        ServerLevel level = server.overworld();
        AABB box = new AABB(s.x - 256, level.getMinBuildHeight(), s.z - 256, s.x + 256, level.getMaxBuildHeight(), s.z + 256);
        List<Entity> all = level.getEntities((Entity) null, box, e -> e.getTags().contains(ELVARG_TAG));
        for (Entity e : all) e.discard();
        return all.size();
    }

    /** Gives the Map to Crandor: a compass that points at the isle. */
    public static void giveMap(ServerPlayer player) {
        BlockPos pos = site(player.server);
        ItemStack map = new ItemStack(Items.COMPASS);
        map.set(DataComponents.LODESTONE_TRACKER, new LodestoneTracker(Optional.of(GlobalPos.of(Level.OVERWORLD, pos)), false));
        map.set(DataComponents.CUSTOM_NAME, Component.literal("Map to Crandor").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GOLD)));
        map.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("Three old pieces, put together.").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GRAY)),
                Component.literal("The needle points to Elvarg's isle.").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GRAY)))));
        CompoundTag data = new CompoundTag();
        data.putString(QuestSteps.QUEST_ITEM, "crandor_map");
        map.set(DataComponents.CUSTOM_DATA, CustomData.of(data));
        if (!player.getInventory().add(map)) player.drop(map, false);
    }

    /** Every five seconds: wake Elvarg for a player with the map who has come to Crandor. */
    static void tick(MinecraftServer server) {
        Site s = state(server);
        if (!s.found) return;
        ServerLevel level = server.overworld();
        List<ServerPlayer> near = new ArrayList<>();
        for (ServerPlayer p : level.players()) {
            if (!p.getTags().contains(HAS_MAP) || p.getTags().contains(SLAIN) || p.isSpectator()) continue;
            double dx = p.getX() - s.x;
            double dz = p.getZ() - s.z;
            if (dx * dx + dz * dz <= WAKE_RANGE * WAKE_RANGE) near.add(p);
        }
        if (near.isEmpty() || elvarg(level, s) != null) return;
        if (level.getGameTime() - s.lastDeath < RESPAWN_TICKS) return;
        if (!level.hasChunkAt(new BlockPos(s.x, 64, s.z))) return;
        int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, s.x, s.z);
        summon(server, s.x, y + 8, s.z, y);
        for (ServerPlayer p : near) {
            p.sendSystemMessage(Component.literal("The ground shakes. Elvarg has seen you!").withStyle(ChatFormatting.RED, ChatFormatting.BOLD));
            p.playNotifySound(SoundEvents.ENDER_DRAGON_GROWL, SoundSource.HOSTILE, 1f, 0.8f);
        }
        QuestModule.LOGGER.info("Elvarg rose on Crandor ({} {} {}) for {}", s.x, y, s.z, near.stream().map(p -> p.getGameProfile().getName()).toList());
    }

    /** Summons Elvarg (admins: /lsp crandor spawn). */
    static void summon(MinecraftServer server, int x, int y, int z, int home) {
        String nbt = "{AgeTicks:" + ELVARG_AGE_TICKS + ",AgingDisabled:1b,Variant:\"red\",Gender:0b,CustomName:'{\"text\":\"Elvarg\",\"color\":\"red\"}',CustomNameVisible:1b,"
                + "PersistenceRequired:1b,Tags:[\"" + ELVARG_TAG + "\"],HasHomePosition:1b,HomeAreaX:" + x + ",HomeAreaY:" + home + ",HomeAreaZ:" + z + "}";
        server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput().withPermission(4).withLevel(server.overworld()),
                "summon iceandfire:fire_dragon " + x + " " + y + " " + z + " " + nbt);
        // The summon applies her age (and so her max health) after the health is set: top her up.
        ServerLevel level = server.overworld();
        for (Entity e : level.getEntities((Entity) null, new AABB(x - 8, y - 8, z - 8, x + 8, y + 8, z + 8), e -> e.getTags().contains(ELVARG_TAG))) {
            if (e instanceof LivingEntity living) living.setHealth(living.getMaxHealth());
        }
    }

    @Nullable
    static Entity elvarg(ServerLevel level, Site s) {
        AABB box = new AABB(s.x - 256, level.getMinBuildHeight(), s.z - 256, s.x + 256, level.getMaxBuildHeight(), s.z + 256);
        List<Entity> found = level.getEntities((Entity) null, box, e -> e.isAlive() && e.getTags().contains(ELVARG_TAG) && !e.getTags().contains(SLAIN_BODY)
                && !(e instanceof LivingEntity living && living.getHealth() <= 0));
        return found.isEmpty() ? null : found.get(0);
    }

    /** Elvarg fell (her death, or her health reaching zero: Ice and Fire keeps the body): her head for everyone nearby hunting her. */
    static void onDeath(LivingEntity dead) {
        if (!dead.getTags().contains(ELVARG_TAG) || dead.getTags().contains(SLAIN_BODY) || !(dead.level() instanceof ServerLevel level)) return;
        dead.addTag(SLAIN_BODY);
        MinecraftServer server = level.getServer();
        Site s = state(server);
        s.lastDeath = level.getGameTime();
        s.setDirty();
        List<String> names = new ArrayList<>();
        for (ServerPlayer p : level.players()) {
            if (!p.getTags().contains(HAS_MAP) || p.getTags().contains(SLAIN)) continue;
            if (p.distanceToSqr(dead) > CREDIT_RANGE * CREDIT_RANGE) continue;
            p.addTag(SLAIN);
            ItemStack head = head();
            if (!p.getInventory().add(head)) p.drop(head, false);
            p.sendSystemMessage(Component.literal("Elvarg is slain! Take her head to Oziach.").withStyle(ChatFormatting.GOLD, ChatFormatting.BOLD));
            p.playNotifySound(SoundEvents.UI_TOAST_CHALLENGE_COMPLETE, SoundSource.PLAYERS, 1f, 1f);
            names.add(p.getGameProfile().getName());
        }
        if (!names.isEmpty()) server.getPlayerList().broadcastSystemMessage(Component.literal(String.join(", ", names) + (names.size() == 1 ? " has" : " have") + " slain Elvarg, the dragon of Crandor!").withStyle(ChatFormatting.GOLD), false);
        QuestModule.LOGGER.info("Elvarg died; credit to {}", names);
    }

    static ItemStack head() {
        ItemStack head = new ItemStack(net.minecraft.core.registries.BuiltInRegistries.ITEM.get(ResourceLocation.parse("iceandfire:dragon_skull_fire")));
        if (head.isEmpty() || head.is(Items.AIR)) head = new ItemStack(Items.DRAGON_HEAD);
        head.set(DataComponents.CUSTOM_NAME, Component.literal("Elvarg's Head").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.RED)));
        head.set(DataComponents.LORE, new ItemLore(List.of(Component.literal("Proof for Oziach.").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GRAY)))));
        CompoundTag data = new CompoundTag();
        data.putString(QuestSteps.QUEST_ITEM, "elvarg_head");
        head.set(DataComponents.CUSTOM_DATA, CustomData.of(data));
        return head;
    }

    private Crandor() {
    }
}
