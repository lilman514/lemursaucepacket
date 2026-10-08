package net.lemursaucepacket.nekomasfixed.client;

import java.util.ArrayList;
import java.util.List;

import net.lemursaucepacket.nekomasfixed.clock.StoredTime;
import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.lemursaucepacket.nekomasfixed.registry.ModBlocks;
import net.lemursaucepacket.nekomasfixed.registry.ModComponents;
import net.lemursaucepacket.nekomasfixed.registry.ModMenus;
import net.lemursaucepacket.nekomasfixed.registry.ModRecipes;
import net.minecraft.ChatFormatting;
import net.minecraft.client.RecipeBookCategories;
import net.minecraft.client.renderer.BlockEntityWithoutLevelRenderer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.Item;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;
import net.neoforged.neoforge.client.event.RegisterMenuScreensEvent;
import net.neoforged.neoforge.client.event.RegisterRecipeBookCategoriesEvent;
import net.neoforged.neoforge.client.extensions.common.IClientItemExtensions;
import net.neoforged.neoforge.client.extensions.common.RegisterClientExtensionsEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.entity.player.ItemTooltipEvent;

/**
 * The client side: block entity renderers (clock, beds, shulker boxes), the kiln screen, the item renderer for the new
 * beds and boxes, and the recorded time in a clock's tooltip. Render layers (translucent glass, cutout torches) are set
 * in the block models' {@code render_type}.
 */
public final class NekomasFixedClient {
    public static void init(IEventBus modBus) {
        modBus.addListener(NekomasFixedClient::registerRenderers);
        modBus.addListener(NekomasFixedClient::registerScreens);
        modBus.addListener(NekomasFixedClient::registerItemExtensions);
        modBus.addListener(NekomasFixedClient::registerRecipeBook);
        NeoForge.EVENT_BUS.addListener(NekomasFixedClient::addStoredTimeTooltip);
    }

    private static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
        event.registerBlockEntityRenderer(ModBlockEntities.CLOCK.get(), ClockRenderer::new);
        event.registerBlockEntityRenderer(ModBlockEntities.BED.get(), DyedBedRenderer::new);
        event.registerBlockEntityRenderer(ModBlockEntities.SHULKER_BOX.get(), DyedShulkerBoxRenderer::new);
    }

    private static void registerScreens(RegisterMenuScreensEvent event) {
        event.register(ModMenus.KILN.get(), KilnScreen::new);
    }

    private static void registerItemExtensions(RegisterClientExtensionsEvent event) {
        List<Item> items = new ArrayList<>();
        for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) {
            items.add(family.bed().get().asItem());
            items.add(family.shulkerBox().get().asItem());
        }
        event.registerItem(new IClientItemExtensions() {
            private BlockEntityWithoutLevelRenderer renderer;

            @Override
            public BlockEntityWithoutLevelRenderer getCustomRenderer() {
                if (renderer == null) renderer = new DyedBlockItemRenderer(); // needs the game's renderers, so not before first use
                return renderer;
            }
        }, items.toArray(Item[]::new));
    }

    /** The kiln has no recipe book; filing its recipes under "unknown" keeps the client log free of a warning per recipe. */
    private static void registerRecipeBook(RegisterRecipeBookCategoriesEvent event) {
        event.registerRecipeCategoryFinder(ModRecipes.KILN.get(), recipe -> RecipeBookCategories.UNKNOWN);
    }

    private static void addStoredTimeTooltip(ItemTooltipEvent event) {
        StoredTime time = event.getItemStack().get(ModComponents.STORED_TIME.get());
        if (time == null) return;
        event.getToolTip().add(Math.min(1, event.getToolTip().size()),
                Component.translatable("component.nekomasfixed.storedtime", StoredTime.format(time.time())).withStyle(ChatFormatting.GRAY));
    }

    private NekomasFixedClient() {
    }
}
