package net.lemursaucepacket.fixes.hardness;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import harmonised.pmmo.api.APIUtils;
import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.tags.TagKey;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ClickType;
import net.minecraft.world.inventory.CraftingMenu;
import net.minecraft.world.inventory.InventoryMenu;
import net.minecraft.world.inventory.ShulkerBoxMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.neoforged.fml.loading.FMLPaths;
import net.neoforged.neoforge.common.util.FakePlayer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The Hardness use-gate: a material from a block the player can't mine yet (found in loot, taken from a
 * chest) can be carried, kept in a chest or dropped, but not put into a recipe, a machine or any other
 * container. This is the menu half: every move of items inside a menu is a
 * {@link AbstractContainerMenu#clicked} call, so one check there covers crafting grids, furnaces, anvils,
 * hoppers, backpacks and every mod's machine menu ({@code mixin.pmmo.UseGateMixin}). Right-clicking a machine
 * with the item is KubeJS's part (server_scripts/enchanting.js).
 *
 * <p>The numbers come from config/lemursaucepacket/enchanting.json (written by enchanting/build.mjs): an
 * item's tier is its item tag {@code lemursaucepacket:hardness/<tier>}, and the tier a player has is the
 * highest whose Mining level they meet. Automation (fake players) and creative players are never gated. The
 * check runs on both sides so the client never predicts a move the server refuses.
 */
public final class HardnessUseGate {
    private static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/hardness");
    private static final Path CONFIG = FMLPaths.GAMEDIR.get().resolve("config").resolve("lemursaucepacket").resolve("enchanting.json");
    private static final long RECHECK_MS = 5000;
    private static final long MESSAGE_MS = 2000;
    private static final String[] ROMAN = {"0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"};

    private record Settings(int maxLevel, int[] unlock, List<TagKey<Item>> tierTags, TagKey<Item> gated,
                            TagKey<Item> containerItems, Set<String> allowedMenus, Set<String> inventoryMenus) {
    }

    private static Settings settings;
    private static long checkedAt; // 0, never Long.MIN_VALUE: "now - checkedAt" must not overflow
    private static long loadedMtime = -1;
    private static boolean levelErrorLogged;

    private HardnessUseGate() {
    }

    /** The stack this click would put where it isn't allowed, or {@link ItemStack#EMPTY} when the click is fine. */
    public static ItemStack blocked(AbstractContainerMenu menu, int slotId, int button, ClickType type, Player player) {
        if (player.isCreative() || player.isSpectator() || player instanceof FakePlayer) return ItemStack.EMPTY;
        Settings s = settings();
        if (s == null) return ItemStack.EMPTY;
        int have = unlocked(player, s);
        if (have >= s.maxLevel) return ItemStack.EMPTY;
        boolean allowedMenu = isAllowedMenu(menu, s);
        Slot slot = slotId >= 0 && slotId < menu.slots.size() ? menu.slots.get(slotId) : null;
        switch (type) {
            case PICKUP -> {
                if (slot == null) return ItemStack.EMPTY; // outside the window: dropping is fine
                ItemStack cursor = menu.getCarried();
                ItemStack inSlot = slot.getItem();
                int cursorTier = tierOf(cursor, s);
                if (cursorTier > have && !allowedMenu && !isPlayerSlot(slot, player)) return cursor;
                if (cursorTier > have && !inSlot.isEmpty() && inSlot.is(s.containerItems)) return cursor; // into a backpack item
                int slotTier = tierOf(inSlot, s);
                if (slotTier > have && !cursor.isEmpty() && cursor.is(s.containerItems)) return inSlot; // a backpack item onto it
                return ItemStack.EMPTY;
            }
            case QUICK_MOVE -> {
                // Shift-click out of a machine is fine; into one is not. Inventory-style menus never target the crafting grid.
                if (slot == null || allowedMenu || isInventoryMenu(menu, s) || !isPlayerSlot(slot, player)) return ItemStack.EMPTY;
                return tierOf(slot.getItem(), s) > have ? slot.getItem() : ItemStack.EMPTY;
            }
            case SWAP -> {
                if (slot == null || allowedMenu || isPlayerSlot(slot, player)) return ItemStack.EMPTY;
                ItemStack hotbar = button == 40 ? player.getInventory().offhand.get(0)
                        : button >= 0 && button < 9 ? player.getInventory().getItem(button) : ItemStack.EMPTY;
                return tierOf(hotbar, s) > have ? hotbar : ItemStack.EMPTY;
            }
            case QUICK_CRAFT -> {
                // A drag adds slots one packet at a time (header 1); the start and end packets carry no slot.
                if (slot == null || allowedMenu || isPlayerSlot(slot, player) || AbstractContainerMenu.getQuickcraftHeader(button) != 1) return ItemStack.EMPTY;
                ItemStack cursor = menu.getCarried();
                return tierOf(cursor, s) > have ? cursor : ItemStack.EMPTY;
            }
            default -> {
                return ItemStack.EMPTY; // PICKUP_ALL and THROW take items out, CLONE is creative
            }
        }
    }

    /** Refuse the click: put the client back in sync (it may have predicted the move) and say why (chat and a ding). */
    public static void refuse(AbstractContainerMenu menu, Player player, ItemStack what) {
        if (player.level().isClientSide()) return;
        menu.sendAllDataToRemote();
        net.lemursaucepacket.fixes.skills.GateNotice.tell(player, "hardness:" + what.getItem(), "You need " + needs(what, player) + " to use " + what.getHoverName().getString()
                + " there: it can only go in a chest until then.", MESSAGE_MS);
    }

    /** Whether the player's Mining level lets them use this material (anything ungated, always). */
    public static boolean mayUse(Player player, ItemStack stack) {
        Settings s = settings();
        return s == null || tierOf(stack, s) <= unlocked(player, s);
    }

    /** A backpack's pickup upgrade left this material on the ground for the normal pickup: says why, once a minute per item. */
    public static void tellBackpack(Player player, ItemStack what) {
        net.lemursaucepacket.fixes.skills.GateNotice.tell(player, "hardness-backpack:" + what.getItem(), "Your backpack can't take " + what.getHoverName().getString()
                + " until you have " + needs(what, player) + ".", 60_000);
    }

    /** "Mining 20 (Hardness II, you have 12)". */
    private static String needs(ItemStack what, Player player) {
        Settings s = settings();
        int tier = s == null ? 0 : tierOf(what, s);
        int level = s != null && tier > 0 && tier < s.unlock.length ? s.unlock[tier] : 0;
        String roman = tier > 0 && tier < ROMAN.length ? ROMAN[tier] : String.valueOf(tier);
        long have;
        try {
            have = APIUtils.getLevel("mining", player);
        } catch (RuntimeException e) {
            have = 0;
        }
        return "Mining " + level + " (Hardness " + roman + ", you have " + have + ")";
    }

    /** The tier the player's Mining level unlocks. */
    private static int unlocked(Player player, Settings s) {
        long mining;
        try {
            mining = APIUtils.getLevel("mining", player);
        } catch (RuntimeException e) {
            if (!levelErrorLogged) {
                levelErrorLogged = true;
                LOGGER.warn("Project MMO gave no Mining level for {} (gate open for now): {}", player.getName().getString(), e.toString());
            }
            return s.maxLevel; // no skill data (yet): never lock a player out over that
        }
        int tier = 0;
        for (int t = 1; t <= s.maxLevel && t < s.unlock.length; t++) if (mining >= s.unlock[t]) tier = t;
        return tier;
    }

    private static int tierOf(ItemStack stack, Settings s) {
        if (stack.isEmpty() || !stack.is(s.gated)) return 0;
        for (int t = s.tierTags.size() - 1; t >= 0; t--) if (stack.is(s.tierTags.get(t))) return t + 1;
        return 0;
    }

    private static boolean isPlayerSlot(Slot slot, Player player) {
        return slot.container == player.getInventory();
    }

    private static boolean isAllowedMenu(AbstractContainerMenu menu, Settings s) {
        return menu instanceof ChestMenu || menu instanceof ShulkerBoxMenu || s.allowedMenus.contains(menu.getClass().getName());
    }

    /** Menus whose shift-click only moves items between the player's own slots (the crafting grid is never a target). */
    private static boolean isInventoryMenu(AbstractContainerMenu menu, Settings s) {
        return menu instanceof InventoryMenu || menu instanceof CraftingMenu || s.inventoryMenus.contains(menu.getClass().getName());
    }

    private static synchronized Settings settings() {
        long now = System.currentTimeMillis();
        if (now - checkedAt < RECHECK_MS) return settings;
        checkedAt = now;
        try {
            if (!Files.exists(CONFIG)) {
                settings = null;
                return null;
            }
            long mtime = Files.getLastModifiedTime(CONFIG).toMillis();
            if (mtime == loadedMtime) return settings;
            try (Reader reader = Files.newBufferedReader(CONFIG)) {
                settings = parse(JsonParser.parseReader(reader).getAsJsonObject());
                loadedMtime = mtime;
            }
        } catch (IOException | RuntimeException e) {
            LOGGER.warn("Could not read {}: {}", CONFIG, e.toString());
            settings = null;
        }
        return settings;
    }

    private static Settings parse(JsonObject root) {
        JsonObject hardness = root.getAsJsonObject("hardness");
        int maxLevel = hardness.get("maxLevel").getAsInt();
        JsonArray unlockJson = hardness.getAsJsonArray("unlock");
        int[] unlock = new int[unlockJson.size()];
        for (int i = 0; i < unlock.length; i++) unlock[i] = unlockJson.get(i).getAsInt();
        String prefix = hardness.get("tag").getAsString();
        List<TagKey<Item>> tierTags = new ArrayList<>();
        for (int t = 1; t <= maxLevel; t++) tierTags.add(itemTag(prefix + t));
        JsonObject useGate = hardness.has("useGate") ? hardness.getAsJsonObject("useGate") : new JsonObject();
        String containerItems = useGate.has("containerItems") ? useGate.get("containerItems").getAsString() : prefix + "container_items";
        return new Settings(maxLevel, unlock, tierTags, itemTag(prefix + "gated"), itemTag(containerItems),
                strings(useGate, "allowedMenus"), strings(useGate, "inventoryMenus"));
    }

    private static TagKey<Item> itemTag(String id) {
        return TagKey.create(Registries.ITEM, ResourceLocation.parse(id));
    }

    private static Set<String> strings(JsonObject object, String key) {
        Set<String> out = new HashSet<>();
        if (object.has(key)) for (JsonElement e : object.getAsJsonArray(key)) out.add(e.getAsString());
        return out;
    }
}
