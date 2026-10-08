package net.lemursaucepacket.fixes.xpbank;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.WeakHashMap;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.skills.GateNotice;
import net.lemursaucepacket.fixes.skills.Levels;
import net.lemursaucepacket.fixes.skills.MachineXp;
import net.lemursaucepacket.fixes.skills.SkillGates;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Block;

/**
 * The banks that are loaded (so a machine finds the nearest in reach without scanning the world), and what a player
 * may do with one. A player takes at the highest tier they could make themselves: the bank's own making gate for tier
 * I, and each upgrade's for II and III (skill_gates.json "craft"). Below tier I they can't take at all. Either way
 * short of what the bank kept, they're told why, with a ding (skills.GateNotice). Taking empties the bank: what their
 * tier can't take is lost, so a low tier can't drain a high-tier bank a little at a time.
 */
public final class XpBanks {
    private static final Map<ServerLevel, Set<BlockPos>> LOADED = new WeakHashMap<>();
    private static final String[] TIER_NAMES = {"", "I", "II", "III"};

    private XpBanks() {
    }

    static void loaded(ServerLevel level, BlockPos pos) {
        LOADED.computeIfAbsent(level, l -> new HashSet<>()).add(pos.immutable());
    }

    static void unloaded(ServerLevel level, BlockPos pos) {
        Set<BlockPos> banks = LOADED.get(level);
        if (banks != null) banks.remove(pos);
    }

    /** The nearest loaded bank within {@code range} blocks of {@code at} each way (the higher tier when two are as near). */
    @Nullable
    public static XpBankBlockEntity nearest(ServerLevel level, BlockPos at, int range) {
        Set<BlockPos> banks = LOADED.get(level);
        if (banks == null || banks.isEmpty()) return null;
        XpBankBlockEntity best = null;
        long bestDist = Long.MAX_VALUE;
        for (BlockPos pos : banks) {
            if (Math.abs(pos.getX() - at.getX()) > range || Math.abs(pos.getY() - at.getY()) > range || Math.abs(pos.getZ() - at.getZ()) > range) continue;
            if (!(level.getBlockEntity(pos) instanceof XpBankBlockEntity bank)) continue;
            long d = (long) pos.distSqr(at);
            if (d < bestDist || d == bestDist && best != null && bank.tier() > best.tier()) {
                best = bank;
                bestDist = d;
            }
        }
        return best;
    }

    // ---------------------------------------------------------------- tiers

    /** The highest tier this player could make (0: not even a bank). */
    public static int tierFor(Player player) {
        int tier = 0;
        for (int t = 1; t <= 3; t++) {
            if (need(t) != null && !meets(player, need(t))) break;
            tier = t;
        }
        return tier;
    }

    @Nullable
    private static SkillGates.Need need(int tier) {
        return SkillGates.craft(new ItemStack(XpBankModule.piece(tier)));
    }

    private static boolean meets(Player player, SkillGates.Need need) {
        return Levels.of(player, need.skill()) >= need.level();
    }

    /** "Crafting 60 (you have 45)": what the next tier up from {@code tier} needs. */
    private static String nextNeed(Player player, int tier) {
        SkillGates.Need need = need(tier + 1);
        return need == null ? "a higher level" : GateNotice.needs(need, Levels.of(player, need.skill()));
    }

    static String tierName(int tier) {
        return TIER_NAMES[Math.max(0, Math.min(3, tier))];
    }

    static String percent(int tier) {
        return Math.round(MachineXp.rules().keeps(tier) * 100) + "%";
    }

    // ---------------------------------------------------------------- what players do with one

