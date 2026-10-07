package net.lemursaucepacket.instances;

import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureProcessorType;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * LemurSaucePacket Instances: instanced events. An NPC tagged {@code lsp_event.<namespace>.<name>} opens that event's
 * window; the fight runs in its own copy of the arena ({@link InstanceManager}); a death inside sends the player's
 * things to the event's keeper ({@link InstanceRules}). Events are data ({@link EventDef}).
 */
@Mod(LspInstances.MOD_ID)
public final class LspInstances {
    public static final String MOD_ID = "lsp_instances";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    private static final DeferredRegister<StructureProcessorType<?>> PROCESSORS = DeferredRegister.create(Registries.STRUCTURE_PROCESSOR, MOD_ID);
    public static final DeferredHolder<StructureProcessorType<?>, StructureProcessorType<StripContainers>> STRIP_CONTAINERS =
            PROCESSORS.register("strip_containers", () -> () -> StripContainers.CODEC);
    public static final DeferredHolder<StructureProcessorType<?>, StructureProcessorType<ArenaReplace>> ARENA_REPLACE =
            PROCESSORS.register("arena_replace", () -> () -> ArenaReplace.CODEC);

    public static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(MOD_ID, path);
    }

    public LspInstances(IEventBus modBus, ModContainer container) {
        PROCESSORS.register(modBus);
        modBus.addListener(InstanceNet::register);
        InstanceRules.init();
        if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.instances.client.InstancesClient.init();
    }
}
