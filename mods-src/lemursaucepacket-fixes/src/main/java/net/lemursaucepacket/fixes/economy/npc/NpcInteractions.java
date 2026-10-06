package net.lemursaucepacket.fixes.economy.npc;

import java.util.Set;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.economy.EconomyContent;
import net.lemursaucepacket.fixes.economy.EconomyModule;
import net.lemursaucepacket.fixes.economy.npc.NpcBook.Npc;
import net.lemursaucepacket.fixes.economy.shop.Shops;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;

/**
 * Right-clicking one of the townsfolk. A talk that is waiting (the intro on a first meeting, or a quest step's dialog)
 * plays first, on its own: the shop never opens on the same click. Otherwise a vendor opens their shop, and anyone else
 * says their usual piece. The shop has a button back to the dialog.
 */
public final class NpcInteractions {
    public static void onEntityInteract(PlayerInteractEvent.EntityInteract event) {
        Entity target = event.getTarget();
        Player player = event.getEntity();
        if (player.level().isClientSide) return;
        Npc npc = NpcBook.of(target);
        if (npc == null || (npc.shop() == null && npc.talks().isEmpty())) return;
        // Admins editing an NPC with Easy NPC's own tools, or sneaking in creative, get Easy NPC as usual.
        ItemStack held = player.getItemInHand(event.getHand());
        if (!held.isEmpty() && BuiltInRegistries.ITEM.getKey(held.getItem()).getNamespace().equals("easy_npc")) return;
        if (player.isCreative() && player.isShiftKeyDown()) return;
        event.setCanceled(true);
        event.setCancellationResult(InteractionResult.SUCCESS);
        if (event.getHand() != InteractionHand.MAIN_HAND || !(player instanceof ServerPlayer sp)) return;
        interact(sp, target, npc);
    }

    public static void interact(ServerPlayer player, Entity entity, Npc npc) {
        NpcBook.Talk talk = pending(player, npc);
        if (talk != null) {
            remember(player, npc, talk);
            openDialog(player, entity, talk.dialog());
            return;
        }
        remember(player, npc, null);
        if (npc.shop() != null) Shops.open(player, entity, npc);
        else openDialog(player, entity, null);
    }

    /** The first talk that is waiting for this player, if any. */
    @Nullable
    public static NpcBook.Talk pending(ServerPlayer player, Npc npc) {
        Set<String> memory = player.getData(EconomyContent.NPC_MEMORY);
        Set<String> tags = player.getTags();
        boolean met = memory.contains(npc.id());
        for (NpcBook.Talk t : npc.talks()) {
            if (t.intro()) {
                if (!met) return t;
                continue;
            }
            if (memory.contains(npc.id() + "/" + t.dialog())) continue;
            if (!tags.containsAll(t.when())) continue;
            if (t.unless().stream().anyMatch(tags::contains)) continue;
            return t;
        }
        return null;
    }

    private static void remember(ServerPlayer player, Npc npc, @Nullable NpcBook.Talk talk) {
        Set<String> memory = player.getData(EconomyContent.NPC_MEMORY);
        memory.add(npc.id());
        if (talk != null && !talk.intro()) memory.add(npc.id() + "/" + talk.dialog());
        player.setData(EconomyContent.NPC_MEMORY, memory);
    }

    /** Forgets who a player has met (all, or one NPC): their talks play again. */
    public static int forget(ServerPlayer player, @Nullable String who) {
        Set<String> memory = player.getData(EconomyContent.NPC_MEMORY);
        int before = memory.size();
        if (who == null) memory.clear();
        else memory.removeIf(k -> k.equals(who) || k.startsWith(who + "/"));
        player.setData(EconomyContent.NPC_MEMORY, memory);
        return before - memory.size();
    }

    /** Opens the NPC's Easy NPC dialog (null: the one its own priorities pick). */
    public static void openDialog(ServerPlayer player, Entity npc, @Nullable String dialog) {
        var server = player.getServer();
        if (server == null) return;
        String command = "easy_npc dialog open " + npc.getStringUUID() + " " + player.getGameProfile().getName() + (dialog == null ? "" : " " + dialog);
        try {
            server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput().withPermission(4), command);
        } catch (Exception e) {
            EconomyModule.LOGGER.warn("Couldn't open {}'s dialog '{}': {}", npc.getName().getString(), dialog, e.toString());
        }
    }

    private NpcInteractions() {
    }
}
