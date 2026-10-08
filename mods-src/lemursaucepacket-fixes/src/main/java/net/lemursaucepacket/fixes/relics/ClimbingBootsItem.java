package net.lemursaucepacket.fixes.relics;

import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;

import it.hurts.sskirillss.relics.api.relics.AbilityMetricTemplate;
import it.hurts.sskirillss.relics.api.relics.AbilityStatisticTemplate;
import it.hurts.sskirillss.relics.api.relics.RelicTemplate;
import it.hurts.sskirillss.relics.api.relics.abilities.AbilitiesTemplate;
import it.hurts.sskirillss.relics.api.relics.abilities.AbilityTemplate;
import it.hurts.sskirillss.relics.api.relics.abilities.ExperienceSourceTemplate;
import it.hurts.sskirillss.relics.api.relics.abilities.ExperienceSourcesTemplate;
import it.hurts.sskirillss.relics.api.relics.abilities.stats.AbilityStatTemplate;
import it.hurts.sskirillss.relics.api.relics.data.AbilityData;
import it.hurts.sskirillss.relics.init.RelicsScalingModels;
import it.hurts.sskirillss.relics.items.relics.base.WearableRelicItem;
import it.hurts.sskirillss.relics.items.relics.base.data.leveling.LevelingTemplate;
import it.hurts.sskirillss.relics.items.relics.base.data.loot.LootTemplate;
import it.hurts.sskirillss.relics.utils.EntityUtils;
import it.hurts.sskirillss.relics.utils.MathUtils;
import net.lemursaucepacket.fixes.LspFixes;
import net.lemursaucepacket.fixes.skills.Levels;
import net.lemursaucepacket.fixes.skills.SkillGates;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.AttributeModifier.Operation;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import top.theillusivec4.curios.api.SlotContext;

/**
 * The Climbing Boots, a relic for the Relics mod's feet slot (made with Crafting, worn with Agility: skills/unlocks.mjs).
 * Their one ability, Foothold, steps the wearer up full blocks without jumping, and every ledge stepped up gives a
 * moment of extra speed; the relic levels from the ledges it climbs, and its points raise both. Like Relics' own
 * relics, the ability works once it's unlocked on the relic's page (Shift over it in a menu, then click the ability).
 *
 * <p>Short of the Agility level the boots do nothing (Project MMO's wear rule also slows the wearer, as with armour).
 * Everything happens on the server; the two attributes reach the client like any other.
 */
public class ClimbingBootsItem extends WearableRelicItem {
    static final String ABILITY = "foothold";
    /** Vanilla's own step (0.6) plus a little: a rise between two ticks on the ground that only the boots allow. */
    private static final double STEP = 0.62;
    private static final int MOMENTUM_TICKS = 40;

    private static final class Track {
        double y;
        boolean ground;
        int momentumUntil;
    }

    private static final Map<LivingEntity, Track> TRACKS = new WeakHashMap<>();

    @Override
    public RelicTemplate constructDefaultRelicTemplate() {
        return RelicTemplate.builder()
                .abilities(AbilitiesTemplate.builder()
                        .ability(AbilityTemplate.builder(ABILITY)
                                // Added to the player's 0.6: a full block from the start, a block and a quarter at best.
                                .stat(AbilityStatTemplate.builder("step_height")
                                        .initialValue(0.45, 0.5)
                                        .targetValue(RelicsScalingModels.MULTIPLICATIVE_BASE.get(), 0.65)
                                        .formatValue(value -> MathUtils.round(0.6 + value, 2))
                                        .build())
                                // Speed for two seconds after each ledge.
                                .stat(AbilityStatTemplate.builder("momentum")
                                        .initialValue(0.04, 0.06)
                                        .targetValue(RelicsScalingModels.MULTIPLICATIVE_BASE.get(), 0.2)
                                        .formatValue(value -> (int) MathUtils.round(value * 100.0, 0))
                                        .build())
                                .experienceSources(ExperienceSourcesTemplate.builder()
                                        .source(ExperienceSourceTemplate.builder("climbing").build())
                                        .build())
                                .statistic(AbilityStatisticTemplate.builder()
                                        .metric(AbilityMetricTemplate.builder("ledges_climbed").formatValue(value -> String.valueOf((int) MathUtils.round(value, 0))).build())
                                        .build())
                                .build())
                        .build())
                .leveling(LevelingTemplate.builder().initialCost(100.0).step(100.0).maxRank(0).build())
                // Made, never found: no loot.
                .loot(LootTemplate.builder().build())
                .build();
    }

