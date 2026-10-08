package net.lemursaucepacket.fixes.skills;

import java.lang.reflect.Method;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

import javax.annotation.Nullable;

import com.mojang.serialization.Codec;

import it.unimi.dsi.fastutil.longs.LongOpenHashSet;
import net.lemursaucepacket.fixes.xpbank.XpBankBlockEntity;
import net.lemursaucepacket.fixes.xpbank.XpBanks;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.CropBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.LevelChunk;
import net.neoforged.bus.api.Event;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.attachment.AttachmentType;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.common.util.FakePlayer;
import net.neoforged.neoforge.event.level.BlockEvent;
import net.neoforged.neoforge.event.level.PistonEvent;
import net.neoforged.neoforge.registries.DeferredRegister;

/**
 * Machine XP (pack 1.16.0, the owner's call: "give the nearest person to the machine the XP, even if it's 2 people that
 * are nearby just give them both XP. it has to be dynamic and passive"). When a Create machine does a skill's work,
 * every player within {@code playerRange} blocks of it gets the XP that work pays by hand, each the whole of it. With
 * nobody that near, an XP Bank within {@code bankRange} blocks of the machine keeps a share of it (xpbank). The work:
 * <ul>
 * <li>Breaking: drills and saws (a saw's whole felled tree), still or on a contraption, and the harvesters, rollers and
 * ploughs on contraptions: Project MMO's BLOCK_BREAK XP for the block, worked out before it goes. A block someone
 * placed pays nothing (Project MMO pays its placer nothing by hand either), unless it's a ripe crop. A block lava and
 * water made pays {@code generatedShare} of its XP, on average (the owner: "cobblestone generators should generate XP,
 * but since its just cobblestone its very little"), whether the world's fluids made it or Create's pipes did.</li>
 * <li>Making: mechanical crafters and the Crafter (CRAFT XP of what they make), basins under a mixer or press (CRAFT
 * XP of the recipe's result), and fans that smelt, blast or smoke (SMELT XP of each item in and SMELTED of each out,
 * what a furnace pays its owner).</li>
 * </ul>
 * Which machine is at work is said by mixins round its work ({@link #enter}, {@link #leave}); its players are looked
 * up when it's paid.
 */
public final class MachineXp {
    private static final boolean PMMO = ModList.get().isLoaded("pmmo");

    /** The numbers (skill_gates.json "machineXp", from skills/unlocks.mjs MACHINE_XP). */
    public record Rules(double playerRange, int bankRange, double generatedShare, double[] bankKeeps) {
        public static final Rules DEFAULT = new Rules(16, 8, 0.1, new double[] {0.10, 0.25, 0.50});

        /** What a bank of this tier keeps of what it catches (tier 1 to 3). */
        public double keeps(int tier) {
            return tier < 1 ? 0 : bankKeeps[Math.min(tier, bankKeeps.length) - 1];
        }
    }

    public static Rules rules() {
        return SkillGates.machineXp();
    }

    // ---------------------------------------------------------------- the machine at work

    /** A machine at work on this thread: its level, where it is, and what it is (a block's description id or a word, for logs). */
    private record Work(@Nullable ServerLevel level, BlockPos at, String machine) {
    }

    private static final Work IDLE = new Work(null, BlockPos.ZERO, "");
    private static final ThreadLocal<ArrayDeque<Work>> WORK = ThreadLocal.withInitial(ArrayDeque::new);

    private MachineXp() {
    }

    /** A machine starts work at {@code at} (the mixins round Create's breaking and making). Always paired with {@link #leave}. */
    public static void enter(@Nullable Level level, @Nullable BlockPos at, String machine) {
        ArrayDeque<Work> stack = WORK.get();
        if (stack.size() > 32) stack.clear(); // left over from work a crash cut short
        stack.push(level instanceof ServerLevel s && at != null ? new Work(s, at.immutable(), machine) : IDLE);
    }

    public static void leave() {
        ArrayDeque<Work> stack = WORK.get();
        if (!stack.isEmpty()) stack.pop();
    }

    @Nullable
    private static Work current(Level level) {
        Work w = WORK.get().peek();
        return w == null || w.level() == null || w.level() != level ? null : w;
    }

    // ---------------------------------------------------------------- what the work pays

