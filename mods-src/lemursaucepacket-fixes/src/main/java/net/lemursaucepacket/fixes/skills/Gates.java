package net.lemursaucepacket.fixes.skills;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

import net.minecraft.ChatFormatting;
import net.minecraft.core.UUIDUtil;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.crafting.Ingredient;
import net.minecraft.world.item.crafting.Recipe;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BrewingStandBlockEntity;
import net.neoforged.neoforge.attachment.AttachmentType;
import net.neoforged.neoforge.fluids.FluidStack;
import net.neoforged.neoforge.event.brewing.PlayerBrewedPotionEvent;
import net.neoforged.neoforge.event.entity.living.LivingDropsEvent;
import net.neoforged.neoforge.event.entity.player.ItemFishedEvent;

/**
 * Where the gates bite (the mixins in {@code mixin} ask these): making a gated item (crafting grid, smithing table, cooking
 * pot, Create's crafting blueprint), putting a gated ingredient in a brewing stand, a stand brewing one or a pot cooking
 * one for a hopper, machines with nobody to ask (the Crafter, Create's mechanical crafters, mixer and press), mob drops,
 * and fishing treasure. Also Brewing's XP, for each potion taken from a stand.
 */
public final class Gates {
    /** The player whose click a menu is handling: the brewing stand's ingredient slot only knows the item. */
    public static final ThreadLocal<Player> CLICKING = new ThreadLocal<>();
    private static final String BREWED = "lsp_brewed";

    /**
     * Who last used a brewing stand or a cooking pot, and their level then (Brewing, Cooking): one that hoppers feed works
     * at that level.
     */
    public record User(UUID id, int level) {
        public static final Codec<User> CODEC = RecordCodecBuilder.create(i -> i.group(
                UUIDUtil.STRING_CODEC.fieldOf("id").forGetter(User::id),
                Codec.INT.fieldOf("level").forGetter(User::level)).apply(i, User::new));
    }

    // ---------------------------------------------------------------- making

    /** Whether this player may take this result (make it); says why not. */
    public static boolean mayMake(Player player, ItemStack result) {
        SkillGates.Need need = SkillGates.craft(result);
        if (need == null || Levels.of(player, need.skill()) >= need.level()) return true;
        tell(player, "You need " + Levels.name(need.skill()) + " " + need.level() + " to make " + result.getHoverName().getString()
                + " (you have " + Levels.of(player, need.skill()) + ").");
        return false;
    }

    /** Whether a machine with nobody to ask may make this: only if it isn't gated. */
    public static boolean machineMayMake(ItemStack result) {
        return machineMayMake(null, result);
    }

    /**
     * Whether a machine may make this: anything ungated, and a gated item at its operator's level (whoever placed it or
     * last right-clicked it: {@link Operators}). Tells the operator why not.
     */
    public static boolean machineMayMake(@javax.annotation.Nullable BlockEntity machine, ItemStack result) {
        SkillGates.Need need = SkillGates.craft(result);
        if (need == null) return true;
        if (machine != null && Operators.has(machine, need)) return true;
        Operators.refuse(machine, need, result, "make");
        return false;
    }

    /**
     * Whether a drill or saw may break a block for its operator: Project MMO's break requirement for it (the chop levels
     * on logs) against the operator's levels, as a player's own hands would be held to it. A machine with no operator
     * breaks nothing that waits on a level. Tells the operator why not.
     *
     * @param machine the machine's name ("Mechanical Saw"), for the message
     * @param at      where the machine is (a contraption's: where the actor is now)
     * @param verb    what it does to the block ("cut", "break")
     */
    public static boolean breakerMayBreak(Level level, net.minecraft.core.BlockPos pos, net.minecraft.world.level.block.state.BlockState state,
                                          @javax.annotation.Nullable Operators.Operator operator, String machine, net.minecraft.core.BlockPos at, String verb) {
        Map<String, Integer> req = Levels.toBreak(level, pos);
        if (req.isEmpty()) return true;
        for (Map.Entry<String, Integer> e : req.entrySet()) {
            if (Operators.level(operator, level.getServer(), e.getKey()) >= e.getValue()) continue;
            String block = state.getBlock().getName().getString();
            Operators.refuse(operator, level.getServer(), machine, at, new SkillGates.Need(e.getKey(), e.getValue(), block), block, verb);
            return false;
        }
        return true;
    }

    private static final ResourceLocation FF_FREEZING = ResourceLocation.fromNamespaceAndPath("friendsandfoes", "totem_of_freezing");
    private static final ResourceLocation FF_ILLUSION = ResourceLocation.fromNamespaceAndPath("friendsandfoes", "totem_of_illusion");

