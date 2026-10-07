package net.lemursaucepacket.fixes.zone;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import net.lemursaucepacket.fixes.zone.SafeZones.Flag;
import net.lemursaucepacket.fixes.zone.SafeZones.Zone;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.OwnableEntity;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.minecraft.world.entity.decoration.HangingEntity;
import net.minecraft.world.entity.monster.Enemy;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelAccessor;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.common.util.FakePlayer;
import net.neoforged.neoforge.common.util.TriState;
import net.neoforged.neoforge.event.entity.EntityJoinLevelEvent;
import net.neoforged.neoforge.event.entity.EntityMobGriefingEvent;
import net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent;
import net.neoforged.neoforge.event.entity.player.AttackEntityEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.level.BlockEvent;
import net.neoforged.neoforge.event.level.ExplosionEvent;
import net.neoforged.neoforge.event.level.PistonEvent;
import net.neoforged.neoforge.event.tick.LevelTickEvent;

/**
 * Enforces {@link SafeZones}: the spawn city is a safe zone (no building, no PvP, no hostile mobs). Ops get
 * through in creative mode or after {@code /lsp zone bypass}. Players can still use doors, chests, waystones,
 * shops and NPCs: only changing blocks and decorations is refused.
 */
public final class ZoneEvents {
    /** Ops who switched the protection off for themselves this session. */
    static final Set<UUID> BYPASS = new HashSet<>();
    private static final Map<UUID, Long> LAST_MESSAGE = new HashMap<>();
    /** Scoreboard tag that lets an admin's /summon put a hostile mob inside on purpose (events, tests). */
    public static final String ALLOW_TAG = "lsp_zone_allowed";

    private ZoneEvents() {
    }

    static boolean bypasses(Player player) {
        if (player == null || player instanceof FakePlayer) return false;
        return player.hasPermissions(2) && (player.isCreative() || BYPASS.contains(player.getUUID()));
    }

    /** Whether a player may change the block at pos: what scripts that set blocks directly ask (the Builder's Wand, the scythe). */
    public static boolean mayBuild(Player player, Level level, BlockPos pos) {
        return SafeZones.at(level, pos, Flag.BUILD) == null || bypasses(player);
    }

    private static Zone zone(LevelAccessor access, BlockPos pos, Flag flag) {
        return access instanceof Level level ? SafeZones.at(level, pos, flag) : null;
    }

    private static void tell(Player player, Zone zone, String what) {
        if (!(player instanceof ServerPlayer sp)) return;
        long now = System.currentTimeMillis();
        Long last = LAST_MESSAGE.get(sp.getUUID());
        if (last != null && now - last < 2000) return;
        LAST_MESSAGE.put(sp.getUUID(), now);
        sp.displayClientMessage(Component.literal("§6" + pretty(zone.name()) + " §7is a safe zone: " + what), true);
    }

    private static String pretty(String name) {
        return name.isEmpty() ? name : Character.toUpperCase(name.charAt(0)) + name.substring(1).replace('_', ' ');
    }

    // ---------------------------------------------------------------- blocks

    @SubscribeEvent
    public static void onBreak(BlockEvent.BreakEvent event) {
        Zone z = zone(event.getLevel(), event.getPos(), Flag.BUILD);
        if (z == null || bypasses(event.getPlayer())) return;
        event.setCanceled(true);
        tell(event.getPlayer(), z, "you can't break blocks here.");
    }

    @SubscribeEvent
    public static void onPlace(BlockEvent.EntityPlaceEvent event) {
        Zone z = zone(event.getLevel(), event.getPos(), Flag.BUILD);
        if (z == null) return;
        Entity who = event.getEntity();
        if (who instanceof Player p && bypasses(p)) return;
        event.setCanceled(true);
        if (who instanceof Player p) tell(p, z, "you can't place blocks here.");
    }

    /** Using an item on a block (buckets, flint and steel, bone meal, spawn eggs, boats...). The block itself still works. */
    @SubscribeEvent
    public static void onUseOnBlock(PlayerInteractEvent.RightClickBlock event) {
        Zone z = zone(event.getLevel(), event.getPos(), Flag.BUILD);
        if (z == null || bypasses(event.getEntity()) || event.getItemStack().isEmpty()) return;
        event.setUseItem(TriState.FALSE);
    }

    /** Axes stripping logs, shovels making paths, hoes tilling. */
    @SubscribeEvent
    public static void onToolModify(BlockEvent.BlockToolModificationEvent event) {
        if (event.isSimulated()) return;
        Zone z = zone(event.getLevel(), event.getPos(), Flag.BUILD);
        if (z == null || bypasses(event.getPlayer())) return;
        event.setCanceled(true);
    }

    @SubscribeEvent
    public static void onTrample(BlockEvent.FarmlandTrampleEvent event) {
        if (zone(event.getLevel(), event.getPos(), Flag.BUILD) != null) event.setCanceled(true);
    }

    @SubscribeEvent
    public static void onFluidPlace(BlockEvent.FluidPlaceBlockEvent event) {
        if (zone(event.getLevel(), event.getPos(), Flag.FLUIDS) != null) event.setNewState(event.getOriginalState());
    }

    @SubscribeEvent
    public static void onPiston(PistonEvent.Pre event) {
        if (zone(event.getLevel(), event.getPos(), Flag.BUILD) != null || zone(event.getLevel(), event.getFaceOffsetPos(), Flag.BUILD) != null) event.setCanceled(true);
    }

