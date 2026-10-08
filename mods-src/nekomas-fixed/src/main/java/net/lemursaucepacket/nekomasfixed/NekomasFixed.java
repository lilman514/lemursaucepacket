package net.lemursaucepacket.nekomasfixed;

import org.slf4j.Logger;

import com.mojang.logging.LogUtils;

import net.lemursaucepacket.nekomasfixed.clock.ClockItemEvents;
import net.lemursaucepacket.nekomasfixed.redstone.StruckRedstone;
import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.lemursaucepacket.nekomasfixed.registry.ModBlocks;
import net.lemursaucepacket.nekomasfixed.registry.ModRegistries;
import net.minecraft.core.cauldron.CauldronInteraction;
import net.minecraft.core.dispenser.ShulkerBoxDispenseBehavior;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.DispenserBlock;
import net.minecraft.world.level.block.FireBlock;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.event.lifecycle.FMLCommonSetupEvent;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.capabilities.Capabilities;
import net.neoforged.neoforge.capabilities.RegisterCapabilitiesEvent;
import net.neoforged.neoforge.items.wrapper.SidedInvWrapper;

/**
 * Nekoma's Fixed for NeoForge, batch 1: new blocks, items and tools only. Nothing here changes how vanilla content
 * behaves, except that the vanilla clock can now be placed and can record a time ({@link ClockItemEvents}).
 *
 * <p>Ported from GreenJAB's Fabric mod (its 1.21.1 branch by Strikey5852; the kiln from main). Registration is in
 * {@code registry/}, the client side in {@code client/}, the Redstone Striker's signal hooks in {@code mixin/}.
 */
@Mod(NekomasFixed.MOD_ID)
public final class NekomasFixed {
    public static final String MOD_ID = "nekomasfixed";
    public static final Logger LOGGER = LogUtils.getLogger();

    public NekomasFixed(IEventBus modBus, ModContainer container) {
        ModRegistries.register(modBus);
        modBus.addListener(NekomasFixed::commonSetup);
        modBus.addListener(NekomasFixed::registerCapabilities);
        ClockItemEvents.init();
        StruckRedstone.init();
        if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.nekomasfixed.client.NekomasFixedClient.init(modBus);
    }

    public static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(MOD_ID, path);
    }

    private static void commonSetup(FMLCommonSetupEvent event) {
        // Vanilla's tables are plain maps, so they are filled on the main thread.
        event.enqueueWork(() -> {
            FireBlock fire = (FireBlock) Blocks.FIRE;
            for (ModBlocks.DyeFamily family : ModBlocks.FAMILIES.values()) {
                fire.setFlammable(family.wool().get(), 30, 60); // vanilla wool and carpet numbers
                fire.setFlammable(family.carpet().get(), 60, 20);
                Item box = family.shulkerBox().get().asItem();
                CauldronInteraction.WATER.map().put(box, CauldronInteraction.SHULKER_BOX); // washes to a plain box, contents kept
                DispenserBlock.registerBehavior(box, new ShulkerBoxDispenseBehavior());
            }
        });
    }

    /** Pipes, funnels and hoppers from other mods reach blocks through capabilities; vanilla's furnace and boxes get theirs from NeoForge. */
    private static void registerCapabilities(RegisterCapabilitiesEvent event) {
        event.registerBlockEntity(Capabilities.ItemHandler.BLOCK, ModBlockEntities.KILN.get(), SidedInvWrapper::new);
        event.registerBlockEntity(Capabilities.ItemHandler.BLOCK, ModBlockEntities.SHULKER_BOX.get(), SidedInvWrapper::new);
    }
}