    /**
     * Whether Friends & Foes may fire the totem this player would use (its Totem of Freezing or Illusion, from a hand or
     * the charm slot, in that order, as it looks): only at the totem's wear level (skill_gates.json "wear"). Friends &
     * Foes runs its own check on every hit, so the notice is kept to every two minutes. Called from the code
     * LspFixesMixinPlugin puts at the top of Friends & Foes' totem handler.
     */
    public static boolean friendsAndFoesTotemReady(Player player) {
        if (player.level().isClientSide()) return true;
        ItemStack totem = friendsAndFoesTotem(player);
        if (totem.isEmpty()) return true;
        SkillGates.Need need = SkillGates.wear(totem);
        if (need == null) return true;
        int have = Levels.of(player, need.skill());
        if (have >= need.level()) return true;
        GateNotice.tell(player, "ff-totem:" + BuiltInRegistries.ITEM.getKey(totem.getItem()),
                "Your " + totem.getHoverName().getString() + " won't work until you have " + GateNotice.needs(need, have) + ".", 120_000);
        return false;
    }

    private static ItemStack friendsAndFoesTotem(Player player) {
        for (ItemStack hand : new ItemStack[] {player.getMainHandItem(), player.getOffhandItem()}) if (isFriendsAndFoesTotem(hand)) return hand;
        try {
            var curios = top.theillusivec4.curios.api.CuriosApi.getCuriosInventory(player);
            if (curios.isPresent()) {
                var equipped = curios.get().getEquippedCurios();
                for (int i = 0; i < equipped.getSlots(); i++) if (isFriendsAndFoesTotem(equipped.getStackInSlot(i))) return equipped.getStackInSlot(i);
            }
        } catch (RuntimeException | LinkageError e) {
            // no Curios: the hands are all there is
        }
        return ItemStack.EMPTY;
    }

    private static boolean isFriendsAndFoesTotem(ItemStack stack) {
        if (stack.isEmpty()) return false;
        ResourceLocation id = BuiltInRegistries.ITEM.getKey(stack.getItem());
        return FF_FREEZING.equals(id) || FF_ILLUSION.equals(id);
    }

    /** Whether this player may use this recipe (Construction's alternate recipes); says why not. */
    public static boolean mayUseRecipe(Player player, ResourceLocation recipe) {
        SkillGates.Need need = SkillGates.recipe(recipe);
        if (need == null || Levels.of(player, need.skill()) >= need.level()) return true;
        tell(player, "You need " + Levels.name(need.skill()) + " " + need.level() + " for this recipe: " + need.what().toLowerCase(java.util.Locale.ROOT)
                + " (you have " + Levels.of(player, need.skill()) + ").");
        return false;
    }

    /** A machine with nobody to ask never uses a recipe that waits on a level. */
    public static boolean machineMayUseRecipe(ResourceLocation recipe) {
        return machineMayUseRecipe(null, recipe);
    }

    /** A recipe that waits on a level (Construction's alternate recipes) runs in a machine at its operator's level. */
    public static boolean machineMayUseRecipe(@javax.annotation.Nullable BlockEntity machine, ResourceLocation recipe) {
        SkillGates.Need need = SkillGates.recipe(recipe);
        return need == null || machine != null && Operators.has(machine, need);
    }

    private static final ResourceLocation CREATE_POTION = ResourceLocation.fromNamespaceAndPath("create", "potion");
    private static final Map<Class<?>, Optional<Method>> FLUID_RESULTS = new ConcurrentHashMap<>();

    /**
     * Whether a basin may run this recipe (Create's mixer and press, and what other mods cook in one): a gated item, or a
     * potion brewed with a gated ingredient, only at the basin's operator's level ({@link Operators}).
     */
    public static boolean basinMayRun(BlockEntity basin, Recipe<?> recipe) {
        if (basin.getLevel() == null) return true;
        ItemStack out;
        try {
            out = recipe.getResultItem(basin.getLevel().registryAccess());
        } catch (RuntimeException e) {
            out = ItemStack.EMPTY;
        }
        if (out != null && !out.isEmpty() && !machineMayMake(basin, out)) return false;
        if (!makesPotion(recipe)) return true;
        int brewing = Operators.level(basin, "brewing");
        for (Ingredient ingredient : recipe.getIngredients()) {
            for (ItemStack s : ingredient.getItems()) {
                SkillGates.Need need = SkillGates.brew(s);
                if (need != null && need.level() > 1 && brewing < need.level()) {
                    Operators.refuse(basin, need, s, "brew with");
                    return false;
                }
            }
        }
        return true;
    }

