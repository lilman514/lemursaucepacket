package net.lemursaucepacket.fixes.hud;

import com.mojang.blaze3d.platform.InputConstants;

import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.commands.Commands;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.config.ModConfig;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.RegisterClientCommandsEvent;
import net.neoforged.neoforge.client.event.RegisterKeyMappingsEvent;
import net.neoforged.neoforge.client.event.RenderGuiLayerEvent;
import net.neoforged.neoforge.client.event.RenderGuiEvent;
import net.neoforged.neoforge.client.gui.VanillaGuiLayers;
import net.neoforged.neoforge.common.ModConfigSpec;
import net.neoforged.neoforge.common.NeoForge;

/**
 * The HUD layout editor's client side: the "Edit HUD layout" key (unbound by default), the {@code /hudlayout}
 * client command, moving the two vanilla parts (status effects, boss bar) and writing remembered Project MMO
 * positions back after a pack update replaced its config. The ESC menu opens {@link HudLayoutScreen} through
 * FancyMenu's {@code opengui} action. Loaded only on the client.
 */
public final class HudLayoutClient {
    public static final KeyMapping KEY = new KeyMapping("key.lsp_fixes.hud_layout", InputConstants.UNKNOWN.getValue(), "key.categories.lsp_fixes");
    private static boolean openNextTick;
    private static boolean effectsPushed;
    private static boolean bossPushed;

