package net.lemursaucepacket.fixes.hub;

import java.nio.file.Files;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;

import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.core.BlockPos;
import net.minecraft.core.GlobalPos;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.LodestoneTracker;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.RandomState;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

/**
 * The capital (docs/world.md): on a brand-new world the server builds it from config/lemursaucepacket/hub_plan.json
 * as soon as it starts, a short way from world spawn, and remembers that it did. Newcomers get a compass that points
 * to it. An existing world is never touched: it is marked SKIPPED the first time this version runs. Ops can build one
 * anyway with {@code /lsp hub build}.
 */
public final class HubModule {
    /** A world younger than this (in ticks) when the server starts counts as brand new. */
    private static final long NEW_WORLD_TICKS = 1200;
    /** Set on a player once they've had the compass, so they get it once. */
    public static final String COMPASS_TAG = "lsp_capital_compass";
    /** Set when a player first walks into the capital (the welcome questline's first step). */
    public static final String FOUND_TAG = "q_lemurton_found";
    private static HubBuilder running;
    private static HubPlan cachedPlan;

    private HubModule() {
    }

    public static void init() {
        NeoForge.EVENT_BUS.addListener(HubModule::onStarted);
        NeoForge.EVENT_BUS.addListener(HubModule::onTick);
        NeoForge.EVENT_BUS.addListener(HubModule::onLogin);
        NeoForge.EVENT_BUS.addListener(HubModule::onCommands);
    }

    private static void onStarted(ServerStartedEvent event) {
        MinecraftServer server = event.getServer();
        running = null;
        cachedPlan = null;
        HubState state = HubState.get(server);
        if (state.status() != HubState.Status.UNDECIDED && state.status() != HubState.Status.BUILDING) return;
        if (!Files.isRegularFile(HubPlan.file())) return;
        long age = server.overworld().getGameTime();
        if (state.status() == HubState.Status.UNDECIDED && age > NEW_WORLD_TICKS) {
            state.set(HubState.Status.SKIPPED, BlockPos.ZERO, 0);
            HubBuilder.LOGGER.info("This world existed before the capital did ({} ticks old): not building one. /lsp hub build makes one by hand.", age);
            return;
        }
        // A brand-new world (nobody has spawned yet): keep world spawn out of the towns it will generate.
        if (state.status() == HubState.Status.UNDECIDED) keepSpawnOutOfTowns(server.overworld());
        // A brand-new world, or a build that was interrupted by a restart: (re)build.
        start(server, null);
    }

    /**
     * Moves world spawn if a village or capital will generate on it: to the nearest dry spot (worked out from the
     * noise) clear of every planned town.
     */
    private static void keepSpawnOutOfTowns(ServerLevel level) {
        BlockPos spawn = level.getSharedSpawnPos();
        List<Settlements.Site> towns = Settlements.near(level, spawn.getX(), spawn.getZ(), 1600);
        if (clearOf(towns, spawn.getX(), spawn.getZ())) return;
        ChunkGenerator gen = level.getChunkSource().getGenerator();
        RandomState rs = level.getChunkSource().randomState();
        int sea = gen.getSeaLevel();
        for (int r = 160; r <= 1200; r += 80)
            for (int k = 0; k < 16; k++) {
                double a = 2 * Math.PI * k / 16 + r * 0.01;
                int x = spawn.getX() + (int) Math.round(Math.cos(a) * r);
                int z = spawn.getZ() + (int) Math.round(Math.sin(a) * r);
                if (!clearOf(towns, x, z)) continue;
                int floor = gen.getBaseHeight(x, z, Heightmap.Types.OCEAN_FLOOR_WG, level, rs);
                int top = gen.getBaseHeight(x, z, Heightmap.Types.WORLD_SURFACE_WG, level, rs);
                if (top > floor + 1 || floor < sea + 1) continue; // under water
                level.setDefaultSpawnPos(new BlockPos(x, floor + 1, z), 0.0F);
                HubBuilder.LOGGER.info("World spawn was in a town; moved {} blocks to {} {} {}", r, x, floor + 1, z);
                return;
            }
        HubBuilder.LOGGER.warn("World spawn is in a town and no clear dry spot turned up within 1200 blocks; leaving it");
    }

