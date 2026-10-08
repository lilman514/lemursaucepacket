package net.lemursaucepacket.nekomasfixed.registry;

import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.clock.StoredTime;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.registries.Registries;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModComponents {
    static final DeferredRegister.DataComponents COMPONENTS = DeferredRegister.createDataComponents(Registries.DATA_COMPONENT_TYPE, NekomasFixed.MOD_ID);

    /** The time of day a clock recorded (upstream registers it as {@code minecraft:stored_time}; ours is namespaced). */
    public static final DeferredHolder<DataComponentType<?>, DataComponentType<StoredTime>> STORED_TIME = COMPONENTS.registerComponentType("stored_time",
            builder -> builder.persistent(StoredTime.CODEC).networkSynchronized(StoredTime.STREAM_CODEC));

    private ModComponents() {
    }
}
