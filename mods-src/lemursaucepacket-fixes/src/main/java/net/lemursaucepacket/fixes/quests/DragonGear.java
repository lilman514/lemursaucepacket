package net.lemursaucepacket.fixes.quests;

import java.util.Map;
import java.util.WeakHashMap;

import net.minecraft.ChatFormatting;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.TagKey;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.damagesource.DamageType;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.event.entity.living.LivingEquipmentChangeEvent;
import net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent;
import net.neoforged.neoforge.event.entity.player.ItemTooltipEvent;
import net.neoforged.neoforge.event.tick.PlayerTickEvent;

/**
 * What the Dragon Slayer quests change about gear, RuneScape style. Dragonscale and dragonsteel armour (the
 * {@code lemursaucepacket:dragonslayer_armor} item tag, made from the scales of Ice and Fire's dragons) can only be worn
 * once you have slain Elvarg and finished Dragon Slayer II, the way the rune platebody waits on Dragon Slayer. And the
 * Anti-dragon Shield (the mayor gives one in Dragon Slayer I) takes most of the sting out of dragon breath while you hold
 * it, the Ender Dragon's as well as Ice and Fire's dragons', and keeps their fire from catching on you.
 */
public final class DragonGear {
    public static final String DONE = "q_ds2_done";
    public static final String SHIELD = "antidragon_shield";
    static final TagKey<Item> ARMOR = TagKey.create(Registries.ITEM, ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "dragonslayer_armor"));
    private static final ResourceKey<DamageType>[] BREATH = breath();
    /** Share of dragon breath damage the shield lets through. */
    private static final float SHIELD_PASSES = 0.2f;
    /** When each shield holder last took a dragon's breath (game time), so the fire it sets can be put out. */
    private static final Map<ServerPlayer, Long> SHIELDED = new WeakHashMap<>();

    @SuppressWarnings("unchecked")
    private static ResourceKey<DamageType>[] breath() {
        String[] kinds = {"dragon_fire", "dragon_ice", "dragon_lightning"};
        ResourceKey<DamageType>[] out = new ResourceKey[kinds.length];
        for (int i = 0; i < kinds.length; i++) out[i] = ResourceKey.create(Registries.DAMAGE_TYPE, ResourceLocation.fromNamespaceAndPath("iceandfire", kinds[i]));
        return out;
    }

    /** Armour put on without the quest comes straight off again. */
    static void onEquip(LivingEquipmentChangeEvent event) {
        if (!(event.getEntity() instanceof ServerPlayer player) || event.getSlot().getType() != EquipmentSlot.Type.HUMANOID_ARMOR) return;
        ItemStack worn = event.getTo();
        if (worn.isEmpty() || !worn.is(ARMOR) || player.getTags().contains(DONE) || player.isCreative()) return;
        ItemStack off = worn.copy();
        player.setItemSlot(event.getSlot(), ItemStack.EMPTY);
        if (!player.getInventory().add(off)) player.drop(off, false);
        player.displayClientMessage(Component.literal("Only those who have slain Elvarg may wear dragon armour (Dragon Slayer II).").withStyle(ChatFormatting.RED), true);
        player.playNotifySound(SoundEvents.VILLAGER_NO, SoundSource.PLAYERS, 0.6f, 1f);
    }

    static boolean isShield(ItemStack stack) {
        return QuestSteps.isQuestItem(stack, SHIELD);
    }

    static boolean holdsShield(Player player) {
        return isShield(player.getMainHandItem()) || isShield(player.getOffhandItem());
    }

    static boolean isBreath(DamageSource source) {
        for (ResourceKey<DamageType> key : BREATH) {
            if (source.is(key)) return true;
        }
        // The Ender Dragon's breath: its lingering cloud hurts as (indirect) magic, with her as the cause.
        if (source.is(net.minecraft.world.damagesource.DamageTypes.DRAGON_BREATH)) return true;
        return source.getEntity() instanceof net.minecraft.world.entity.boss.enderdragon.EnderDragon
                && (source.is(net.minecraft.world.damagesource.DamageTypes.MAGIC) || source.is(net.minecraft.world.damagesource.DamageTypes.INDIRECT_MAGIC));
    }

    static void onDamage(LivingIncomingDamageEvent event) {
        if (!(event.getEntity() instanceof ServerPlayer player) || !isBreath(event.getSource()) || !holdsShield(player)) return;
        event.setAmount(event.getAmount() * SHIELD_PASSES);
        SHIELDED.put(player, player.level().getGameTime());
    }

    /** Nor does a dragon's fire catch on whoever holds the shield: the burning its breath leaves (25 s) is put out. */
    static void onPlayerTick(PlayerTickEvent.Post event) {
        if (!(event.getEntity() instanceof ServerPlayer player) || !player.isOnFire()) return;
        Long at = SHIELDED.get(player);
        if (at == null) return;
        if (player.level().getGameTime() - at > 40) SHIELDED.remove(player);
        else if (holdsShield(player)) player.clearFire();
    }

    /** Client and server: the requirement on the armour's tooltip. */
    static void onTooltip(ItemTooltipEvent event) {
        ItemStack stack = event.getItemStack();
        if (stack.is(ARMOR)) event.getToolTip().add(Component.literal("Requires: Dragon Slayer II").withStyle(ChatFormatting.DARK_RED));
        else if (isShield(stack)) event.getToolTip().add(Component.literal("Blocks most of a dragon's breath, and its fire, while held.").withStyle(ChatFormatting.GOLD));
    }

    private DragonGear() {
    }
}
