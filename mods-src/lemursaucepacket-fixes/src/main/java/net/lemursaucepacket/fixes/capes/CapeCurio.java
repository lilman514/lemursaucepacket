package net.lemursaucepacket.fixes.capes;

import com.google.common.collect.LinkedHashMultimap;
import com.google.common.collect.Multimap;
import com.google.gson.JsonObject;

import net.minecraft.core.Holder;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Block;
import net.neoforged.neoforge.event.entity.EntityLeaveLevelEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import top.theillusivec4.curios.api.CuriosApi;
import top.theillusivec4.curios.api.SlotContext;
import top.theillusivec4.curios.api.type.capability.ICurio;
import top.theillusivec4.curios.api.type.capability.ICurioItem;
import top.theillusivec4.curios.api.type.inventory.ICurioStacksHandler;

/**
 * Capes in Curios. The "cape" slot (data/lemursaucepacket/curios/slots/cape.json) belongs to players and armor stands
 * (curios/entities/capes.json); the cape items are in the {@code curios:cape} item tag. Players wear only the capes they
 * have earned, stands show any. A worn cape's attributes come through Curios (they show on the item as "When worn"), its
 * effects and mending from {@link Capes#tickPerks}. Right-click a stand with a cape to hang it there (the one already
 * on it comes back to you); sneak and right-click with an empty hand to take it; break the stand and the cape drops.
 */
final class CapeCurio implements ICurioItem {
    static final String SLOT = "cape";
    private static final CapeCurio INSTANCE = new CapeCurio();

    /** Each cape item gets its Curios behaviour once the items exist (KubeJS registers them). */
    static void register() {
        int n = 0;
        for (CapeDefs.Def def : CapeDefs.all()) {
            if (def.item() == Items.AIR) {
                CapesModule.LOGGER.warn("No item for the {}: it can't be worn", def.id());
                continue;
            }
            CuriosApi.registerCurio(def.item(), INSTANCE);
            n++;
        }
        CapesModule.LOGGER.info("{} cape items can be worn in the Curios '{}' slot", n, SLOT);
    }

    // ---------------------------------------------------------------- the slot

    private static java.util.Optional<ICurioStacksHandler> slot(LivingEntity e) {
        return CuriosApi.getCuriosInventory(e).flatMap(h -> h.getStacksHandler(SLOT)).filter(h -> h.getSlots() > 0);
    }

    /** What's in an entity's cape slot (empty if it has none). */
    static ItemStack worn(LivingEntity e) {
        return slot(e).map(h -> h.getStacks().getStackInSlot(0)).orElse(ItemStack.EMPTY);
    }

    /** Whether the slot's "show" toggle (the eye in the Curios panel) is on. */
    static boolean shown(LivingEntity e) {
        return slot(e).map(h -> h.getRenders().isEmpty() || h.getRenders().get(0)).orElse(false);
    }

    static boolean setWorn(LivingEntity e, ItemStack stack) {
        var h = slot(e);
        h.ifPresent(s -> s.getStacks().setStackInSlot(0, stack));
        return h.isPresent();
    }

    // ---------------------------------------------------------------- the cape as a curio

    @Override
    public boolean canEquip(SlotContext context, ItemStack stack) {
        CapeDefs.Def def = CapeDefs.of(stack);
        if (def == null || !SLOT.equals(context.identifier())) return false;
        if (context.entity() instanceof ArmorStand) return true;
        return context.entity() instanceof Player p && Capes.owns(p, def.id());
    }

    @Override
    public boolean canEquipFromUse(SlotContext context, ItemStack stack) {
        return context.entity() instanceof Player;
    }

    @Override
    public ICurio.SoundInfo getEquipSound(SlotContext context, ItemStack stack) {
        return new ICurio.SoundInfo(SoundEvents.ARMOR_EQUIP_LEATHER.value(), 1f, 1f);
    }

    @Override
    public void curioTick(SlotContext context, ItemStack stack) {
        if (!(context.entity() instanceof ServerPlayer p)) return;
        CapeDefs.Def def = CapeDefs.of(stack);
        if (def != null && Capes.owns(p, def.id())) Capes.tickPerks(p, def);
    }

