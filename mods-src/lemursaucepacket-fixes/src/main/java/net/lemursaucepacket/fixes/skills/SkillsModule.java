package net.lemursaucepacket.fixes.skills;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

import net.lemursaucepacket.fixes.LspFixes;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.BrewingStandMenu;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BrewingStandBlockEntity;
import net.minecraft.world.scores.DisplaySlot;
import net.minecraft.world.scores.Objective;
import net.minecraft.world.scores.Scoreboard;
import net.minecraft.world.scores.criteria.ObjectiveCriteria;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModList;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.attachment.AttachmentType;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.brewing.PlayerBrewedPotionEvent;
import net.neoforged.neoforge.event.entity.living.LivingDropsEvent;
import net.neoforged.neoforge.event.entity.player.ItemFishedEvent;
import net.neoforged.neoforge.event.entity.player.PlayerContainerEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.level.BlockEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import net.neoforged.neoforge.registries.DeferredRegister;
import net.neoforged.neoforge.registries.NeoForgeRegistries;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * RuneScape-style skill progression (docs/skills.md, data in skills/unlocks.mjs): the levels that making things, brewing,
 * drops and fishing treasure wait on ({@link Gates}, {@link SkillGates}), Brewing's XP, and the combat level
 * ({@link Levels#combat}) shown under every player's name. Planting, chopping and gear are Project MMO's own rules.
 */
public final class SkillsModule {
    public static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/skills");
    private static final String COMBAT_OBJECTIVE = "lsp_combat";
    private static final String COOKING_POT_MENU = "vectorwing.farmersdelight.common.block.entity.container.CookingPotMenu";

    private static final DeferredRegister<AttachmentType<?>> ATTACHMENTS = DeferredRegister.create(NeoForgeRegistries.ATTACHMENT_TYPES, LspFixes.MOD_ID);
    /** On brewing stands: who last used one and their Brewing level then. */
    public static final Supplier<AttachmentType<Gates.User>> BREWER = ATTACHMENTS.register("brewer",
            () -> AttachmentType.builder(() -> new Gates.User(net.minecraft.Util.NIL_UUID, 0)).serialize(Gates.User.CODEC).build());
    /** On Farmer's Delight cooking pots: who last used one and their Cooking level then. */
    public static final Supplier<AttachmentType<Gates.User>> COOK = ATTACHMENTS.register("cook",
            () -> AttachmentType.builder(() -> new Gates.User(net.minecraft.Util.NIL_UUID, 0)).serialize(Gates.User.CODEC).build());
    /** On machines (Create's, the Crafter, placed backpacks): who placed or last used one, and their levels then. */
    public static final Supplier<AttachmentType<Operators.Operator>> OPERATOR = ATTACHMENTS.register("operator",
            () -> AttachmentType.builder(() -> Operators.Operator.NONE).serialize(Operators.Operator.CODEC).build());
    /** The operator attachment's id, as it's saved in a block entity's data (and so in a contraption's). */
    public static final String OPERATOR_ID = LspFixes.MOD_ID + ":operator";

    private static Field potOfMenu;

    public static void init(IEventBus modBus) {
        MachineXp.init(ATTACHMENTS);
        ATTACHMENTS.register(modBus);
        NeoForge.EVENT_BUS.addListener((PlayerBrewedPotionEvent e) -> Gates.onBrewed(e));
        NeoForge.EVENT_BUS.addListener((LivingDropsEvent e) -> Gates.onDrops(e));
        NeoForge.EVENT_BUS.addListener((ItemFishedEvent e) -> Gates.onFished(e));
        NeoForge.EVENT_BUS.addListener((net.neoforged.neoforge.event.entity.living.LivingUseTotemEvent e) -> Gates.onTotem(e));
        NeoForge.EVENT_BUS.addListener((PlayerContainerEvent.Open e) -> remember(e.getContainer(), e.getEntity()));
        NeoForge.EVENT_BUS.addListener((ServerStartedEvent e) -> selfCheck());
        NeoForge.EVENT_BUS.addListener((ServerTickEvent.Post e) -> {
            if (e.getServer().getTickCount() % 100 == 31) showCombatLevels(e.getServer());
            // Who carries which backpack (its upgrades work at that player's level), once a second.
            if (e.getServer().getTickCount() % 20 == 7 && ModList.get().isLoaded("sophisticatedcore"))
                for (ServerPlayer p : e.getServer().getPlayerList().getPlayers()) net.lemursaucepacket.fixes.compat.BackpackCarriers.scan(p);
        });
        // Machines run at their operator's level: whoever placed them, or last right-clicked them.
        NeoForge.EVENT_BUS.addListener((BlockEvent.EntityPlaceEvent e) -> {
            if (e.getEntity() instanceof ServerPlayer p && Operators.isMachine(e.getLevel().getBlockEntity(e.getPos()))) Operators.set(e.getLevel().getBlockEntity(e.getPos()), p);
        });
        NeoForge.EVENT_BUS.addListener((PlayerInteractEvent.RightClickBlock e) -> {
            if (e.getEntity() instanceof ServerPlayer p && Operators.isMachine(e.getLevel().getBlockEntity(e.getPos()))) Operators.set(e.getLevel().getBlockEntity(e.getPos()), p);
        });
        NeoForge.EVENT_BUS.addListener((PlayerEvent.PlayerLoggedOutEvent e) -> GateNotice.forget(e.getEntity().getUUID()));
        if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.skills.client.SkillsClient.init(modBus);
    }

    /** A brewing stand or cooking pot remembers who opened it, and their level, for when hoppers feed it. */
    private static void remember(AbstractContainerMenu menu, net.minecraft.world.entity.player.Player player) {
        if (menu instanceof BrewingStandMenu stand && ((net.lemursaucepacket.fixes.mixin.BrewingStandMenuAccessor) stand).lsp$stand() instanceof BrewingStandBlockEntity be) {
            Gates.rememberBrewer(be, player);
        } else if (COOKING_POT_MENU.equals(menu.getClass().getName())) {
            try {
                if (potOfMenu == null) potOfMenu = menu.getClass().getField("blockEntity");
                if (potOfMenu.get(menu) instanceof BlockEntity pot) Gates.rememberCook(pot, player);
            } catch (ReflectiveOperationException ex) {
                LOGGER.warn("Couldn't find the cooking pot behind its menu", ex);
            }
        }
    }

    /**
     * Which gates are in: each is a mixin, and one whose target moved (a mod update) is skipped without a word, so this
     * looks for each one's handler in its class and says which are missing.
     */
    private static void selfCheck() {
        String[][] gates = {
                {"crafting grids", "minecraft", "net.minecraft.world.inventory.Slot"},
                {"smithing table", "minecraft", "net.minecraft.world.inventory.SmithingMenu"},
                {"brewing stand slot", "minecraft", "net.minecraft.world.inventory.BrewingStandMenu$IngredientsSlot"},
                {"brewing stand", "minecraft", "net.minecraft.world.level.block.entity.BrewingStandBlockEntity"},
                {"Crafter", "minecraft", "net.minecraft.world.level.block.CrafterBlock"},
                {"cooking pot slot", "neoforge", "net.neoforged.neoforge.items.SlotItemHandler"},
                {"cooking pot", "farmersdelight", "vectorwing.farmersdelight.common.block.entity.CookingPotBlockEntity"},
                {"mechanical crafters", "create", "com.simibubi.create.content.kinetics.crafter.RecipeGridHandler"},
                {"mechanical crafters' operators", "create", "com.simibubi.create.content.kinetics.crafter.MechanicalCrafterBlockEntity"},
                {"basins", "create", "com.simibubi.create.content.processing.basin.BasinRecipe"},
                {"spouts", "create", "com.simibubi.create.content.fluids.spout.FillingBySpout"},
                {"spouts' operators", "create", "com.simibubi.create.content.fluids.spout.SpoutBlockEntity"},
                {"relic abilities", "relics", "it.hurts.sskirillss.relics.api.relics.data.AbilityData"},
                {"backpack upgrades", "sophisticatedcore", "net.p3pp3rf1y.sophisticatedcore.upgrades.UpgradeWrapperBase"},
                {"backpack pickup (Hardness)", "sophisticatedcore", "net.p3pp3rf1y.sophisticatedcore.util.InventoryHelper"},
                {"placed backpacks' operators", "sophisticatedbackpacks", "net.p3pp3rf1y.sophisticatedbackpacks.backpack.BackpackBlockEntity"},
                {"crafting blueprint", "create", "com.simibubi.create.content.equipment.blueprint.BlueprintEntity"},
                {"airships carry free blocks", "sable", "dev.ryanhcode.sable.api.SubLevelAssemblyHelper"},
                {"drills spare free blocks", "create", "com.simibubi.create.foundation.utility.BlockHelper"},
                {"drills and saws", "create", "com.simibubi.create.content.kinetics.base.BlockBreakingKineticBlockEntity"},
                {"drills and saws on contraptions", "create", "com.simibubi.create.content.kinetics.base.BlockBreakingMovementBehaviour"},
        };
        List<String> in = new ArrayList<>(), missing = new ArrayList<>();
        for (String[] g : gates) {
            if (!"minecraft".equals(g[1]) && !"neoforge".equals(g[1]) && !ModList.get().isLoaded(g[1])) continue;
            boolean found = false;
            try {
                for (Method m : Class.forName(g[2], false, SkillsModule.class.getClassLoader()).getDeclaredMethods()) {
                    if (m.getName().endsWith("lsp$skillGate") || m.getName().endsWith("lsp$freeBlocks")) {
                        found = true;
                        break;
                    }
                }
            } catch (ClassNotFoundException | LinkageError ex) {
                // counted as missing
            }
            (found ? in : missing).add(g[0]);
        }
        // Machine XP's hooks (MachineXp): the same check, by their own handlers' name.
        String[][] machineXp = {
                {"drills and saws", "create", "com.simibubi.create.content.kinetics.base.BlockBreakingKineticBlockEntity"},
                {"saws' felled trees", "create", "com.simibubi.create.content.kinetics.saw.SawBlockEntity"},
                {"actors on contraptions", "create", "com.simibubi.create.content.kinetics.base.BlockBreakingMovementBehaviour"},
                {"harvesters", "create", "com.simibubi.create.content.contraptions.actors.harvester.HarvesterMovementBehaviour"},
                {"what machines break", "create", "com.simibubi.create.foundation.utility.BlockHelper"},
                {"fans", "create", "com.simibubi.create.content.kinetics.fan.AirCurrent"},
                {"fans' smelting", "create", "com.simibubi.create.content.kinetics.fan.processing.AllFanProcessingTypes$BlastingType"},
                {"fans' smoking", "create", "com.simibubi.create.content.kinetics.fan.processing.AllFanProcessingTypes$SmokingType"},
                {"basins", "create", "com.simibubi.create.content.processing.basin.BasinRecipe"},
                {"mechanical crafters", "create", "com.simibubi.create.content.kinetics.crafter.RecipeGridHandler"},
                {"the Crafter", "minecraft", "net.minecraft.world.level.block.CrafterBlock"},
        };
        List<String> xpIn = new ArrayList<>(), xpMissing = new ArrayList<>();
        for (String[] g : machineXp) {
            if (!"minecraft".equals(g[1]) && !ModList.get().isLoaded(g[1])) continue;
            try {
                Class.forName(g[2], false, SkillsModule.class.getClassLoader()); // loads it, so its mixins apply now
            } catch (ClassNotFoundException | LinkageError ex) {
                // counted as missing below
            }
            // The mixin plugin notes each class that got a handler (LspFixesMixinPlugin.noteMachineXp).
            boolean found = System.getProperty("lsp_fixes.machineXpHooked", "").contains("|" + g[2] + "|");
            (found ? xpIn : xpMissing).add(g[0]);
        }
        if (xpMissing.isEmpty()) LOGGER.info("Machine XP in: {}", String.join(", ", xpIn));
        else LOGGER.error("Machine XP MISSING: {} (in: {})", String.join(", ", xpMissing), String.join(", ", xpIn));
        // Friends & Foes' totems are hooked by the mixin plugin, not a named handler (LspFixesMixinPlugin).
        if (ModList.get().isLoaded("friendsandfoes")) ("true".equals(System.getProperty("lsp_fixes.friendsAndFoesTotemsGated")) ? in : missing).add("Friends & Foes totems");
        if (missing.isEmpty()) LOGGER.info("Skill gates in: {}", String.join(", ", in));
        else LOGGER.error("Skill gates MISSING: {} (in: {})", String.join(", ", missing), String.join(", ", in));
    }

    /** Everyone's combat level under their name, as RuneScape shows it over players' heads. */
    private static void showCombatLevels(MinecraftServer server) {
        Scoreboard board = server.getScoreboard();
        Objective objective = board.getObjective(COMBAT_OBJECTIVE);
        if (objective == null) {
            objective = board.addObjective(COMBAT_OBJECTIVE, ObjectiveCriteria.DUMMY, Component.literal("Combat").withStyle(ChatFormatting.GOLD),
                    ObjectiveCriteria.RenderType.INTEGER, true, null);
        }
        if (board.getDisplayObjective(DisplaySlot.BELOW_NAME) != objective) board.setDisplayObjective(DisplaySlot.BELOW_NAME, objective);
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            int level = Levels.combat(p);
            var score = board.getOrCreatePlayerScore(p, objective);
            if (score.get() != level) score.set(level);
        }
    }

    private SkillsModule() {
    }
}
