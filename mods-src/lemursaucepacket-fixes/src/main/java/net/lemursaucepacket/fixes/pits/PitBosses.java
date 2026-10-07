package net.lemursaucepacket.fixes.pits;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.annotation.Nullable;

import org.joml.Vector3f;

import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.BlockParticleOption;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.registries.Registries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.TagParser;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.damagesource.DamageType;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.monster.Ghast;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.SmallFireball;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.EntityHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.event.entity.EntityJoinLevelEvent;
import net.neoforged.neoforge.event.entity.ProjectileImpactEvent;
import net.neoforged.neoforge.event.entity.living.LivingDamageEvent;
import net.neoforged.neoforge.event.entity.living.LivingIncomingDamageEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

/**
 * The pit bosses and the beasts with a trick (docs/fight-pits.md), driven by the entity tags pits/build.mjs gives them:
 * <ul>
 * <li>{@code lsp_pits_jad}: Kiln-Tok-Jad (and the Inferno's Kal-Tok-Jads), a giant blaze without AI that drifts toward
 * the nearest player. Every four seconds it telegraphs one of two attacks: a <b>fire volley</b> (flames gather in it;
 * raise a shield toward it) or a <b>slam</b> (it rises and a ring burns round your feet; get out of the ring). Either
 * hurts by a share of your health, through armour. At half health it calls menders.</li>
 * <li>{@code lsp_pits_healer}: menders (zombified piglins) walk to their boss and heal it until a player hits one; then
 * they all turn on that player, being zombified piglins, and heal no more.</li>
 * <li>{@code lsp_pits_mejkot}: heals the pit beasts near it. {@code lsp_pits_zek}: its fireballs hurt as kiln fire,
 * which Fire Resistance doesn't stop, and light nothing.</li>
 * <li>{@code lsp_inf_mejrah}: slows and tires whoever it hits. {@code lsp_inf_imkot}: burrows up beside its prey when it
 * can't get any closer.</li>
 * <li>{@code lsp_inf_zuk}: Kiln-Kal-Zuk, a giant ghast without AI behind a shield (block displays) that drifts along the
 * lava's edge. Every few seconds his eyes burn, then he burns everyone the shield doesn't cover. As he weakens he sends
 * sets of beasts, then a Kal-Tok-Jad, then menders.</li>
 * </ul>
 * Nothing here survives a restart, and nothing needs to: an instance's run doesn't either.
 */
public final class PitBosses {
    static final String JAD = "lsp_pits_jad", INFERNO_JAD = "lsp_inf_jad", MENDER = "lsp_pits_healer", TURNED = "lsp_mender_turned",
            MEJKOT = "lsp_pits_mejkot", ZEK = "lsp_pits_zek", MEJRAH = "lsp_inf_mejrah", IMKOT = "lsp_inf_imkot", ZUK = "lsp_inf_zuk",
            SHIELD = "lsp_inf_shield", PIT = "lsp_pits";
    static final ResourceKey<DamageType> JAD_VOLLEY = damage("jad_volley"), JAD_SLAM = damage("jad_slam"), ZUK_VOLLEY = damage("zuk_volley"),
            KILN_FIRE = damage("kiln_fire");
    /** Ticks a Jad telegraphs an attack for, and rests between attacks. */
    private static final int TELEGRAPH = 30, COOLDOWN = 50;
    private static final float VOLLEY_SHARE = 0.65F, SLAM_SHARE = 0.6F, ZUK_SHARE = 0.9F;
    private static final double SLAM_RADIUS = 3.2;
    /** /lsp pits debug: log every boss attack and what came of it. */
    static boolean debug;

    private static ResourceKey<DamageType> damage(String id) {
        return ResourceKey.create(Registries.DAMAGE_TYPE, ResourceLocation.fromNamespaceAndPath("lemursaucepacket", id));
    }

    private enum Attack { NONE, VOLLEY, SLAM }

    private static final class Jad {
        final ServerLevel level;
        final UUID id;
        Vec3 home, at;
        double hover;
        int timer;
        Attack attack = Attack.NONE;
        Vec3 slamAt;
        UUID target;
        boolean mendersCalled;
        int volleys;

        Jad(ServerLevel level, UUID id, RandomSource random) {
            this.level = level;
            this.id = id;
            this.timer = 60 + random.nextInt(60);
        }
    }

    private static final class Mender {
        final ServerLevel level;
        UUID boss;
        final int slot;

        Mender(ServerLevel level, UUID boss, int slot) {
            this.level = level;
            this.boss = boss;
            this.slot = slot;
        }
    }

    private static final class Zuk {
        final ServerLevel level;
        final UUID id;
        Vec3 home;
        double shieldX, shieldY, shieldZ;
        int direction = 1;
        final List<UUID> shield = new ArrayList<>();
        int timer = 200;
        boolean charging;
        int stage;

