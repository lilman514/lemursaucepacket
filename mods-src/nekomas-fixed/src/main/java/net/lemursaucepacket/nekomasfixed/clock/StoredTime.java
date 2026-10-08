package net.lemursaucepacket.nekomasfixed.clock;

import com.mojang.serialization.Codec;

import io.netty.buffer.ByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.world.level.Level;

/** The time of day a clock recorded (right-click air with it), in ticks after midnight (0 to 23999). */
public record StoredTime(int time) {
    public static final Codec<StoredTime> CODEC = Codec.intRange(0, 23999).xmap(StoredTime::new, StoredTime::time);
    public static final StreamCodec<ByteBuf, StoredTime> STREAM_CODEC = ByteBufCodecs.VAR_INT.map(StoredTime::new, StoredTime::time);

    /** Ticks since midnight. Minecraft's day time 0 is 6 AM. */
    public static int timeOfDay(Level level) {
        return (int) Math.floorMod(level.getDayTime() + 6000, 24000L);
    }

    /** The time of day as HH:MM, the way the clock's label and tooltip show it. */
    public static String format(int timeOfDay) {
        return String.format("%02d:%02d", timeOfDay / 1000, (timeOfDay % 1000) * 60 / 1000);
    }
}
