package net.lemursaucepacket.fixes.towns;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;

import net.lemursaucepacket.fixes.hub.HubModule;
import net.lemursaucepacket.fixes.hub.Settlements;
import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitlesAnimationPacket;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.tags.StructureTags;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.structure.StructureStart;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Names on the map: walking into a town shows its name as a title, like entering an area in RuneScape. The capital
 * is Lemurton; the grand capitals and villages the world generates get names of their own (see {@link TownNames}).
 */
public final class TownModule {
    private static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/towns");
    /** Where each player was at the last check ("" outside any town), and when each place was last announced. */
    private static final Map<UUID, String> where = new HashMap<>();
    private static final Map<String, Long> announced = new HashMap<>();
    /** A place isn't announced to the same player again within this many ticks (walking along its edge). */
    private static final long QUIET_TICKS = 20 * 120;

    private TownModule() {
    }

    public static void init() {
        NeoForge.EVENT_BUS.addListener(TownModule::onTick);
        NeoForge.EVENT_BUS.addListener((PlayerEvent.PlayerLoggedOutEvent e) -> where.remove(e.getEntity().getUUID()));
        NeoForge.EVENT_BUS.addListener(TownModule::onCommands);
    }

    /** For admins (and tests): the towns the world will generate near you, and a way to visit one. */
    private static void onCommands(RegisterCommandsEvent event) {
        event.getDispatcher().register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("towns")
                        .then(Commands.literal("list").executes(TownModule::list))
                        .then(Commands.literal("goto").then(Commands.argument("n", IntegerArgumentType.integer(1)).executes(TownModule::visit)))));
    }

    private static List<Settlements.Site> nearby(CommandSourceStack src) {
        BlockPos at = BlockPos.containing(src.getPosition());
        List<Settlements.Site> towns = new java.util.ArrayList<>(Settlements.near(src.getServer().overworld(), at.getX(), at.getZ(), 3000));
        towns.sort(Comparator.comparingDouble(t -> t.distance(at.getX(), at.getZ())));
        return towns;
    }

    private static int list(CommandContext<CommandSourceStack> ctx) {
        BlockPos at = BlockPos.containing(ctx.getSource().getPosition());
        List<Settlements.Site> towns = nearby(ctx.getSource());
        StringBuilder out = new StringBuilder(towns.size() + " towns within 3000 blocks:");
        for (int i = 0; i < Math.min(20, towns.size()); i++) {
            Settlements.Site t = towns.get(i);
            String name = TownNames.get(ctx.getSource().getServer()).known("minecraft:overworld@" + (t.x() >> 4) + "," + (t.z() >> 4));
            out.append('\n').append(i + 1).append(". ").append(t.capital() ? "capital " : "village ").append(t.structure()).append(" at ").append(t.x()).append(" ").append(t.z())
                    .append(" (").append((int) t.distance(at.getX(), at.getZ())).append(" blocks)").append(name != null ? ": " + name : "");
        }
        ctx.getSource().sendSuccess(() -> Component.literal(out.toString()), false);
        return towns.size();
    }

    private static int visit(CommandContext<CommandSourceStack> ctx) throws CommandSyntaxException {
        ServerPlayer p = ctx.getSource().getPlayerOrException();
        List<Settlements.Site> towns = nearby(ctx.getSource());
        int n = IntegerArgumentType.getInteger(ctx, "n");
        if (n > towns.size()) {
            ctx.getSource().sendFailure(Component.literal("Only " + towns.size() + " towns nearby"));
            return 0;
        }
        Settlements.Site t = towns.get(n - 1);
        ServerLevel level = ctx.getSource().getServer().overworld();
        int y = level.getChunkSource().getGenerator().getBaseHeight(t.x(), t.z(), Heightmap.Types.WORLD_SURFACE_WG, level, level.getChunkSource().randomState());
        p.teleportTo(level, t.x() + 0.5, y + 2, t.z() + 0.5, p.getYRot(), p.getXRot());
        ctx.getSource().sendSuccess(() -> Component.literal("Sent you to " + t.structure() + " at " + t.x() + " " + (y + 2) + " " + t.z()), true);
        return 1;
    }

    private record Place(String key, String name, String subtitle, boolean capital) {
    }

    private static void onTick(ServerTickEvent.Post event) {
        MinecraftServer server = event.getServer();
        if (server.getTickCount() % 20 != 7) return;
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            Place place = placeOf(p);
            String key = place == null ? "" : place.key();
            String last = where.put(p.getUUID(), key);
            if (place == null || key.equals(last)) continue;
            if (place.capital()) HubModule.arrived(p);
            String quietKey = p.getUUID() + "|" + key;
            Long at = announced.get(quietKey);
            if (at != null && server.getTickCount() - at < QUIET_TICKS) continue;
            announced.put(quietKey, (long) server.getTickCount());
            LOGGER.info("{} entered {} ({})", p.getGameProfile().getName(), place.name(), place.subtitle());
            p.connection.send(new ClientboundSetTitlesAnimationPacket(10, 50, 20));
            p.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal(place.subtitle()).withStyle(ChatFormatting.GRAY)));
            p.connection.send(new ClientboundSetTitleTextPacket(Component.literal(place.name()).withStyle(ChatFormatting.GOLD)));
        }
    }

    private static Place placeOf(ServerPlayer p) {
        String capital = HubModule.capitalAt(p);
        if (capital != null) return new Place("capital", capital, "The first city of the realm", true);
        ServerLevel level = p.serverLevel();
        StructureStart start = level.structureManager().getStructureWithPieceAt(p.blockPosition(), StructureTags.VILLAGE);
        if (!start.isValid()) return null;
        ResourceLocation id = level.registryAccess().registryOrThrow(Registries.STRUCTURE).getKey(start.getStructure());
        if (id == null) return null;
        String key = level.dimension().location() + "@" + start.getChunkPos().x + "," + start.getChunkPos().z;
        String name = TownNames.get(p.server).name(key, level.getSeed(), id);
        boolean grand = Settlements.isCapital(id);
        return new Place(key, name, grand ? TownNames.Style.of(id).capitalTitle() : "Village", false);
    }
}