    /** A cape's attribute perks ({@code perk.attributes} in capes.mjs), for the player wearing it (not for a stand). */
    @Override
    public Multimap<Holder<Attribute>, AttributeModifier> getAttributeModifiers(SlotContext context, ResourceLocation id, ItemStack stack) {
        Multimap<Holder<Attribute>, AttributeModifier> map = LinkedHashMultimap.create();
        CapeDefs.Def def = CapeDefs.of(stack);
        if (def == null || !def.perk().has("attributes") || context.entity() instanceof ArmorStand) return map;
        JsonObject attributes = def.perk().getAsJsonObject("attributes");
        for (String key : attributes.keySet()) {
            double amount = attributes.get(key).getAsDouble();
            ResourceLocation modifier = ResourceLocation.fromNamespaceAndPath(id.getNamespace(), id.getPath() + "/" + key.toLowerCase(java.util.Locale.ROOT));
            switch (key) {
                case "armor" -> map.put(Attributes.ARMOR, new AttributeModifier(modifier, amount, AttributeModifier.Operation.ADD_VALUE));
                case "toughness" -> map.put(Attributes.ARMOR_TOUGHNESS, new AttributeModifier(modifier, amount, AttributeModifier.Operation.ADD_VALUE));
                case "health" -> map.put(Attributes.MAX_HEALTH, new AttributeModifier(modifier, amount, AttributeModifier.Operation.ADD_VALUE));
                case "speed" -> map.put(Attributes.MOVEMENT_SPEED, new AttributeModifier(modifier, amount, AttributeModifier.Operation.ADD_MULTIPLIED_TOTAL));
                case "luck" -> map.put(Attributes.LUCK, new AttributeModifier(modifier, amount, AttributeModifier.Operation.ADD_VALUE));
                case "breakSpeed" -> map.put(Attributes.BLOCK_BREAK_SPEED, new AttributeModifier(modifier, amount, AttributeModifier.Operation.ADD_MULTIPLIED_TOTAL));
                default -> CapesModule.LOGGER.warn("The {} has an unknown attribute perk '{}'", def.id(), key);
            }
        }
        return map;
    }

    // ---------------------------------------------------------------- armor stands

    static void onStandInteract(PlayerInteractEvent.EntityInteractSpecific e) {
        if (!(e.getTarget() instanceof ArmorStand stand) || stand.isMarker() || e.getEntity().isSpectator()) return;
        Player p = e.getEntity();
        ItemStack held = p.getItemInHand(e.getHand());
        CapeDefs.Def def = CapeDefs.of(held);
        ItemStack on = worn(stand);
        boolean server = !e.getLevel().isClientSide();
        if (def != null) {
            if (server) {
                ItemStack cape = p.getAbilities().instabuild ? held.copyWithCount(1) : held.split(1);
                setWorn(stand, cape);
                if (!on.isEmpty()) {
                    if (held.isEmpty()) p.setItemInHand(e.getHand(), on);
                    else if (!p.getInventory().add(on)) p.drop(on, false);
                }
                stand.level().playSound(null, stand.getX(), stand.getY(), stand.getZ(), SoundEvents.ARMOR_EQUIP_LEATHER, SoundSource.PLAYERS, 1f, 1f);
            }
        } else if (held.isEmpty() && p.isShiftKeyDown() && !on.isEmpty()) {
            if (server) {
                setWorn(stand, ItemStack.EMPTY);
                p.setItemInHand(e.getHand(), on);
                stand.level().playSound(null, stand.getX(), stand.getY(), stand.getZ(), SoundEvents.ARMOR_EQUIP_LEATHER, SoundSource.PLAYERS, 1f, 0.8f);
            }
        } else {
            return;
        }
        e.setCanceled(true);
        e.setCancellationResult(InteractionResult.sidedSuccess(!server));
    }

    /** A stand broken (by hand, an explosion, fire or /kill) drops its cape; one unloaded with its chunk keeps it. */
    static void onLeave(EntityLeaveLevelEvent e) {
        if (e.getLevel().isClientSide() || !(e.getEntity() instanceof ArmorStand stand) || stand.getRemovalReason() != Entity.RemovalReason.KILLED) return;
        ItemStack on = worn(stand);
        if (on.isEmpty()) return;
        setWorn(stand, ItemStack.EMPTY);
        Block.popResource(e.getLevel(), stand.blockPosition().above(), on);
    }

    private CapeCurio() {
    }
}
