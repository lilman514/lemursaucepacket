package net.lemursaucepacket.fixes.mixin.relics;

import it.hurts.sskirillss.relics.api.relics.data.AbilitiesData;
import net.lemursaucepacket.fixes.skills.GateNotice;
import net.lemursaucepacket.fixes.skills.Levels;
import net.lemursaucepacket.fixes.skills.SkillGates;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Relics' abilities need the skill level their relic is gated at (skill_gates.json "wear", from skills/modded.mjs):
 * below it a worn relic's passive abilities do nothing and its active ones won't start, the way the Climbing Boots
 * work. Project MMO's wear rule only slows the wearer; this is what stops the relic itself. Every relic ability asks
 * {@code canPlayerUse} (and active ones {@code canPlayerActivate}) before it does anything.
 */
@Mixin(value = it.hurts.sskirillss.relics.api.relics.data.AbilityData.class, remap = false)
public abstract class AbilityDataMixin {
    @Shadow
    @Final
    private AbilitiesData abilitiesData;

    @Inject(method = "canPlayerUse", at = @At("HEAD"), cancellable = true)
    private void lsp$skillGate(LivingEntity entity, CallbackInfoReturnable<Boolean> cir) {
        if (entity instanceof Player player && !lsp_fixes$hasLevel(player)) cir.setReturnValue(false);
    }

    @Inject(method = "canPlayerActivate", at = @At("HEAD"), cancellable = true)
    private void lsp_fixes$skillToActivate(Player player, CallbackInfoReturnable<Boolean> cir) {
        if (!lsp_fixes$hasLevel(player)) cir.setReturnValue(false);
    }

    @Unique
    private boolean lsp_fixes$hasLevel(Player player) {
        ItemStack stack = this.abilitiesData.getRelicData().getStack();
        SkillGates.Need need = SkillGates.wear(stack);
        if (need == null) return true;
        int have = Levels.of(player, need.skill());
        if (have >= need.level()) return true;
        // Said on the server only (GateNotice), at most every two minutes per relic: abilities ask every tick.
        GateNotice.tell(player, "relic:" + stack.getItem(), "Your " + stack.getHoverName().getString() + " won't work until you have " + GateNotice.needs(need, have) + ".", 120_000);
        return false;
    }
}