    public static void init(IEventBus modBus, ModContainer container) {
        container.registerConfig(ModConfig.Type.CLIENT, HudConfig.SPEC);
        modBus.addListener(HudLayoutClient::onRegisterKeys);
        NeoForge.EVENT_BUS.addListener(HudLayoutClient::onClientTick);
        NeoForge.EVENT_BUS.addListener(HudLayoutClient::onRegisterCommands);
        NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, HudLayoutClient::onLayerPre);
        NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, HudLayoutClient::onLayerPost);
        NeoForge.EVENT_BUS.addListener(HudLayoutClient::onLoggingIn);
        NeoForge.EVENT_BUS.addListener(EventPriority.HIGHEST, HudLayoutClient::onGuiPre);
    }

    private static void onGuiPre(RenderGuiEvent.Pre event) {
        if (Minecraft.getInstance().screen instanceof HudLayoutScreen) event.setCanceled(true);
    }

    private static void onRegisterKeys(RegisterKeyMappingsEvent event) {
        event.register(KEY);
    }

    private static void onRegisterCommands(RegisterClientCommandsEvent event) {
        // The chat screen closes after the command runs, so the editor opens on the next tick.
        event.getDispatcher().register(Commands.literal("hudlayout").executes(context -> {
            openNextTick = true;
            return 1;
        }));
    }

    private static void onClientTick(ClientTickEvent.Post event) {
        Minecraft mc = Minecraft.getInstance();
        while (KEY.consumeClick()) {
            if (mc.screen == null) openNextTick = true;
        }
        if (openNextTick && mc.player != null && mc.screen == null) {
            openNextTick = false;
            mc.setScreen(new HudLayoutScreen());
        }
    }

    // ---- vanilla parts: a translate around the layer. LOWEST priority, so it only runs when no other
    // listener cancelled the layer (a cancelled Pre gets no Post, which would leave the pose pushed).

    private static void onLayerPre(RenderGuiLayerEvent.Pre event) {
        if (Minecraft.getInstance().screen instanceof HudLayoutScreen) {
            event.setCanceled(true);
            return;
        }
        if (event.getName().toString().equals("create:goggle_info") && !HudConfig.GOGGLES_VISIBLE.get()) {
            event.setCanceled(true);
            return;
        }
        if (event.getName().equals(VanillaGuiLayers.EFFECTS)) {
            if (!HudConfig.EFFECTS_VISIBLE.get()) {
                quietXaeroPushBoxes("POTION_EFFECTS_PUSH_BOX", "POTION_EFFECTS_SHIFT_PUSH_BOX");
                event.setCanceled(true);
                return;
            }
            int cols = HudElements.VanillaEffects.columns();
            if (cols == 0) return;
            int sw = event.getGuiGraphics().guiWidth(), sh = event.getGuiGraphics().guiHeight();
            int x = HudConfig.EFFECTS_X.get(), y = HudConfig.EFFECTS_Y.get();
            int vanillaLeft = sw - 25 * cols;
            int dx = x < 0 ? x + 1 : x - vanillaLeft;
            dx = Math.max(-vanillaLeft, Math.min(0, dx));
            int dy = Math.max(-1, Math.min(sh - 52, y));
            if (dx == 0 && dy == 0) return;
            event.getGuiGraphics().pose().pushPose();
            event.getGuiGraphics().pose().translate(dx, dy, 0);
            effectsPushed = true;
        } else if (event.getName().equals(VanillaGuiLayers.BOSS_OVERLAY)) {
            if (!HudConfig.BOSS_VISIBLE.get()) {
                quietXaeroPushBoxes("BOSS_HEALTH_PUSH_BOX", "BOSS_HEALTH_SHIFT_PUSH_BOX");
                event.setCanceled(true);
                return;
            }
            int sw = event.getGuiGraphics().guiWidth(), sh = event.getGuiGraphics().guiHeight();
            int room = sw / 2 - 91;
            int dx = Math.max(-room, Math.min(room, HudConfig.BOSS_BAR_X.get()));
            int dy = Math.max(-3, Math.min(sh - 20, HudConfig.BOSS_BAR_Y.get()));
            if (dx == 0 && dy == 0) return;
            event.getGuiGraphics().pose().pushPose();
            event.getGuiGraphics().pose().translate(dx, dy, 0);
            bossPushed = true;
        }
    }

    private static void onLayerPost(RenderGuiLayerEvent.Post event) {
        if (effectsPushed && event.getName().equals(VanillaGuiLayers.EFFECTS)) {
            effectsPushed = false;
            event.getGuiGraphics().pose().popPose();
            quietXaeroPushBoxes("POTION_EFFECTS_PUSH_BOX", "POTION_EFFECTS_SHIFT_PUSH_BOX");
        } else if (bossPushed && event.getName().equals(VanillaGuiLayers.BOSS_OVERLAY)) {
            bossPushed = false;
            event.getGuiGraphics().pose().popPose();
            quietXaeroPushBoxes("BOSS_HEALTH_PUSH_BOX", "BOSS_HEALTH_SHIFT_PUSH_BOX");
        }
    }

    private static boolean xaeroBroken;
    private static java.lang.reflect.Method xaeroSetActive;
    private static final java.util.Map<String, Object> XAERO_BOXES = new java.util.HashMap<>();

    /**
     * Xaero's Minimap moves itself out of the way of the effect icons and boss bars, assuming vanilla's places
     * (its "push boxes", switched on after those layers draw). Once we've moved them elsewhere that push is
     * wrong, so it is switched off again for that frame. This runs after Xaero's own listener (lowest priority).
     */
    private static void quietXaeroPushBoxes(String... fields) {
        if (xaeroBroken || !net.neoforged.fml.ModList.get().isLoaded("xaerominimap")) return;
        try {
            if (xaeroSetActive == null) xaeroSetActive = Reflect.cls("xaero.hud.pushbox.PushBox").getMethod("setActive", boolean.class);
            for (String field : fields) {
                Object box = XAERO_BOXES.get(field);
                if (box == null) {
                    box = Reflect.staticField("xaero.hud.pushbox.BuiltInPushBoxes", field);
                    XAERO_BOXES.put(field, box);
                }
                xaeroSetActive.invoke(box, false);
            }
        } catch (Throwable t) {
            xaeroBroken = true;
            HudElements.warnOnce("Xaero's push boxes", t);
        }
    }

    // ---- positions saved into configs the pack ships

    private static void onLoggingIn(ClientPlayerNetworkEvent.LoggingIn event) {
        restoreRemembered();
    }

    /**
     * The launcher re-applies a config the pack ships whenever the pack's copy changes, which would undo a
     * layout saved into it. Project MMO's pmmo-client.toml is the one such file, so its positions are also kept
     * in lsp_fixes-client.toml and written back here if they differ.
     */
    static void restoreRemembered() {
        if (!net.neoforged.fml.ModList.get().isLoaded("pmmo")) return;
        try {
            boolean changed = restore("Client.GUI.Gain List Xoffset", HudConfig.PMMO_GAIN_X)
                    | restore("Client.GUI.Gain List Yoffset", HudConfig.PMMO_GAIN_Y)
                    | restore("Client.GUI.Skill List Xoffset", HudConfig.PMMO_SKILLS_X)
                    | restore("Client.GUI.Skill List Yoffset", HudConfig.PMMO_SKILLS_Y)
                    | restoreVisibility("Client.GUI.Display Skill List", HudConfig.PMMO_SKILLS_VISIBLE)
                    | restoreVisibility("Client.GUI.Display Gain List", HudConfig.PMMO_GAINS_VISIBLE);
            if (changed) {
                Reflect.specOf("pmmo-client.toml").save();
                HudElements.LOGGER.info("HUD layout: put your saved Project MMO positions back into pmmo-client.toml");
            }
        } catch (Throwable t) {
            HudElements.warnOnce("restoring Project MMO positions", t);
        }
    }

    private static boolean restore(String path, ModConfigSpec.DoubleValue remembered) throws Exception {
        double want = remembered.get();
        if (want < 0) return false;
        ModConfigSpec.ConfigValue<?> value = Reflect.configValue("pmmo-client.toml", path);
        if (Math.abs(((Number) value.get()).doubleValue() - want) < 1e-6) return false;
        Reflect.set(value, want);
        return true;
    }

    private static boolean restoreVisibility(String path, ModConfigSpec.IntValue remembered) throws Exception {
        if (remembered.get() < 0) return false;
        boolean want = remembered.get() == 1;
        ModConfigSpec.ConfigValue<?> value = Reflect.configValue("pmmo-client.toml", path);
        if (Boolean.valueOf(want).equals(value.get())) return false;
        Reflect.set(value, want);
        return true;
    }

    private HudLayoutClient() {
    }
}