        Zuk(ServerLevel level, UUID id) {
            this.level = level;
            this.id = id;
        }
    }

    private static final class Burrower {
        final ServerLevel level;
        double best = Double.MAX_VALUE;
        long since;

        Burrower(ServerLevel level, long now) {
            this.level = level;
            this.since = now;
        }
    }

    private static final Map<UUID, Jad> JADS = new HashMap<>();
    private static final Map<UUID, Zuk> ZUKS = new HashMap<>();
    private static final Map<UUID, Mender> MENDERS = new HashMap<>();
    private static final Map<UUID, ServerLevel> MEJKOTS = new HashMap<>();
    private static final Map<UUID, Burrower> BURROWERS = new HashMap<>();

    // ---------------------------------------------------------------- events

    static void onJoin(EntityJoinLevelEvent e) {
        if (!(e.getLevel() instanceof ServerLevel level)) return;
        Entity entity = e.getEntity();
        var tags = entity.getTags();
        if (!tags.contains(PIT) || !(entity instanceof LivingEntity)) return;
        UUID id = entity.getUUID();
        if (tags.contains(JAD)) JADS.computeIfAbsent(id, u -> new Jad(level, u, level.random));
        else if (tags.contains(ZUK)) ZUKS.computeIfAbsent(id, u -> new Zuk(level, u));
        else if (tags.contains(MEJKOT)) MEJKOTS.put(id, level);
        else if (tags.contains(IMKOT)) BURROWERS.computeIfAbsent(id, u -> new Burrower(level, level.getServer().getTickCount()));
        else if (tags.contains(MENDER) && !MENDERS.containsKey(id)) {
            // A mender that isn't one the bosses called (an admin's): it serves the nearest boss.
            LivingEntity boss = nearestBoss(level, entity.position());
            if (boss != null) MENDERS.put(id, new Mender(level, boss.getUUID(), MENDERS.size()));
        }
    }

    static void onTick(ServerTickEvent.Post e) {
        if (JADS.isEmpty() && ZUKS.isEmpty() && MENDERS.isEmpty() && MEJKOTS.isEmpty() && BURROWERS.isEmpty()) return;
        long now = e.getServer().getTickCount();
        JADS.values().removeIf(j -> !tickJad(j));
        ZUKS.values().removeIf(z -> !tickZuk(z, now));
        if (now % 10 == 3) MENDERS.entrySet().removeIf(m -> !tickMender(m.getKey(), m.getValue(), now));
        if (now % 40 == 11) MEJKOTS.entrySet().removeIf(m -> !tickMejKot(m.getKey(), m.getValue()));
        if (now % 20 == 7) BURROWERS.entrySet().removeIf(b -> !tickBurrower(b.getKey(), b.getValue(), now));
    }

    /** A player hitting a mender turns it (and, being a zombified piglin, the others with it). */
    static void onIncomingDamage(LivingIncomingDamageEvent e) {
        LivingEntity victim = e.getEntity();
        if (victim.getTags().contains(MENDER) && e.getSource().getEntity() instanceof Player) victim.addTag(TURNED);
    }

    /** Kal-MejRah drain your run: slowness and hunger on a hit. */
    static void onDamaged(LivingDamageEvent.Post e) {
        if (!(e.getEntity() instanceof ServerPlayer p) || e.getNewDamage() <= 0) return;
        Entity by = e.getSource().getEntity();
        if (by != null && by.getTags().contains(MEJRAH)) {
            p.addEffect(new MobEffectInstance(MobEffects.MOVEMENT_SLOWDOWN, 100, 1));
            p.addEffect(new MobEffectInstance(MobEffects.HUNGER, 100, 1));
        }
    }

    /** A Zek's fireball is kiln fire: it hurts through Fire Resistance, and lights nothing. */
    static void onImpact(ProjectileImpactEvent e) {
        Projectile projectile = e.getProjectile();
        if (!(projectile instanceof SmallFireball) || !(projectile.level() instanceof ServerLevel level)) return;
        Entity owner = projectile.getOwner();
        if (owner == null || !owner.getTags().contains(ZEK)) return;
        HitResult hit = e.getRayTraceResult();
        if (hit instanceof EntityHitResult eh && !(eh.getEntity() instanceof Player)) return;
        e.setCanceled(true);
        if (hit instanceof EntityHitResult eh && eh.getEntity() instanceof ServerPlayer p) {
            p.hurt(source(level, KILN_FIRE, projectile, owner), 7F);
            p.igniteForSeconds(4F);
        }
        level.sendParticles(ParticleTypes.FLAME, projectile.getX(), projectile.getY(), projectile.getZ(), 8, 0.2, 0.2, 0.2, 0.02);
        projectile.discard();
    }

    // ---------------------------------------------------------------- Jad