    /** Right-click: takes everything at the player's tier. */
    static void take(ServerPlayer player, XpBankBlockEntity bank) {
        int mine = tierFor(player);
        if (mine == 0) {
            GateNotice.tell(player, "xpbank:none", "You can't use an XP Bank until you can make one: that needs " + nextNeed(player, 0) + ".", 5_000);
            return;
        }
        BankedXp held = bank.banked();
        if (held.isEmpty()) {
            player.sendSystemMessage(Component.literal("This XP Bank is empty. It fills while machines within " + MachineXp.rules().bankRange()
                    + " blocks of it work with nobody within " + Math.round(MachineXp.rules().playerRange()) + " blocks of them.").withStyle(ChatFormatting.GRAY));
            return;
        }
        Map<String, Long> payout = held.payout(mine);
        boolean short_ = held.above(mine);
        int top = held.topTier();
        bank.takeAll();
        if (!payout.isEmpty()) MachineXp.give(player, payout);
        player.sendSystemMessage(Component.literal(payout.isEmpty() ? "The XP Bank held too little to take anything at your tier."
                : "You took " + total(payout) + " XP from the XP Bank: " + list(payout) + ".").withStyle(ChatFormatting.GREEN));
        player.level().playSound(null, bank.getBlockPos(), SoundEvents.EXPERIENCE_ORB_PICKUP, SoundSource.BLOCKS, 0.8F, 0.9F + player.getRandom().nextFloat() * 0.2F);
        if (short_) {
            GateNotice.tell(player, "xpbank:short", "You got " + percent(mine) + " of what that bank caught, not the " + percent(top) + " a Tier " + tierName(top)
                    + " bank keeps: you take at Tier " + tierName(mine) + " until you can make the Tier " + tierName(mine + 1) + " upgrade, which needs "
                    + nextNeed(player, mine) + ".", 0);
        }
    }

    /** Sneak-right-click: what it is and what this player would take. */
    static void show(ServerPlayer player, XpBankBlockEntity bank) {
        int tier = bank.tier();
        int mine = tierFor(player);
        StringBuilder out = new StringBuilder("XP Bank, Tier ").append(tierName(tier)).append(": keeps ").append(percent(tier))
                .append(" of what machines within ").append(MachineXp.rules().bankRange()).append(" blocks earn while nobody is within ")
                .append(Math.round(MachineXp.rules().playerRange())).append(" blocks of them.");
        BankedXp held = bank.banked();
        if (held.isEmpty()) out.append(" It's empty.");
        else if (mine == 0) out.append(" It holds XP, but you can't take any until you can make an XP Bank: ").append(nextNeed(player, 0)).append(".");
        else {
            Map<String, Long> payout = held.payout(mine);
            out.append(" You'd take ").append(total(payout)).append(" XP").append(payout.isEmpty() ? "" : ": " + list(payout)).append(".");
            if (held.above(mine)) out.append(" You take at Tier ").append(tierName(mine)).append(" (").append(percent(mine))
                    .append(") until you can make the Tier ").append(tierName(mine + 1)).append(" upgrade: ").append(nextNeed(player, mine)).append(".");
        }
        player.sendSystemMessage(Component.literal(out.toString()).withStyle(ChatFormatting.YELLOW));
    }

    /** An upgrade used on a bank: fits it if the bank is the tier below. */
    static void upgrade(ServerPlayer player, XpBankBlockEntity bank, ItemStack stack, XpBankUpgradeItem upgrade) {
        int tier = bank.tier();
        if (tier >= upgrade.tier()) {
            player.sendSystemMessage(Component.literal("This XP Bank is already Tier " + tierName(tier) + ".").withStyle(ChatFormatting.GRAY));
            return;
        }
        if (tier < upgrade.tier() - 1) {
            player.sendSystemMessage(Component.literal("Fit the Tier " + tierName(tier + 1) + " upgrade first.").withStyle(ChatFormatting.GRAY));
            return;
        }
        ServerLevel level = (ServerLevel) player.level();
        level.setBlock(bank.getBlockPos(), bank.getBlockState().setValue(XpBankBlock.TIER, upgrade.tier()), Block.UPDATE_ALL);
        if (!player.getAbilities().instabuild) stack.shrink(1);
        level.playSound(null, bank.getBlockPos(), SoundEvents.SMITHING_TABLE_USE, SoundSource.BLOCKS, 1.0F, 1.0F);
        player.sendSystemMessage(Component.literal("This XP Bank is now Tier " + tierName(upgrade.tier()) + ": it keeps " + percent(upgrade.tier())
                + " of what machines near it earn while nobody is near them. What it already held stays at the share it came in at.").withStyle(ChatFormatting.GREEN));
    }

    private static String total(Map<String, Long> xp) {
        long n = 0;
        for (long v : xp.values()) n += v;
        return String.format("%,d", n);
    }

    /** "1,000 Mining, 250 Woodcutting". */
    static String list(Map<String, Long> xp) {
        StringBuilder out = new StringBuilder();
        Map<String, Long> sorted = new HashMap<>(xp);
        sorted.entrySet().stream().sorted((a, b) -> Long.compare(b.getValue(), a.getValue())).forEach(e -> {
            if (out.length() > 0) out.append(", ");
            out.append(String.format("%,d", e.getValue())).append(' ').append(Levels.name(e.getKey()));
        });
        return out.toString();
    }
}
