package net.lemursaucepacket.instances;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.mojang.brigadier.exceptions.CommandSyntaxException;

import net.minecraft.ChatFormatting;
import net.minecraft.Util;
import net.minecraft.core.BlockPos;
import net.minecraft.core.GlobalPos;
import net.minecraft.core.Vec3i;
import net.minecraft.core.registries.Registries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.TagParser;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.BossEvent;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * Lobbies and running instances. A host opens a co-op fight (a lobby) from an event's window and others join it from
 * the same window; a solo start is a lobby of one that begins at once. Each run gets a slot in the instance dimension
 * ({@link #DIMENSION}, empty, always noon), 2048 blocks apart: its arena template is placed there afresh, the event's
 * spawns are added, and the party is brought in. It ends when the bosses are dead and the loot time is up, when time
 * runs out, or when nobody is left; then everyone still inside goes back where they started and the slot is cleared.
 * Nothing about a run survives a restart except where to send people back ({@link InstanceData}).
 */
public final class InstanceManager {
    public static final ResourceKey<Level> DIMENSION = ResourceKey.create(Registries.DIMENSION, LspInstances.id("instances"));
    static final int SLOT_SPACING = 2048, BASE_Y = 64;
    /** How close to the event's NPC a window's buttons work, and how close a co-op member must be when it begins. */
    private static final int NEAR = 10, BEGIN_NEAR = 32;
    private static final int LOBBY_TICKS = 5 * 60 * 20;

    static final class Lobby {
        final UUID host;
        final ResourceLocation event;
        final List<UUID> members = new ArrayList<>();
        final long created;

        Lobby(UUID host, ResourceLocation event, long created) {
            this.host = host;
            this.event = event;
            this.created = created;
            members.add(host);
        }
    }

    static final class Session {
        final int id;
        final ResourceLocation event;
        final EventDef def;
        final int slot;
        final BlockPos origin, centre;
        final Vec3i size;
        final Set<UUID> members = new LinkedHashSet<>();
        /** Members in the arena and alive. */
        final Set<UUID> inside = new LinkedHashSet<>();
        final Map<UUID, GlobalPos> exits = new HashMap<>();
        final List<UUID> bosses = new ArrayList<>();
        final List<Vec3> bossSpawns = new ArrayList<>();
        String bossName = "";
        Vec3 spawn = Vec3.ZERO;
        /** Where the arena's {@code player_spawn} marker was, if it had one. */
        BlockPos marker;
        ServerBossEvent bar;
        long started, wonAt = -1;
        int warned;

        Session(int id, ResourceLocation event, EventDef def, int slot, BlockPos origin, Vec3i size) {
            this.id = id;
            this.event = event;
            this.def = def;
            this.slot = slot;
            this.origin = origin;
            this.size = size;
            this.centre = origin.offset(size.getX() / 2, 0, size.getZ() / 2);
        }

        boolean outside(Vec3 pos) {
            double dx = pos.x - (centre.getX() + 0.5), dz = pos.z - (centre.getZ() + 0.5);
            return dx * dx + dz * dz > (double) def.radius() * def.radius() || pos.y < origin.getY() - 24 || pos.y > origin.getY() + size.getY() + 96;
        }
    }

    private static final Map<UUID, Lobby> LOBBIES = new LinkedHashMap<>();
    private static final Map<Integer, Session> SESSIONS = new LinkedHashMap<>();
    private static int nextId = 1;

    // ---------------------------------------------------------------- lookups

    static Optional<Session> sessionInside(UUID player) {
        return SESSIONS.values().stream().filter(s -> s.inside.contains(player)).findFirst();
    }

    static Optional<Lobby> lobbyOf(UUID player) {
        return LOBBIES.values().stream().filter(l -> l.members.contains(player)).findFirst();
    }

    static Map<Integer, Session> sessions() {
        return SESSIONS;
    }

    static Map<UUID, Lobby> lobbies() {
        return LOBBIES;
    }

    /** The event an NPC opens: its {@code lsp_event.<namespace>.<name>} tag. */
    static Optional<ResourceLocation> eventOf(Entity npc) {
        for (String tag : npc.getTags()) {
            if (!tag.startsWith("lsp_event.")) continue;
            String rest = tag.substring("lsp_event.".length());
            int dot = rest.indexOf('.');
            if (dot <= 0) continue;
            ResourceLocation id = ResourceLocation.tryBuild(rest.substring(0, dot), rest.substring(dot + 1));
            if (id != null) return Optional.of(id);
        }
        return Optional.empty();
    }

    // ---------------------------------------------------------------- the window

    /** Opens (or refreshes) the event's window for this player, as if they'd spoken to {@code npc}. */
    static void open(ServerPlayer player, ResourceLocation event, Entity npc, int mode) {
        EventDef def = EventLoader.get(event);
        if (def == null) {
            player.sendSystemMessage(Component.literal("This event isn't set up (" + event + ").").withStyle(ChatFormatting.RED));
            return;
        }
        UUID me = player.getUUID();
        MinecraftServer server = player.server;
        List<InstanceNet.LobbyView> open = new ArrayList<>();
        Optional<InstanceNet.LobbyView> mine = Optional.empty();
        boolean hosting = false;
        for (Lobby l : LOBBIES.values()) {
            if (!l.event.equals(event)) continue;
            InstanceNet.LobbyView view = view(server, l, def);
            if (l.members.contains(me)) {
                mine = Optional.of(view);
                hosting = l.host.equals(me);
            } else if (l.members.size() < def.maxPlayers()) {
                open.add(view);
            }
        }
        boolean can = def.start().met(player);
        int kept = InstanceData.get(server).keptFor(me, event.toString()).size();
        PacketDistributor.sendToPlayer(player, new InstanceNet.Window(mode, event, npc == null ? -1 : npc.getId(), def.name(),
                def.description(), can, can ? "" : def.start().message(), open, mine, hosting, kept, def.keeper()));
    }

    private static InstanceNet.LobbyView view(MinecraftServer server, Lobby l, EventDef def) {
        List<String> names = l.members.stream().map(u -> name(server, u)).toList();
        return new InstanceNet.LobbyView(l.host, name(server, l.host), names, def.maxPlayers());
    }

    private static String name(MinecraftServer server, UUID uuid) {
        ServerPlayer p = server.getPlayerList().getPlayer(uuid);
        return p == null ? "?" : p.getGameProfile().getName();
    }

    /** Refreshes the window of everyone in a lobby (only where it's open). */
    private static void refresh(MinecraftServer server, Lobby lobby, Entity npc) {
        for (UUID u : lobby.members) {
            ServerPlayer p = server.getPlayerList().getPlayer(u);
            if (p != null) open(p, lobby.event, npc, InstanceNet.REFRESH);
        }
    }

    static void onAction(ServerPlayer player, InstanceNet.Action action) {
        EventDef def = EventLoader.get(action.event());
        Entity npc = player.serverLevel().getEntity(action.npc());
        if (def == null || npc == null || !eventOf(npc).map(action.event()::equals).orElse(false) || player.distanceToSqr(npc) > NEAR * NEAR) {
            PacketDistributor.sendToPlayer(player, InstanceNet.Window.close(action.event()));
            return;
        }
        MinecraftServer server = player.server;
        UUID me = player.getUUID();
        switch (action.action()) {
            case InstanceNet.SOLO -> {
                if (busy(player) || !allowed(player, def)) return;
                start(server, action.event(), def, List.of(player));
            }
            case InstanceNet.HOST -> {
                if (busy(player) || !allowed(player, def)) return;
                Lobby lobby = new Lobby(me, action.event(), server.getTickCount());
                LOBBIES.put(me, lobby);
                player.sendSystemMessage(Component.literal("You opened a co-op fight: " + def.name() + ". Others join it from this same window; press Begin when everyone is in.").withStyle(ChatFormatting.GOLD));
                open(player, action.event(), npc, InstanceNet.REFRESH);
            }
            case InstanceNet.JOIN -> {
                if (busy(player)) return;
                Lobby lobby = LOBBIES.get(action.target());
                if (lobby == null || !lobby.event.equals(action.event())) {
                    player.sendSystemMessage(Component.literal("That fight isn't open any more.").withStyle(ChatFormatting.RED));
                } else if (lobby.members.size() >= def.maxPlayers()) {
                    player.sendSystemMessage(Component.literal("That fight is full.").withStyle(ChatFormatting.RED));
                } else {
                    lobby.members.add(me);
                    tell(server, lobby.members, Component.literal(player.getGameProfile().getName() + " joined " + name(server, lobby.host) + "'s fight ("
                            + lobby.members.size() + "/" + def.maxPlayers() + ").").withStyle(ChatFormatting.GOLD));
                    refresh(server, lobby, npc);
                    return;
                }
                open(player, action.event(), npc, InstanceNet.REFRESH);
            }
            case InstanceNet.LEAVE -> lobbyOf(me).ifPresent(lobby -> {
                if (lobby.host.equals(me)) {
                    LOBBIES.remove(me);
                    tell(server, lobby.members, Component.literal(player.getGameProfile().getName() + " called off the co-op fight.").withStyle(ChatFormatting.GRAY));
                    for (UUID u : lobby.members) {
                        ServerPlayer p = server.getPlayerList().getPlayer(u);
                        if (p != null) open(p, lobby.event, npc, InstanceNet.REFRESH);
                    }
                } else {
                    lobby.members.remove(me);
                    tell(server, lobby.members, Component.literal(player.getGameProfile().getName() + " left the co-op fight.").withStyle(ChatFormatting.GRAY));
                    refresh(server, lobby, npc);
                    open(player, lobby.event, npc, InstanceNet.REFRESH);
                }
            });
            case InstanceNet.BEGIN -> {
                Lobby lobby = LOBBIES.get(me);
                if (lobby == null) return;
                LOBBIES.remove(me);
                List<ServerPlayer> party = new ArrayList<>();
                for (UUID u : lobby.members) {
                    ServerPlayer p = server.getPlayerList().getPlayer(u);
                    if (p == null) continue;
                    if (p.level() != npc.level() || p.distanceToSqr(npc) > BEGIN_NEAR * BEGIN_NEAR || sessionInside(u).isPresent()) {
                        p.sendSystemMessage(Component.literal("The fight began without you: you were too far away.").withStyle(ChatFormatting.GRAY));
                        PacketDistributor.sendToPlayer(p, InstanceNet.Window.close(lobby.event));
                        continue;
                    }
                    party.add(p);
                }
                start(server, lobby.event, def, party);
            }
            case InstanceNet.RECLAIM -> reclaim(player, action.event(), def);
            default -> {
            }
        }
    }

    private static boolean busy(ServerPlayer player) {
        if (sessionInside(player.getUUID()).isPresent()) return true;
        if (lobbyOf(player.getUUID()).isPresent()) {
            player.sendSystemMessage(Component.literal("You're already in a co-op fight. Leave it first.").withStyle(ChatFormatting.RED));
            return true;
        }
        return false;
    }

    private static boolean allowed(ServerPlayer player, EventDef def) {
        if (def.start().met(player)) return true;
        player.sendSystemMessage(Component.literal(def.start().message().isEmpty() ? "You can't start this." : def.start().message()).withStyle(ChatFormatting.RED));
        return false;
    }

    private static void tell(MinecraftServer server, Iterable<UUID> who, Component message) {
        for (UUID u : who) {
            ServerPlayer p = server.getPlayerList().getPlayer(u);
            if (p != null) p.sendSystemMessage(message);
        }
    }

    // ---------------------------------------------------------------- running

    /** Starts a run for these players (admins: /instances start). Returns the session, or empty if it couldn't. */
    static Optional<Session> start(MinecraftServer server, ResourceLocation event, EventDef def, List<ServerPlayer> party) {
        ServerLevel level = server.getLevel(DIMENSION);
        Optional<StructureTemplate> found = server.getStructureManager().get(def.arena());
        if (level == null || found.isEmpty() || party.isEmpty()) {
            for (ServerPlayer p : party) {
                p.sendSystemMessage(Component.literal("The way to " + def.name() + " isn't ready yet. Try again later.").withStyle(ChatFormatting.RED));
                PacketDistributor.sendToPlayer(p, InstanceNet.Window.close(event));
            }
            LspInstances.LOGGER.warn("Can't start {}: {}", event, level == null ? "no instance dimension" : found.isEmpty() ? "no arena template " + def.arena() : "nobody to start it");
            return Optional.empty();
        }
        StructureTemplate template = found.get();
        int slot = 0;
        while (slotTaken(slot)) slot++;
        BlockPos origin = new BlockPos(slot * SLOT_SPACING, BASE_Y, 0);
        Session s = new Session(nextId++, event, def, slot, origin, template.getSize());
        long began = Util.getMillis();
        prepare(level, s, template);
        LspInstances.LOGGER.info("Run {} of {} in slot {} for {}: arena ready in {} ms", s.id, event, slot,
                party.stream().map(p -> p.getGameProfile().getName()).toList(), Util.getMillis() - began);

        for (EventDef.Spawn spawn : def.spawns()) {
            Vec3 at = place(level, s, spawn.at());
            String nbt = spawn.nbt().replace("{x}", Integer.toString((int) Math.floor(at.x))).replace("{y}", Integer.toString((int) Math.floor(at.y)))
                    .replace("{z}", Integer.toString((int) Math.floor(at.z))).replace("{ground}", Integer.toString(ground(level, at)));
            Entity entity;
            try {
                CompoundTag tag = TagParser.parseTag(nbt);
                entity = EntityType.loadEntityRecursive(tag, level, e -> {
                    e.moveTo(at.x, at.y, at.z, level.random.nextFloat() * 360F, 0F);
                    return e;
                });
            } catch (CommandSyntaxException e) {
                LspInstances.LOGGER.error("Event {}: bad spawn NBT {}", event, nbt, e);
                continue;
            }
            if (entity == null) {
                LspInstances.LOGGER.error("Event {}: couldn't make {}", event, nbt);
                continue;
            }
            // Mobs whose max health comes from their NBT (an aged dragon) start on the base health: top them up.
            if (spawn.fullHealth() && entity instanceof LivingEntity living) living.setHealth(living.getMaxHealth());
            if (!level.tryAddFreshEntityWithPassengers(entity)) continue;
            if (spawn.boss()) {
                s.bosses.add(entity.getUUID());
                s.bossSpawns.add(at);
                if (s.bossName.isEmpty()) s.bossName = entity.getDisplayName().getString();
            }
        }
        if (!s.bosses.isEmpty()) {
            s.bar = new ServerBossEvent(Component.literal(s.bossName).withStyle(ChatFormatting.RED), BossEvent.BossBarColor.RED, BossEvent.BossBarOverlay.NOTCHED_10);
        }

        // A player_spawn marker in the arena beats the event's offset; then they face the middle of the arena.
        s.spawn = s.marker != null ? Vec3.atBottomCenterOf(s.marker) : place(level, s, def.playerSpawn());
        float yaw = s.marker == null ? def.playerYaw()
                : (float) Math.toDegrees(Math.atan2(-(s.centre.getX() + 0.5 - s.spawn.x), s.centre.getZ() + 0.5 - s.spawn.z));
        InstanceData data = InstanceData.get(server);
        int i = 0;
        for (ServerPlayer p : party) {
            GlobalPos back = GlobalPos.of(p.level().dimension(), p.blockPosition());
            s.exits.put(p.getUUID(), back);
            data.returns.put(p.getUUID(), back);
            s.members.add(p.getUUID());
            s.inside.add(p.getUUID());
            PacketDistributor.sendToPlayer(p, InstanceNet.Window.close(event));
            // Side by side, a step apart.
            double off = (i % 2 == 0 ? 1 : -1) * ((i + 1) / 2);
            double side = Math.toRadians(yaw);
            double px = s.spawn.x + Math.cos(side) * off, pz = s.spawn.z + Math.sin(side) * off;
            double py = ground(level, new Vec3(px, s.spawn.y, pz));
            p.teleportTo(level, px, py, pz, yaw, 0F);
            if (s.bar != null) s.bar.addPlayer(p);
            p.sendSystemMessage(Component.literal(def.name() + (party.size() > 1 ? ": your party of " + party.size() + " is in." : ": you're in.")).withStyle(ChatFormatting.GOLD, ChatFormatting.BOLD));
            p.playNotifySound(SoundEvents.ENDER_DRAGON_GROWL, SoundSource.HOSTILE, 0.8F, 0.9F);
            i++;
        }
        data.setDirty();
        s.started = server.getTickCount();
        SESSIONS.put(s.id, s);
        return Optional.of(s);
    }

    private static boolean slotTaken(int slot) {
        return SESSIONS.values().stream().anyMatch(s -> s.slot == slot);
    }

    /** Keeps the slot's chunks loaded, clears what a last run left, and places the arena afresh. */
    private static void prepare(ServerLevel level, Session s, StructureTemplate template) {
        forEachChunk(s, (cx, cz) -> level.setChunkForced(cx, cz, true));
        InstanceData data = InstanceData.get(level.getServer());
        String was = data.slotArena.get(s.slot);
        String now = s.def.arena() + "|" + s.size.getX() + "|" + s.size.getY() + "|" + s.size.getZ();
        if (was != null && !was.equals(now)) {
            // A different arena was here: clear its whole box first.
            String[] parts = was.split("\\|");
            if (parts.length == 4) {
                BlockPos end = s.origin.offset(Integer.parseInt(parts[1]) - 1, Integer.parseInt(parts[2]) - 1, Integer.parseInt(parts[3]) - 1);
                for (BlockPos pos : BlockPos.betweenClosed(s.origin, end)) level.setBlock(pos, Blocks.AIR.defaultBlockState(), Block.UPDATE_CLIENTS | Block.UPDATE_KNOWN_SHAPE);
            }
        }
        clearEntities(level, s);
        StructurePlaceSettings settings = new StructurePlaceSettings().setIgnoreEntities(true);
        if (s.def.stripContainers()) settings.addProcessor(StripContainers.INSTANCE);
        if (!s.def.replace().isEmpty()) settings.addProcessor(ArenaReplace.of(s.def.replace(), s.centre));
        template.placeInWorld(level, s.origin, s.origin, settings, level.random, Block.UPDATE_CLIENTS | Block.UPDATE_KNOWN_SHAPE);
        // Data markers (structure blocks in DATA mode) name places in the arena; they go once read.
        for (StructureTemplate.StructureBlockInfo info : template.filterBlocks(s.origin, settings, Blocks.STRUCTURE_BLOCK)) {
            if (info.nbt() == null || !"DATA".equals(info.nbt().getString("mode"))) continue;
            if ("player_spawn".equals(info.nbt().getString("metadata"))) s.marker = info.pos();
            level.setBlock(info.pos(), Blocks.AIR.defaultBlockState(), Block.UPDATE_CLIENTS);
        }
        data.slotArena.put(s.slot, now);
        data.setDirty();
    }

    private static void forEachChunk(Session s, java.util.function.BiConsumer<Integer, Integer> action) {
        int minX = (s.origin.getX() - 32) >> 4, maxX = (s.origin.getX() + s.size.getX() + 32) >> 4;
        int minZ = (s.origin.getZ() - 32) >> 4, maxZ = (s.origin.getZ() + s.size.getZ() + 32) >> 4;
        for (int cx = minX; cx <= maxX; cx++) {
            for (int cz = minZ; cz <= maxZ; cz++) action.accept(cx, cz);
        }
    }

    private static void clearEntities(ServerLevel level, Session s) {
        AABB box = new AABB(s.origin.getX() - 64, level.getMinBuildHeight(), s.origin.getZ() - 64,
                s.origin.getX() + s.size.getX() + 64, level.getMaxBuildHeight(), s.origin.getZ() + s.size.getZ() + 64);
        for (Entity e : level.getEntities((Entity) null, box, e -> !(e instanceof Player))) e.discard();
    }

    /** A place in the arena: its x and z from the centre, standing on the ground there plus {@code dy}. */
    private static Vec3 place(ServerLevel level, Session s, EventDef.Spot spot) {
        double x = s.centre.getX() + spot.x() + 0.5, z = s.centre.getZ() + spot.z() + 0.5;
        return new Vec3(x, ground(level, new Vec3(x, 0, z)) + spot.dy(), z);
    }

    private static int ground(ServerLevel level, Vec3 at) {
        int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, (int) Math.floor(at.x), (int) Math.floor(at.z));
        return y <= level.getMinBuildHeight() ? BASE_Y + 1 : y;
    }

    /** Every half second: bosses, the clock, strays. */
    static void tick(MinecraftServer server) {
        if (SESSIONS.isEmpty() && LOBBIES.isEmpty()) return;
        long now = server.getTickCount();
        LOBBIES.values().removeIf(l -> {
            ServerPlayer host = server.getPlayerList().getPlayer(l.host);
            l.members.removeIf(u -> server.getPlayerList().getPlayer(u) == null);
            if (host == null || now - l.created > LOBBY_TICKS) {
                tell(server, l.members, Component.literal("The co-op fight wasn't started in time and has been called off.").withStyle(ChatFormatting.GRAY));
                return true;
            }
            return false;
        });
        ServerLevel level = server.getLevel(DIMENSION);
        if (level == null) return;
        for (Session s : List.copyOf(SESSIONS.values())) {
            s.inside.removeIf(u -> {
                ServerPlayer p = server.getPlayerList().getPlayer(u);
                return p == null || p.level().dimension() != DIMENSION || !p.isAlive();
            });
            for (UUID u : s.inside) {
                ServerPlayer p = server.getPlayerList().getPlayer(u);
                if (p != null && s.outside(p.position())) {
                    p.teleportTo(level, s.spawn.x, s.spawn.y, s.spawn.z, p.getYRot(), 0F);
                    p.sendSystemMessage(Component.literal("There's no way off the isle but back the way you came.").withStyle(ChatFormatting.GRAY));
                }
            }
            float health = 0, max = 0;
            for (int i = 0; i < s.bosses.size(); i++) {
                Entity e = level.getEntity(s.bosses.get(i));
                if (!(e instanceof LivingEntity boss) || !boss.isAlive() || boss.getHealth() <= 0) continue;
                health += boss.getHealth();
                max += boss.getMaxHealth();
                if (s.outside(boss.position())) {
                    Vec3 home = s.bossSpawns.get(i);
                    boss.teleportTo(home.x, home.y, home.z);
                }
            }
            if (s.bar != null) {
                s.bar.setProgress(max > 0 ? Math.clamp(health / max, 0F, 1F) : 0F);
                for (ServerPlayer p : List.copyOf(s.bar.getPlayers())) if (!s.inside.contains(p.getUUID())) s.bar.removePlayer(p);
            }
            if (!s.bosses.isEmpty() && max == 0 && s.wonAt < 0) {
                s.wonAt = now;
                tell(server, s.inside, Component.literal(s.bossName + " is slain! You have " + s.def.lootTime() + " seconds before you're taken back.").withStyle(ChatFormatting.GOLD, ChatFormatting.BOLD));
                for (UUID u : s.inside) {
                    ServerPlayer p = server.getPlayerList().getPlayer(u);
                    if (p != null) p.playNotifySound(SoundEvents.UI_TOAST_CHALLENGE_COMPLETE, SoundSource.PLAYERS, 1F, 1F);
                }
            }
            if (s.inside.isEmpty()) {
                end(server, s, null);
            } else if (s.wonAt >= 0 && now - s.wonAt >= s.def.lootTime() * 20L) {
                end(server, s, "Time to go: you're taken back.");
            } else if (now - s.started >= s.def.timeLimit() * 20L) {
                end(server, s, "Time's up: you're taken back.");
            } else if (s.wonAt < 0) {
                long left = s.def.timeLimit() * 20L - (now - s.started);
                int stage = left <= 60 * 20 ? 2 : left <= 5 * 60 * 20 ? 1 : 0;
                if (stage > s.warned) {
                    s.warned = stage;
                    tell(server, s.inside, Component.literal((stage == 2 ? "One minute" : "Five minutes") + " left in " + s.def.name() + ".").withStyle(ChatFormatting.YELLOW));
                }
            }
        }
    }

    /** Sends everyone still inside back where they came from and clears the slot. */
    static void end(MinecraftServer server, Session s, String message) {
        SESSIONS.remove(s.id);
        InstanceData data = InstanceData.get(server);
        for (UUID u : List.copyOf(s.inside)) {
            ServerPlayer p = server.getPlayerList().getPlayer(u);
            if (p == null) continue;
            if (message != null) p.sendSystemMessage(Component.literal(message).withStyle(ChatFormatting.GRAY));
            sendBack(server, p, s.exits.getOrDefault(u, data.returns.get(u)));
            data.returns.remove(u);
        }
        s.inside.clear();
        if (s.bar != null) s.bar.removeAllPlayers();
        ServerLevel level = server.getLevel(DIMENSION);
        if (level != null) {
            clearEntities(level, s);
            forEachChunk(s, (cx, cz) -> level.setChunkForced(cx, cz, false));
        }
        data.setDirty();
        LspInstances.LOGGER.info("Run {} of {} ended{}", s.id, s.event, message == null ? " (nobody left)" : ": " + message);
    }

    static void sendBack(MinecraftServer server, ServerPlayer p, GlobalPos to) {
        ServerLevel level = to == null ? null : server.getLevel(to.dimension());
        if (level == null) {
            level = server.overworld();
            BlockPos spawn = level.getSharedSpawnPos();
            p.teleportTo(level, spawn.getX() + 0.5, level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, spawn.getX(), spawn.getZ()), spawn.getZ() + 0.5, p.getYRot(), 0F);
            return;
        }
        p.teleportTo(level, to.pos().getX() + 0.5, to.pos().getY(), to.pos().getZ() + 0.5, p.getYRot(), 0F);
    }

    /** /instance leave: back out the way you came. */
    static boolean leave(ServerPlayer p) {
        Optional<Session> s = sessionInside(p.getUUID());
        if (s.isEmpty()) return false;
        s.get().inside.remove(p.getUUID());
        InstanceData data = InstanceData.get(p.server);
        sendBack(p.server, p, s.get().exits.getOrDefault(p.getUUID(), data.returns.get(p.getUUID())));
        data.returns.remove(p.getUUID());
        data.setDirty();
        if (s.get().bar != null) s.get().bar.removePlayer(p);
        return true;
    }

    // ---------------------------------------------------------------- the keeper

    /** Gives these stacks to the keeper of the event the player is fighting in. False if there's none to give them to. */
    static boolean keep(ServerPlayer player, List<ItemStack> stacks) {
        Optional<Session> s = sessionInside(player.getUUID());
        if (s.isEmpty() || s.get().def.keeper().isEmpty()) return false;
        List<ItemStack> real = stacks.stream().filter(st -> !st.isEmpty()).map(ItemStack::copy).toList();
        InstanceData.get(player.server).keep(player.getUUID(), s.get().event.toString(), real);
        return true;
    }

    static Optional<Session> keeperFor(ServerPlayer player) {
        return sessionInside(player.getUUID()).filter(s -> !s.def.keeper().isEmpty());
    }

    /** Hands back what the keeper holds: armour onto empty armour slots, the rest into the inventory, the remainder kept. */
    static void reclaim(ServerPlayer player, ResourceLocation event, EventDef def) {
        InstanceData data = InstanceData.get(player.server);
        List<ItemStack> held = data.keptFor(player.getUUID(), event.toString());
        String keeper = def.keeper().isEmpty() ? "The keeper" : def.keeper();
        if (held.isEmpty()) {
            player.sendSystemMessage(Component.literal(keeper + " has nothing of yours.").withStyle(ChatFormatting.GRAY));
            return;
        }
        List<ItemStack> left = new ArrayList<>();
        int given = 0;
        for (ItemStack stack : held) {
            ItemStack s = stack.copy();
            EquipmentSlot slot = player.getEquipmentSlotForItem(s);
            if (slot.getType() == EquipmentSlot.Type.HUMANOID_ARMOR && player.getItemBySlot(slot).isEmpty()) {
                player.setItemSlot(slot, s);
                given++;
                continue;
            }
            player.getInventory().add(s);
            if (s.isEmpty()) given++;
            else left.add(s);
        }
        data.setKept(player.getUUID(), event.toString(), left);
        player.sendSystemMessage(Component.literal(keeper + " hands back your things" + (left.isEmpty() ? "." : ". He keeps the rest (" + left.size()
                + (left.size() == 1 ? " stack" : " stacks") + ") until you have room.")).withStyle(ChatFormatting.GOLD));
        if (given > 0) player.playNotifySound(SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 0.8F, 1F);
        player.containerMenu.broadcastChanges();
        PacketDistributor.sendToPlayer(player, InstanceNet.Window.close(event));
    }

    /** On a restart nothing is running: drop the old forced chunks. */
    static void serverStarted(MinecraftServer server) {
        SESSIONS.clear();
        LOBBIES.clear();
        ServerLevel level = server.getLevel(DIMENSION);
        if (level == null) {
            LspInstances.LOGGER.error("The instance dimension {} is missing: events can't run", DIMENSION.location());
            return;
        }
        for (long chunk : List.copyOf(level.getForcedChunks())) level.setChunkForced(net.minecraft.world.level.ChunkPos.getX(chunk), net.minecraft.world.level.ChunkPos.getZ(chunk), false);
    }

    private InstanceManager() {
    }
}