    private static boolean tickJad(Jad j) {
        if (!(j.level.getEntity(j.id) instanceof LivingEntity jad) || !jad.isAlive()) return false;
        if (j.home == null) {
            j.home = jad.position();
            j.hover = jad.getY() + 1.0;
            j.at = new Vec3(jad.getX(), j.hover, jad.getZ());
        }
        ServerPlayer target = nearestPlayer(j.level, jad.position(), 64);
        double y = j.hover;
        if (j.attack == Attack.SLAM) y = j.hover + (TELEGRAPH - j.timer) * 0.1;
        if (target != null && j.attack == Attack.NONE) {
            // Drift toward the player while resting, but stay near the middle of the pit.
            Vec3 to = new Vec3(target.getX() - j.at.x, 0, target.getZ() - j.at.z);
            if (to.length() > 8) {
                Vec3 next = j.at.add(to.normalize().scale(0.05));
                if (next.distanceTo(new Vec3(j.home.x, next.y, j.home.z)) <= 16) j.at = next;
            }
        }
        jad.setDeltaMovement(Vec3.ZERO);
        float yaw = target == null ? jad.getYRot() : (float) (Mth.atan2(target.getZ() - j.at.z, target.getX() - j.at.x) * Mth.RAD_TO_DEG) - 90F;
        jad.moveTo(j.at.x, y, j.at.z, yaw, 0F);
        jad.setYHeadRot(yaw);
        jad.setYBodyRot(yaw);

        if (!j.mendersCalled && jad.getHealth() <= jad.getMaxHealth() * 0.5F) {
            j.mendersCalled = true;
            callMenders(j.level, jad, j.home, jad.getTags().contains(INFERNO_JAD) ? PitMobs.zukMenders() : PitMobs.jadMenders(), jad.getTags().contains(INFERNO_JAD) ? 3 : 4);
        }
        if (target == null) return true;
        switch (j.attack) {
            case NONE -> {
                if (--j.timer <= 0) begin(j, jad, target);
            }
            case VOLLEY -> {
                if (j.timer % 2 == 0) gather(j.level, jad);
                if (--j.timer <= 0) {
                    ServerPlayer at = j.level.getServer().getPlayerList().getPlayer(j.target);
                    if (at != null && at.isAlive() && at.level() == j.level) volley(j.level, jad, at);
                    j.attack = Attack.NONE;
                    j.timer = COOLDOWN;
                }
            }
            case SLAM -> {
                if (j.timer % 2 == 0) ring(j.level, j.slamAt);
                if (--j.timer <= 0) {
                    slam(j.level, jad, j.slamAt);
                    j.attack = Attack.NONE;
                    j.timer = COOLDOWN;
                }
            }
        }
        return true;
    }

    private static void begin(Jad j, LivingEntity jad, ServerPlayer target) {
        j.target = target.getUUID();
        j.timer = TELEGRAPH;
        if (j.level.random.nextBoolean()) {
            j.attack = Attack.VOLLEY;
            j.volleys++;
            sound(j.level, jad.position(), SoundEvents.BLAZE_AMBIENT, 3F, 0.5F);
            sound(j.level, jad.position(), SoundEvents.FIRECHARGE_USE, 2F, 0.6F);
            target.displayClientMessage(Component.literal(jad.getName().getString() + " draws in flame: raise your shield!").withStyle(ChatFormatting.GOLD), true);
        } else {
            j.attack = Attack.SLAM;
            j.slamAt = target.position();
            sound(j.level, jad.position(), SoundEvents.RAVAGER_ROAR, 2.5F, 0.6F);
            target.displayClientMessage(Component.literal(jad.getName().getString() + " rises to slam: get out of the ring!").withStyle(ChatFormatting.RED), true);
        }
    }

    /** Flames drawn into Jad's maw. */
    private static void gather(ServerLevel level, LivingEntity jad) {
        Vec3 head = jad.getEyePosition();
        RandomSource r = level.random;
        for (int i = 0; i < 6; i++) {
            Vec3 dir = new Vec3(r.nextGaussian(), r.nextGaussian() * 0.6, r.nextGaussian()).normalize();
            Vec3 from = head.add(dir.scale(3.0));
            Vec3 v = head.subtract(from).scale(0.12);
            level.sendParticles(i % 3 == 0 ? ParticleTypes.LAVA : ParticleTypes.FLAME, from.x, from.y, from.z, 0, v.x, v.y, v.z, 1.0);
        }
    }

