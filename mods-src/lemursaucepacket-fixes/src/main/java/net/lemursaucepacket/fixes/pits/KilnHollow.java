package net.lemursaucepacket.fixes.pits;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.mojang.datafixers.util.Pair;

import net.lemursaucepacket.fixes.hub.HubState;
import net.lemursaucepacket.fixes.hub.Waystones;
import net.lemursaucepacket.fixes.quests.QuestSteps;
import net.lemursaucepacket.fixes.zone.SafeZones;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.GlobalPos;
import net.minecraft.core.Holder;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.LodestoneTracker;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate;
import net.minecraft.world.level.saveddata.SavedData;

/**
 * Kiln Hollow, the Kilnfolk's outpost ({@code structures/buildings/80-kiln.mjs}): where the Fight Pits and the Inferno
 * are entered. Built once per world, like the Crandor memorial:
 * <ol>
 * <li>Once Lemurton is up (or someone needs the Kilnfolk Pass), the nearest volcanic land is found the way /locate
 * finds a biome: Terralith's volcanic crater or peaks, else its basalt cliffs or ashen savanna, else badlands; failing
 * all that, a spot a long way out. It's saved.</li>
 * <li>The land round it is force-loaded so it generates; on the first tick it's all in, the flattest spot near there gets
 * the outpost, its front toward Lemurton. Its data markers say where the Kilnfolk stand ({@code npc:<id>:<facing>},
 * Easy NPC presets from npcs/npcs.mjs) and where the waystone goes; it gets a safe zone of its own.</li>
 * </ol>
 */