    /** A Create processing recipe with a potion among its fluid results: the mixer's brewing (its getFluidResults). */
    private static boolean makesPotion(Recipe<?> recipe) {
        Optional<Method> getter = FLUID_RESULTS.computeIfAbsent(recipe.getClass(), c -> {
            try {
                return Optional.of(c.getMethod("getFluidResults"));
            } catch (NoSuchMethodException e) {
                return Optional.empty();
            }
        });
        if (getter.isEmpty()) return false;
        try {
            if (getter.get().invoke(recipe) instanceof List<?> fluids) {
                for (Object f : fluids)
                    if (f instanceof FluidStack fs && CREATE_POTION.equals(BuiltInRegistries.FLUID.getKey(fs.getFluid()))) return true;
            }
        } catch (ReflectiveOperationException | RuntimeException e) {
            return false;
        }
        return false;
    }

    // ---------------------------------------------------------------- brewing

    /** Whether the clicking player may put this ingredient in a stand. Hoppers (no click) may: the stand checks when it brews. */
    public static boolean mayBrewWith(ItemStack ingredient) {
        Player p = CLICKING.get();
        if (p == null) return true;
        SkillGates.Need need = SkillGates.brew(ingredient);
        if (need == null || Levels.of(p, "brewing") >= need.level()) return true;
        tell(p, "You need Brewing " + need.level() + " to brew with " + ingredient.getHoverName().getString() + " (" + need.what() + ").");
        return false;
    }

    /**
     * Whether a stand may brew with its ingredient: anyone can brew what isn't gated, the rest needs its last user's level.
     * A stand with no potions in it has nothing to brew, so it isn't held up.
     */
    public static boolean standMayBrew(BrewingStandBlockEntity stand, ItemStack ingredient) {
        SkillGates.Need need = SkillGates.brew(ingredient);
        if (need == null || need.level() <= 1) return true;
        if (stand.getItem(0).isEmpty() && stand.getItem(1).isEmpty() && stand.getItem(2).isEmpty()) return true;
        User u = user(stand, SkillsModule.BREWER);
        if (u != null && u.level() >= need.level()) return true;
        tellNearby(stand, u, "This stand needs Brewing " + need.level() + " to brew with " + ingredient.getHoverName().getString()
                + ": you had " + (u == null ? 0 : u.level()) + " when you last used it.");
        return false;
    }

    public static void rememberBrewer(BrewingStandBlockEntity stand, Player player) {
        remember(stand, SkillsModule.BREWER, player, "brewing");
    }

    // ---------------------------------------------------------------- cooking pots

    /** Whether a cooking pot may cook a meal: anyone can cook what isn't gated, the rest needs its last user's level. */
    public static boolean potMayCook(BlockEntity pot, ItemStack meal) {
        SkillGates.Need need = SkillGates.craft(meal);
        if (need == null) return true;
        User u = user(pot, SkillsModule.COOK);
        int level = u == null ? 0 : "cooking".equals(need.skill()) ? u.level() : liveLevel(pot, u, need.skill());
        if (level >= need.level()) return true;
        tellNearby(pot, u, "This pot needs " + Levels.name(need.skill()) + " " + need.level() + " to cook " + meal.getHoverName().getString()
                + ": you had " + level + " when you last used it.");
        return false;
    }

    public static void rememberCook(BlockEntity pot, Player player) {
        remember(pot, SkillsModule.COOK, player, "cooking");
    }

    private static User user(BlockEntity be, Supplier<AttachmentType<User>> type) {
        return be.hasData(type) ? be.getData(type) : null;
    }

    private static void remember(BlockEntity be, Supplier<AttachmentType<User>> type, Player player, String skill) {
        if (player.level().isClientSide()) return;
        be.setData(type, new User(player.getUUID(), Levels.of(player, skill)));
        be.setChanged();
    }

    /** A skill the attachment didn't record: the last user's level now, if they're online. */
    private static int liveLevel(BlockEntity be, User u, String skill) {
        if (be.getLevel() == null || be.getLevel().getServer() == null) return 0;
        ServerPlayer p = be.getLevel().getServer().getPlayerList().getPlayer(u.id());
        return p == null ? 0 : Levels.of(p, skill);
    }

    /** Tells the last user why a stand or pot is waiting, if they're standing by it. */
    private static void tellNearby(BlockEntity be, User u, String message) {
        if (u == null || be.getLevel() == null || be.getLevel().getServer() == null) return;
        ServerPlayer p = be.getLevel().getServer().getPlayerList().getPlayer(u.id());
        if (p != null && p.level() == be.getLevel() && p.blockPosition().closerThan(be.getBlockPos(), 6)) tell(p, message);
    }

