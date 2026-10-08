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
        if (mixinClassName.endsWith(".friendsandfoes.FriendsAndFoesTotemHookMixin")) hookFriendsAndFoesTotems(targetClass);
    }

    /** The descriptor of Friends & Foes' totem handler, merged into Player by its PlayerEntityMixin. */
    private static final String FF_TOTEMS_DESC = "(Lnet/minecraft/world/damagesource/DamageSource;FLorg/spongepowered/asm/mixin/injection/callback/CallbackInfoReturnable;)V";

    /**
     * Puts {@code if (!Gates.friendsAndFoesTotemReady(this)) return;} at the top of Friends & Foes' totem handler. Says in
     * the log whether it found it; the startup self-check reads the system property.
     */
    private static void hookFriendsAndFoesTotems(ClassNode player) {
        for (org.objectweb.asm.tree.MethodNode m : player.methods) {
            // Mixin renames it on the way in: handler$<id>$friendsandfoes$tryUseTotems (the source says friendsandfoes_tryUseTotems).
            if (!m.name.contains("friendsandfoes") || !m.name.endsWith("tryUseTotems") || !FF_TOTEMS_DESC.equals(m.desc)) continue;
            org.objectweb.asm.tree.InsnList check = new org.objectweb.asm.tree.InsnList();
            org.objectweb.asm.tree.LabelNode carryOn = new org.objectweb.asm.tree.LabelNode();
            check.add(new org.objectweb.asm.tree.VarInsnNode(org.objectweb.asm.Opcodes.ALOAD, 0));
            check.add(new org.objectweb.asm.tree.MethodInsnNode(org.objectweb.asm.Opcodes.INVOKESTATIC, "net/lemursaucepacket/fixes/skills/Gates",
                    "friendsAndFoesTotemReady", "(Lnet/minecraft/world/entity/player/Player;)Z", false));
            check.add(new org.objectweb.asm.tree.JumpInsnNode(org.objectweb.asm.Opcodes.IFNE, carryOn));
            check.add(new org.objectweb.asm.tree.InsnNode(org.objectweb.asm.Opcodes.RETURN));
            check.add(carryOn);
            m.instructions.insert(check);
            System.setProperty("lsp_fixes.friendsAndFoesTotemsGated", "true");
            LOGGER.info("Friends & Foes' totems wait for their skill level ({})", m.name);
            return;
        }
        StringBuilder seen = new StringBuilder();
        for (org.objectweb.asm.tree.MethodNode m : player.methods) if (m.name.contains("friendsandfoes") || m.name.contains("Totem")) seen.append(' ').append(m.name).append(m.desc);
        LOGGER.warn("Friends & Foes' totem handler wasn't found in Player: its Totems of Freezing and Illusion aren't gated (Friends & Foes methods there:{})", seen);
    }
}
