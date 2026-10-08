package net.lemursaucepacket.fixes.compat;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import net.lemursaucepacket.fixes.skills.GateNotice;
import net.lemursaucepacket.fixes.skills.Levels;
import net.lemursaucepacket.fixes.skills.Operators;
import net.lemursaucepacket.fixes.skills.SkillGates;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.neoforged.neoforge.server.ServerLifecycleHooks;
import net.p3pp3rf1y.sophisticatedbackpacks.backpack.BackpackItem;
import net.p3pp3rf1y.sophisticatedcore.api.IStorageWrapper;
import net.p3pp3rf1y.sophisticatedcore.init.ModCoreDataComponents;

/**
 * Backpack upgrades work at the level of whoever carries the backpack (the upgrade's own making gate in skill_gates.json:
 * a magnet upgrade needs Crafting 30 to make and to work), and a placed backpack's at its operator's (skills.Operators).
 * Upgrades only know their backpack's contents id, so once a second this notes which player carries which backpack, in
 * their inventory or back slot. Used by the mixin on Sophisticated Core's UpgradeWrapperBase.isEnabled.
 *
 * <p>Stack and tank upgrades are left alone: switching those off would leave a backpack holding more than it may.
 */
public final class BackpackCarriers {
    private static final Map<UUID, UUID> CARRIER = new ConcurrentHashMap<>();

    private BackpackCarriers() {
    }

    /** Notes the backpacks this player carries (inventory and Curios slots). */
    public static void scan(ServerPlayer player) {
        for (ItemStack stack : player.getInventory().items) note(player, stack);
        // Worn in the chest slot (Sophisticated Backpacks allows it) counts as carried too.
        for (ItemStack stack : player.getInventory().armor) note(player, stack);
        note(player, player.getOffhandItem());
        try {
            top.theillusivec4.curios.api.CuriosApi.getCuriosInventory(player).ifPresent(curios -> {
                var handler = curios.getEquippedCurios();
                for (int i = 0; i < handler.getSlots(); i++) note(player, handler.getStackInSlot(i));
            });
        } catch (RuntimeException | LinkageError e) {
            // no Curios: the inventory is enough
        }
    }

    private static void note(ServerPlayer player, ItemStack stack) {
        if (stack.isEmpty() || !(stack.getItem() instanceof BackpackItem)) return;
        UUID contents = stack.get(ModCoreDataComponents.STORAGE_UUID.get());
        if (contents != null) CARRIER.put(contents, player.getUUID());
    }

    /** Whether this upgrade, on in its backpack, may work: says why not to whoever carries it (or the placed backpack's operator). */
    public static boolean allows(IStorageWrapper storage, ItemStack upgrade) {
        String id = net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(upgrade.getItem()).getPath();
        if (id.contains("stack_upgrade") || id.contains("tank_upgrade")) return true;
        SkillGates.Need need = SkillGates.craft(upgrade);
        if (need == null) return true;
        BlockEntity placed = Operators.current();
        if (placed != null) {
            if (Operators.has(placed, need)) return true;
            Operators.refuse(placed, need, upgrade, "use");
            return false;
        }
        UUID contents = storage.getContentsUuid().orElse(null);
        UUID carrier = contents == null ? null : CARRIER.get(contents);
        MinecraftServer server = ServerLifecycleHooks.getCurrentServer();
        ServerPlayer player = carrier == null || server == null ? null : server.getPlayerList().getPlayer(carrier);
        if (player == null) return true; // nobody known carries it (yet): leave it as it is
        int have = Levels.of(player, need.skill());
        if (have >= need.level()) return true;
        GateNotice.tell(player, "upgrade:" + upgrade.getItem(), "Your " + upgrade.getHoverName().getString() + " won't work until you have "
                + GateNotice.needs(need, have) + ".", 120_000);
        return false;
    }
}
