package net.lemursaucepacket.instances;

import java.util.List;
import java.util.Optional;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

import net.minecraft.resources.ResourceLocation;

/**
 * One instanced event, read from {@code data/<namespace>/lsp_instances/event/<name>.json} (its id is the file's).
 *
 * <p>Places are given from the arena's centre: {@code x} and {@code z} across, and {@code dy} above the ground found
 * there once the arena is placed (0: standing on it). An arena under a roof gives a place's height instead: {@code y},
 * counted from the arena template's bottom layer (the ground found from above would be the roof). Spawn NBT may use {x}, {y}, {z} (where the entity appears) and {ground} (the ground's
 * y there), for things like a dragon's home position.
 *
 * @param name        the event's window title and how chat names it
 * @param description lines under the title in the window
 * @param arena       a structure template: a datapack's, or one saved in the world's generated folder
 * @param stripContainers  leave out chests and other containers when placing the arena (no loot every run)
 * @param playerSpawn where the party arrives, unless the arena has a {@code player_spawn} data marker (a structure block
 *                    in DATA mode with that metadata): then there, facing the middle
 * @param playerYaw   which way they face on arrival (0 south, 90 west, 180 north, 270 east)
 * @param spawns      what appears when the fight starts; the event is won when every {@code boss} is dead
 * @param maxPlayers  party size, the host included
 * @param timeLimit   seconds before the party is sent back
 * @param lootTime    seconds after the win before they are sent back
 * @param start       what the host needs (helpers who join a co-op fight need nothing)
 * @param keeper      who keeps the things of those who die in it ("Ned"); empty: deaths are ordinary
 * @param keeperPlace where that is ("the Crandor memorial")
 * @param radius      how far from the centre players and bosses may go before they're brought back
 * @param replace     blocks swapped as the arena is placed, within a radius of its centre (a clearing round a boss)
 * @param trial       a wave fight: waves of spawns one after another (see {@link Trial}); none for a plain boss fight
 */
