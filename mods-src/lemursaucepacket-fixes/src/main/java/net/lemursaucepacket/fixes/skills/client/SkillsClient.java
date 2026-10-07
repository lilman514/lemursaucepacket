package net.lemursaucepacket.fixes.skills.client;

import net.lemursaucepacket.fixes.skills.Levels;
import net.lemursaucepacket.fixes.skills.SkillGates;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Player;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.entity.player.ItemTooltipEvent;

/** Tooltips for the gates: what making an item, or brewing with an ingredient, or a drop, needs (red while you're short). */
public final class SkillsClient {
    public static void init() {
        NeoForge.EVENT_BUS.addListener(SkillsClient::onTooltip);
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
