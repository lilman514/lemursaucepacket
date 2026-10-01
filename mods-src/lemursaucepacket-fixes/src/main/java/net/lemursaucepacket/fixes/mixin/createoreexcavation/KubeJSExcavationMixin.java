package net.lemursaucepacket.fixes.mixin.createoreexcavation;

import net.neoforged.fml.loading.LoadingModList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Create Ore Excavation's KubeJS plugin leaves the ProcessingOutput type wrapper to KubeJS Create when that mod
 * is installed, but it reads the answer from {@code CreateOreExcavation.kubeJSCreate}, which COE only sets in its
 * own mod constructor. KubeJS runs the plugin from its constructor, and COE depends on KubeJS, so with
 * single-threaded mod loading (fml.toml maxThreads = 1) KubeJS always gets there first: the flag is still false,
 * both mods register the wrapper and the game stops with "Wrapper for class ... ProcessingOutput already exists".
 * Setting the flag when KubeJS creates the plugin gives COE the right answer in time.
 */
@Mixin(targets = "com.tom.createores.kubejs.KubeJSExcavation", remap = false)
public abstract class KubeJSExcavationMixin {
    private static final Logger LSP$LOGGER = LoggerFactory.getLogger("lsp_fixes");

    @Inject(method = "<init>", at = @At("RETURN"))
    private void lsp$setKubeJSCreateFlag(CallbackInfo ci) {
        try {
            boolean loaded = LoadingModList.get().getModFileById("kubejs_create") != null;
            Class.forName("com.tom.createores.CreateOreExcavation").getField("kubeJSCreate").setBoolean(null, loaded);
        } catch (ReflectiveOperationException | RuntimeException e) {
            LSP$LOGGER.warn("Could not set Create Ore Excavation's kubeJSCreate flag early: {}", e.toString());
        }
    }
}
