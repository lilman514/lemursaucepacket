package net.lemursaucepacket.fixes.hud;

/**
 * One movable HUD part in the layout editor. Each one reads and writes its own mod's position setting, the
 * way that mod stores it, so the layout keeps working without this mod.
 *
 * <p>Implementations resolve everything they need from the other mod when they are built (reflection, no
 * compile dependency); if something is missing the element is skipped with a log line instead of crashing.
 */
public abstract class HudElement {
    /** A rectangle in GUI pixels. */
    public record Box(int x, int y, int w, int h) {
        public Box at(int nx, int ny) {
            return new Box(nx, ny, w, h);
        }

        public int right() {
            return x + w;
        }

        public int bottom() {
            return y + h;
        }

        public int centerX() {
            return x + w / 2;
        }

        public int centerY() {
            return y + h / 2;
        }

        public boolean contains(double px, double py) {
            return px >= x && px < x + w && py >= y && py < y + h;
        }
    }

    private final String id;
    private final String name;

    protected HudElement(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public final String id() {
        return id;
    }

    /** Shown on the box. */
    public final String name() {
        return name;
    }

    /** Where the part is drawn now, from its config, roughly its size. */
    public abstract Box box(int screenW, int screenH);

    /** Where the mod's own defaults put it (same size as {@link #box}). */
    public abstract Box defaultBox(int screenW, int screenH);

    /** Stores the box's position in the mod's settings (in memory) and saves them to disk. */
    public abstract void save(Box box, int screenW, int screenH) throws Exception;

    /** Puts the mod's default position back and saves. */
    public abstract void reset() throws Exception;

    /** Where the position is stored, for the tooltip and the log. */
    public abstract String where();

    /** Where a dropped box really ends up, for mods that can only store some places (default: where it was dropped). */
    public Box settle(Box box, int screenW, int screenH) {
        return box;
    }

    /** False when the part is switched off in its mod (the box is drawn dimmed). */
    public boolean shown() {
        return HudVisibility.shown(id);
    }

    /** Saves visibility without touching position or game state. */
    public void setShown(boolean shown) throws Exception {
        HudVisibility.save(id, shown);
    }
}