    /** The volley: a shield raised toward Jad (for a moment already) takes it; anyone else burns. */
    private static void volley(ServerLevel level, LivingEntity jad, ServerPlayer p) {
        Vec3 from = jad.getEyePosition();
        Vec3 to = p.position().add(0, p.getBbHeight() * 0.6, 0);
        beam(level, from, to, ParticleTypes.FLAME);
        sound(level, jad.position(), SoundEvents.BLAZE_SHOOT, 3F, 0.6F);
        if (blocks(p, jad.position())) {
            ItemStack shield = p.getUseItem();
            if (!shield.isEmpty()) shield.hurtAndBreak(4, p, LivingEntity.getSlotForHand(p.getUsedItemHand()));
            sound(level, p.position(), SoundEvents.SHIELD_BLOCK, 1.5F, 0.8F);
            level.sendParticles(ParticleTypes.FLAME, to.x, to.y, to.z, 20, 0.4, 0.4, 0.4, 0.05);
            p.displayClientMessage(Component.literal("Blocked!").withStyle(ChatFormatting.GREEN), true);
            if (debug) PitsModule.LOGGER.info("[pits] {} volley on {}: blocked", jad.getName().getString(), p.getGameProfile().getName());
            return;
        }
        float before = p.getHealth();
        level.sendParticles(ParticleTypes.EXPLOSION, to.x, to.y, to.z, 1, 0, 0, 0, 0);
        sound(level, p.position(), SoundEvents.GENERIC_EXPLODE.value(), 1.2F, 1.3F);
        p.hurt(source(level, JAD_VOLLEY, jad, jad), p.getMaxHealth() * VOLLEY_SHARE);
        p.igniteForSeconds(3F);
        if (debug) PitsModule.LOGGER.info("[pits] {} volley on {}: hit, health {} -> {}", jad.getName().getString(), p.getGameProfile().getName(), before, p.getHealth());
    }

    /** Where the slam will land: a burning ring round where the player stood. */
    private static void ring(ServerLevel level, Vec3 at) {
        ParticleOptions dust = new DustParticleOptions(new Vector3f(1F, 0.35F, 0.05F), 1.0F);
        for (int i = 0; i < 40; i++) {
            double a = i * Math.PI * 2 / 40;
            level.sendParticles(dust, at.x + Math.cos(a) * SLAM_RADIUS, at.y + 0.15, at.z + Math.sin(a) * SLAM_RADIUS, 1, 0, 0, 0, 0);
        }
        for (int i = 0; i < 10; i++) {
            double a = level.random.nextDouble() * Math.PI * 2;
            level.sendParticles(ParticleTypes.FLAME, at.x + Math.cos(a) * SLAM_RADIUS, at.y + 0.1, at.z + Math.sin(a) * SLAM_RADIUS, 1, 0, 0.05, 0, 0.01);
        }
        level.sendParticles(ParticleTypes.LAVA, at.x, at.y + 0.2, at.z, 2, SLAM_RADIUS * 0.5, 0, SLAM_RADIUS * 0.5, 0);
    }

    /** The slam lands: everyone inside the ring is hurt and thrown up. */
    private static void slam(ServerLevel level, LivingEntity jad, Vec3 at) {
        level.sendParticles(ParticleTypes.EXPLOSION_EMITTER, at.x, at.y + 0.5, at.z, 1, 0, 0, 0, 0);
        level.sendParticles(ParticleTypes.LAVA, at.x, at.y + 0.3, at.z, 30, SLAM_RADIUS * 0.6, 0.2, SLAM_RADIUS * 0.6, 0);
        sound(level, at, SoundEvents.GENERIC_EXPLODE.value(), 2F, 0.7F);
        sound(level, at, SoundEvents.ANVIL_LAND, 1.5F, 0.5F);
        for (ServerPlayer p : level.getPlayers(pl -> pl.isAlive() && !pl.isSpectator())) {
            double dx = p.getX() - at.x, dz = p.getZ() - at.z;
            if (dx * dx + dz * dz > SLAM_RADIUS * SLAM_RADIUS || p.getY() < at.y - 1.5 || p.getY() > at.y + 3) {
                if (debug) PitsModule.LOGGER.info("[pits] {} slam missed {} ({} blocks from the middle)", jad.getName().getString(), p.getGameProfile().getName(), String.format("%.1f", Math.sqrt(dx * dx + dz * dz)));
                continue;
            }
            float before = p.getHealth();
            p.hurt(source(level, JAD_SLAM, jad, jad), p.getMaxHealth() * SLAM_SHARE);
            if (debug) PitsModule.LOGGER.info("[pits] {} slam on {}: hit, health {} -> {}", jad.getName().getString(), p.getGameProfile().getName(), before, p.getHealth());
            p.igniteForSeconds(3F);
            p.setDeltaMovement(p.getDeltaMovement().add(0, 0.55, 0));
            p.hurtMarked = true;
        }
    }

    /** Raising a shield toward where the hit comes from, held a moment already (the vanilla rule for blocking). */
    private static boolean blocks(ServerPlayer p, Vec3 from) {
        if (!p.isBlocking()) return false;
        double yaw = Math.toRadians(p.getYHeadRot());
        Vec3 look = new Vec3(-Math.sin(yaw), 0, Math.cos(yaw));
        Vec3 toPlayer = from.vectorTo(p.position());
        toPlayer = new Vec3(toPlayer.x, 0, toPlayer.z).normalize();
        return toPlayer.dot(look) < 0.0;
    }

