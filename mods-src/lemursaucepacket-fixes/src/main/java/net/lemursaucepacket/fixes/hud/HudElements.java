package net.lemursaucepacket.fixes.hud;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.Rect2i;
import net.minecraft.world.effect.MobEffectInstance;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.common.ModConfigSpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The movable HUD parts in this pack, each stored the way its own mod expects. Every integration is optional
 * (built only when the mod is loaded) and reached by reflection: if a mod update renames something, that one
 * element is logged and left out of the editor.
 */
public final class HudElements {
    static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/hud");
    private static final Set<String> WARNED = new HashSet<>();

    @FunctionalInterface
    private interface Factory {
        HudElement create() throws Throwable;
    }

    /** The elements that can be edited right now (mods present, settings found). */
    public static List<HudElement> available() {
        List<HudElement> list = new ArrayList<>();
        add(list, "xaerominimap", "Xaero's Minimap", XaeroMinimap::new);
        add(list, "jade", "Jade", Jade::new);
        add(list, "voicechat", "Simple Voice Chat icon", VoiceIcon::new);
        add(list, "voicechat", "Simple Voice Chat group", VoiceGroup::new);
        add(list, "create", "Create goggle overlay", CreateGoggles::new);
        add(list, "pmmo", "Project MMO XP gains", () -> new Pmmo(false));
        add(list, "pmmo", "Project MMO skill list", () -> new Pmmo(true));
        add(list, "ftbquests", "FTB Quests pinned quests", FtbPinned::new);
        add(list, null, "status effects", VanillaEffects::new);
        add(list, null, "boss bar", VanillaBossBar::new);
        return list;
    }

    private static void add(List<HudElement> list, String modId, String what, Factory factory) {
        if (modId != null && !ModList.get().isLoaded(modId)) return;
        try {
            list.add(factory.create());
        } catch (Throwable t) {
            warnOnce(what, t);
        }
    }

    static void warnOnce(String what, Throwable t) {
        if (WARNED.add(what)) LOGGER.warn("HUD layout: leaving out {} ({}); the mod may have renamed its settings", what, t.toString());
    }

    private static double guiScale() {
        return Minecraft.getInstance().getWindow().getGuiScale();
    }

    private static double round4(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }

    // ---------------------------------------------------------------- Xaero's Minimap

    /**
     * Xaero's Minimap keeps HUD module positions in {@code config/xaerohud.txt} ({@code module;id=xaerominimap:minimap;
     * x=..;y=..;centered=..;fromRight=..;fromBottom=..}). Written through its own module API and settings save,
     * exactly like its "Edit HUD" screen does, so it moves at once.
     */
    static final class XaeroMinimap extends HudElement {
        private final Object module;
        private final Method getSession;
        private final Method getConfirmed;
        private final Method setTransform;
        private final Method copy;
        private final Class<?> transformClass;
        private final Field fx, fy, fCentered, fFromRight, fFromBottom;
        private final Method sessionWidth, sessionHeight, sessionActive;
        private final Object settings;
        private final Method saveSettings;

        XaeroMinimap() throws Exception {
            super("xaero_minimap", "Minimap");
            module = Reflect.staticField("xaero.hud.minimap.BuiltInHudModules", "MINIMAP");
            Class<?> moduleClass = Reflect.cls("xaero.hud.module.HudModule");
            transformClass = Reflect.cls("xaero.hud.module.ModuleTransform");
            getSession = moduleClass.getMethod("getCurrentSession");
            getConfirmed = moduleClass.getMethod("getConfirmedTransform");
            setTransform = moduleClass.getMethod("setTransform", transformClass);
            copy = transformClass.getMethod("copy");
            fx = transformClass.getField("x");
            fy = transformClass.getField("y");
            fCentered = transformClass.getField("centered");
            fFromRight = transformClass.getField("fromRight");
            fFromBottom = transformClass.getField("fromBottom");
            Class<?> sessionClass = Reflect.cls("xaero.hud.module.ModuleSession");
            sessionWidth = sessionClass.getMethod("getWidth", double.class);
            sessionHeight = sessionClass.getMethod("getHeight", double.class);
            sessionActive = sessionClass.getMethod("isActive");
            Class<?> hudMod = Reflect.cls("xaero.common.HudMod");
            Object mod = hudMod.getField("INSTANCE").get(null);
            settings = hudMod.getMethod("getSettings").invoke(mod);
            saveSettings = Reflect.cls("xaero.common.settings.ModSettings").getMethod("saveSettings");
            if (mod == null || settings == null) throw new IllegalStateException("Xaero's Minimap is not set up");
        }

