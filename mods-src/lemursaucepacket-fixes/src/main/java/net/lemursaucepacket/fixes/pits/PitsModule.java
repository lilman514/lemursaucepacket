package net.lemursaucepacket.fixes.pits;

import com.mojang.brigadier.CommandDispatcher;

import net.lemursaucepacket.fixes.hub.HubState;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.levelgen.Heightmap;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.AddReloadListenerEvent;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.server.ServerStoppedEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The Kilnfolk (docs/fight-pits.md): Kiln Hollow, their outpost ({@link KilnHollow}), and the bosses and beasts of their
 * wave fights, the Fight Pits and the Inferno ({@link PitBosses}; the fights themselves are lsp_instances events written
 * by pits/build.mjs). Their quests are npcs/quests.mjs and quests/book.mjs, like Dragon Slayer I's.
 */
public final class PitsModule {
    public static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/pits");

    public static void init() {
        NeoForge.EVENT_BUS.addListener((AddReloadListenerEvent e) -> e.addListener(new PitMobs.Loader()));
        NeoForge.EVENT_BUS.addListener(PitBosses::onJoin);
        NeoForge.EVENT_BUS.addListener(PitBosses::onTick);
        NeoForge.EVENT_BUS.addListener(PitBosses::onIncomingDamage);
        NeoForge.EVENT_BUS.addListener(PitBosses::onDamaged);
        NeoForge.EVENT_BUS.addListener(PitBosses::onImpact);
        NeoForge.EVENT_BUS.addListener((ServerTickEvent.Post e) -> {
            if (e.getServer().getTickCount() % 100 == 41) {
                try {
                    KilnHollow.tick(e.getServer());
                } catch (Exception ex) {
                    LOGGER.error("Kiln Hollow tick failed", ex);
                }
            }
        });
        NeoForge.EVENT_BUS.addListener((ServerStoppedEvent e) -> PitBosses.clear(e.getServer()));
        NeoForge.EVENT_BUS.addListener((RegisterCommandsEvent e) -> register(e.getDispatcher()));
    }

    private static void register(CommandDispatcher<CommandSourceStack> d) {
        d.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("pits").then(Commands.literal("debug").executes(c -> {
                    PitBosses.debug = !PitBosses.debug;
                    c.getSource().sendSuccess(() -> Component.literal("Pit boss attacks are " + (PitBosses.debug ? "logged" : "no longer logged") + "."), true);
                    return 1;
                })))
                .then(Commands.literal("kiln")
                        .then(Commands.literal("where").executes(c -> {
                            var server = c.getSource().getServer();
                            BlockPos site = KilnHollow.site(server);
                            BlockPos built = KilnHollow.hollow(server).orElse(null);
                            KilnHollow.Site s = KilnHollow.state(server);
                            c.getSource().sendSuccess(() -> Component.literal(built != null ? "Kiln Hollow is at " + built.getX() + " " + built.getY() + " " + built.getZ() + " (" + s.land + ")"
                                    : "Kiln Hollow's land is at " + site.getX() + " " + site.getZ() + " (" + s.land + "); it's built once Lemurton is up and that land has loaded."), false);
                            return 1;
                        }))
                        .then(Commands.literal("reset").executes(c -> {
                            KilnHollow.reset(c.getSource().getServer());
                            c.getSource().sendSuccess(() -> Component.literal("Kiln Hollow is forgotten: it will be found and built again (the old one stays where it is)."), true);
                            return 1;
                        }))
                        .then(Commands.literal("pass").then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            KilnHollow.givePass(EntityArgument.getPlayer(c, "player"));
                            return 1;
                        })))
                        .then(Commands.literal("goto").then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            var server = c.getSource().getServer();
                            ServerPlayer p = EntityArgument.getPlayer(c, "player");
                            ServerLevel level = server.overworld();
                            BlockPos at = KilnHollow.hollow(server).orElse(null);
                            if (at == null) {
                                // Not built yet: to its land (which then loads and gets built).
                                BlockPos site = KilnHollow.site(server);
                                level.getChunk(site.getX() >> 4, site.getZ() >> 4);
                                p.teleportTo(level, site.getX() + 0.5, level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, site.getX(), site.getZ()) + 1, site.getZ() + 0.5, p.getYRot(), 0F);
                                return 1;
                            }
                            // In front of it (it faces Lemurton), looking at it.
                            BlockPos home = HubState.get(server).status() == HubState.Status.BUILT ? HubState.get(server).centre() : level.getSharedSpawnPos();
                            double ox = home.getX() - at.getX(), oz = home.getZ() - at.getZ();
                            int fx = Math.abs(ox) > Math.abs(oz) ? (int) Math.signum(ox) : 0, fz = fx == 0 ? (oz >= 0 ? 1 : -1) : 0;
                            int x = at.getX() + fx * 11, z = at.getZ() + fz * 11;
                            float yaw = (float) Math.toDegrees(Math.atan2(fx, -fz));
                            p.teleportTo(level, x + 0.5, at.getY() + 1, z + 0.5, yaw, 0F);
                            return 1;
                        })))));
    }

    private PitsModule() {
    }
}