    // ---------------------------------------------------------------- menders

    /** A boss calls menders: they appear round it on the floor and walk to it. */
    private static void callMenders(ServerLevel level, LivingEntity boss, Vec3 around, String snbt, int count) {
        if (snbt.isEmpty()) return;
        double floor = floorY(level, around.x, around.y + 2, around.z, around.y - 1);
        int made = 0;
        for (int i = 0; i < count; i++) {
            double a = i * Math.PI * 2 / count + level.random.nextDouble() * 0.5;
            for (double d : new double[] {11, 9, 13, 7, 15}) {
                Vec3 at = stand(level, around.x + Math.cos(a) * d, floor, around.z + Math.sin(a) * d);
                if (at == null) continue;
                Entity m = PitMobs.spawn(level, snbt, at, 0F);
                if (m != null) {
                    MENDERS.put(m.getUUID(), new Mender(level, boss.getUUID(), i));
                    level.sendParticles(ParticleTypes.LARGE_SMOKE, at.x, at.y + 1, at.z, 12, 0.3, 0.6, 0.3, 0.02);
                    made++;
                }
                break;
            }
        }
        sound(level, boss.position(), SoundEvents.ZOMBIFIED_PIGLIN_ANGRY, 2F, 0.7F);
        for (ServerPlayer p : level.getPlayers(pl -> pl.distanceToSqr(boss) < 96 * 96))
            p.sendSystemMessage(Component.literal(boss.getName().getString() + " calls its menders! Strike one to turn them from it.").withStyle(ChatFormatting.YELLOW));
        PitsModule.LOGGER.info("{} called {} menders", boss.getName().getString(), made);
    }

    private static boolean tickMender(UUID id, Mender m, long now) {
        if (!(m.level.getEntity(id) instanceof Mob mender) || !mender.isAlive()) return false;
        if (!(m.level.getEntity(m.boss) instanceof LivingEntity boss) || !boss.isAlive()) return false;
        if (mender.getTags().contains(TURNED)) return false;
        if (mender.getTarget() != null) {
            mender.addTag(TURNED);
            return false;
        }
        AABB box = boss.getBoundingBox();
        double gap = Math.sqrt(distanceSqr(box, mender.position()));
        if (gap > 4.5) {
            // Under Jad, or for Zuk (across the lava) the shore in front of him, spread along it.
            Vec3 goal = boss.getTags().contains(ZUK)
                    ? new Vec3(boss.getX() + (m.slot - 1) * 2.5, mender.getY(), box.maxZ + 2.5)
                    : new Vec3(boss.getX(), mender.getY(), boss.getZ());
            mender.getNavigation().moveTo(goal.x, goal.y, goal.z, 1.15);
        } else {
            mender.getNavigation().stop();
            if ((now / 10 + m.slot) % 2 == 0 && boss.getHealth() < boss.getMaxHealth()) {
                boss.heal(boss.getTags().contains(ZUK) ? 6F : 4F);
                if (debug) PitsModule.LOGGER.info("[pits] a mender heals {} to {}", boss.getName().getString(), boss.getHealth());
                Vec3 from = mender.getEyePosition(), to = boss.position().add(0, boss.getBbHeight() * 0.4, 0);
                beam(m.level, from, to, ParticleTypes.HAPPY_VILLAGER);
                m.level.sendParticles(ParticleTypes.HEART, to.x, to.y + 0.5, to.z, 2, 0.6, 0.6, 0.6, 0);
            }
        }
        return true;
    }

    // ---------------------------------------------------------------- the other beasts

