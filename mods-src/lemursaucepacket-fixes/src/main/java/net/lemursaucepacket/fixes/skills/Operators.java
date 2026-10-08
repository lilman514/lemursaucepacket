package net.lemursaucepacket.fixes.skills;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import javax.annotation.Nullable;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

import net.minecraft.Util;
import net.minecraft.core.BlockPos;
import net.minecraft.core.UUIDUtil;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.NbtOps;
import net.minecraft.nbt.Tag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.BlockEntity;

/**
 * Who runs a machine: whoever placed it or last right-clicked it, with their levels at that moment. A machine makes
 * what the skill gates list (skill_gates.json "craft") at its operator's level: their live level while they're online,
 * the one they had at their last visit while they're away. One nobody has placed or touched (a schematicannon built it)
 * makes only what anyone could, until someone right-clicks it. The same rule as the brewing stand's and cooking pot's
 * last user, for Create's machines, the Crafter and placed backpacks.
 */
public final class Operators {
    /** A machine's operator and their levels when they last placed or used it. */
    public record Operator(UUID id, Map<String, Integer> levels) {
        public static final Codec<Operator> CODEC = RecordCodecBuilder.create(i -> i.group(
                UUIDUtil.CODEC.fieldOf("id").forGetter(Operator::id),
                Codec.unboundedMap(Codec.STRING, Codec.INT).fieldOf("levels").forGetter(Operator::levels)
        ).apply(i, Operator::new));
        public static final Operator NONE = new Operator(Util.NIL_UUID, Map.of());
    }

    /** Block entities that make things on their own, by class name (so this builds without the mods). */
    private static final Set<String> MACHINES = Set.of(
            "com.simibubi.create.content.processing.basin.BasinBlockEntity",
            "com.simibubi.create.content.kinetics.crafter.MechanicalCrafterBlockEntity",
            "com.simibubi.create.content.fluids.spout.SpoutBlockEntity",
            "com.simibubi.create.content.kinetics.deployer.DeployerBlockEntity",
            "com.simibubi.create.content.kinetics.drill.DrillBlockEntity",
            "com.simibubi.create.content.kinetics.saw.SawBlockEntity",
            "net.minecraft.world.level.block.entity.CrafterBlockEntity",
            "net.p3pp3rf1y.sophisticatedbackpacks.backpack.BackpackBlockEntity");

    /** The machine making something right now, for code that can't see it (the mechanical crafter's grid, the Crafter's recipe). */
    private static final ThreadLocal<BlockEntity> CURRENT = new ThreadLocal<>();

    private Operators() {
    }

    public static boolean isMachine(@Nullable BlockEntity be) {
        return be != null && MACHINES.contains(be.getClass().getName());
    }

    /** Makes the player this machine's operator, with their levels now. */
    public static void set(BlockEntity be, Player player) {
        Map<String, Integer> levels = new HashMap<>();
        for (String skill : SkillGates.skills()) levels.put(skill, Levels.of(player, skill));
        be.setData(SkillsModule.OPERATOR, new Operator(player.getUUID(), levels));
        be.setChanged();
    }

    @Nullable
    public static Operator of(@Nullable BlockEntity be) {
        if (be == null || !be.hasData(SkillsModule.OPERATOR)) return null;
        Operator o = be.getData(SkillsModule.OPERATOR);
        return o.id().equals(Util.NIL_UUID) ? null : o;
    }

    /**
     * A contraption actor's operator (a drill or saw on a moving contraption): saved with its block when the contraption
     * was put together, among the block entity's NeoForge attachments.
     */
    @Nullable
    public static Operator saved(@Nullable CompoundTag blockData) {
        if (blockData == null) return null;
        Tag tag = blockData.getCompound(net.neoforged.neoforge.attachment.AttachmentHolder.ATTACHMENTS_NBT_KEY).get(SkillsModule.OPERATOR_ID);
        if (tag == null) return null;
        Operator o = Operator.CODEC.parse(NbtOps.INSTANCE, tag).result().orElse(null);
        return o == null || o.id().equals(Util.NIL_UUID) ? null : o;
    }

    @Nullable
    private static MinecraftServer server(@Nullable BlockEntity be) {
        return be == null || be.getLevel() == null ? null : be.getLevel().getServer();
    }

    @Nullable
    private static ServerPlayer online(@Nullable MinecraftServer server, Operator o) {
        return server == null ? null : server.getPlayerList().getPlayer(o.id());
    }

    /** The operator's level: live while they're online, from their last visit otherwise; 0 with no operator. */
    public static int level(@Nullable BlockEntity be, String skill) {
        return level(of(be), server(be), skill);
    }

    /** The same for an operator known some other way (a contraption actor's, see {@link #saved}). */
    public static int level(@Nullable Operator o, @Nullable MinecraftServer server, String skill) {
        if (o == null) return 0;
        ServerPlayer p = online(server, o);
        if (p != null) return Levels.of(p, skill);
        if (skill.contains("|")) {
            int best = 0;
            for (String s : skill.split("\\|")) best = Math.max(best, o.levels().getOrDefault(s, 0));
            return best;
        }
        return o.levels().getOrDefault(skill, 0);
    }

    /** Whether this machine's operator has what the gate needs. */
    public static boolean has(@Nullable BlockEntity be, SkillGates.Need need) {
        return level(be, need.skill()) >= need.level();
    }

    /**
     * Tells the operator, if they're online, why their machine is waiting ("can't make Cake", "can't brew with Blaze
     * Powder"): once a minute per machine and item.
     */
    public static void refuse(@Nullable BlockEntity be, SkillGates.Need need, ItemStack what, String verb) {
        if (be == null) return;
        refuse(of(be), server(be), be.getBlockState().getBlock().getName().getString(), be.getBlockPos(), need, what.getHoverName().getString(), verb);
    }

    /** The same for a machine known by name and place (a contraption actor's operator, a block it won't break). */
    public static void refuse(@Nullable Operator o, @Nullable MinecraftServer server, String machine, BlockPos pos, SkillGates.Need need, String what, String verb) {
        if (o == null) return;
        ServerPlayer p = online(server, o);
        if (p == null) return;
        GateNotice.tell(p, "machine:" + pos.asLong() + ":" + what, "Your " + machine + " at " + pos.getX() + " " + pos.getY() + " " + pos.getZ()
                + " can't " + verb + " " + what + ": it runs at your level, and that needs " + GateNotice.needs(need, Levels.of(p, need.skill())) + ".", 60_000);
    }

    /** The machine making something on this thread right now (see the mixins that set it), or null. */
    @Nullable
    public static BlockEntity current() {
        return CURRENT.get();
    }

    public static void enter(BlockEntity be) {
        CURRENT.set(be);
    }

    public static void leave() {
        CURRENT.remove();
    }
}
