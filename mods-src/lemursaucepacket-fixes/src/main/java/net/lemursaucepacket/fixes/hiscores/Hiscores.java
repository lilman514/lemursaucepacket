package net.lemursaucepacket.fixes.hiscores;

import net.minecraft.server.level.ServerPlayer;

/** For the rest of lsp_fixes: the counters the hiscores keep where Minecraft keeps no statistic (Elvarg's kills). */
public final class Hiscores {
    /** Adds to a player's counter (a boss's kill count) and records them, so /hiscores shows it at once. Returns the new count. */
    public static long count(ServerPlayer p, String counter, long amount) {
        HiscoresStore.Entry e = HiscoresStore.get(p.server).entry(p.getUUID(), p.getGameProfile().getName());
        long now = e.counters.merge(counter, amount, Long::sum);
        HiscoresModule.record(p);
        return now;
    }

    private Hiscores() {
    }
}
