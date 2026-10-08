package net.lemursaucepacket.nekomasfixed.registry;

import net.lemursaucepacket.nekomasfixed.Colour;
import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

/** One creative tab with everything; the vanilla clock is in it too, since placing it is one of the features. */
public final class ModCreativeTab {
    static final DeferredRegister<CreativeModeTab> TABS = DeferredRegister.create(Registries.CREATIVE_MODE_TAB, NekomasFixed.MOD_ID);

    public static final DeferredHolder<CreativeModeTab, CreativeModeTab> TAB = TABS.register(NekomasFixed.MOD_ID, () -> CreativeModeTab.builder()
            .title(Component.translatable("itemGroup.nekomasfixed"))
            .icon(() -> new ItemStack(ModItems.DYES.get(Colour.AMBER).get()))
            .displayItems((parameters, output) -> {
                for (var item : ModItems.ALL) {
                    output.accept(item.get());
                    if (item == ModItems.REDSTONE_STRIKER) output.accept(Items.CLOCK);
                }
            })
            .build());

    private ModCreativeTab() {
    }
}