    /**
     * Create breaks a block with no player behind it (BlockHelper.destroyBlockAs): if a machine is at work, its players
     * (or its bank) get Project MMO's break XP for the block, worked out while it's still there.
     */
    public static void breaking(Level level, BlockPos pos) {
        Work w = current(level);
        if (w == null || !PMMO) return;
        ServerLevel server = w.level();
        BlockState state = server.getBlockState(pos);
        if (state.isAir()) return;
        double share = 1;
        if (Pmmo.placedBy(server, pos) != null) share = state.getBlock() instanceof CropBlock crop && crop.isMaxAge(state) ? 1 : 0;
        else if (Generated.has(server, pos)) share = rules().generatedShare();
        // The block is going: neither its placer nor its making should stick to whatever comes there next.
        Generated.forget(server, pos);
        Pmmo.forgetPlaced(server, pos);
        if (share <= 0) return;
        double s = share;
        pay(w, player -> scaled(Pmmo.blockXp(server, pos, player), s));
    }

    /** A machine made something (a mechanical crafter, the Crafter, a basin): what making it by hand pays (CRAFT). */
    public static void made(@Nullable Level level, @Nullable BlockPos at, String machine, @Nullable ItemStack result) {
        if (!PMMO || !(level instanceof ServerLevel server) || at == null || result == null || result.isEmpty()) return;
        ItemStack made = result.copy();
        pay(new Work(server, at.immutable(), machine), player -> Pmmo.itemXp(server, made, "CRAFT", player));
    }

    /** A fan smelted, blasted or smoked {@code in} into {@code out}: what a furnace pays, SMELT per item in, SMELTED per item out. */
    public static void smelted(Level level, ItemStack in, @Nullable List<ItemStack> out) {
        Work w = current(level);
        if (w == null || !PMMO || in.isEmpty() || out == null || out.isEmpty()) return;
        ServerLevel server = w.level();
        ItemStack one = in.copyWithCount(1);
        int count = in.getCount();
        List<ItemStack> outputs = new ArrayList<>();
        for (ItemStack o : out) if (!o.isEmpty()) outputs.add(o.copy());
        pay(w, player -> {
            Map<String, Long> xp = times(Pmmo.itemXp(server, one, "SMELT", player), count);
            for (ItemStack o : outputs) times(Pmmo.itemXp(server, o.copyWithCount(1), "SMELTED", player), o.getCount()).forEach((k, v) -> xp.merge(k, v, Long::sum));
            return xp;
        });
    }

    /** Every player near the machine gets all of it; with none, the nearest XP Bank in reach keeps its share. */
    private static void pay(Work w, Function<ServerPlayer, Map<String, Long>> award) {
        List<ServerPlayer> near = near(w.level(), w.at());
        if (!near.isEmpty()) {
            for (ServerPlayer p : near) {
                Map<String, Long> xp = award.apply(p);
                if (!xp.isEmpty()) Pmmo.give(p, xp);
            }
            return;
        }
        XpBankBlockEntity bank = XpBanks.nearest(w.level(), w.at(), rules().bankRange());
        if (bank == null) return;
        Map<String, Long> xp = award.apply(null);
        if (!xp.isEmpty()) bank.deposit(xp);
    }

    /** Hands a player XP as Project MMO pays an action by hand (what an XP Bank pays out). */
    public static void give(ServerPlayer player, Map<String, Long> xp) {
        if (PMMO && !xp.isEmpty()) Pmmo.give(player, xp);
    }

    /** The players within reach of a machine: alive, not spectating, not a machine's own fake player. */
    public static List<ServerPlayer> near(ServerLevel level, BlockPos at) {
        double r = rules().playerRange();
        double r2 = r * r;
        List<ServerPlayer> out = new ArrayList<>();
        for (ServerPlayer p : level.players()) {
            if (p instanceof FakePlayer || p.isSpectator() || !p.isAlive()) continue;
            if (p.distanceToSqr(at.getX() + 0.5, at.getY() + 0.5, at.getZ() + 0.5) <= r2) out.add(p);
        }
        return out;
    }