    private static boolean clearOf(List<Settlements.Site> towns, int x, int z) {
        return towns.stream().allMatch(t -> t.distance(x, z) >= Settlements.keepAway(t));
    }

    private static boolean start(MinecraftServer server, BlockPos at) {
        try {
            running = new HubBuilder(server, HubPlan.read(), at);
            HubBuilder.LOGGER.info("Building the capital{}", at == null ? " near world spawn" : " at " + at.toShortString());
            return true;
        } catch (Exception e) {
            HubBuilder.LOGGER.error("Can't read {}", HubPlan.file(), e);
            return false;
        }
    }

    private static void onTick(ServerTickEvent.Post event) {
        if (running != null && running.tick()) running = null;
    }

    private static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (!(event.getEntity() instanceof ServerPlayer p)) return;
        if (running != null) {
            p.sendSystemMessage(Component.literal("§6The capital is being raised nearby §7(" + running.status() + "). You'll get a compass to it when it's ready."));
            return;
        }
        HubState s = HubState.get(p.server);
        HubPlan plan = plan();
        if (s.status() == HubState.Status.BUILT && plan != null) welcome(p, plan, s.centre());
    }

    private static HubPlan plan() {
        if (cachedPlan == null && Files.isRegularFile(HubPlan.file())) {
            try {
                cachedPlan = HubPlan.read();
            } catch (Exception e) {
                HubBuilder.LOGGER.error("Can't read {}", HubPlan.file(), e);
            }
        }
        return cachedPlan;
    }

    /** Under the waystone, below the paving: what the compass points at. */
    static BlockPos lodestone(HubPlan plan, BlockPos centre) {
        return centre.offset(plan.waystone().x(), -1, plan.waystone().z());
    }

    /** Where travellers come in (the south edge of the market). */
    static BlockPos arrival(HubPlan plan, BlockPos centre) {
        int[] a = plan.arrival();
        return centre.offset(a[0], a[1], a[2]);
    }

    /** A newcomer's compass to the capital and directions, once per player. */
    static void welcome(ServerPlayer p, HubPlan plan, BlockPos centre) {
        if (p.getTags().contains(COMPASS_TAG)) return;
        giveCompass(p, plan, centre);
        p.addTag(COMPASS_TAG);
        BlockPos to = arrival(plan, centre);
        int dx = to.getX() - p.getBlockX();
        int dz = to.getZ() - p.getBlockZ();
        int dist = (int) (Math.round(Math.hypot(dx, dz) / 10.0) * 10);
        p.sendSystemMessage(Component.literal("§6" + plan.name() + "§7, the capital, lies about §f" + dist + " blocks §7to the §f" + direction(dx, dz) + "§7. The compass points the way."));
    }

    private static void giveCompass(ServerPlayer p, HubPlan plan, BlockPos centre) {
        ItemStack compass = new ItemStack(Items.COMPASS);
        compass.set(DataComponents.LODESTONE_TRACKER, new LodestoneTracker(Optional.of(GlobalPos.of(Level.OVERWORLD, lodestone(plan, centre))), true));
        compass.set(DataComponents.CUSTOM_NAME, Component.literal("Compass to " + plan.name()).withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GOLD)));
        compass.set(DataComponents.LORE, new ItemLore(List.of(Component.literal("Points the way to the capital.").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GRAY)))));
        if (!p.getInventory().add(compass)) p.drop(compass, false);
    }

    /** North is -z. */
    static String direction(int dx, int dz) {
        String[] names = {"east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"};
        double a = Math.toDegrees(Math.atan2(dz, dx));
        return names[(int) Math.floorMod(Math.round(a / 45.0), 8)];
    }

    /** The capital's name if the player stands inside its walls (its safe zone), else null. */
    public static String capitalAt(ServerPlayer p) {
        HubState s = HubState.get(p.server);
        HubPlan plan = plan();
        if (s.status() != HubState.Status.BUILT || plan == null || p.level().dimension() != Level.OVERWORLD) return null;
        HubPlan.Zone z = plan.zone();
        int x = p.getBlockX() - s.centre().getX();
        int zz = p.getBlockZ() - s.centre().getZ();
        return x >= Math.min(z.x1(), z.x2()) && x <= Math.max(z.x1(), z.x2()) && zz >= Math.min(z.z1(), z.z2()) && zz <= Math.max(z.z1(), z.z2()) ? plan.name() : null;
    }

    /** First steps into the capital complete the welcome questline's first quest. */
    public static void arrived(ServerPlayer p) {
        p.addTag(FOUND_TAG);
    }

    private static void onCommands(RegisterCommandsEvent event) {
        CommandDispatcher<CommandSourceStack> d = event.getDispatcher();
        d.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("hub")
                        .then(Commands.literal("status").executes(HubModule::status))
                        .then(Commands.literal("goto").executes(ctx -> travel(ctx, List.of(ctx.getSource().getPlayerOrException())))
                                .then(Commands.argument("players", EntityArgument.players()).executes(ctx -> travel(ctx, EntityArgument.getPlayers(ctx, "players")))))
                        .then(Commands.literal("compass").executes(ctx -> compass(ctx, List.of(ctx.getSource().getPlayerOrException())))
                                .then(Commands.argument("players", EntityArgument.players()).executes(ctx -> compass(ctx, EntityArgument.getPlayers(ctx, "players")))))
                        .then(Commands.literal("build")
                                .then(Commands.literal("here").executes(ctx -> build(ctx, true)))
                                .then(Commands.literal("near_spawn").executes(ctx -> build(ctx, false))))));
    }

    private static int status(CommandContext<CommandSourceStack> ctx) {
        HubState s = HubState.get(ctx.getSource().getServer());
        String now = running != null ? "building: " + running.status() : s.status().name().toLowerCase() + (s.status() == HubState.Status.BUILT ? " at " + s.centre().toShortString() : "");
        ctx.getSource().sendSuccess(() -> Component.literal("Capital: " + now), false);
        return 1;
    }

    /** Takes players to the capital's arrival point. */
    private static int travel(CommandContext<CommandSourceStack> ctx, Collection<ServerPlayer> players) throws CommandSyntaxException {
        HubState s = HubState.get(ctx.getSource().getServer());
        HubPlan plan = plan();
        if (s.status() != HubState.Status.BUILT || plan == null) {
            ctx.getSource().sendFailure(Component.literal("There's no capital in this world yet."));
            return 0;
        }
        BlockPos to = arrival(plan, s.centre());
        for (ServerPlayer p : players) p.teleportTo(ctx.getSource().getServer().overworld(), to.getX() + 0.5, to.getY(), to.getZ() + 0.5, 180.0F, 0.0F);
        ctx.getSource().sendSuccess(() -> Component.literal("Sent " + players.size() + " to " + plan.name()), true);
        return players.size();
    }

    /** A replacement compass (it's only handed out once on its own). */
    private static int compass(CommandContext<CommandSourceStack> ctx, Collection<ServerPlayer> players) {
        HubState s = HubState.get(ctx.getSource().getServer());
        HubPlan plan = plan();
        if (s.status() != HubState.Status.BUILT || plan == null) {
            ctx.getSource().sendFailure(Component.literal("There's no capital in this world yet."));
            return 0;
        }
        for (ServerPlayer p : players) giveCompass(p, plan, s.centre());
        ctx.getSource().sendSuccess(() -> Component.literal("Gave " + players.size() + " a compass to " + plan.name()), true);
        return players.size();
    }

    private static int build(CommandContext<CommandSourceStack> ctx, boolean here) {
        if (running != null) {
            ctx.getSource().sendFailure(Component.literal("Already building: " + running.status()));
            return 0;
        }
        BlockPos at = here ? BlockPos.containing(ctx.getSource().getPosition()) : null;
        boolean ok = start(ctx.getSource().getServer(), at);
        ctx.getSource().sendSuccess(() -> Component.literal(ok ? "Building the capital" + (here ? " here" : " near world spawn") + ". It takes a minute or two." : "Couldn't read the city plan (see the log)."), true);
        return ok ? 1 : 0;
    }
}
