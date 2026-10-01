package net.lemursaucepacket.fixes.hud;

import java.util.ArrayList;
import java.util.List;

import net.lemursaucepacket.fixes.hud.HudElement.Box;
import net.minecraft.ChatFormatting;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import org.lwjgl.glfw.GLFW;

/**
 * The HUD layout editor: the game view behind a light shade, with representative sample content in each
 * movable HUD part. The live HUD is suppressed while this screen is open.
 * Drag to move (edges and centre lines snap; Shift places freely), right-click or Reset for the mod's default,
 * arrow keys nudge the selected box. Save writes every changed part into its own mod's settings.
 *
 * <p>Public with a no-argument constructor so FancyMenu's {@code opengui} action can open it from the ESC menu.
 */
public final class HudLayoutScreen extends Screen {
    // The pack's UI kit (art/pixel-kit.mjs).
    private static final int SHADE = 0x60000000;
    private static final int IRON = 0xC02F2B28;
    private static final int IRON_OFF = 0x90191715;
    private static final int BRASS_DARK = 0xFF87591A;
    private static final int BRASS = 0xFFE0AC46;
    private static final int BRASS_HI = 0xFFF8D982;
    private static final int GUIDE = 0x90E0AC46;
    private static final int PARCHMENT = 0xFFF1E4C2;
    private static final int GREY = 0xFF7D7367;
    private static final int SNAP = 4;

    private static final class Entry {
        final HudElement element;
        Box box;
        boolean moved;
        boolean reset;
        final boolean initiallyShown;
        boolean shown;

        Entry(HudElement element, Box box) {
            this.element = element;
            this.box = box;
            this.initiallyShown = this.shown = element.shown();
        }
    }

    private final List<Entry> entries = new ArrayList<>();
    private int builtW = -1;
    private int builtH = -1;
    private Entry dragging;
    private Entry selected;
    private double grabX;
    private double grabY;
    private boolean guideX;
    private boolean guideY;
    private Button resetButton;
    private Button visibilityButton;

    public HudLayoutScreen() {
        super(Component.literal("HUD Layout"));
    }