    @Override
    public void curioTick(SlotContext slot, ItemStack stack) {
        super.curioTick(slot, stack);
        LivingEntity entity = slot.entity();
        if (entity.level().isClientSide()) return;
        ResourceLocation stepId = id(slot, "step_height"), speedId = id(slot, "momentum");
        AbilityData ability = getRelicData(entity, stack).getAbilitiesData().getAbilityData(ABILITY);
        if (!(entity instanceof Player player) || !ready(player) || ability == null || !ability.canPlayerUse(player)) {
            EntityUtils.removeAttribute(entity, Attributes.STEP_HEIGHT, Operation.ADD_VALUE, stepId);
            EntityUtils.removeAttribute(entity, Attributes.MOVEMENT_SPEED, Operation.ADD_MULTIPLIED_TOTAL, speedId);
            TRACKS.remove(entity);
            return;
        }
        EntityUtils.resetAttribute(entity, Attributes.STEP_HEIGHT, (float) ability.getStatData("step_height").getValue(), Operation.ADD_VALUE, stepId);

        // A step up: from the ground, higher in one tick than vanilla's step allows (a jump rises 0.42 at most). The
        // tick of the step itself doesn't count as on the ground (the move went up), so only the tick before must.
        Track track = TRACKS.computeIfAbsent(entity, e -> new Track());
        double y = entity.getY();
        boolean ground = entity.onGround();
        double rise = y - track.y;
        if (track.ground && rise > STEP && rise < 2 && !entity.isPassenger()) {
            getRelicData(entity, stack).getLevelingData().addExperience(ABILITY, "climbing", 1.0);
            ability.getStatisticData().getMetricData("ledges_climbed").addValue(1.0);
            track.momentumUntil = entity.tickCount + MOMENTUM_TICKS;
        }
        track.y = y;
        track.ground = ground;
        if (entity.tickCount < track.momentumUntil)
            EntityUtils.resetAttribute(entity, Attributes.MOVEMENT_SPEED, (float) ability.getStatData("momentum").getValue(), Operation.ADD_MULTIPLIED_TOTAL, speedId);
        else
            EntityUtils.removeAttribute(entity, Attributes.MOVEMENT_SPEED, Operation.ADD_MULTIPLIED_TOTAL, speedId);
    }

    @Override
    public void onUnequip(SlotContext slot, ItemStack newStack, ItemStack stack) {
        super.onUnequip(slot, newStack, stack);
        // Curios calls this whenever the stack in the slot changes, and a relic's data changes as it ticks and levels:
        // only a real taking off (something else in the slot) clears the boots' effects.
        if (newStack.is(this)) return;
        LivingEntity entity = slot.entity();
        EntityUtils.removeAttribute(entity, Attributes.STEP_HEIGHT, Operation.ADD_VALUE, id(slot, "step_height"));
        EntityUtils.removeAttribute(entity, Attributes.MOVEMENT_SPEED, Operation.ADD_MULTIPLIED_TOTAL, id(slot, "momentum"));
        TRACKS.remove(entity);
    }

    @Override
    public void appendHoverText(ItemStack stack, Item.TooltipContext context, List<Component> lines, TooltipFlag flag) {
        super.appendHoverText(stack, context, lines, flag);
        // What they do, and the step Relics asks first. (The level they need is the pack's own "Requires" line.)
        lines.add(Component.literal("Step up full blocks without jumping.").withStyle(ChatFormatting.GRAY));
        lines.add(Component.literal("Unlock Foothold on its page to use it.").withStyle(ChatFormatting.DARK_GRAY));
    }

    /** Whether the wearer has the level the boots need (skill_gates.json "wear"). */
    private static boolean ready(Player player) {
        SkillGates.Need need = SkillGates.wear(PackRelics.CLIMBING_BOOTS.get().getDefaultInstance());
        return need == null || Levels.of(player, need.skill()) >= need.level();
    }

    private static ResourceLocation id(SlotContext slot, String what) {
        return ResourceLocation.fromNamespaceAndPath(LspFixes.MOD_ID, "climbing_boots_" + what + "_" + slot.identifier() + "_" + slot.index());
    }
}