    private static boolean tickMejKot(UUID id, ServerLevel level) {
        if (!(level.getEntity(id) instanceof LivingEntity mejkot) || !mejkot.isAlive()) return false;
        for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, mejkot.getBoundingBox().inflate(8), x -> x.isAlive() && x.getTags().contains(PIT) && x.getHealth() < x.getMaxHealth())) {
            e.heal(4F);
            level.sendParticles(ParticleTypes.HEART, e.getX(), e.getY() + e.getBbHeight() + 0.3, e.getZ(), 1, 0.2, 0.1, 0.2, 0);
        }
        return true;
    }

    private static boolean tickBurrower(UUID id, Burrower b, long now) {
        if (!(b.level.getEntity(id) instanceof LivingEntity hog) || !hog.isAlive()) return false;
        ServerPlayer target = nearestPlayer(b.level, hog.position(), 48);
        if (target == null) return true;
        double d = hog.distanceTo(target);
        if (d < b.best - 0.5) {
            b.best = d;
            b.since = now;
        }
        if (d > 5 && now - b.since > 120) {
            // Can't get any closer: it burrows, and comes up beside its prey.
            double a = b.level.random.nextDouble() * Math.PI * 2;
            Vec3 up = stand(b.level, target.getX() + Math.cos(a) * 2.5, target.getY(), target.getZ() + Math.sin(a) * 2.5);
            if (up != null) {
                burst(b.level, hog.position(), hog.blockPosition().below());
                hog.teleportTo(up.x, up.y, up.z);
                burst(b.level, up, BlockPos.containing(up).below());
                sound(b.level, up, SoundEvents.ROOTED_DIRT_BREAK, 2F, 0.6F);
                target.displayClientMessage(Component.literal(hog.getName().getString() + " burrows up beside you!").withStyle(ChatFormatting.GOLD), true);
            }
            b.best = Double.MAX_VALUE;
            b.since = now;
        }
        return true;
    }

    private static void burst(ServerLevel level, Vec3 at, BlockPos ground) {
        level.sendParticles(new BlockParticleOption(ParticleTypes.BLOCK, level.getBlockState(ground)), at.x, at.y + 0.3, at.z, 30, 0.6, 0.3, 0.6, 0.1);
    }

    // ---------------------------------------------------------------- Zuk

    private static boolean tickZuk(Zuk z, long now) {
        if (!(z.level.getEntity(z.id) instanceof LivingEntity zuk) || !zuk.isAlive()) {
            removeShield(z);
            return false;
        }
        PitMobs.Shield line = PitMobs.shield();
        if (z.home == null) {
            z.home = zuk.position();
            z.shieldX = z.home.x + (line.from() + line.to()) / 2.0;
            z.shieldZ = Math.floor(z.home.z) + line.forward();
            z.shieldY = floorY(z.level, z.home.x, z.home.y, z.shieldZ + 2.5, z.home.y - 6);
            makeShield(z);
            for (ServerPlayer p : z.level.getPlayers(pl -> pl.distanceToSqr(zuk) < 128 * 128))
                p.sendSystemMessage(Component.literal("Kiln-Kal-Zuk wakes. When his eyes burn, be behind the drifting shield!").withStyle(ChatFormatting.DARK_RED, ChatFormatting.BOLD));
        }
        zuk.setDeltaMovement(Vec3.ZERO);
        // The shield drifts from end to end.
        z.shieldX += z.direction * 0.08;
        if (z.shieldX > z.home.x + line.to()) z.direction = -1;
        if (z.shieldX < z.home.x + line.from()) z.direction = 1;
        if (now % 2 == 0) moveShield(z);
        ServerPlayer near = nearestPlayer(z.level, zuk.position(), 96);
        if (near != null) {
            float yaw = (float) (Mth.atan2(near.getZ() - zuk.getZ(), near.getX() - zuk.getX()) * Mth.RAD_TO_DEG) - 90F;
            zuk.setYRot(yaw);
            zuk.setYHeadRot(yaw);
            zuk.setYBodyRot(yaw);
        }
        float health = zuk.getHealth() / zuk.getMaxHealth();
        if (z.stage == 0 && health <= 0.8F || z.stage == 1 && health <= 0.6F) {
            z.stage++;
            sendSet(z, zuk);
        } else if (z.stage == 2 && health <= 0.5F) {
            z.stage++;
            Vec3 at = stand(z.level, z.home.x, z.shieldY, z.home.z + 16);
            if (at != null) PitMobs.spawn(z.level, PitMobs.zukJad(), at, 0F);
            announce(z.level, zuk, "Kiln-Kal-Zuk calls a Kal-Tok-Jad into the pit!", ChatFormatting.RED);
        } else if (z.stage == 3 && health <= 0.25F) {
            z.stage++;
            callMenders(z.level, zuk, new Vec3(z.home.x, z.shieldY, z.home.z + 14), PitMobs.zukMenders(), 3);
        }
        if (!z.charging) {
            if (--z.timer <= 0) {
                z.charging = true;
                z.timer = 40;
                if (zuk instanceof Ghast ghast) ghast.setCharging(true);
                sound(z.level, zuk.position(), SoundEvents.GHAST_WARN, 4F, 0.5F);
                for (ServerPlayer p : z.level.getPlayers(pl -> pl.distanceToSqr(zuk) < 128 * 128))
                    p.displayClientMessage(Component.literal("Kiln-Kal-Zuk's eyes burn: get behind the shield!").withStyle(ChatFormatting.DARK_RED), true);
            }
        } else {
            Vec3 eye = zuk.getEyePosition();
            z.level.sendParticles(ParticleTypes.FLAME, eye.x, eye.y, eye.z + zuk.getBbWidth() * 0.45, 6, 1.2, 0.8, 0.2, 0.01);
            if (--z.timer <= 0) {
                z.charging = false;
                if (zuk instanceof Ghast ghast) ghast.setCharging(false);
                burn(z, zuk);
                z.timer = health <= 0.1F ? 90 : 130;
            }
        }
        return true;
    }

    /** Zuk burns: everyone the shield doesn't cover takes most of their health. */
    private static void burn(Zuk z, LivingEntity zuk) {
        Vec3 eye = zuk.getEyePosition();
        sound(z.level, zuk.position(), SoundEvents.GHAST_SHOOT, 4F, 0.4F);
        for (ServerPlayer p : z.level.getPlayers(pl -> pl.isAlive() && !pl.isSpectator() && pl.distanceToSqr(zuk) < 128 * 128)) {
            Vec3 to = p.getEyePosition();
            Vec3 hit = shieldHit(z, eye, to);
            if (hit != null) {
                beam(z.level, eye, hit, ParticleTypes.FLAME);
                z.level.sendParticles(ParticleTypes.LAVA, hit.x, hit.y, hit.z, 12, 0.5, 0.5, 0.2, 0);
                sound(z.level, hit, SoundEvents.SHIELD_BLOCK, 2F, 0.5F);
                if (debug) PitsModule.LOGGER.info("[pits] Zuk burns: {} is behind the shield (shield at x {}, player at x {})", p.getGameProfile().getName(), String.format("%.1f", z.shieldX), String.format("%.1f", p.getX()));
                continue;
            }
            float before = p.getHealth();
            beam(z.level, eye, to, ParticleTypes.SOUL_FIRE_FLAME);
            z.level.sendParticles(ParticleTypes.EXPLOSION, to.x, to.y, to.z, 1, 0, 0, 0, 0);
            p.hurt(source(z.level, ZUK_VOLLEY, zuk, zuk), p.getMaxHealth() * ZUK_SHARE);
            p.igniteForSeconds(5F);
            if (debug) PitsModule.LOGGER.info("[pits] Zuk burns {}: health {} -> {} (shield at x {}, player at x {})", p.getGameProfile().getName(), before, p.getHealth(), String.format("%.1f", z.shieldX), String.format("%.1f", p.getX()));
        }
    }

    /** Where the line from Zuk's eye to a player meets the shield, or null if it doesn't (the player isn't covered). */
    @Nullable
    private static Vec3 shieldHit(Zuk z, Vec3 eye, Vec3 to) {
        double plane = z.shieldZ + 0.5;
        if (to.z <= plane + 0.3) return null;
        double t = (plane - eye.z) / (to.z - eye.z);
        if (t <= 0 || t >= 1) return null;
        Vec3 at = eye.add(to.subtract(eye).scale(t));
        // Across only (the shield covers its lane however high the line passes, as a glyph would).
        if (Math.abs(at.x - z.shieldX) > 2.8) return null;
        return new Vec3(at.x, Mth.clamp(at.y, z.shieldY + 0.5, z.shieldY + SHIELD_H - 0.5), at.z);
    }

    private static final int SHIELD_W = 5, SHIELD_H = 4;

    private static void makeShield(Zuk z) {
        for (int i = 0; i < SHIELD_W; i++)
            for (int k = 0; k < SHIELD_H; k++) {
                boolean edge = i == 0 || i == SHIELD_W - 1 || k == 0 || k == SHIELD_H - 1;
                String block = edge ? "minecraft:obsidian" : "minecraft:crying_obsidian";
                try {
                    CompoundTag tag = TagParser.parseTag("{id:\"minecraft:block_display\",block_state:{Name:\"" + block
                            + "\"},teleport_duration:2,brightness:{block:12,sky:0},Tags:[\"" + PIT + "\",\"" + SHIELD + "\"]}");
                    Entity d = EntityType.loadEntityRecursive(tag, z.level, e -> {
                        e.moveTo(z.shieldX - SHIELD_W / 2.0, z.shieldY, z.shieldZ, 0F, 0F);
                        return e;
                    });
                    if (d != null && z.level.addFreshEntity(d)) z.shield.add(d.getUUID());
                } catch (Exception ex) {
                    PitsModule.LOGGER.error("Couldn't make Zuk's shield", ex);
                }
            }
        moveShield(z);
    }

    private static void moveShield(Zuk z) {
        for (int n = 0; n < z.shield.size(); n++) {
            Entity d = z.level.getEntity(z.shield.get(n));
            if (d == null) continue;
            int i = n / SHIELD_H, k = n % SHIELD_H;
            d.teleportTo(z.shieldX - SHIELD_W / 2.0 + i, z.shieldY + k, z.shieldZ);
        }
    }

    private static void removeShield(Zuk z) {
        for (UUID u : z.shield) {
            Entity d = z.level.getEntity(u);
            if (d != null) d.discard();
        }
        z.shield.clear();
    }

    /** A set of beasts from one side of the pit. */
    private static void sendSet(Zuk z, LivingEntity zuk) {
        double side = z.stage % 2 == 0 ? -1 : 1;
        int n = 0;
        for (String snbt : PitMobs.zukSets()) {
            Vec3 at = stand(z.level, z.home.x + side * (16 + n * 2), z.shieldY, z.home.z + 14);
            if (at != null) {
                Entity e = PitMobs.spawn(z.level, snbt, at, 0F);
                if (e instanceof Mob mob) mob.setTarget(nearestPlayer(z.level, at, 96));
            }
            n++;
        }
        announce(z.level, zuk, "Kiln-Kal-Zuk sends more beasts into the pit!", ChatFormatting.GOLD);
    }

    // ---------------------------------------------------------------- helpers

    private static void announce(ServerLevel level, Entity near, String text, ChatFormatting colour) {
        for (ServerPlayer p : level.getPlayers(pl -> pl.distanceToSqr(near) < 128 * 128)) p.sendSystemMessage(Component.literal(text).withStyle(colour));
    }

    @Nullable
    private static ServerPlayer nearestPlayer(ServerLevel level, Vec3 at, double range) {
        Player p = level.getNearestPlayer(at.x, at.y, at.z, range, pl -> pl.isAlive() && !pl.isSpectator());
        return p instanceof ServerPlayer sp ? sp : null;
    }

    @Nullable
    private static LivingEntity nearestBoss(ServerLevel level, Vec3 at) {
        LivingEntity best = null;
        double bestD = 64 * 64;
        for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, new AABB(at, at).inflate(64), x -> x.isAlive() && (x.getTags().contains(JAD) || x.getTags().contains(ZUK)))) {
            double d = e.distanceToSqr(at);
            if (d < bestD) {
                bestD = d;
                best = e;
            }
        }
        return best;
    }

    private static double distanceSqr(AABB box, Vec3 p) {
        double dx = Math.max(Math.max(box.minX - p.x, 0), p.x - box.maxX);
        double dy = Math.max(Math.max(box.minY - p.y, 0), p.y - box.maxY);
        double dz = Math.max(Math.max(box.minZ - p.z, 0), p.z - box.maxZ);
        return dx * dx + dy * dy + dz * dz;
    }

    /** The floor's y (where feet go) at x, z, looking down from {@code top} to {@code bottom}; {@code bottom} if none. */
    private static double floorY(ServerLevel level, double x, double top, double z, double bottom) {
        Vec3 at = stand(level, x, top, z);
        return at != null && at.y >= bottom ? at.y : bottom;
    }

    /** A place to stand at x, z near height y (solid below, room above), or null. */
    @Nullable
    private static Vec3 stand(ServerLevel level, double x, double y, double z) {
        BlockPos.MutableBlockPos p = new BlockPos.MutableBlockPos();
        int bx = Mth.floor(x), bz = Mth.floor(z), top = Mth.floor(y) + 3;
        for (int yy = top; yy >= top - 9; yy--) {
            if (!level.getBlockState(p.set(bx, yy - 1, bz)).blocksMotion() || !level.getFluidState(p.set(bx, yy - 1, bz)).isEmpty()) continue;
            if (level.getBlockState(p.set(bx, yy, bz)).blocksMotion() || level.getBlockState(p.set(bx, yy + 1, bz)).blocksMotion()) continue;
            if (!level.getFluidState(p.set(bx, yy, bz)).isEmpty()) continue;
            return new Vec3(bx + 0.5, yy, bz + 0.5);
        }
        return null;
    }

    private static void beam(ServerLevel level, Vec3 from, Vec3 to, ParticleOptions particle) {
        Vec3 d = to.subtract(from);
        int steps = Math.max(2, (int) (d.length() / 0.4));
        for (int i = 0; i <= steps; i++) {
            Vec3 at = from.add(d.scale(i / (double) steps));
            level.sendParticles(particle, at.x, at.y, at.z, 1, 0.03, 0.03, 0.03, 0);
        }
    }

    private static void sound(Level level, Vec3 at, SoundEvent sound, float volume, float pitch) {
        level.playSound(null, at.x, at.y, at.z, sound, SoundSource.HOSTILE, volume, pitch);
    }

    private static DamageSource source(Level level, ResourceKey<DamageType> type, Entity direct, Entity cause) {
        return level.registryAccess().registryOrThrow(Registries.DAMAGE_TYPE).getHolder(type).map(h -> new DamageSource(h, direct, cause))
                .orElseGet(() -> cause instanceof LivingEntity living ? level.damageSources().mobAttack(living) : level.damageSources().magic());
    }

    /** Forgets everything (a server stopping). */
    static void clear(MinecraftServer server) {
        JADS.clear();
        ZUKS.clear();
        MENDERS.clear();
        MEJKOTS.clear();
        BURROWERS.clear();
    }

    private PitBosses() {
    }
}