        private int[] size() throws Exception {
            Object session = getSession.invoke(module);
            if (session == null) return new int[] {64, 64};
            return new int[] {(int) sessionWidth.invoke(session, guiScale()), (int) sessionHeight.invoke(session, guiScale())};
        }

        @Override
        public boolean shown() {
            return super.shown();
        }

        @Override
        public Box box(int sw, int sh) {
            try {
                int[] s = size();
                Object t = getConfirmed.invoke(module);
                int x = fx.getInt(t), y = fy.getInt(t);
                int left = fCentered.getBoolean(t) ? sw / 2 - s[0] / 2 : fFromRight.getBoolean(t) ? sw - x - s[0] : x;
                int top = fFromBottom.getBoolean(t) ? sh - y - s[1] : y;
                return new Box(left, top, s[0], s[1]);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public Box defaultBox(int sw, int sh) {
            Box b = box(sw, sh);
            return new Box(0, 0, b.w(), b.h());
        }

        @Override
        public void save(Box b, int sw, int sh) throws Exception {
            Object t = copy.invoke(getConfirmed.invoke(module));
            boolean fromBottom = b.y() > sh - b.y() - b.h();
            fFromBottom.setBoolean(t, fromBottom);
            fy.setInt(t, fromBottom ? sh - b.y() - b.h() : b.y());
            boolean centered = Math.abs(b.centerX() - sw / 2) <= 1;
            fCentered.setBoolean(t, centered);
            boolean fromRight = !centered && b.x() > sw - b.x() - b.w();
            fFromRight.setBoolean(t, fromRight);
            fx.setInt(t, centered ? 0 : fromRight ? sw - b.x() - b.w() : b.x());
            setTransform.invoke(module, t);
            Reflect.call(settings, saveSettings);
        }

        @Override
        public Box settle(Box b, int sw, int sh) {
            return Math.abs(b.centerX() - sw / 2) <= 1 ? b.at(sw / 2 - b.w() / 2, b.y()) : b;
        }

        @Override
        public void reset() throws Exception {
            setTransform.invoke(module, transformClass.getConstructor().newInstance());
            Reflect.call(settings, saveSettings);
        }

        @Override
        public String where() {
            return "config/xaerohud.txt (module xaerominimap:minimap: x, y, centered, fromRight, fromBottom)";
        }
    }

    // ---------------------------------------------------------------- Jade

    /**
     * Jade: {@code config/jade/jade.json}, {@code overlay.overlayPosX/overlayPosY} (fractions of the screen, Y
     * measured up from the bottom) and {@code overlay.overlayAnchorX/overlayAnchorY} (which point of the box
     * sits there). Set on Jade's live config object and saved, the same way its own position editor does.
     */
    static final class Jade extends HudElement {
        private final Method get, getOverlay, posX, posY, anchorX, anchorY, scale, tryFlip;
        private final Method setPosX, setPosY, setAnchorX, setAnchorY;
        private final Object jsonConfig;
        private final Method save;
        private final Field expectedRect;
        private final Object rectHolder;

        Jade() throws Exception {
            super("jade", "Jade (block info)");
            Class<?> api = Reflect.cls("snownee.jade.api.config.IWailaConfig");
            Class<?> overlay = Reflect.cls("snownee.jade.api.config.IWailaConfig$IConfigOverlay");
            get = api.getMethod("get");
            getOverlay = api.getMethod("getOverlay");
            posX = overlay.getMethod("getOverlayPosX");
            posY = overlay.getMethod("getOverlayPosY");
            anchorX = overlay.getMethod("getAnchorX");
            anchorY = overlay.getMethod("getAnchorY");
            scale = overlay.getMethod("getOverlayScale");
            tryFlip = overlay.getMethod("tryFlip", float.class);
            setPosX = overlay.getMethod("setOverlayPosX", float.class);
            setPosY = overlay.getMethod("setOverlayPosY", float.class);
            setAnchorX = overlay.getMethod("setAnchorX", float.class);
            setAnchorY = overlay.getMethod("setAnchorY", float.class);
            jsonConfig = Reflect.staticField("snownee.jade.Jade", "CONFIG");
            save = Reflect.cls("snownee.jade.util.JsonConfig").getMethod("save");
            Object holder = null;
            Field rect = null;
            try {
                holder = Reflect.staticField("snownee.jade.overlay.OverlayRenderer", "rect");
                rect = Reflect.cls("snownee.jade.api.ui.TooltipRect").getField("expectedRect");
            } catch (ReflectiveOperationException e) {
                // Only used to size the box.
            }
            rectHolder = holder;
            expectedRect = rect;
            overlay(); // fails here, not later, if the config can't be reached
        }

        private Object overlay() throws Exception {
            return getOverlay.invoke(get.invoke(null));
        }

        private float f(Method m, Object o) throws Exception {
            return (float) m.invoke(o);
        }

        private float flip(Object o, float v) throws Exception {
            return (float) tryFlip.invoke(o, v);
        }

        private int[] size() throws Exception {
            if (rectHolder != null && expectedRect != null) {
                Rect2i r = (Rect2i) expectedRect.get(rectHolder);
                if (r != null && r.getWidth() > 20 && r.getHeight() > 10) return new int[] {r.getWidth(), r.getHeight()};
            }
            float s = f(scale, overlay());
            return new int[] {Math.round(130 * s), Math.round(30 * s)};
        }

        @Override
        public Box box(int sw, int sh) {
            try {
                Object o = overlay();
                int[] s = size();
                float x = sw * flip(o, f(posX, o)) - s[0] * flip(o, f(anchorX, o));
                float y = sh * (1 - f(posY, o)) - s[1] * f(anchorY, o);
                return new Box(Math.round(x), Math.round(y), s[0], s[1]);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public Box defaultBox(int sw, int sh) {
            Box b = box(sw, sh);
            return new Box(Math.round(sw * 0.5f - b.w() * 0.5f), 0, b.w(), b.h());
        }

        /** Jade's own rule (PreviewOptionsScreen): the box's near edge or centre becomes the anchor. */
        private static float anchor(float center, float size, int rectSize) {
            float anchor = center / size;
            if (anchor < 0.25F) return 0.0F;
            if (anchor > 0.75F) return 1.0F;
            float half = rectSize / 2.0F;
            float tolerance = Math.min(15.0F, half / 2.0F - 3.0F);
            if (Math.abs(center + half - size / 2.0F) < tolerance) return 1.0F;
            return Math.abs(center - half - size / 2.0F) < tolerance ? 0.0F : 0.5F;
        }

        private static float snap(float v) {
            return v > 0.475F && v < 0.525F ? 0.5F : v;
        }

        @Override
        public void save(Box b, int sw, int sh) throws Exception {
            float cx = b.x() + b.w() / 2.0F;
            float cy = b.y() + b.h() / 2.0F;
            float ax = anchor(cx, sw, b.w());
            float ay = anchor(cy, sh, b.h());
            float px = (cx + b.w() * (ax - 0.5F)) / sw;
            float py = 1.0F - (cy + b.h() * (ay - 0.5F)) / sh;
            write(snap(px), snap(py), ax, ay);
        }

        private void write(float px, float py, float ax, float ay) throws Exception {
            Object o = overlay();
            setPosX.invoke(o, flip(o, (float) round4(px)));
            setPosY.invoke(o, (float) round4(py));
            setAnchorX.invoke(o, flip(o, ax));
            setAnchorY.invoke(o, ay);
            Reflect.call(jsonConfig, save);
        }

        @Override
        public void reset() throws Exception {
            write(0.5F, 1.0F, 0.5F, 0.0F); // Jade's defaults (WailaConfig.ConfigOverlay codec)
        }

        @Override
        public String where() {
            return "config/jade/jade.json (overlay.overlayPosX/Y, overlay.overlayAnchorX/Y)";
        }
    }

    // ---------------------------------------------------------------- Simple Voice Chat

    /** Simple Voice Chat's client config entries (de.maxhenkel configbuilder): get, set, save, getDefault. */
    abstract static class VoiceBase extends HudElement {
        protected final Method get, set, save, getDefault;
        protected final Object config;

        VoiceBase(String id, String name) throws Exception {
            super(id, name);
            config = Reflect.staticField("de.maxhenkel.voicechat.VoicechatClient", "CLIENT_CONFIG");
            if (config == null) throw new IllegalStateException("voice chat client config not loaded");
            Class<?> entry = Reflect.cls("de.maxhenkel.voicechat.configbuilder.entry.ConfigEntry");
            get = entry.getMethod("get");
            set = entry.getMethod("set", Object.class);
            save = entry.getMethod("save");
            getDefault = entry.getMethod("getDefault");
        }

        protected Object entry(String field) throws ReflectiveOperationException {
            Object e = config.getClass().getField(field).get(config);
            if (e == null) throw new NoSuchFieldException(field);
            return e;
        }

        protected Object value(String field) throws Exception {
            return get.invoke(entry(field));
        }

        protected Object defaultValue(String field) throws Exception {
            return getDefault.invoke(entry(field));
        }

        protected void put(String field, Object value) throws Exception {
            Object e = entry(field);
            set.invoke(e, value);
            Reflect.call(e, save);
        }

        /** Negative positions anchor to the right/bottom edge (the voice chat's own convention). */
        protected static int anchored(int start, int size, int screen) {
            return start + size / 2 > screen / 2 ? Math.min(-1, start + size - screen) : Math.max(0, start);
        }

        protected static int start(int pos, int size, int screen) {
            return pos < 0 ? screen + pos - size : pos;
        }
    }

    /**
     * The microphone/status icon: {@code config/voicechat/voicechat-client.properties}, {@code hud_icon_pos_x/y}
     * (negative = from the right/bottom). The voice chat reads these every frame, so the icon moves at once.
     */
    static final class VoiceIcon extends VoiceBase {
        VoiceIcon() throws Exception {
            super("voice_icon", "Voice icon");
            entry("hudIconPosX");
            entry("hudIconPosY");
        }

        private int size() throws Exception {
            return Math.max(4, (int) Math.round(16 * ((Number) value("hudIconScale")).doubleValue()));
        }

        private Box boxFor(int px, int py, int sw, int sh) throws Exception {
            int s = size();
            return new Box(start(px, s, sw), start(py, s, sh), s, s);
        }

        @Override
        public Box box(int sw, int sh) {
            try {
                return boxFor((Integer) value("hudIconPosX"), (Integer) value("hudIconPosY"), sw, sh);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public Box defaultBox(int sw, int sh) {
            try {
                return boxFor((Integer) defaultValue("hudIconPosX"), (Integer) defaultValue("hudIconPosY"), sw, sh);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public void save(Box b, int sw, int sh) throws Exception {
            put("hudIconPosX", anchored(b.x(), b.w(), sw));
            put("hudIconPosY", anchored(b.y(), b.h(), sh));
        }

        @Override
        public void reset() throws Exception {
            put("hudIconPosX", defaultValue("hudIconPosX"));
            put("hudIconPosY", defaultValue("hudIconPosY"));
        }

        @Override
        public String where() {
            return "config/voicechat/voicechat-client.properties (hud_icon_pos_x, hud_icon_pos_y)";
        }
    }

    /**
     * The group members' heads: {@code group_player_icon_pos_x/y} in the same file. The box is sized for three
     * members in the configured orientation and scale.
     */
    static final class VoiceGroup extends VoiceBase {
        private static final int MEMBERS = 3;

        VoiceGroup() throws Exception {
            super("voice_group", "Voice group");
            entry("groupPlayerIconPosX");
            entry("groupPlayerIconPosY");
        }

        private int[] size() throws Exception {
            double s = ((Number) value("groupHudIconScale")).doubleValue();
            boolean vertical = String.valueOf(value("groupPlayerIconOrientation")).equals("VERTICAL");
            int along = (int) Math.round((11 * (MEMBERS - 1) + 10) * s);
            int across = (int) Math.round(10 * s);
            return vertical ? new int[] {across, along} : new int[] {along, across};
        }

        private Box boxFor(int px, int py, int sw, int sh) throws Exception {
            int[] s = size();
            return new Box(start(px, s[0], sw), start(py, s[1], sh), s[0], s[1]);
        }

        @Override
        public Box box(int sw, int sh) {
            try {
                return boxFor((Integer) value("groupPlayerIconPosX"), (Integer) value("groupPlayerIconPosY"), sw, sh);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public Box defaultBox(int sw, int sh) {
            try {
                return boxFor((Integer) defaultValue("groupPlayerIconPosX"), (Integer) defaultValue("groupPlayerIconPosY"), sw, sh);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public void save(Box b, int sw, int sh) throws Exception {
            put("groupPlayerIconPosX", anchored(b.x(), b.w(), sw));
            put("groupPlayerIconPosY", anchored(b.y(), b.h(), sh));
        }

        @Override
        public void reset() throws Exception {
            put("groupPlayerIconPosX", defaultValue("groupPlayerIconPosX"));
            put("groupPlayerIconPosY", defaultValue("groupPlayerIconPosY"));
        }

        @Override
        public String where() {
            return "config/voicechat/voicechat-client.properties (group_player_icon_pos_x, group_player_icon_pos_y)";
        }
    }

    // ---------------------------------------------------------------- NeoForge-config mods (Create, Project MMO)

    /** Two numbers in a NeoForge TOML config; setting them updates the mod's cached value at once. */
    abstract static class TomlPair extends HudElement {
        protected final String file;
        protected final ModConfigSpec.ConfigValue<?> xValue, yValue;
        protected final String xPath, yPath;

        TomlPair(String id, String name, String file, String xPath, String yPath) throws Exception {
            super(id, name);
            this.file = file;
            this.xPath = xPath;
            this.yPath = yPath;
            xValue = Reflect.configValue(file, xPath);
            yValue = Reflect.configValue(file, yPath);
            xValue.get(); // throws if the file isn't loaded yet
        }

        protected double num(ModConfigSpec.ConfigValue<?> v) {
            return ((Number) v.get()).doubleValue();
        }

        protected double def(ModConfigSpec.ConfigValue<?> v) {
            return ((Number) v.getDefault()).doubleValue();
        }

        protected void write(Object x, Object y) {
            Reflect.set(xValue, x);
            Reflect.set(yValue, y);
            Reflect.specOf(file).save();
        }

        @Override
        public String where() {
            String x = xPath.substring(xPath.lastIndexOf('.') + 1);
            String y = yPath.substring(yPath.lastIndexOf('.') + 1);
            return "config/" + file + " (" + x + ", " + y + ")";
        }
    }

    /**
     * Create's goggle and hover overlay: {@code config/create-client.toml}, {@code [client.goggleOverlay]
     * overlayOffsetX/overlayOffsetY}, pixels from the screen centre (what {@code /create overlay} edits).
     */
    static final class CreateGoggles extends TomlPair {
        CreateGoggles() throws Exception {
            super("create_goggles", "Create goggle info", "create-client.toml", "client.goggleOverlay.overlayOffsetX", "client.goggleOverlay.overlayOffsetY");
        }

        private static Box boxFor(double ox, double oy, int sw, int sh) {
            return new Box(sw / 2 + (int) ox, sh / 2 + (int) oy, 120, 36);
        }

        @Override
        public Box box(int sw, int sh) {
            return boxFor(num(xValue), num(yValue), sw, sh);
        }

        @Override
        public Box defaultBox(int sw, int sh) {
            return boxFor(def(xValue), def(yValue), sw, sh);
        }

        @Override
        public void save(Box b, int sw, int sh) {
            write(b.x() - sw / 2, b.y() - sh / 2);
        }

        @Override
        public void reset() {
            write(xValue.getDefault(), yValue.getDefault());
        }
    }

    /**
     * Project MMO: {@code config/pmmo-client.toml}, {@code [Client.GUI] "Gain List Xoffset"/"Gain List Yoffset"}
     * (the XP pop-ups) or {@code "Skill List Xoffset"/"Skill List Yoffset"}, fractions of the screen size.
     * The pack ships that file, so the position is also remembered in lsp_fixes-client.toml
     * ({@link HudLayoutClient#restoreRemembered()}).
     */
    static final class Pmmo extends TomlPair {
        private final boolean skills;
        private final ModConfigSpec.ConfigValue<?> display;

        Pmmo(boolean skills) throws Exception {
            super(skills ? "pmmo_skills" : "pmmo_gains", skills ? "Skill list" : "XP gains", "pmmo-client.toml",
                    skills ? "Client.GUI.Skill List Xoffset" : "Client.GUI.Gain List Xoffset",
                    skills ? "Client.GUI.Skill List Yoffset" : "Client.GUI.Gain List Yoffset");
            this.skills = skills;
            ModConfigSpec.ConfigValue<?> d = null;
            try {
                d = Reflect.configValue(file, skills ? "Client.GUI.Display Skill List" : "Client.GUI.Display Gain List");
            } catch (NoSuchFieldException e) {
                // Only used to dim the box.
            }
            display = d;
        }

        private Box boxFor(double x, double y, int sw, int sh) {
            if (skills) return net.lemursaucepacket.fixes.pmmo.SkillHud.box(x, y, sw, sh);
            return new Box((int) (sw * x), (int) (sh * y), skills ? 110 : 100, skills ? 3 + 14 * 9 : 3 + 5 * 9);
        }

        @Override
        public boolean shown() {
            return display == null || Boolean.TRUE.equals(display.get());
        }

        @Override
        public Box box(int sw, int sh) {
            return boxFor(num(xValue), num(yValue), sw, sh);
        }

        @Override
        public Box defaultBox(int sw, int sh) {
            return boxFor(def(xValue), def(yValue), sw, sh);
        }

        @Override
        public void save(Box b, int sw, int sh) {
            // (int)(size * fraction) must give back the same pixel, hence the half pixel.
            double x = Math.max(0, Math.min(1, round4((b.x() + 0.5) / sw)));
            double y = Math.max(0, Math.min(1, round4((b.y() + 0.5) / sh)));
            write(x, y);
            remember(x, y);
        }

        @Override
        public void reset() {
            write(xValue.getDefault(), yValue.getDefault());
            remember(-1, -1);
        }

        private void remember(double x, double y) {
            (skills ? HudConfig.PMMO_SKILLS_X : HudConfig.PMMO_GAIN_X).set(x);
            (skills ? HudConfig.PMMO_SKILLS_Y : HudConfig.PMMO_GAIN_Y).set(y);
            HudConfig.SPEC.save();
        }
    }

    // ---------------------------------------------------------------- FTB Quests

    /**
     * FTB Quests' pinned quests: {@code config/ftbquests-client.snbt}, {@code pinned.pinned_quests_pos} (one of
     * eight screen edges/corners) and {@code pinned_quests_inset_x/y} (pixels from that edge). The box settles
     * on the nearest of those places when dropped, since that is all the mod can store.
     */
    static final class FtbPinned extends HudElement {
        private static final String[] NAMES = {"TOP_LEFT", "TOP", "TOP_RIGHT", "RIGHT", "BOTTOM_RIGHT", "BOTTOM", "BOTTOM_LEFT", "LEFT"};
        private static final int[][] CELLS = {{0, 0}, {1, 0}, {2, 0}, {2, 1}, {2, 2}, {1, 2}, {0, 2}, {0, 1}};
        private final Object pos, insetX, insetY, scale;
        private final Method get, set;
        private final Class<?> enumClass;
        private final Object configManager;
        private final Method save;
        private final Object tracker;
        private Method refresh;
        private Field renderData;

        FtbPinned() throws Exception {
            super("ftb_pinned", "Pinned quests");
            String c = "dev.ftb.mods.ftbquests.client.FTBQuestsClientConfig";
            pos = Reflect.staticField(c, "PINNED_QUESTS_POS");
            insetX = Reflect.staticField(c, "PINNED_QUESTS_INSET_X");
            insetY = Reflect.staticField(c, "PINNED_QUESTS_INSET_Y");
            scale = Reflect.staticField(c, "PINNED_QUESTS_SCALE");
            Class<?> base = Reflect.cls("dev.ftb.mods.ftblibrary.snbt.config.BaseValue");
            get = base.getMethod("get");
            set = base.getMethod("set", Object.class);
            enumClass = Reflect.cls("dev.ftb.mods.ftblibrary.util.PanelPositioning");
            Class<?> manager = Reflect.cls("dev.ftb.mods.ftblibrary.config.manager.ConfigManager");
            configManager = manager.getMethod("getInstance").invoke(null);
            save = manager.getMethod("save", String.class);
            tracker = Reflect.staticField("dev.ftb.mods.ftbquests.client.PinnedQuestsTracker", "INSTANCE");
            try {
                refresh = tracker.getClass().getMethod("refresh");
                renderData = tracker.getClass().getDeclaredField("renderData");
                renderData.setAccessible(true);
            } catch (Exception e) {
                renderData = null; // only used to size the box
            }
            cell(String.valueOf(get.invoke(pos)));
        }

        private static int cell(String name) {
            for (int i = 0; i < NAMES.length; i++) if (NAMES[i].equals(name)) return i;
            throw new IllegalArgumentException("unknown pinned_quests_pos " + name);
        }

        private int[] size() throws Exception {
            double s = ((Number) get.invoke(scale)).doubleValue();
            int w = 168, h = 46;
            if (renderData != null) {
                try {
                    Object data = renderData.get(tracker);
                    if (data != null) {
                        Method width = data.getClass().getDeclaredMethod("width");
                        Method height = data.getClass().getDeclaredMethod("height");
                        width.setAccessible(true);
                        height.setAccessible(true);
                        w = (int) width.invoke(data);
                        h = (int) height.invoke(data);
                    }
                } catch (Exception e) {
                    renderData = null; // keep the estimate
                }
            }
            return new int[] {(int) (w * s), (int) (h * s)};
        }

        /** FTB Library's PanelPositioning.getPanelPos. */
        private static Box place(int cell, int ix, int iy, int w, int h, int sw, int sh) {
            int col = CELLS[cell][0], row = CELLS[cell][1];
            int x = col == 0 ? ix : col == 1 ? (sw - w) / 2 : sw - w - ix;
            int y = row == 0 ? iy : row == 1 ? (sh - h) / 2 : sh - h - iy;
            return new Box(x, y, w, h);
        }

        @Override
        public Box box(int sw, int sh) {
            try {
                int[] s = size();
                return place(cell(String.valueOf(get.invoke(pos))), (Integer) get.invoke(insetX), (Integer) get.invoke(insetY), s[0], s[1], sw, sh);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public Box defaultBox(int sw, int sh) {
            Box b = box(sw, sh);
            return place(3, 2, 2, b.w(), b.h(), sw, sh); // RIGHT, 2, 2: FTBQuestsClientConfig's defaults
        }

        /** Which of the eight places a dropped box means, and its insets. */
        private int[] choose(Box b, int sw, int sh) {
            int cx = b.centerX(), cy = b.centerY();
            int col = cx < sw / 3 ? 0 : cx > sw * 2 / 3 ? 2 : 1;
            int row = cy < sh / 3 ? 0 : cy > sh * 2 / 3 ? 2 : 1;
            if (col == 1 && row == 1) {
                if (Math.abs(cx - sw / 2.0) / sw > Math.abs(cy - sh / 2.0) / sh) col = cx < sw / 2 ? 0 : 2;
                else row = cy < sh / 2 ? 0 : 2;
            }
            int cell = 0;
            for (int i = 0; i < CELLS.length; i++) if (CELLS[i][0] == col && CELLS[i][1] == row) cell = i;
            int ix = col == 0 ? b.x() : col == 2 ? sw - b.right() : 2;
            int iy = row == 0 ? b.y() : row == 2 ? sh - b.bottom() : 2;
            return new int[] {cell, Math.max(0, ix), Math.max(0, iy)};
        }

        @Override
        public Box settle(Box b, int sw, int sh) {
            int[] c = choose(b, sw, sh);
            return place(c[0], c[1], c[2], b.w(), b.h(), sw, sh);
        }

        @SuppressWarnings({"unchecked", "rawtypes"})
        private void write(String cell, int ix, int iy) throws Exception {
            set.invoke(pos, Enum.valueOf((Class<? extends Enum>) enumClass, cell));
            set.invoke(insetX, ix);
            set.invoke(insetY, iy);
            Reflect.call(configManager, save, "ftbquests-client");
            if (refresh != null) refresh.invoke(tracker);
        }

        @Override
        public void save(Box b, int sw, int sh) throws Exception {
            int[] c = choose(b, sw, sh);
            write(NAMES[c[0]], c[1], c[2]);
        }

        @Override
        public void reset() throws Exception {
            write("RIGHT", 2, 2);
        }

        @Override
        public String where() {
            return "config/ftbquests-client.snbt (pinned.pinned_quests_pos, pinned_quests_inset_x/y)";
        }
    }

    // ---------------------------------------------------------------- vanilla (moved by this mod)

    /** Status effect icons, moved with a translate around vanilla's layer ({@link HudLayoutClient}). */
    static final class VanillaEffects extends HudElement {
        VanillaEffects() {
            super("effects", "Status effects");
        }

        /** Icons per row: beneficial on top, the rest below (vanilla's layout). */
        static int columns() {
            Minecraft mc = Minecraft.getInstance();
            if (mc.player == null) return 0;
            int good = 0, bad = 0;
            for (MobEffectInstance e : mc.player.getActiveEffects()) {
                if (!e.showIcon()) continue;
                if (e.getEffect().value().isBeneficial()) good++;
                else bad++;
            }
            return Math.max(good, bad);
        }

        static Box boxFor(int x, int y, int cols, int sw) {
            int w = 25 * cols;
            int left = x >= 0 ? x : sw + x + 1 - w;
            return new Box(left, 1 + y, w, 50);
        }

        @Override
        public Box box(int sw, int sh) {
            return boxFor(HudConfig.EFFECTS_X.get(), HudConfig.EFFECTS_Y.get(), Math.max(3, columns()), sw);
        }

        @Override
        public Box defaultBox(int sw, int sh) {
            return boxFor(-1, 0, Math.max(3, columns()), sw);
        }

        @Override
        public void save(Box b, int sw, int sh) {
            HudConfig.EFFECTS_X.set(b.centerX() > sw / 2 ? Math.min(-1, b.right() - sw - 1) : Math.max(0, b.x()));
            HudConfig.EFFECTS_Y.set(b.y() - 1);
            HudConfig.SPEC.save();
        }

        @Override
        public void reset() {
            HudConfig.EFFECTS_X.set(-1);
            HudConfig.EFFECTS_Y.set(0);
            HudConfig.SPEC.save();
        }

        @Override
        public String where() {
            return "config/lsp_fixes-client.toml (hud.vanilla.effectsX, effectsY)";
        }
    }

    /** Boss bars, moved the same way. */
    static final class VanillaBossBar extends HudElement {
        VanillaBossBar() {
            super("boss_bar", "Boss bar");
        }

        static Box boxFor(int dx, int dy, int sw) {
            return new Box(sw / 2 - 91 + dx, 3 + dy, 182, 16);
        }

        @Override
        public Box box(int sw, int sh) {
            return boxFor(HudConfig.BOSS_BAR_X.get(), HudConfig.BOSS_BAR_Y.get(), sw);
        }

        @Override
        public Box defaultBox(int sw, int sh) {
            return boxFor(0, 0, sw);
        }

        @Override
        public void save(Box b, int sw, int sh) {
            HudConfig.BOSS_BAR_X.set(b.x() - (sw / 2 - 91));
            HudConfig.BOSS_BAR_Y.set(b.y() - 3);
            HudConfig.SPEC.save();
        }

        @Override
        public void reset() {
            HudConfig.BOSS_BAR_X.set(0);
            HudConfig.BOSS_BAR_Y.set(0);
            HudConfig.SPEC.save();
        }

        @Override
        public String where() {
            return "config/lsp_fixes-client.toml (hud.vanilla.bossBarX, bossBarY)";
        }
    }

    private HudElements() {
    }
}
