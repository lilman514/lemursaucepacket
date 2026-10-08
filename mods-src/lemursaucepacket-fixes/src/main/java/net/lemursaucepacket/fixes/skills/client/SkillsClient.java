package net.lemursaucepacket.fixes.skills.client;

import java.util.function.Supplier;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.lemursaucepacket.fixes.skills.Levels;
import net.lemursaucepacket.fixes.skills.SkillGates;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.network.chat.Component;
import net.minecraft.server.packs.resources.ResourceManagerReloadListener;
import net.minecraft.world.entity.player.Player;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.RegisterClientCommandsEvent;
import net.neoforged.neoforge.client.event.RegisterClientReloadListenersEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.entity.player.ItemTooltipEvent;

/**
 * The skills' client side: tooltips for the gates (what making an item, or brewing with an ingredient, or a drop, needs;
 * red while you're short), and the skill screens ({@link SkillsScreen}, {@link SkillGuideScreen}) with /skills to open
 * them.
 */
public final class SkillsClient {
    /** A screen to open once the chat that ran /skills has closed. */
    private static Supplier<Screen> openNext;

    public static void init(IEventBus modBus) {
        NeoForge.EVENT_BUS.addListener(SkillsClient::onTooltip);
        NeoForge.EVENT_BUS.addListener(SkillsClient::onRegisterCommands);
        NeoForge.EVENT_BUS.addListener(SkillsClient::onClientTick);
        modBus.addListener((RegisterClientReloadListenersEvent e) -> e.registerReloadListener((ResourceManagerReloadListener) manager -> SkillGuideData.reset()));
    }

    private static void onRegisterCommands(RegisterClientCommandsEvent event) {
        // /skills: the skills screen; /skills <skill>: that skill's guide.
        event.getDispatcher().register(Commands.literal("skills")
                .executes(context -> {
                    openNext = () -> new SkillsScreen(null);
                    return 1;
                })
                .then(Commands.argument("skill", StringArgumentType.word())
                        .suggests((context, builder) -> SharedSuggestionProvider.suggest(SkillGuideData.skills(), builder))
                        .executes(context -> {
                            String skill = StringArgumentType.getString(context, "skill").toLowerCase(java.util.Locale.ROOT);
                            if (!SkillGuideData.skills().contains(skill)) {
                                context.getSource().sendFailure(Component.literal("There's no skill called " + skill + ". Try one of: " + String.join(", ", SkillGuideData.skills())));
                                return 0;
                            }
                            openNext = () -> new SkillGuideScreen(skill, null);
                            return 1;
                        })));
    }

    private static void onClientTick(ClientTickEvent.Post event) {
        Minecraft mc = Minecraft.getInstance();
        if (openNext != null && mc.player != null && mc.screen == null) {
            Supplier<Screen> screen = openNext;
            openNext = null;
            mc.setScreen(screen.get());
        }
    }

    private static void onTooltip(ItemTooltipEvent e) {
        Player p = e.getEntity();
        var lines = e.getToolTip();
        SkillGates.Need make = SkillGates.craft(e.getItemStack());
        if (make != null) lines.add(line("Making it needs ", make, p));
        SkillGates.Need brew = SkillGates.brew(e.getItemStack());
        if (brew != null) lines.add(line("Brews " + brew.what() + ": needs ", brew, p));
        for (SkillGates.Drop d : SkillGates.drops()) {
            if (e.getItemStack().is(d.item())) lines.add(line("Drops only for ", d.need(), p));
        }
    }

    private static Component line(String text, SkillGates.Need need, Player p) {
        boolean short_ = p != null && Levels.of(p, need.skill()) < need.level();
        return Component.literal(text + Levels.name(need.skill()) + " " + need.level()).withStyle(short_ ? ChatFormatting.RED : ChatFormatting.DARK_GRAY);
    }

    private SkillsClient() {
    }
}
