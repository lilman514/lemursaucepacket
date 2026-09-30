package net.lemursaucepacket.fixes;

import java.util.List;
import java.util.Set;

import net.neoforged.fml.loading.LoadingModList;
import org.objectweb.asm.tree.ClassNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.spongepowered.asm.mixin.extensibility.IMixinConfigPlugin;
import org.spongepowered.asm.mixin.extensibility.IMixinInfo;

/**
 * Applies a mixin only when the mod it patches is installed. The rule is the package name:
 * {@code mixin.pmmo.DetailScrollMixin} needs mod id {@code pmmo}. A mixin directly in the
 * {@code mixin} package always applies.
 *
 * <p>Lives outside the mixin package on purpose (classes there can't be loaded normally), and must
 * not touch Minecraft classes: it runs before the game is set up.
 */
public final class LspFixesMixinPlugin implements IMixinConfigPlugin {
    private static final Logger LOGGER = LoggerFactory.getLogger(LspFixes.MOD_ID);
    private String mixinPackage = "";

    @Override
    public void onLoad(String mixinPackage) {
        this.mixinPackage = mixinPackage + ".";
    }

    @Override
    public boolean shouldApplyMixin(String targetClassName, String mixinClassName) {
        if (!mixinClassName.startsWith(mixinPackage)) return true;
        String relative = mixinClassName.substring(mixinPackage.length());
        int dot = relative.indexOf('.');
        if (dot < 0) return true;
        String modId = relative.substring(0, dot);
        if (LoadingModList.get().getModFileById(modId) != null) return true;
        LOGGER.info("Skipping {}: mod '{}' is not installed", relative, modId);
        return false;
    }

    @Override
    public String getRefMapperConfig() {
        return null;
    }

    @Override
    public void acceptTargets(Set<String> myTargets, Set<String> otherTargets) {
    }

    @Override
    public List<String> getMixins() {
        return null;
    }

    @Override
    public void preApply(String targetClassName, ClassNode targetClass, String mixinClassName, IMixinInfo mixinInfo) {
    }

    @Override
    public void postApply(String targetClassName, ClassNode targetClass, String mixinClassName, IMixinInfo mixinInfo) {
    }
}
