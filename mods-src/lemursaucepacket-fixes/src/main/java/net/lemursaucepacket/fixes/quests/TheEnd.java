package net.lemursaucepacket.fixes.quests;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import net.lemursaucepacket.fixes.hub.HubState;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.GlobalPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.StructureTags;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.boss.enderdragon.EnderDragon;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.LodestoneTracker;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.saveddata.SavedData;

/**
 * Dragon Slayer I's dragon: the Ender Dragon. Oziach puts the three map pieces together into the Map to the Stronghold,
 * a compass that points to the stronghold nearest Lemurton (found once the way eyes of ender find one, and saved), whose
 * portal leads to her island. When she falls, everyone near her who is on that step of the quest gets her head, the
 * proof Oziach wants; Elvarg (Dragon Slayer II) is {@link Crandor}'s.
 */
public final class TheEnd {
    static final String HAS_MAP = "q_ds_map";
    static final String SLAIN = "q_ds_dragon";
    /** Set on a dragon once her slayers have been credited (her death and her last hit both report it). */
    private static final String CREDITED = "lsp_dragon_credited";
    private static final int CREDIT_RANGE = 300;

    /** Where the stronghold is in this world (saved), found on first use. */
    public static final class Site extends SavedData {
        boolean found;
        int x;
        int z;

        static Site load(CompoundTag tag, HolderLookup.Provider registries) {
            Site s = new Site();
            s.found = tag.getBoolean("found");
            s.x = tag.getInt("x");
            s.z = tag.getInt("z");
            return s;
        }

        @Override
        public CompoundTag save(CompoundTag tag, HolderLookup.Provider registries) {
            tag.putBoolean("found", found);
            tag.putInt("x", x);
            tag.putInt("z", z);
            return tag;
        }
    }

    static Site state(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(new SavedData.Factory<>(Site::new, Site::load, null), "lsp_stronghold");
    }

    /** The stronghold nearest Lemurton (y 64 as a placeholder: the needle only needs x and z). */
    public static Optional<BlockPos> stronghold(MinecraftServer server) {
        Site s = state(server);
        if (!s.found) {
            ServerLevel level = server.overworld();
            HubState hub = HubState.get(server);
            BlockPos origin = hub.status() == HubState.Status.BUILT ? hub.centre() : level.getSharedSpawnPos();
            long started = System.nanoTime();
            BlockPos found = level.findNearestMapStructure(StructureTags.EYE_OF_ENDER_LOCATED, origin, 100, false);
            if (found == null) {
                QuestModule.LOGGER.warn("No stronghold within 1,600 blocks of {}: the Map to the Stronghold has nothing to point at", origin.toShortString());
                return Optional.empty();
            }
            s.found = true;
            s.x = found.getX();
            s.z = found.getZ();
            s.setDirty();
            QuestModule.LOGGER.info("The stronghold for Dragon Slayer I is at {} {} ({} blocks from {}), found in {} ms", s.x, s.z,
                    (int) Math.sqrt(found.atY(0).distSqr(origin.atY(0))), origin.toShortString(), (System.nanoTime() - started) / 1_000_000);
        }
        return Optional.of(new BlockPos(s.x, 64, s.z));
    }

    /** The Map to the Stronghold: a compass whose needle points to the stronghold's portal room. */
    public static void giveMap(ServerPlayer player) {
        ItemStack map = new ItemStack(Items.COMPASS);
        stronghold(player.server).ifPresent(pos -> map.set(DataComponents.LODESTONE_TRACKER, new LodestoneTracker(Optional.of(GlobalPos.of(Level.OVERWORLD, pos)), false)));
        map.set(DataComponents.CUSTOM_NAME, Component.literal("Map to the Stronghold").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.LIGHT_PURPLE)));
        map.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("Three old pieces, put together.").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GRAY)),
                Component.literal("The needle points to the stronghold;").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GRAY)),
                Component.literal("its portal leads to the End.").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GRAY)))));
        CompoundTag data = new CompoundTag();
        data.putString(QuestSteps.QUEST_ITEM, "stronghold_map");
        map.set(DataComponents.CUSTOM_DATA, CustomData.of(data));
        if (!player.getInventory().add(map)) player.drop(map, false);
    }

    /** The Ender Dragon fell: her head for everyone near her who is hunting her for Oziach. */
    static void onDeath(LivingEntity dead) {
        if (!(dead instanceof EnderDragon dragon) || dragon.getTags().contains(CREDITED) || !(dead.level() instanceof ServerLevel level)) return;
        dragon.addTag(CREDITED);
        MinecraftServer server = level.getServer();
        List<String> names = new ArrayList<>();
        for (ServerPlayer p : level.players()) {
            if (!p.getTags().contains(HAS_MAP) || p.getTags().contains(SLAIN)) continue;
            if (p.distanceToSqr(dead) > CREDIT_RANGE * CREDIT_RANGE) continue;
            p.addTag(SLAIN);
            ItemStack head = head();
            if (!p.getInventory().add(head)) p.drop(head, false);
            p.sendSystemMessage(Component.literal("The Ender Dragon is slain! Take her head to Oziach.").withStyle(ChatFormatting.LIGHT_PURPLE, ChatFormatting.BOLD));
            p.playNotifySound(SoundEvents.UI_TOAST_CHALLENGE_COMPLETE, SoundSource.PLAYERS, 1f, 1f);
            names.add(p.getGameProfile().getName());
        }
        if (!names.isEmpty())
            server.getPlayerList().broadcastSystemMessage(Component.literal(String.join(", ", names) + (names.size() == 1 ? " has" : " have") + " slain the Ender Dragon for Dragon Slayer I!").withStyle(ChatFormatting.LIGHT_PURPLE), false);
        QuestModule.LOGGER.info("The Ender Dragon died; Dragon Slayer I credit to {}", names);
    }

    static ItemStack head() {
        ItemStack head = new ItemStack(Items.DRAGON_HEAD);
        head.set(DataComponents.CUSTOM_NAME, Component.literal("The Ender Dragon's Head").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.LIGHT_PURPLE)));
        head.set(DataComponents.LORE, new ItemLore(List.of(Component.literal("Proof for Oziach.").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GRAY)))));
        CompoundTag data = new CompoundTag();
        data.putString(QuestSteps.QUEST_ITEM, "ender_dragon_head");
        head.set(DataComponents.CUSTOM_DATA, CustomData.of(data));
        return head;
    }

    private TheEnd() {
    }
}