    @SubscribeEvent
    public static void onGrief(EntityMobGriefingEvent event) {
        Entity e = event.getEntity();
        if (SafeZones.at(e.level(), e.getX(), e.getY(), e.getZ(), Flag.BUILD) != null) event.setCanGrief(false);
    }

    @SubscribeEvent
    public static void onExplosion(ExplosionEvent.Detonate event) {
        Level level = event.getLevel();
        event.getAffectedBlocks().removeIf(pos -> SafeZones.at(level, pos, Flag.EXPLOSIONS) != null);
        event.getAffectedEntities().removeIf(e -> !(e instanceof Enemy) && SafeZones.at(level, e.getX(), e.getY(), e.getZ(), Flag.EXPLOSIONS) != null);
    }

    // ---------------------------------------------------------------- entities

    /** Players (and their pets and arrows) can't hurt players; nobody but an op hurts the town's decorations and animals. */
    @SubscribeEvent
    public static void onDamage(LivingIncomingDamageEvent event) {
        LivingEntity victim = event.getEntity();
        Player attacker = playerBehind(event.getSource().getEntity());
        if (attacker == null) return;
        if (victim instanceof Player && victim != attacker) {
            Zone z = SafeZones.at(victim.level(), victim.getX(), victim.getY(), victim.getZ(), Flag.PVP);
            if (z == null) z = SafeZones.at(attacker.level(), attacker.getX(), attacker.getY(), attacker.getZ(), Flag.PVP);
            if (z != null) {
                event.setCanceled(true);
                tell(attacker, z, "no fighting other players here.");
            }
            return;
        }
        if (!(victim instanceof Enemy) && !(victim instanceof Player) && !bypasses(attacker)) {
            Zone z = SafeZones.at(victim.level(), victim.getX(), victim.getY(), victim.getZ(), Flag.DECOR);
            if (z != null) event.setCanceled(true);
        }
    }

    /** Hitting item frames, armour stands and paintings (they aren't LivingEntities, or don't use the damage event). */
    @SubscribeEvent
    public static void onAttack(AttackEntityEvent event) {
        Entity target = event.getTarget();
        if (!(target instanceof HangingEntity) && !(target instanceof ArmorStand)) return;
        Zone z = SafeZones.at(target.level(), target.getX(), target.getY(), target.getZ(), Flag.DECOR);
        if (z == null || bypasses(event.getEntity())) return;
        event.setCanceled(true);
    }

    /** Turning or emptying item frames, taking from armour stands. */
    @SubscribeEvent
    public static void onEntityInteract(PlayerInteractEvent.EntityInteractSpecific event) {
        decorInteract(event, event.getTarget());
    }

    @SubscribeEvent
    public static void onEntityInteract(PlayerInteractEvent.EntityInteract event) {
        decorInteract(event, event.getTarget());
    }

    private static void decorInteract(PlayerInteractEvent event, Entity target) {
        if (!(target instanceof HangingEntity) && !(target instanceof ArmorStand)) return;
        Zone z = SafeZones.at(target.level(), target.getX(), target.getY(), target.getZ(), Flag.DECOR);
        if (z == null || bypasses(event.getEntity())) return;
        if (event instanceof PlayerInteractEvent.EntityInteract e) e.setCanceled(true);
        if (event instanceof PlayerInteractEvent.EntityInteractSpecific e) e.setCanceled(true);
    }

    /** The player who caused something: the entity itself, an arrow's shooter, a pet's owner. */
    private static Player playerBehind(Entity source) {
        if (source instanceof Player p) return p;
        if (source instanceof OwnableEntity pet && pet.getOwner() instanceof Player p) return p;
        return null;
    }

    // ---------------------------------------------------------------- mobs

    /** Easy NPC's zombie, skeleton, witch... models are hostile mob classes too, but they're the town's people. */
    private static boolean isNpc(Entity e) {
        return net.minecraft.core.registries.BuiltInRegistries.ENTITY_TYPE.getKey(e.getType()).getNamespace().equals("easy_npc");
    }

    @SubscribeEvent
    public static void onJoin(EntityJoinLevelEvent event) {
        Entity e = event.getEntity();
        if (event.loadedFromDisk() || !(e instanceof Enemy) || e.getTags().contains(ALLOW_TAG) || isNpc(e)) return;
        if (SafeZones.at(event.getLevel(), e.getX(), e.getY(), e.getZ(), Flag.MOBS) != null) event.setCanceled(true);
    }

    /** Every five seconds, hostile mobs that walked (or were pushed) into a zone are removed, without drops. */
    @SubscribeEvent
    public static void onLevelTick(LevelTickEvent.Post event) {
        if (!(event.getLevel() instanceof ServerLevel level) || level.getGameTime() % 100 != 0) return;
        String dim = level.dimension().location().toString();
        for (Zone zone : SafeZones.get(level.getServer()).all()) {
            if (!zone.flags().contains(Flag.MOBS) || !zone.dimension().equals(dim)) continue;
            for (Mob mob : level.getEntitiesOfClass(Mob.class, zone.box(), m -> m instanceof Enemy && !m.getTags().contains(ALLOW_TAG) && !m.hasCustomName() && !isNpc(m)))
                mob.discard();
        }
    }
}