    /** Brewing XP for each potion taken out of a stand, once per kind of potion it becomes. */
    static void onBrewed(PlayerBrewedPotionEvent e) {
        if (!(e.getEntity() instanceof ServerPlayer p)) return;
        ItemStack stack = e.getStack();
        int level = SkillGates.potionLevel(stack);
        if (level < 0) return;
        String kind = String.valueOf(stack.get(DataComponents.POTION_CONTENTS).potion().flatMap(h -> h.unwrapKey()).map(k -> k.location() + "/" + stack.getItem()).orElse(""));
        if (kind.equals(stack.getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY).copyTag().getString(BREWED))) return;
        CustomData.update(DataComponents.CUSTOM_DATA, stack, tag -> tag.putString(BREWED, kind));
        Levels.addXp(p, "brewing", Math.round(SkillGates.brewXp(level)));
    }

    // ---------------------------------------------------------------- drops and fishing

    /** A drop that waits on a level comes only when a player with it is the killer. */
    static void onDrops(LivingDropsEvent e) {
        for (SkillGates.Drop d : SkillGates.drops()) {
            if (e.getEntity().getType() != d.entity()) continue;
            Player killer = e.getSource().getEntity() instanceof Player p ? p : null;
            if (killer != null && Levels.of(killer, d.need().skill()) >= d.need().level()) continue;
            boolean removed = e.getDrops().removeIf(item -> item.getItem().is(d.item()));
            if (removed && killer != null) {
                killer.sendSystemMessage(Component.literal("It dropped nothing special: " + d.need().what().toLowerCase(java.util.Locale.ROOT) + " drop only for "
                        + Levels.name(d.need().skill()) + " " + d.need().level() + " (you have " + Levels.of(killer, d.need().skill()) + ").").withStyle(ChatFormatting.GRAY));
            }
        }
    }

    /**
     * A totem of undying (or another held item with a "wear" gate that saves its holder) only saves a player with its
     * level (skill_gates.json "wear": Hitpoints 50 for the totem). Below it the totem stays in the hand, unused.
     */
    static void onTotem(net.neoforged.neoforge.event.entity.living.LivingUseTotemEvent e) {
        if (!(e.getEntity() instanceof ServerPlayer p)) return;
        SkillGates.Need need = SkillGates.wear(e.getTotem());
        if (need == null || Levels.of(p, need.skill()) >= need.level()) return;
        e.setCanceled(true);
        GateNotice.tell(p, "totem:" + e.getTotem().getItem(), "Your " + e.getTotem().getHoverName().getString() + " didn't save you: it needs "
                + GateNotice.needs(need, Levels.of(p, need.skill())) + ".", 1_000);
    }

    /** Below the Fishing level for treasure, treasure on the line comes up as a cod. */
    static void onFished(ItemFishedEvent e) {
        slipTreasure(e.getEntity(), e.getDrops());
    }

    /**
     * Treasure in a catch that the player's Fishing level can't land yet: empties it (the hook spawns these same stacks)
     * and hands over a cod for each. Returns how many slipped.
     */
    public static int slipTreasure(Player p, java.util.List<ItemStack> drops) {
        int need = SkillGates.fishingTreasure();
        if (need <= 0 || Levels.of(p, "fishing") >= need) return 0;
        int slipped = 0;
        for (ItemStack s : drops) {
            if (!treasure(s)) continue;
            s.setCount(0);
            slipped++;
        }
        if (slipped == 0) return 0;
        ItemStack cod = new ItemStack(Items.COD, slipped);
        if (!p.getInventory().add(cod)) p.drop(cod, false);
        tell(p, "Treasure on the line slipped off: you need Fishing " + need + " to land it.");
        return slipped;
    }

    private static boolean treasure(ItemStack s) {
        if (s.is(Items.ENCHANTED_BOOK) || s.is(Items.NAME_TAG) || s.is(Items.SADDLE) || s.is(Items.NAUTILUS_SHELL)) return true;
        return (s.is(Items.BOW) || s.is(Items.FISHING_ROD)) && s.isEnchanted();
    }

    // ---------------------------------------------------------------- telling

    /** A chat line and a ding (GateNotice), the same one at most every few seconds, from the server only. */
    static void tell(Player p, String message) {
        if (p.level().isClientSide()) return;
        GateNotice.tell(p, message, message, 4_000);
    }

    private Gates() {
    }
}
