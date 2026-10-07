package net.lemursaucepacket.fixes.quests;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mojang.brigadier.exceptions.CommandSyntaxException;

import net.lemursaucepacket.fixes.hub.HubState;
import net.lemursaucepacket.fixes.hub.Waystones;
import net.lemursaucepacket.fixes.zone.SafeZones;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.Vec3i;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.TagParser;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.TamableAnimal;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.block.StructureBlock;
import net.minecraft.world.level.block.entity.StructureBlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.StructureMode;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplateManager;
import net.minecraft.world.phys.AABB;

/**
 * The Crandor memorial: Ned's post at the foot of Elvarg's hill ({@code structures/buildings/70-crandor.mjs}), where the
 * Elvarg event starts and where Ned keeps the things of those who fall in it. Built once per world, next to the roost
 * Crandor is ({@link Crandor#site}):
 * <ol>
 * <li>When the site is known, the area round the roost is force-loaded, so it generates in the background.</li>
 * <li>On the first tick it's all in, the den (97 blocks across) is copied into the template
 * {@code lemursaucepacket:crandor_den}, the event's arena, with a {@code player_spawn} marker on the side the memorial
 * is on; then the memorial goes up on low, flat ground facing Lemurton, with its dragon skull, Ned and a waystone, in a
 * safe zone of its own.</li>
 * </ol>
 */
