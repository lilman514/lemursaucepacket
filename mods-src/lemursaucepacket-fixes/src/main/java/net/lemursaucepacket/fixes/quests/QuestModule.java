package net.lemursaucepacket.fixes.quests;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;

import net.minecraft.ChatFormatting;
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
import net.neoforged.neoforge.event.entity.living.LivingDeathEvent;
import net.neoforged.neoforge.event.entity.living.LivingEquipmentChangeEvent;
import net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent;
import net.neoforged.neoforge.event.entity.player.ItemTooltipEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * RuneScape-style quests (docs/quests.md): the steps NPC dialogs run ({@link QuestSteps}), Crandor and Elvarg for
 * Dragon Slayer I ({@link Crandor}), and the gear that quest unlocks ({@link DragonGear}). The quests themselves are FTB
 * Quests chapters that stay hidden until an NPC gives them to you (quests/book.mjs).
 */
public final class QuestModule {
    public static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/quests");

    public static void init() {
        NeoForge.EVENT_BUS.addListener((AddReloadListenerEvent e) -> e.addListener(new QuestSteps.Loader(e.getRegistryAccess())));
        NeoForge.EVENT_BUS.addListener((RegisterCommandsEvent e) -> register(e.getDispatcher()));
        NeoForge.EVENT_BUS.addListener((ServerTickEvent.Post e) -> {
            if (e.getServer().getTickCount() % 100 == 17) {
                try {
                    Crandor.tick(e.getServer());
                } catch (Exception ex) {
                    LOGGER.error("Crandor tick failed", ex);
                }
            }
        });
        // Elvarg's death counts even if another mod cancels it (Ice and Fire turns dead dragons into lootable bodies), and so
        // does her health reaching zero.
        NeoForge.EVENT_BUS.addListener(net.neoforged.bus.api.EventPriority.HIGHEST, true, LivingDeathEvent.class, e -> Crandor.onDeath(e.getEntity()));
        NeoForge.EVENT_BUS.addListener((net.neoforged.neoforge.event.entity.living.LivingDamageEvent.Post e) -> {
            if (e.getEntity().getHealth() <= 0) Crandor.onDeath(e.getEntity());
        });
        NeoForge.EVENT_BUS.addListener((LivingEquipmentChangeEvent e) -> DragonGear.onEquip(e));
        NeoForge.EVENT_BUS.addListener((LivingIncomingDamageEvent e) -> DragonGear.onDamage(e));
        NeoForge.EVENT_BUS.addListener((net.neoforged.neoforge.event.tick.PlayerTickEvent.Post e) -> DragonGear.onPlayerTick(e));
        NeoForge.EVENT_BUS.addListener((ItemTooltipEvent e) -> DragonGear.onTooltip(e));
    }

    private static void register(CommandDispatcher<CommandSourceStack> d) {
        d.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("quest")
                        // What an NPC's dialog button runs: /lsp quest step @initiator <quest> <step> @npc-uuid
                        .then(Commands.literal("step").then(Commands.argument("player", EntityArgument.player()).then(Commands.argument("quest", StringArgumentType.word())
                                .then(Commands.argument("step", StringArgumentType.word())
                                        .executes(c -> QuestSteps.run(EntityArgument.getPlayer(c, "player"), StringArgumentType.getString(c, "quest"), StringArgumentType.getString(c, "step"), null))
                                        .then(Commands.argument("npc", EntityArgument.entity()).executes(c -> QuestSteps.run(EntityArgument.getPlayer(c, "player"),
                                                StringArgumentType.getString(c, "quest"), StringArgumentType.getString(c, "step"), EntityArgument.getEntity(c, "npc"))))))))
                        .then(Commands.literal("reset").then(Commands.argument("player", EntityArgument.player()).then(Commands.argument("quest", StringArgumentType.word()).executes(c -> {
                            ServerPlayer p = EntityArgument.getPlayer(c, "player");
                            int n = QuestSteps.reset(p, StringArgumentType.getString(c, "quest"));
                            c.getSource().sendSuccess(() -> Component.literal("Removed " + n + " stage(s) from " + p.getGameProfile().getName()), true);
                            return n;
                        }))))
                        .then(Commands.literal("list").executes(c -> {
                            QuestSteps.all().values().forEach(q -> c.getSource().sendSuccess(() -> Component.literal(q.id() + ": " + q.title() + " (" + q.steps().size() + " steps)"), false));
                            return QuestSteps.all().size();
                        })))
                .then(Commands.literal("crandor")
                        .then(Commands.literal("where").executes(c -> {
                            BlockPos pos = Crandor.site(c.getSource().getServer());
                            c.getSource().sendSuccess(() -> Component.literal("Crandor is at " + pos.getX() + " " + pos.getZ()), false);
                            return 1;
                        }))
                        .then(Commands.literal("map").then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            Crandor.giveMap(EntityArgument.getPlayer(c, "player"));
                            return 1;
                        })))
                        .then(Commands.literal("goto").then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            ServerPlayer p = EntityArgument.getPlayer(c, "player");
                            BlockPos pos = Crandor.site(c.getSource().getServer());
                            ServerLevel level = c.getSource().getServer().overworld();
                            level.getChunk(pos.getX() >> 4, pos.getZ() >> 4);
                            int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, pos.getX(), pos.getZ());
                            // A little way off, so the roost's own dragon doesn't land on you.
                            p.teleportTo(level, pos.getX() + 48.5, y + 30, pos.getZ() + 0.5, p.getYRot(), p.getXRot());
                            return 1;
                        })))
                        .then(Commands.literal("reset").executes(c -> {
                            int n = Crandor.reset(c.getSource().getServer());
                            c.getSource().sendSuccess(() -> Component.literal("Cleared " + n + " Elvarg(s) off Crandor; she can rise again at once."), true);
                            return n;
                        }))
                        .then(Commands.literal("spawn").executes(c -> {
                            BlockPos pos = Crandor.site(c.getSource().getServer());
                            ServerLevel level = c.getSource().getServer().overworld();
                            int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, pos.getX(), pos.getZ());
                            Crandor.summon(c.getSource().getServer(), pos.getX(), y + 8, pos.getZ(), y);
                            c.getSource().sendSuccess(() -> Component.literal("Elvarg summoned over Crandor.").withStyle(ChatFormatting.RED), true);
                            return 1;
                        }))));
    }

    private QuestModule() {
    }
}
