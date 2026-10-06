package net.lemursaucepacket.fixes.economy;

import java.text.NumberFormat;
import java.util.Locale;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;

/**
 * Gold Coins, the server's one currency. A coin stack is a single item whose {@link EconomyContent#COIN_AMOUNT} says how
 * many coins it is (no stack cap); a stack with a count above one is worth amount x count. A player's purse is every coin
 * stack in their inventory, which {@link #normalize} keeps as one stack.
 *
 * <p>Scripts can reach this class: {@code Java.loadClass('net.lemursaucepacket.fixes.economy.Coins')}.
 */
public final class Coins {
    /** What one Coin Pouch (the Brassworks mission reward) opens into. */
    public static final long POUCH_COINS = 100;

    public static boolean is(ItemStack stack) {
        return !stack.isEmpty() && stack.is(EconomyContent.GOLD_COINS.get());
    }

    /** The coins in a stack: its amount times its count (0 for anything that isn't coins). */
    public static long value(ItemStack stack) {
        if (!is(stack)) return 0;
        Long amount = stack.get(EconomyContent.COIN_AMOUNT.get());
        return Math.max(1, amount == null ? 1 : amount) * stack.getCount();
    }

    /** A fresh coin stack of {@code amount} coins (empty for none). */
    public static ItemStack stack(long amount) {
        if (amount <= 0) return ItemStack.EMPTY;
        ItemStack stack = new ItemStack(EconomyContent.GOLD_COINS.get());
        stack.set(EconomyContent.COIN_AMOUNT.get(), amount);
        return stack;
    }

    /** Sets a coin stack to {@code amount} coins in place (count 1, nothing else on it); 0 empties it. */
    public static void set(ItemStack stack, long amount) {
        if (amount <= 0) {
            stack.setCount(0);
            return;
        }
        stack.setCount(1);
        stack.set(EconomyContent.COIN_AMOUNT.get(), amount);
    }

    // ---------------------------------------------------------------- the purse

    /** Every coin a player carries: main inventory, hotbar and off hand. */
    public static long purse(Player player) {
        Inventory inv = player.getInventory();
        long total = 0;
        for (int i = 0; i < inv.getContainerSize(); i++) total += value(inv.getItem(i));
        return total;
    }

    public static boolean has(Player player, long amount) {
        return purse(player) >= amount;
    }

    /** Takes {@code amount} coins from the purse, smallest stacks first. False (and nothing taken) if the purse is short. */
    public static boolean take(Player player, long amount) {
        if (amount <= 0) return true;
        if (purse(player) < amount) return false;
        Inventory inv = player.getInventory();
        long left = amount;
        while (left > 0) {
            int smallest = -1;
            for (int i = 0; i < inv.getContainerSize(); i++) {
                ItemStack s = inv.getItem(i);
                if (is(s) && (smallest < 0 || value(s) < value(inv.getItem(smallest)))) smallest = i;
            }
            if (smallest < 0) break;
            ItemStack s = inv.getItem(smallest);
            long have = value(s);
            if (have <= left) {
                inv.setItem(smallest, ItemStack.EMPTY);
                left -= have;
            } else {
                set(s, have - left);
                left = 0;
            }
        }
        inv.setChanged();
        afterChange(player);
        return true;
    }

    /** Adds coins to the purse: onto the existing coin stack, else a free slot, else they drop at the player's feet. */
    public static void give(Player player, long amount) {
        if (amount <= 0) return;
        Inventory inv = player.getInventory();
        for (int i = 0; i < inv.getContainerSize(); i++) {
            ItemStack s = inv.getItem(i);
            if (is(s)) {
                set(s, value(s) + amount);
                inv.setChanged();
                afterChange(player);
                return;
            }
        }
        ItemStack fresh = stack(amount);
        if (!inv.add(fresh)) player.drop(fresh, false);
        afterChange(player);
    }

    /**
     * Folds every coin stack in a player's inventory into the first one, and turns any stack with a count above one into a
     * single stack of the same worth. True if anything changed.
     */
    public static boolean normalize(Player player) {
        Inventory inv = player.getInventory();
        int first = -1;
        long total = 0;
        int stacks = 0;
        boolean untidy = false;
        for (int i = 0; i < inv.getContainerSize(); i++) {
            ItemStack s = inv.getItem(i);
            if (!is(s)) continue;
            stacks++;
            total += value(s);
            if (first < 0) first = i;
            if (s.getCount() != 1 || !s.has(EconomyContent.COIN_AMOUNT.get()) || s.getComponentsPatch().size() != 1) untidy = true;
        }
        if (first < 0 || (stacks == 1 && !untidy)) return false;
        for (int i = 0; i < inv.getContainerSize(); i++) if (i != first && is(inv.getItem(i))) inv.setItem(i, ItemStack.EMPTY);
        inv.setItem(first, stack(total));
        inv.setChanged();
        afterChange(player);
        return true;
    }

    /** Purse milestones for the quest book (stage tags), checked whenever coins move. */
    static void afterChange(Player player) {
        if (!(player instanceof ServerPlayer sp)) return;
        long purse = purse(sp);
        for (int i = 0; i < MILESTONES.length; i++) {
            if (purse >= MILESTONES[i] && !sp.getTags().contains(MILESTONE_TAGS[i])) sp.addTag(MILESTONE_TAGS[i]);
        }
    }

    private static final long[] MILESTONES = {1_000, 10_000, 100_000, 1_000_000};
    private static final String[] MILESTONE_TAGS = {"econ_purse_1k", "econ_purse_10k", "econ_purse_100k", "econ_purse_1m"};

    // ---------------------------------------------------------------- formatting

    /** 2,346 */
    public static String exact(long amount) {
        return NumberFormat.getIntegerInstance(Locale.US).format(amount);
    }

    /** The slot count: 999, 2.3k, 23k, 234k, 2.3M, ... (rounded down, so a stack never shows more than it holds). */
    public static String compact(long amount) {
        if (amount < 1000) return Long.toString(amount);
        String[] units = {"k", "M", "B", "T", "Q"};
        double v = amount;
        int unit = -1;
        while (v >= 1000 && unit < units.length - 1) {
            v /= 1000;
            unit++;
        }
        if (v < 10) {
            long tenths = (long) Math.floor(v * 10 + 1e-9);
            return tenths % 10 == 0 ? (tenths / 10) + units[unit] : (tenths / 10) + "." + (tenths % 10) + units[unit];
        }
        return (long) Math.floor(v + 1e-9) + units[unit];
    }

    /** RuneScape's stack colours: yellow below 100k, white to 10M, green from 10M. */
    public static int compactColor(long amount) {
        if (amount >= 10_000_000) return 0x00FF80;
        if (amount >= 100_000) return 0xFFFFFF;
        return 0xFFFF00;
    }

    /** "2,346 coins" in gold. */
    public static MutableComponent text(long amount) {
        return Component.literal(exact(amount) + (amount == 1 ? " coin" : " coins")).withStyle(ChatFormatting.GOLD);
    }

    static void coinSound(Player player) {
        if (player instanceof ServerPlayer sp) sp.playNotifySound(SoundEvents.EXPERIENCE_ORB_PICKUP, SoundSource.PLAYERS, 0.4f, 1.6f);
    }

    private Coins() {
    }
}