    /**
     * A share of an award. What falls short of a whole XP is paid as a chance, so a tenth stays a tenth on average: a
     * cobblestone's 1 Mining comes about one cobblestone in ten.
     */
    private static Map<String, Long> scaled(Map<String, Long> xp, double share) {
        if (share >= 1) return xp;
        Map<String, Long> out = new HashMap<>();
        xp.forEach((skill, v) -> {
            if (v == null || v <= 0) return;
            double exact = v * share;
            long whole = (long) Math.floor(exact);
            if (java.util.concurrent.ThreadLocalRandom.current().nextDouble() < exact - whole) whole++;
            if (whole > 0) out.put(skill, whole);
        });
        return out;
    }

    private static Map<String, Long> times(Map<String, Long> xp, int n) {
        Map<String, Long> out = new HashMap<>();
        xp.forEach((skill, v) -> {
            if (v != null && v > 0) out.put(skill, v * n);
        });
        return out;
    }

    // ---------------------------------------------------------------- blocks lava and water made

    /**
     * Where lava and water made a block (a cobblestone generator's stone, basalt, obsidian), per chunk, until the block
     * is broken, replaced or pushed away (a piston carries the mark along). Breaking one by hand pays as Project MMO
     * says; a machine gets {@code generatedShare} of it.
     */
    public static final class Generated {
        private static final Codec<LongOpenHashSet> CODEC = Codec.LONG_STREAM.xmap(s -> new LongOpenHashSet(s.toArray()), set -> Arrays.stream(set.toLongArray()));
        static Supplier<AttachmentType<LongOpenHashSet>> TYPE;

        static void register(DeferredRegister<AttachmentType<?>> attachments) {
            TYPE = attachments.register("generated_blocks", () -> AttachmentType.builder(() -> new LongOpenHashSet()).serialize(CODEC, set -> !set.isEmpty()).build());
        }

        public static boolean has(ServerLevel level, BlockPos pos) {
            LevelChunk chunk = level.getChunkAt(pos);
            return chunk.hasData(TYPE) && chunk.getData(TYPE).contains(pos.asLong());
        }

        static void mark(LevelAccessor level, BlockPos pos) {
            if (!(level instanceof ServerLevel server) || !server.isLoaded(pos)) return;
            LevelChunk chunk = server.getChunkAt(pos);
            if (chunk.getData(TYPE).add(pos.asLong())) chunk.setUnsaved(true);
        }

        static void forget(LevelAccessor level, BlockPos pos) {
            if (!(level instanceof ServerLevel server) || !server.isLoaded(pos)) return;
            LevelChunk chunk = server.getChunkAt(pos);
            if (chunk.hasData(TYPE) && chunk.getData(TYPE).remove(pos.asLong())) chunk.setUnsaved(true);
        }

