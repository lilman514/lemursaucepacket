package net.lemursaucepacket.fixes.capes;

import java.util.function.Supplier;

import net.lemursaucepacket.fixes.LspFixes;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModList;
import net.neoforged.fml.event.lifecycle.FMLCommonSetupEvent;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.attachment.AttachmentType;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.entity.EntityLeaveLevelEvent;
import net.neoforged.neoforge.event.entity.living.LivingEntityUseItemEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.level.BlockEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import net.neoforged.neoforge.registries.DeferredRegister;
import net.neoforged.neoforge.registries.NeoForgeRegistries;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Capes (docs/capes.md): items you earn and wear in their own Curios slot, "cape". Only a player who has earned a cape
 * can wear it, and anyone can stand one on an armor stand. Unlocks, perks and the collection screen (ESC → Capes, or
 * /capes) are here; who wears what is just what's in the slot, so Curios saves and syncs it, and the client draws it
 * where the vanilla cape goes ({@code mixin.CapeSkinMixin}) or on the stand ({@code client.StandCapeLayer}).
 */
public final class CapesModule {
    public static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/capes");
    /** Curios is in the pack; without it (a bare dev run) capes are only data. */
    public static final boolean CURIOS = ModList.get().isLoaded("curios");

    private static final DeferredRegister<AttachmentType<?>> ATTACHMENTS = DeferredRegister.create(NeoForgeRegistries.ATTACHMENT_TYPES, LspFixes.MOD_ID);
    public static final Supplier<AttachmentType<CapeData>> DATA = ATTACHMENTS.register("capes",
            () -> AttachmentType.builder(CapeData::new).serialize(CapeData.CODEC).copyOnDeath().build());

    public static void init(IEventBus modBus) {
        CapeDefs.load();
        ATTACHMENTS.register(modBus);
        modBus.addListener(CapeNet::register);
        modBus.addListener((FMLCommonSetupEvent e) -> {
            if (CURIOS) e.enqueueWork(CapeCurio::register);
        });
        NeoForge.EVENT_BUS.addListener((RegisterCommandsEvent e) -> CapeCommands.register(e.getDispatcher()));
        NeoForge.EVENT_BUS.addListener((PlayerEvent.PlayerLoggedInEvent e) -> {
            if (e.getEntity() instanceof ServerPlayer p) Capes.onLogin(p);
        });
        NeoForge.EVENT_BUS.addListener((ServerTickEvent.Post e) -> {
            int tick = e.getServer().getTickCount();
            if (tick % 20 != 7) return;
            for (ServerPlayer p : e.getServer().getPlayerList().getPlayers()) {
                try {
                    if (tick % 100 == 7) Capes.checkUnlocks(p);
                } catch (Exception ex) {
                    LOGGER.error("Cape unlock check failed for {}", p.getGameProfile().getName(), ex);
                }
            }
        });
        NeoForge.EVENT_BUS.addListener((BlockEvent.BreakEvent e) -> Capes.onBreak(e));
        NeoForge.EVENT_BUS.addListener((LivingEntityUseItemEvent.Finish e) -> Capes.onEat(e));
        NeoForge.EVENT_BUS.addListener((PlayerInteractEvent.RightClickItem e) -> Capes.onUse(e));
        if (CURIOS) {
            NeoForge.EVENT_BUS.addListener(EventPriority.HIGH, (PlayerInteractEvent.EntityInteractSpecific e) -> CapeCurio.onStandInteract(e));
            NeoForge.EVENT_BUS.addListener((EntityLeaveLevelEvent e) -> CapeCurio.onLeave(e));
        }
        if (ModList.get().isLoaded("pmmo")) CapePmmo.init();
        if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.capes.client.CapesClient.init(modBus);
    }

    private CapesModule() {
    }
}