public record EventDef(String name, List<String> description, ResourceLocation arena, boolean stripContainers,
                       Spot playerSpawn, float playerYaw, List<Spawn> spawns, int maxPlayers, int timeLimit, int lootTime,
                       Requirement start, String keeper, String keeperPlace, int radius, List<Replace> replace, Trial trial) {

    /**
     * A wave fight (the Fight Pits): the waves come one after another, {@code rest} seconds after the last one falls;
     * it's won when the last wave is cleared, or its bosses are dead. A wave's spawns without an {@code at} appear at
     * the arena's {@code wave_spawn} markers (structure blocks in DATA mode), shuffled. With {@code safeDeaths} a
     * player who would die is pulled out alive instead, with everything they had (nothing drops, no grave, no heart
     * lost). {@code winCommands} run for each player inside when it's won, as the server; {player} is their name.
     */
    public record Trial(List<Wave> waves, int rest, boolean safeDeaths, List<String> winCommands) {
        public static final Trial NONE = new Trial(List.of(), 5, false, List.of());
        public static final Codec<Trial> CODEC = RecordCodecBuilder.create(i -> i.group(
                Wave.CODEC.listOf().fieldOf("waves").forGetter(Trial::waves),
                Codec.intRange(0, 120).optionalFieldOf("rest", 5).forGetter(Trial::rest),
                Codec.BOOL.optionalFieldOf("safe_deaths", false).forGetter(Trial::safeDeaths),
                Codec.STRING.listOf().optionalFieldOf("win_commands", List.of()).forGetter(Trial::winCommands)).apply(i, Trial::new));

        public boolean hasWaves() {
            return !waves.isEmpty();
        }
    }

    /** One wave: what appears together. */
    public record Wave(List<Spawn> spawns) {
        public static final Codec<Wave> CODEC = RecordCodecBuilder.create(i -> i.group(
                Spawn.CODEC.listOf().fieldOf("spawns").forGetter(Wave::spawns)).apply(i, Wave::new));
    }

    /** Blocks ({@code id} or {@code #tag}) within {@code radius} of the arena's centre become {@code with} (a block id). */
    public record Replace(List<String> blocks, String with, int radius) {
        public static final Codec<Replace> CODEC = RecordCodecBuilder.create(i -> i.group(
                Codec.STRING.listOf().fieldOf("blocks").forGetter(Replace::blocks),
                Codec.STRING.optionalFieldOf("with", "minecraft:air").forGetter(Replace::with),
                Codec.intRange(1, 512).fieldOf("radius").forGetter(Replace::radius)).apply(i, Replace::new));
    }

    public record Spot(int x, int z, int dy, Optional<Integer> y) {
        public Spot(int x, int z, int dy) {
            this(x, z, dy, Optional.empty());
        }

        public static final Codec<Spot> CODEC = RecordCodecBuilder.create(i -> i.group(
                Codec.INT.optionalFieldOf("x", 0).forGetter(Spot::x),
                Codec.INT.optionalFieldOf("z", 0).forGetter(Spot::z),
                Codec.INT.optionalFieldOf("dy", 0).forGetter(Spot::dy),
                Codec.INT.optionalFieldOf("y").forGetter(Spot::y)).apply(i, Spot::new));
    }

    /**
     * An entity to add when the fight starts (or its wave comes), as SNBT with its {@code id}; {@code count} of them.
     * Without {@code at}: the arena's centre, or for a wave, its {@code wave_spawn} markers.
     */
    public record Spawn(String nbt, Optional<Spot> at, boolean boss, boolean fullHealth, int count) {
        public static final Codec<Spawn> CODEC = RecordCodecBuilder.create(i -> i.group(
                Codec.STRING.fieldOf("nbt").forGetter(Spawn::nbt),
                Spot.CODEC.optionalFieldOf("at").forGetter(Spawn::at),
                Codec.BOOL.optionalFieldOf("boss", false).forGetter(Spawn::boss),
                Codec.BOOL.optionalFieldOf("full_health", false).forGetter(Spawn::fullHealth),
                Codec.intRange(1, 32).optionalFieldOf("count", 1).forGetter(Spawn::count)).apply(i, Spawn::new));
    }

    /** Entity tags the player must have, and must not have; {@code message} says why not. */
    public record Requirement(List<String> tags, List<String> notTags, String message) {
        public static final Requirement NONE = new Requirement(List.of(), List.of(), "");
        public static final Codec<Requirement> CODEC = RecordCodecBuilder.create(i -> i.group(
                Codec.STRING.listOf().optionalFieldOf("tags", List.of()).forGetter(Requirement::tags),
                Codec.STRING.listOf().optionalFieldOf("not_tags", List.of()).forGetter(Requirement::notTags),
                Codec.STRING.optionalFieldOf("message", "").forGetter(Requirement::message)).apply(i, Requirement::new));

        public boolean met(net.minecraft.world.entity.Entity e) {
            return e.getTags().containsAll(tags) && notTags.stream().noneMatch(e.getTags()::contains);
        }
    }

    public static final Codec<EventDef> CODEC = RecordCodecBuilder.create(i -> i.group(
            Codec.STRING.fieldOf("name").forGetter(EventDef::name),
            Codec.STRING.listOf().optionalFieldOf("description", List.of()).forGetter(EventDef::description),
            ResourceLocation.CODEC.fieldOf("arena").forGetter(EventDef::arena),
            Codec.BOOL.optionalFieldOf("strip_containers", true).forGetter(EventDef::stripContainers),
            Spot.CODEC.optionalFieldOf("player_spawn", new Spot(0, 0, 0)).forGetter(EventDef::playerSpawn),
            Codec.FLOAT.optionalFieldOf("player_yaw", 0F).forGetter(EventDef::playerYaw),
            Spawn.CODEC.listOf().optionalFieldOf("spawns", List.of()).forGetter(EventDef::spawns),
            Codec.intRange(1, 16).optionalFieldOf("max_players", 4).forGetter(EventDef::maxPlayers),
            Codec.intRange(30, 7200).optionalFieldOf("time_limit", 1200).forGetter(EventDef::timeLimit),
            Codec.intRange(0, 600).optionalFieldOf("loot_time", 60).forGetter(EventDef::lootTime),
            Requirement.CODEC.optionalFieldOf("start_requires", Requirement.NONE).forGetter(EventDef::start),
            Codec.STRING.optionalFieldOf("keeper", "").forGetter(EventDef::keeper),
            Codec.STRING.optionalFieldOf("keeper_place", "").forGetter(EventDef::keeperPlace),
            Codec.intRange(8, 512).optionalFieldOf("radius", 64).forGetter(EventDef::radius),
            Replace.CODEC.listOf().optionalFieldOf("replace", List.of()).forGetter(EventDef::replace),
            Trial.CODEC.optionalFieldOf("trial", Trial.NONE).forGetter(EventDef::trial)).apply(i, EventDef::new));
}