        /** Marks what fluids make, forgets what players break or place, and moves marks with pistons. */
        static void listen() {
            NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, (BlockEvent.FluidPlaceBlockEvent e) -> {
                BlockState made = e.getNewState();
                if (!made.isAir() && !made.is(Blocks.FIRE) && made.getFluidState().isEmpty()) mark(e.getLevel(), e.getPos());
            });
            NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, (BlockEvent.BreakEvent e) -> forget(e.getLevel(), e.getPos()));
            NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, (BlockEvent.EntityPlaceEvent e) -> forget(e.getLevel(), e.getPos()));
            NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, (PistonEvent.Pre e) -> pushed(e));
            if (ModList.get().isLoaded("create")) listenToCreatePipes();
        }

        /** A piston about to move blocks: each marked block's mark goes where it lands. */
        private static void pushed(PistonEvent.Pre e) {
            if (!(e.getLevel() instanceof ServerLevel level)) return;
            var resolver = e.getStructureHelper();
            if (resolver == null || !resolver.resolve()) return;
            Direction dir = resolver.getPushDirection();
            List<BlockPos> marked = new ArrayList<>();
            for (BlockPos p : resolver.getToPush()) if (has(level, p)) marked.add(p);
            for (BlockPos p : marked) forget(level, p);
            for (BlockPos p : marked) mark(level, p.relative(dir));
        }

        /** Create's pipes make stone where lava meets water (PipeCollisionEvent, posted before the block is set). */
        @SuppressWarnings("unchecked")
        private static void listenToCreatePipes() {
            try {
                Class<?> base = Class.forName("com.simibubi.create.api.event.PipeCollisionEvent");
                Method getLevel = base.getMethod("getLevel");
                Method getPos = base.getMethod("getPos");
                Method getState = base.getMethod("getState");
                for (String kind : new String[] {"Flow", "Spill"}) {
                    Class<? extends Event> type = (Class<? extends Event>) Class.forName(base.getName() + "$" + kind);
                    NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, false, type, e -> {
                        try {
                            if (getState.invoke(e) != null) mark((Level) getLevel.invoke(e), (BlockPos) getPos.invoke(e));
                        } catch (ReflectiveOperationException ex) {
                            SkillsModule.LOGGER.debug("Couldn't read a Create pipe collision", ex);
                        }
                    });
                }
            } catch (ReflectiveOperationException | LinkageError ex) {
                SkillsModule.LOGGER.warn("Create's pipe collisions can't be told apart: stone its pipes make pays machines in full ({})", ex.toString());
            }
        }

        private Generated() {
        }
    }

    // ---------------------------------------------------------------- Project MMO

    /** Project MMO's side, kept apart so none of it loads without the mod. */
    private static final class Pmmo {
        static Map<String, Long> blockXp(ServerLevel level, BlockPos pos, @Nullable ServerPlayer player) {
            try {
                Map<String, Long> xp = harmonised.pmmo.core.Core.get(level)
                        .getExperienceAwards(harmonised.pmmo.api.enums.EventType.BLOCK_BREAK, pos, level, player, new CompoundTag());
                return xp == null ? new HashMap<>() : new HashMap<>(xp);
            } catch (RuntimeException | LinkageError e) {
                SkillsModule.LOGGER.warn("Couldn't work out the XP for breaking {} at {}: {}", level.getBlockState(pos), pos, e.toString());
                return new HashMap<>();
            }
        }

        /** An item's XP for an event; with no player (a bank), without the player's own bonuses. */
        static Map<String, Long> itemXp(ServerLevel level, ItemStack stack, String event, @Nullable ServerPlayer player) {
            try {
                var type = harmonised.pmmo.api.enums.EventType.valueOf(event);
                var core = harmonised.pmmo.core.Core.get(level);
                Map<String, Long> xp = player != null
                        ? core.getExperienceAwards(type, stack, player, new CompoundTag())
                        : core.getCommonXpAwardData(new HashMap<>(), type, BuiltInRegistries.ITEM.getKey(stack.getItem()), null,
                                harmonised.pmmo.api.enums.ObjectType.ITEM, harmonised.pmmo.util.TagUtils.stackTag(stack, level));
                return xp == null ? new HashMap<>() : new HashMap<>(xp);
            } catch (RuntimeException | LinkageError e) {
                SkillsModule.LOGGER.warn("Couldn't work out the {} XP for {}: {}", event, stack, e.toString());
                return new HashMap<>();
            }
        }

        /** Hands XP over the way Project MMO pays an action by hand (its skill groups and multipliers apply). */
        static void give(ServerPlayer player, Map<String, Long> xp) {
            try {
                harmonised.pmmo.core.Core.get(player.level()).awardXP(List.of(player), new HashMap<>(xp));
            } catch (RuntimeException | LinkageError e) {
                SkillsModule.LOGGER.warn("Couldn't give {} their machine XP {}: {}", player.getGameProfile().getName(), xp, e.toString());
            }
        }

        @Nullable
        static UUID placedBy(ServerLevel level, BlockPos pos) {
            try {
                return level.getChunkAt(pos).getData(harmonised.pmmo.storage.DataAttachmentTypes.PLACED_MAP.get()).get(pos);
            } catch (RuntimeException | LinkageError e) {
                return null;
            }
        }

        static void forgetPlaced(ServerLevel level, BlockPos pos) {
            try {
                LevelChunk chunk = level.getChunkAt(pos);
                if (chunk.getData(harmonised.pmmo.storage.DataAttachmentTypes.PLACED_MAP.get()).remove(pos) != null) chunk.setUnsaved(true);
            } catch (RuntimeException | LinkageError e) {
                // nothing to tidy
            }
        }
    }

    /** Called from SkillsModule.init. */
    static void init(DeferredRegister<AttachmentType<?>> attachments) {
        Generated.register(attachments);
        Generated.listen();
    }
}
