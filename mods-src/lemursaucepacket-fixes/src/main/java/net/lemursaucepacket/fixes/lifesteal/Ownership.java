package net.lemursaucepacket.fixes.lifesteal;

import java.util.UUID;

import javax.annotation.Nullable;

import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;

/**
 * Who an item belongs to. The KubeJS core stamps {@code minecraft:custom_data} with {@code lsp_owner} (the
 * player's uuid) and {@code lsp_gen} (their life number) the first time an item enters their inventory; this
 * side only reads the stamp. An owner whose life number has since been erased is "dead": the item is deleted
 * wherever it is seen ({@link Purge}).
 */
public final class Ownership {
    public static final String OWNER_KEY = "lsp_owner";
    public static final String GEN_KEY = "lsp_gen";

    /** A player's life: the uuid and the life number. {@link #key()} is the string form used in indexes. */
    public record Owner(UUID uuid, int generation) {
        public String key() {
            return uuid + ":" + generation;
        }

        @Nullable
        public static Owner parse(String key) {
            int colon = key.lastIndexOf(':');
            if (colon < 0) return null;
            try {
                return new Owner(UUID.fromString(key.substring(0, colon)), Integer.parseInt(key.substring(colon + 1)));
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
    }

    @Nullable
    public static Owner of(ItemStack stack) {
        if (stack.isEmpty()) return null;
        CustomData data = stack.get(DataComponents.CUSTOM_DATA);
        if (data == null) return null;
        CompoundTag tag = data.getUnsafe();
        if (!tag.contains(OWNER_KEY, CompoundTag.TAG_STRING)) return null;
        try {
            return new Owner(UUID.fromString(tag.getString(OWNER_KEY)), tag.getInt(GEN_KEY));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static boolean isOwnedBy(ItemStack stack, UUID player) {
        Owner owner = of(stack);
        return owner != null && owner.uuid().equals(player);
    }

    /** True when the stamp names a life that has been erased. */
    public static boolean isDead(MinecraftServer server, @Nullable Owner owner) {
        return owner != null && LifestealState.get(server).isErased(owner);
    }

    public static boolean isDead(MinecraftServer server, ItemStack stack) {
        return isDead(server, of(stack));
    }

    private Ownership() {
    }
}