public final class CrandorMemorial {
    static final int NONE = 0, LOADING = 1, BUILT = 2;
    static final ResourceLocation TEMPLATE = ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "crandor_memorial");
    public static final ResourceLocation DEN = ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "crandor_den");
    private static final int DEN_RADIUS = 48, DEN_BELOW = 12, DEN_ABOVE = 48, CHUNK_RADIUS = 5;
    /** In the memorial template: the platform's centre (the ground block), the dais top, Ned's spot, the waystone. */
    private static final BlockPos CENTRE = new BlockPos(6, 4, 6), SKULL = new BlockPos(6, 6, 6), NED = new BlockPos(10, 5, 9), WAYSTONE = new BlockPos(3, 5, 9);
    private static final String NED_PRESET = "lemursaucepacket:easy_npc/preset/villager/lemurton_ned.npc.snbt";
    static final String ZONE = "crandor_memorial";

    /** From Crandor's tick (every five seconds). */
    static void tick(MinecraftServer server, Crandor.Site s) {
        if (s.memorial == BUILT) {
            maintain(server, s);
            return;
        }
        if (!s.found) {
            // Crandor is found once the city is up (or once someone needs the map), so the memorial is there in time.
            if (HubState.get(server).status() == HubState.Status.BUILT) Crandor.site(server);
            return;
        }
        ServerLevel level = server.overworld();
        int cx = s.x >> 4, cz = s.z >> 4;
        if (s.memorial == NONE) {
            for (int x = cx - CHUNK_RADIUS; x <= cx + CHUNK_RADIUS; x++)
                for (int z = cz - CHUNK_RADIUS; z <= cz + CHUNK_RADIUS; z++) level.setChunkForced(x, z, true);
            s.memorial = LOADING;
            s.setDirty();
            QuestModule.LOGGER.info("Crandor memorial: loading the land round the roost at {} {}", s.x, s.z);
            return;
        }
        for (int x = cx - CHUNK_RADIUS; x <= cx + CHUNK_RADIUS; x++)
            for (int z = cz - CHUNK_RADIUS; z <= cz + CHUNK_RADIUS; z++) if (!level.getChunkSource().hasChunk(x, z)) return;
        try {
            build(server, level, s);
        } catch (Exception e) {
            QuestModule.LOGGER.error("Crandor memorial: building failed", e);
        }
        for (int x = cx - CHUNK_RADIUS; x <= cx + CHUNK_RADIUS; x++)
            for (int z = cz - CHUNK_RADIUS; z <= cz + CHUNK_RADIUS; z++) level.setChunkForced(x, z, false);
        s.memorial = BUILT;
        s.setDirty();
    }

    /**
     * While the memorial's land is loaded: no wild dragon round Crandor (Elvarg lives in her instance now, and the roost's
     * own dragon would burn visitors and the skull), and the skull back on its dais if anything took it. Tamed dragons
     * and an admin's Elvarg are left alone.
     */
    private static void maintain(MinecraftServer server, Crandor.Site s) {
        ServerLevel level = server.overworld();
        BlockPos centre = new BlockPos(s.mx, s.my, s.mz);
        if (!level.hasChunkAt(centre)) return;
        AABB round = new AABB(s.x - 128, level.getMinBuildHeight(), s.z - 128, s.x + 128, level.getMaxBuildHeight(), s.z + 128).minmax(
                new AABB(centre).inflate(64, 0, 64).setMinY(level.getMinBuildHeight()).setMaxY(level.getMaxBuildHeight()));
        for (Entity e : level.getEntities((Entity) null, round, CrandorMemorial::wildDragon)) {
            QuestModule.LOGGER.info("Crandor memorial: a wild {} near the memorial is gone (at {})", BuiltInRegistries.ENTITY_TYPE.getKey(e.getType()), e.blockPosition().toShortString());
            e.discard();
        }
        // A chunk's entities load a little after the chunk: only then can a missing skull be told from one not loaded yet.
        if (!level.areEntitiesLoaded(ChunkPos.asLong(centre))) return;
        BlockPos dais = centre.above(2);
        List<Entity> skulls = level.getEntities((Entity) null, new AABB(dais).inflate(2), e -> SKULL_ID.equals(BuiltInRegistries.ENTITY_TYPE.getKey(e.getType())));
        for (int i = 1; i < skulls.size(); i++) skulls.get(i).discard();
        if (skulls.isEmpty()) {
            double ox = s.mx - s.x, oz = s.mz - s.z;
            float yaw = Math.abs(oz) >= Math.abs(ox) ? (oz > 0 ? 0 : 180) : (ox > 0 ? -90 : 90);
            try {
                skull(level, dais, yaw);
                QuestModule.LOGGER.info("Crandor memorial: the dragon skull was gone; put it back");
            } catch (CommandSyntaxException e) {
                QuestModule.LOGGER.error("Crandor memorial: couldn't put the skull back", e);
            }
        }
    }

    private static final ResourceLocation SKULL_ID = ResourceLocation.fromNamespaceAndPath("iceandfire", "dragon_skull");

    private static boolean wildDragon(Entity e) {
        ResourceLocation id = BuiltInRegistries.ENTITY_TYPE.getKey(e.getType());
        if (!id.getNamespace().equals("iceandfire") || !id.getPath().endsWith("_dragon")) return false;
        if (e.getTags().contains(Crandor.ELVARG_TAG)) return false;
        return !(e instanceof TamableAnimal pet && pet.isTame());
    }

    /** The skull of a dragon slain long ago, on the dais, looking out. */
    private static void skull(ServerLevel level, BlockPos at, float yaw) throws CommandSyntaxException {
        CompoundTag tag = TagParser.parseTag("{id:\"iceandfire:dragon_skull\",Type:\"fire\",Stage:4,DragonAge:80,DragonYaw:" + yaw
                + "f,PersistenceRequired:1b,Invulnerable:1b,NoAI:1b}");
        Entity skull = EntityType.loadEntityRecursive(tag, level, e -> {
            e.moveTo(at.getX() + 0.5, at.getY(), at.getZ() + 0.5, yaw, 0);
            return e;
        });
        if (skull != null) level.tryAddFreshEntityWithPassengers(skull);
        else QuestModule.LOGGER.warn("Crandor memorial: no dragon skull (is Ice and Fire installed?)");
    }

    private static int top(ServerLevel level, int x, int z) {
        return level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, x, z) - 1;
    }

    /** The memorial's spot: on the side toward Lemurton, low (the foot of the hill), flat, dry, clear of trees and the burnt roost. */
    private static BlockPos spot(MinecraftServer server, ServerLevel level, Crandor.Site s) {
        HubState hub = HubState.get(server);
        BlockPos home = hub.status() == HubState.Status.BUILT ? hub.centre() : level.getSharedSpawnPos();
        double tx = home.getX() - s.x, tz = home.getZ() - s.z, tl = Math.max(1, Math.hypot(tx, tz));
        tx /= tl;
        tz /= tl;
        BlockPos best = null;
        double bestScore = Double.MAX_VALUE;
        for (int dist = 30; dist <= 60; dist += 3) {
            for (int a = 0; a < 36; a++) {
                double dx = Math.cos(Math.toRadians(a * 10)), dz = Math.sin(Math.toRadians(a * 10));
                int x = s.x + (int) Math.round(dx * dist), z = s.z + (int) Math.round(dz * dist);
                int g = top(level, x, z);
                int min = g, max = g, canopy = 0;
                for (int ox = -6; ox <= 6; ox += 3)
                    for (int oz = -6; oz <= 6; oz += 3) {
                        int h = top(level, x + ox, z + oz);
                        min = Math.min(min, h);
                        max = Math.max(max, h);
                        if (level.getHeight(Heightmap.Types.MOTION_BLOCKING, x + ox, z + oz) - h > 2) canopy++;
                    }
                if (max - min > 4) continue;
                BlockState ground = level.getBlockState(new BlockPos(x, g, z));
                if (!ground.getFluidState().isEmpty()) continue;
                if (BuiltInRegistries.BLOCK.getKey(ground.getBlock()).getNamespace().equals("iceandfire")) continue;
                double toward = dx * tx + dz * tz;
                // The side players come from first (the den's way in), then the lowest ground there (the foot of the hill).
                double score = g + (max - min) * 3 + canopy * 4 + (1 - toward) * 30 + Math.abs(dist - 40) * 0.3;
                if (score < bestScore) {
                    bestScore = score;
                    best = new BlockPos(x, g, z);
                }
            }
        }
        if (best == null) {
            int x = s.x + (int) Math.round(tx * 40), z = s.z + (int) Math.round(tz * 40);
            best = new BlockPos(x, top(level, x, z), z);
        }
        return best;
    }

    /**
     * Copies the den round the roost into {@link #DEN}, the event's arena, with a {@code player_spawn} marker where the
     * party arrives: on the memorial's side ({@code ox}, {@code oz}: the way out from the roost), on open ground at the
     * edge of her clearing, about 24 blocks out, so they arrive with her in view rather than in the trees.
     */
    static void captureDen(MinecraftServer server, ServerLevel level, Crandor.Site s, double ox, double oz) {
        StructureTemplateManager templates = server.getStructureManager();
        int ground = top(level, s.x, s.z);
        BlockPos marker = null;
        for (int d : new int[] {24, 26, 22, 28, 20, 30, 32, 18, 34, 36}) {
            int x = s.x + (int) Math.round(ox * d), z = s.z + (int) Math.round(oz * d);
            int h = top(level, x, z);
            boolean open = level.getHeight(Heightmap.Types.MOTION_BLOCKING, x, z) - 1 <= h;
            if (open && level.getBlockState(new BlockPos(x, h, z)).getFluidState().isEmpty()) {
                marker = new BlockPos(x, h + 1, z);
                break;
            }
        }
        if (marker == null) {
            int x = s.x + (int) Math.round(ox * 24), z = s.z + (int) Math.round(oz * 24);
            marker = new BlockPos(x, top(level, x, z) + 1, z);
        }
        int bottom = Math.max(level.getMinBuildHeight(), Math.min(ground, marker.getY() - 1) - DEN_BELOW);
        int topY = Math.min(level.getMaxBuildHeight() - 1, Math.max(ground, marker.getY()) + DEN_ABOVE);
        BlockPos corner = new BlockPos(s.x - DEN_RADIUS, bottom, s.z - DEN_RADIUS);
        Vec3i size = new Vec3i(DEN_RADIUS * 2 + 1, topY - bottom + 1, DEN_RADIUS * 2 + 1);
        BlockState was = level.getBlockState(marker);
        level.setBlock(marker, Blocks.STRUCTURE_BLOCK.defaultBlockState().setValue(StructureBlock.MODE, StructureMode.DATA), Block.UPDATE_CLIENTS);
        if (level.getBlockEntity(marker) instanceof StructureBlockEntity sbe) {
            sbe.setMode(StructureMode.DATA);
            sbe.setMetaData("player_spawn");
        }
        StructureTemplate den = templates.getOrCreate(DEN);
        den.fillFromWorld(level, corner, size, false, Blocks.AIR);
        level.setBlock(marker, was, Block.UPDATE_CLIENTS);
        boolean saved = templates.save(DEN);
        QuestModule.LOGGER.info("Crandor memorial: copied the den ({}x{}x{} from {}) into {}{}; the party arrives at {}", size.getX(), size.getY(), size.getZ(),
                corner.toShortString(), DEN, saved ? "" : " (NOT SAVED)", marker.toShortString());
    }

    /** /lsp crandor den: copies the den again (it must be loaded), e.g. after a change to how it's copied. */
    static boolean recaptureDen(MinecraftServer server) {
        Crandor.Site s = Crandor.state(server);
        ServerLevel level = server.overworld();
        if (s.memorial != BUILT || !level.hasChunkAt(new BlockPos(s.x, 64, s.z))) return false;
        double ox = s.mx - s.x, oz = s.mz - s.z, ol = Math.max(1, Math.hypot(ox, oz));
        captureDen(server, level, s, ox / ol, oz / ol);
        return true;
    }

    private static void build(MinecraftServer server, ServerLevel level, Crandor.Site s) throws CommandSyntaxException {
        StructureTemplateManager templates = server.getStructureManager();
        BlockPos at = spot(server, level, s);
        double ox = at.getX() - s.x, oz = at.getZ() - s.z, ol = Math.max(1, Math.hypot(ox, oz));
        ox /= ol;
        oz /= ol;

        captureDen(server, level, s, ox, oz);

        // The memorial, its front to the visitors (away from the den).
        Optional<StructureTemplate> found = templates.get(TEMPLATE);
        if (found.isEmpty()) {
            QuestModule.LOGGER.error("Crandor memorial: no template {}", TEMPLATE);
            return;
        }
        Rotation rotation;
        float yaw;
        String facing;
        if (Math.abs(oz) >= Math.abs(ox)) {
            rotation = oz > 0 ? Rotation.NONE : Rotation.CLOCKWISE_180;
            yaw = oz > 0 ? 0 : 180;
            facing = oz > 0 ? "south" : "north";
        } else {
            rotation = ox > 0 ? Rotation.COUNTERCLOCKWISE_90 : Rotation.CLOCKWISE_90;
            yaw = ox > 0 ? -90 : 90;
            facing = ox > 0 ? "east" : "west";
        }
        StructurePlaceSettings settings = new StructurePlaceSettings().setRotation(rotation).setRotationPivot(CENTRE).setIgnoreEntities(true);
        BlockPos origin = at.subtract(CENTRE);
        found.get().placeInWorld(level, origin, origin, settings, level.random, Block.UPDATE_ALL);
        BlockPos skull = origin.offset(StructureTemplate.calculateRelativePosition(settings, SKULL));
        BlockPos ned = origin.offset(StructureTemplate.calculateRelativePosition(settings, NED));
        BlockPos waystone = origin.offset(StructureTemplate.calculateRelativePosition(settings, WAYSTONE));

        skull(level, skull, yaw);

        // Ned, by his bench.
        UUID nedId = UUID.randomUUID();
        server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput().withPermission(4).withLevel(level),
                "easy_npc preset import data " + NED_PRESET + " " + (ned.getX() + 0.5) + " " + ned.getY() + " " + (ned.getZ() + 0.5) + " " + nedId);
        Entity nedEntity = level.getEntity(nedId);
        if (nedEntity != null) {
            nedEntity.setYRot(yaw);
            nedEntity.setYHeadRot(yaw);
            if (nedEntity instanceof Mob mob) mob.setYBodyRot(yaw);
        } else {
            QuestModule.LOGGER.warn("Crandor memorial: Ned wasn't imported ({})", NED_PRESET);
        }

        Waystones.place(level, waystone, "Crandor Memorial", facing, false);
        SafeZones.get(server).put(new SafeZones.Zone(ZONE, level.dimension().location().toString(), at.getX() - 9, at.getY() - 6, at.getZ() - 9,
                at.getX() + 9, at.getY() + 14, at.getZ() + 9, EnumSet.allOf(SafeZones.Flag.class)));
        s.mx = at.getX();
        s.my = at.getY();
        s.mz = at.getZ();
        QuestModule.LOGGER.info("Crandor memorial built at {} facing {} ({} blocks from the roost); Ned at {}", at.toShortString(), facing, (int) ol, ned.toShortString());
    }

    private CrandorMemorial() {
    }
}