public final class KilnHollow {
    static final int NONE = 0, LOADING = 1, BUILT = 2;
    static final ResourceLocation TEMPLATE = ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "kiln_hollow");
    static final String ZONE = "kiln_hollow";
    private static final int CHUNK_RADIUS = 5, SEARCH = 56;
    private static final List<Set<String>> LANDS = List.of(
            Set.of("terralith:volcanic_crater", "terralith:volcanic_peaks"),
            Set.of("terralith:basalt_cliffs", "terralith:ashen_savanna"),
            Set.of("minecraft:badlands", "minecraft:eroded_badlands", "minecraft:wooded_badlands", "terralith:painted_mountains", "terralith:savanna_badlands"));
    private static final int[] RADII = {2400, 2400, 1600};

    /** Where the Hollow is in this world (saved). */
    public static final class Site extends SavedData {
        boolean found;
        int x, z;
        String land = "";
        int status;
        int hx, hy, hz;

        static Site load(CompoundTag tag, HolderLookup.Provider registries) {
            Site s = new Site();
            s.found = tag.getBoolean("found");
            s.x = tag.getInt("x");
            s.z = tag.getInt("z");
            s.land = tag.getString("land");
            s.status = tag.getInt("status");
            s.hx = tag.getInt("hx");
            s.hy = tag.getInt("hy");
            s.hz = tag.getInt("hz");
            return s;
        }

        @Override
        public CompoundTag save(CompoundTag tag, HolderLookup.Provider registries) {
            tag.putBoolean("found", found);
            tag.putInt("x", x);
            tag.putInt("z", z);
            tag.putString("land", land);
            tag.putInt("status", status);
            tag.putInt("hx", hx);
            tag.putInt("hy", hy);
            tag.putInt("hz", hz);
            return tag;
        }
    }

    static Site state(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(new SavedData.Factory<>(Site::new, Site::load, null), "lsp_kiln_hollow");
    }

    /** Where the Hollow is, if it's built. */
    public static Optional<BlockPos> hollow(MinecraftServer server) {
        Site s = state(server);
        return s.status == BUILT ? Optional.of(new BlockPos(s.hx, s.hy, s.hz)) : Optional.empty();
    }

    private static BlockPos home(MinecraftServer server) {
        HubState hub = HubState.get(server);
        return hub.status() == HubState.Status.BUILT ? hub.centre() : server.overworld().getSharedSpawnPos();
    }

    /** The site (found the first time it's asked for: that can take a moment). */
    public static BlockPos site(MinecraftServer server) {
        Site s = state(server);
        if (!s.found) {
            ServerLevel level = server.overworld();
            BlockPos origin = home(server);
            long started = System.nanoTime();
            Pair<BlockPos, Holder<Biome>> found = null;
            for (int i = 0; i < LANDS.size() && found == null; i++) {
                Set<String> ids = LANDS.get(i);
                found = level.findClosestBiome3d(h -> h.unwrapKey().map(k -> ids.contains(k.location().toString())).orElse(false), origin, RADII[i], 32, 64);
            }
            BlockPos at;
            if (found != null) {
                at = found.getFirst();
                s.land = found.getSecond().unwrapKey().map(k -> k.location().toString()).orElse("?");
            } else {
                at = origin.offset(-1100, 0, 700);
                s.land = "none";
                PitsModule.LOGGER.warn("No volcanic land, basalt or badlands near {}; Kiln Hollow falls back to {}", origin.toShortString(), at.toShortString());
            }
            s.found = true;
            s.x = at.getX();
            s.z = at.getZ();
            s.setDirty();
            PitsModule.LOGGER.info("Kiln Hollow's land: {} at {} {} ({} blocks from {}), found in {} ms", s.land, s.x, s.z,
                    (int) Math.sqrt(at.atY(0).distSqr(origin.atY(0))), origin.toShortString(), (System.nanoTime() - started) / 1_000_000);
        }
        return new BlockPos(s.x, 64, s.z);
    }

    /** /lsp kiln reset: forgets where the Hollow is, so it's found and built again (the old one isn't removed). */
    static void reset(MinecraftServer server) {
        Site s = state(server);
        s.found = false;
        s.status = NONE;
        s.land = "";
        s.setDirty();
        SafeZones.get(server).remove(ZONE);
    }

    /** Every five seconds. */
    static void tick(MinecraftServer server) {
        Site s = state(server);
        if (s.status == BUILT) return;
        if (!s.found) {
            HubState.Status hub = HubState.get(server).status();
            if (hub == HubState.Status.BUILT || hub == HubState.Status.SKIPPED) site(server);
            return;
        }
        ServerLevel level = server.overworld();
        int cx = s.x >> 4, cz = s.z >> 4;
        if (s.status == NONE) {
            for (int x = cx - CHUNK_RADIUS; x <= cx + CHUNK_RADIUS; x++)
                for (int z = cz - CHUNK_RADIUS; z <= cz + CHUNK_RADIUS; z++) level.setChunkForced(x, z, true);
            s.status = LOADING;
            s.setDirty();
            PitsModule.LOGGER.info("Kiln Hollow: loading the land at {} {}", s.x, s.z);
            return;
        }
        for (int x = cx - CHUNK_RADIUS; x <= cx + CHUNK_RADIUS; x++)
            for (int z = cz - CHUNK_RADIUS; z <= cz + CHUNK_RADIUS; z++) if (!level.getChunkSource().hasChunk(x, z)) return;
        try {
            build(server, level, s);
        } catch (Exception e) {
            PitsModule.LOGGER.error("Kiln Hollow: building failed", e);
        }
        for (int x = cx - CHUNK_RADIUS; x <= cx + CHUNK_RADIUS; x++)
            for (int z = cz - CHUNK_RADIUS; z <= cz + CHUNK_RADIUS; z++) level.setChunkForced(x, z, false);
        s.status = BUILT;
        s.setDirty();
        // Saved at once: a crash before the next autosave would otherwise build it (and its people) a second time.
        level.getDataStorage().save();
    }

    private static int top(ServerLevel level, int x, int z) {
        return level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, x, z) - 1;
    }

    /**
     * The best spot near the site for the outpost (31 across): flat, dry, and in the land that was found (volcanic ground
     * rather than the green hills beside it). Its centre on the ground, at the middle height.
     */
    private static BlockPos spot(ServerLevel level, Site s) {
        Set<String> land = LANDS.stream().filter(set -> set.contains(s.land)).findFirst().orElse(Set.of(s.land));
        BlockPos best = null;
        double bestScore = Double.MAX_VALUE;
        for (int dx = -SEARCH; dx <= SEARCH; dx += 5)
            for (int dz = -SEARCH; dz <= SEARCH; dz += 5) {
                int x = s.x + dx, z = s.z + dz;
                int[] heights = new int[25];
                int n = 0, wet = 0;
                for (int ox = -12; ox <= 12; ox += 6)
                    for (int oz = -12; oz <= 12; oz += 6) {
                        int h = top(level, x + ox, z + oz);
                        heights[n++] = h;
                        if (!level.getBlockState(new BlockPos(x + ox, h, z + oz)).getFluidState().isEmpty()) wet++;
                    }
                java.util.Arrays.sort(heights);
                int spread = heights[22] - heights[2];
                int foreign = 0;
                for (int[] o : new int[][] {{0, 0}, {-10, -10}, {10, -10}, {-10, 10}, {10, 10}}) {
                    String biome = level.getBiome(new BlockPos(x + o[0], heights[12], z + o[1])).unwrapKey().map(k -> k.location().toString()).orElse("");
                    if (!land.contains(biome)) foreign++;
                }
                double score = spread * 3 + wet * 12 + foreign * 9 + Math.hypot(dx, dz) * 0.1;
                if (score < bestScore) {
                    bestScore = score;
                    best = new BlockPos(x, heights[12], z);
                }
            }
        return best != null ? best : new BlockPos(s.x, top(level, s.x, s.z), s.z);
    }

    private static void build(MinecraftServer server, ServerLevel level, Site s) {
        Optional<StructureTemplate> found = server.getStructureManager().get(TEMPLATE);
        if (found.isEmpty()) {
            PitsModule.LOGGER.error("Kiln Hollow: no template {}", TEMPLATE);
            return;
        }
        StructureTemplate template = found.get();
        // The template's centre marker (above the plaza's middle) is the pivot.
        BlockPos pivot = null;
        for (StructureTemplate.StructureBlockInfo info : template.filterBlocks(BlockPos.ZERO, new StructurePlaceSettings(), Blocks.STRUCTURE_BLOCK))
            if (info.nbt() != null && "centre".equals(info.nbt().getString("metadata"))) pivot = info.pos();
        if (pivot == null) {
            PitsModule.LOGGER.error("Kiln Hollow: the template has no centre marker");
            return;
        }
        BlockPos at = spot(level, s);
        BlockPos toward = home(server);
        double ox = toward.getX() - at.getX(), oz = toward.getZ() - at.getZ();
        Rotation rotation;
        String facing;
        if (Math.abs(oz) >= Math.abs(ox)) {
            rotation = oz > 0 ? Rotation.NONE : Rotation.CLOCKWISE_180;
            facing = oz > 0 ? "south" : "north";
        } else {
            rotation = ox > 0 ? Rotation.COUNTERCLOCKWISE_90 : Rotation.CLOCKWISE_90;
            facing = ox > 0 ? "east" : "west";
        }
        StructurePlaceSettings settings = new StructurePlaceSettings().setRotation(rotation).setRotationPivot(new BlockPos(pivot.getX(), 0, pivot.getZ())).setIgnoreEntities(true);
        // The plaza's surface (just under the centre marker) goes on the ground at the spot.
        BlockPos origin = at.offset(-pivot.getX(), -(pivot.getY() - 1), -pivot.getZ());
        template.placeInWorld(level, origin, origin, settings, level.random, Block.UPDATE_ALL);

        int people = 0;
        for (StructureTemplate.StructureBlockInfo info : template.filterBlocks(origin, settings, Blocks.STRUCTURE_BLOCK)) {
            if (info.nbt() == null || !"DATA".equals(info.nbt().getString("mode"))) continue;
            String[] meta = info.nbt().getString("metadata").split(":");
            BlockPos pos = info.pos();
            level.setBlock(pos, Blocks.AIR.defaultBlockState(), Block.UPDATE_ALL);
            Direction dir = meta.length > 1 ? Direction.byName(meta[meta.length - 1]) : null;
            if (dir != null) dir = rotation.rotate(dir);
            switch (meta[0]) {
                case "npc" -> {
                    if (meta.length >= 3 && npc(server, level, meta[1], pos, dir == null ? 0F : dir.toYRot())) people++;
                }
                case "waystone" -> Waystones.place(level, pos, "Kiln Hollow", dir == null ? facing : dir.getName(), false);
                default -> {
                }
            }
        }
        SafeZones.get(server).put(new SafeZones.Zone(ZONE, level.dimension().location().toString(), at.getX() - 17, at.getY() - 8, at.getZ() - 17,
                at.getX() + 17, at.getY() + 22, at.getZ() + 17, EnumSet.allOf(SafeZones.Flag.class)));
        s.hx = at.getX();
        s.hy = at.getY();
        s.hz = at.getZ();
        PitsModule.LOGGER.info("Kiln Hollow built at {} facing {} ({}), {} of the Kilnfolk", at.toShortString(), facing, s.land, people);
    }

    /** Brings one of the Kilnfolk in (an Easy NPC preset from npcs/npcs.mjs), facing a way. */
    private static boolean npc(MinecraftServer server, ServerLevel level, String id, BlockPos pos, float yaw) {
        String preset = "lemursaucepacket:easy_npc/preset/piglin/lemurton_" + id + ".npc.snbt";
        UUID uuid = UUID.randomUUID();
        server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput().withPermission(4).withLevel(level),
                "easy_npc preset import data " + preset + " " + (pos.getX() + 0.5) + " " + pos.getY() + " " + (pos.getZ() + 0.5) + " " + uuid);
        Entity e = level.getEntity(uuid);
        if (e == null) {
            PitsModule.LOGGER.warn("Kiln Hollow: {} wasn't imported ({})", id, preset);
            return false;
        }
        e.setYRot(yaw);
        e.setYHeadRot(yaw);
        if (e instanceof Mob mob) mob.setYBodyRot(yaw);
        return true;
    }

    /** The Kilnfolk Pass: a compass that points to Kiln Hollow (its land, before it's built). */
    public static void givePass(ServerPlayer player) {
        BlockPos pos = hollow(player.server).orElseGet(() -> site(player.server));
        ItemStack pass = new ItemStack(Items.COMPASS);
        pass.set(DataComponents.LODESTONE_TRACKER, new LodestoneTracker(Optional.of(GlobalPos.of(Level.OVERWORLD, pos)), false));
        pass.set(DataComponents.CUSTOM_NAME, Component.literal("Kilnfolk Pass").withStyle(st -> st.withItalic(false).withColor(ChatFormatting.GOLD)));
        pass.set(DataComponents.LORE, new ItemLore(List.of(
                Component.literal("A shard of warm obsidian on a cord.").withStyle(st -> st.withItalic(false).withColor(ChatFormatting.GRAY)),
                Component.literal("It pulls toward Kiln Hollow.").withStyle(st -> st.withItalic(false).withColor(ChatFormatting.GRAY)))));
        CompoundTag data = new CompoundTag();
        data.putString(QuestSteps.QUEST_ITEM, "kiln_pass");
        pass.set(DataComponents.CUSTOM_DATA, CustomData.of(data));
        if (!player.getInventory().add(pass)) player.drop(pass, false);
    }

    private KilnHollow() {
    }
}
