package net.lemursaucepacket.nekomasfixed.registry;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import net.lemursaucepacket.nekomasfixed.Colour;
import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.item.RedstoneStrikerItem;
import net.minecraft.core.Direction;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.BedItem;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.StandingAndWallBlockItem;
import net.minecraft.world.item.component.ItemContainerContents;
import net.minecraft.world.level.block.Block;
import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

/** Every item of batch 1, kept in creative-tab order in {@link #ALL}. */
public final class ModItems {
    static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(NekomasFixed.MOD_ID);
    private static final List<DeferredItem<? extends Item>> ORDER = new ArrayList<>();
    /** All our items in the order the creative tab lists them. */
    public static final List<DeferredItem<? extends Item>> ALL = Collections.unmodifiableList(ORDER);

    public static final DeferredItem<StandingAndWallBlockItem> GLOW_TORCH = add(ITEMS.register("glow_torch",
            () -> new StandingAndWallBlockItem(ModBlocks.GLOW_TORCH.get(), ModBlocks.GLOW_WALL_TORCH.get(), new Item.Properties(), Direction.DOWN)));
    public static final DeferredItem<RedstoneStrikerItem> REDSTONE_STRIKER = add(ITEMS.registerItem("redstone_striker",
            RedstoneStrikerItem::new, new Item.Properties().durability(64)));
    public static final DeferredItem<BlockItem> KILN = block(ModBlocks.KILN);

    /**
     * The new dyes. Plain crafting items, not {@code DyeItem}s: DyeItem's constructor would take over a vanilla colour's
     * slot in {@code DyeItem.byColor} (breaking sheep and trades), and they aren't in {@code #c:dyes} either, or vanilla's
     * shulker box dyeing would accept them and make a white box.
     */
    public static final Map<Colour, DeferredItem<Item>> DYES;

    static {
        Map<Colour, DeferredItem<Item>> dyes = new EnumMap<>(Colour.class);
        for (Colour colour : Colour.NEW) dyes.put(colour, add(ITEMS.registerSimpleItem(colour.getSerializedName() + "_dye")));
        DYES = Collections.unmodifiableMap(dyes);

        for (DeferredBlock<?> froglight : ModBlocks.FROGLIGHTS) block(froglight);
        // Grouped by kind, like vanilla's colored blocks tab.
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) block(family.wool());
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) block(family.carpet());
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) block(family.terracotta());
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) block(family.glazedTerracotta());
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) block(family.concrete());
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) block(family.concretePowder());
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) block(family.stainedGlass());
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) block(family.stainedGlassPane());
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) block(family.candle());
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) {
            add(ITEMS.register(family.bed().getId().getPath(), () -> new BedItem(family.bed().get(), new Item.Properties().stacksTo(1))));
        }
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) {
            add(ITEMS.registerSimpleBlockItem(family.shulkerBox().getId().getPath(), family.shulkerBox(),
                    new Item.Properties().stacksTo(1).component(DataComponents.CONTAINER, ItemContainerContents.EMPTY)));
        }
        for (ModBlocks.BrickSet set : ModBlocks.BRICKS.values()) block(set.bricks());
        for (ModBlocks.BrickSet set : ModBlocks.BRICKS.values()) block(set.slab());
        for (ModBlocks.BrickSet set : ModBlocks.BRICKS.values()) block(set.stairs());
        for (ModBlocks.BrickSet set : ModBlocks.BRICKS.values()) block(set.wall());
    }

    private static DeferredItem<BlockItem> block(DeferredBlock<? extends Block> block) {
        return add(ITEMS.registerSimpleBlockItem(block));
    }

    private static <T extends DeferredItem<? extends Item>> T add(T item) {
        ORDER.add(item);
        return item;
    }

    private ModItems() {
    }
}