    @Override
    protected void init() {
        if (width != builtW || height != builtH) build();
        int y = height - 22;
        int x = width / 2;
        addRenderableWidget(Button.builder(Component.literal("Save"), b -> save()).bounds(x - 142, y, 68, 20)
                .tooltip(Tooltip.create(Component.literal("Save positions and visibility"))).build());
        resetButton = addRenderableWidget(Button.builder(Component.literal("Reset all"), b -> resetPressed()).bounds(x - 70, y, 68, 20).build());
        visibilityButton = addRenderableWidget(Button.builder(Component.literal("Hide"), b -> toggleSelected()).bounds(x + 2, y, 68, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Cancel"), b -> onClose()).bounds(x + 74, y, 68, 20)
                .tooltip(Tooltip.create(Component.literal("Discard positions and visibility changes"))).build());
        updateResetButton();
    }

    /** One box per part, where its mod draws it now. A resize starts over (positions are in GUI pixels). */
    private void build() {
        entries.clear();
        dragging = null;
        selected = null;
        for (HudElement element : HudElements.available()) {
            try {
                entries.add(new Entry(element, keepOnScreen(element.box(width, height))));
            } catch (Throwable t) {
                HudElements.warnOnce(element.name(), t);
            }
        }
        builtW = width;
        builtH = height;
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    @Override
    public void onClose() {
        if (minecraft != null) minecraft.setScreen(null);
    }

    // ---------------------------------------------------------------- drawing

    /** No blur and only a light shade, so the real HUD stays visible behind the boxes. */
    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        g.fill(0, 0, width, height, SHADE);
        if (dragging != null) {
            if (guideX) g.fill(width / 2, 0, width / 2 + 1, height, GUIDE);
            if (guideY) g.fill(0, height / 2, width, height / 2 + 1, GUIDE);
        }
        Entry hovered = dragging == null ? entryAt(mouseX, mouseY) : null;
        for (Entry e : entries) drawBox(g, e, e == hovered);
        if (entries.isEmpty()) {
            g.drawCenteredString(font, Component.literal("No movable HUD parts found (see the log)."), width / 2, height / 2 - 4, PARCHMENT);
        }
        Component hint = Component.literal("Drag: move  |  H: show/hide  |  Right-click: reset");
        int hintW = font.width(hint);
        g.fill(width / 2 - hintW / 2 - 3, height - 36, width / 2 + hintW / 2 + 3, height - 25, IRON);
        g.drawCenteredString(font, hint, width / 2, height - 34, PARCHMENT);
    }

    private void drawBox(GuiGraphics g, Entry e, boolean hovered) {
        Box b = e.box;
        boolean shown = e.shown;
        g.fill(b.x(), b.y(), b.right(), b.bottom(), shown ? IRON : IRON_OFF);
        int edge = e == selected || e == dragging ? BRASS_HI : hovered ? BRASS : shown ? BRASS_DARK : GREY;
        g.renderOutline(b.x(), b.y(), b.w(), b.h(), edge);
        if (e == selected) g.renderOutline(b.x() - 1, b.y() - 1, b.w() + 2, b.h() + 2, BRASS_DARK);
        String label = e.element.name() + (shown ? "" : " (hidden)") + (e.moved || e.reset || e.shown != e.initiallyShown ? " *" : "");
        if (shown) {
            HudPreview.render(g, e.element.id(), b);
            g.renderOutline(b.x(), b.y(), b.w(), b.h(), edge);
            if (e != selected && !hovered) return;
        }
        int textW = font.width(label);
        int color = shown ? PARCHMENT : GREY;
        if (!shown && textW + 4 <= b.w() && b.h() >= 11) {
            g.drawString(font, label, b.centerX() - textW / 2, b.centerY() - 4, color, true);
            return;
        }
        // Too small for its name (the voice icon): a tag beside it, inside the screen.
        int tx = clamp(b.centerX() - textW / 2, 1, width - textW - 1);
        int ty = b.bottom() + 12 <= height - 36 ? b.bottom() + 2 : b.y() - 11;
        g.fill(tx - 2, ty - 1, tx + textW + 2, ty + 9, IRON);
        g.drawString(font, label, tx, ty, color, true);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        updateResetButton();
        super.render(g, mouseX, mouseY, partialTick);
        if (dragging != null) return;
        Entry hovered = entryAt(mouseX, mouseY);
        if (hovered != null && !overWidget(mouseX, mouseY)) {
            List<Component> lines = new ArrayList<>();
            lines.add(Component.literal(hovered.element.name()).withStyle(ChatFormatting.GOLD));
            lines.add(Component.literal("Select, then " + (hovered.shown ? "Hide" : "Show") + " or press H.").withStyle(ChatFormatting.GRAY));
            lines.add(Component.literal("Shift: move freely. Arrows: nudge.").withStyle(ChatFormatting.GRAY));
            if (!hovered.shown) lines.add(Component.literal("Hidden after saving. You can still move and select it here.").withStyle(ChatFormatting.GRAY));
            g.renderComponentTooltip(font, lines, mouseX, mouseY);
        }
    }

    private void updateResetButton() {
        if (resetButton == null) return;
        if (visibilityButton != null) {
            visibilityButton.active = selected != null;
            visibilityButton.setMessage(Component.literal(selected != null && !selected.shown ? "Show" : "Hide"));
            visibilityButton.setTooltip(Tooltip.create(Component.literal(selected == null ? "Select a HUD element first" : "Show or hide " + selected.element.name() + " after saving (H)")));
        }
        resetButton.setMessage(Component.literal(selected == null ? "Reset all" : "Reset"));
        resetButton.setTooltip(Tooltip.create(Component.literal(selected == null
                ? "Put every part back where its mod puts it by default"
                : "Put " + selected.element.name() + " back where its mod puts it by default")));
    }

    // ---------------------------------------------------------------- input

    private boolean overWidget(double x, double y) {
        return children().stream().anyMatch(c -> c.isMouseOver(x, y));
    }

    /** The smallest box under the mouse, so a small part inside a big one can still be picked. */
    private Entry entryAt(double x, double y) {
        Entry best = null;
        for (Entry e : entries) {
            if (!e.box.contains(x, y)) continue;
            if (best == null || e == selected || (best != selected && e.box.w() * e.box.h() <= best.box.w() * best.box.h())) best = e;
        }
        return best;
    }

    @Override
    public boolean mouseClicked(double x, double y, int button) {
        if (super.mouseClicked(x, y, button)) return true;
        Entry e = entryAt(x, y);
        if (e == null) {
            selected = null;
            return false;
        }
        selected = e;
        if (button == GLFW.GLFW_MOUSE_BUTTON_LEFT) {
            dragging = e;
            grabX = x - e.box.x();
            grabY = y - e.box.y();
            guideX = guideY = false;
        } else if (button == GLFW.GLFW_MOUSE_BUTTON_RIGHT) {
            toDefault(e);
        }
        return true;
    }

    @Override
    public boolean mouseDragged(double x, double y, int button, double dx, double dy) {
        if (dragging != null && button == GLFW.GLFW_MOUSE_BUTTON_LEFT) {
            moveTo(dragging, x - grabX, y - grabY, !hasShiftDown());
            return true;
        }
        return super.mouseDragged(x, y, button, dx, dy);
    }

    @Override
    public boolean mouseReleased(double x, double y, int button) {
        if (dragging != null && button == GLFW.GLFW_MOUSE_BUTTON_LEFT) {
            settle(dragging);
            dragging = null;
            return true;
        }
        return super.mouseReleased(x, y, button);
    }

    @Override
    public boolean keyPressed(int key, int scanCode, int modifiers) {
        if (selected != null && dragging == null) {
            if (key == GLFW.GLFW_KEY_H) {
                toggleSelected();
                return true;
            }
            int step = hasShiftDown() ? 10 : 1;
            int dx = key == GLFW.GLFW_KEY_LEFT ? -step : key == GLFW.GLFW_KEY_RIGHT ? step : 0;
            int dy = key == GLFW.GLFW_KEY_UP ? -step : key == GLFW.GLFW_KEY_DOWN ? step : 0;
            if (dx != 0 || dy != 0) {
                moveTo(selected, selected.box.x() + dx, selected.box.y() + dy, false);
                settle(selected);
                return true;
            }
        }
        return super.keyPressed(key, scanCode, modifiers);
    }

    // ---------------------------------------------------------------- moving

    private void moveTo(Entry e, double fx, double fy, boolean snap) {
        int w = e.box.w(), h = e.box.h();
        int x = (int) Math.round(fx), y = (int) Math.round(fy);
        guideX = guideY = false;
        if (snap) {
            if (Math.abs(x) <= SNAP) x = 0;
            else if (Math.abs(x + w - width) <= SNAP) x = width - w;
            else if (Math.abs(x + w / 2 - width / 2) <= SNAP) {
                x = width / 2 - w / 2;
                guideX = true;
            }
            if (Math.abs(y) <= SNAP) y = 0;
            else if (Math.abs(y + h - height) <= SNAP) y = height - h;
            else if (Math.abs(y + h / 2 - height / 2) <= SNAP) {
                y = height / 2 - h / 2;
                guideY = true;
            }
        }
        e.box = keepOnScreen(e.box.at(x, y));
        e.moved = true;
        e.reset = false;
    }

    /** Some mods can only store certain places (FTB Quests: eight edges); show where it will really go. */
    private void settle(Entry e) {
        try {
            e.box = keepOnScreen(e.element.settle(e.box, width, height));
        } catch (Throwable t) {
            HudElements.warnOnce(e.element.name(), t);
        }
    }

    private void toDefault(Entry e) {
        try {
            e.box = keepOnScreen(e.element.defaultBox(width, height));
            e.reset = true;
            e.moved = false;
        } catch (Throwable t) {
            HudElements.warnOnce(e.element.name(), t);
        }
    }

    private void resetPressed() {
        if (selected != null) toDefault(selected);
        else entries.forEach(this::toDefault);
    }

    private void toggleSelected() {
        if (selected == null) return;
        selected.shown = !selected.shown;
        updateResetButton();
    }

    private Box keepOnScreen(Box b) {
        return b.at(clamp(b.x(), 0, width - b.w()), clamp(b.y(), 0, height - b.h()));
    }

    private static int clamp(int v, int min, int max) {
        return max < min ? min : Math.max(min, Math.min(max, v));
    }

    // ---------------------------------------------------------------- saving

    private void save() {
        List<String> failed = new ArrayList<>();
        int saved = 0;
        for (Entry e : entries) {
            if (!e.moved && !e.reset && e.shown == e.initiallyShown) continue;
            try {
                if (e.reset) e.element.reset();
                else if (e.moved) e.element.save(e.box, width, height);
                if (e.shown != e.initiallyShown) e.element.setShown(e.shown);
                saved++;
                HudElements.LOGGER.info("HUD layout: {} {} in {}", e.element.name(), e.reset ? "reset" : "moved to " + e.box.x() + "," + e.box.y(), e.element.where());
            } catch (Throwable t) {
                failed.add(e.element.name());
                HudElements.LOGGER.warn("HUD layout: could not save {} ({})", e.element.name(), e.element.where(), t);
            }
        }
        if (minecraft != null && minecraft.player != null) {
            Component message = failed.isEmpty()
                    ? Component.literal(saved == 0 ? "HUD layout: nothing changed." : "HUD layout saved.").withStyle(ChatFormatting.GOLD)
                    : Component.literal("HUD layout saved, except " + String.join(", ", failed) + " (see the log).").withStyle(ChatFormatting.RED);
            minecraft.player.displayClientMessage(message, false);
        }
        onClose();
    }
}
