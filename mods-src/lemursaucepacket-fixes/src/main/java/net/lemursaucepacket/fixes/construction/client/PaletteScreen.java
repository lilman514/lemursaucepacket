package net.lemursaucepacket.fixes.construction.client;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import net.lemursaucepacket.fixes.construction.PaletteNet;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Block;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * The Mason's Palette's picker: its categories down the left, their blocks on the right (or every block matching the
 * search), the chosen one outlined. Click a block to have the palette place it.
 */
final class PaletteScreen extends Screen {
    private static final int W = 360, MAX_H = 258, CELL = 20, GRID_X = 150, GRID_Y = 44, LIST_ROW = 10;
    private static final int PANEL = 0xE8141820, EDGE = 0xFF6B5A3C, LINE = 0xFFE0AC46, GOLD = 0xFFF8D982, TEXT = 0xFFE5E2D9, MUTED = 0xFFA8A499;
    private static final int GOOD = 0xFF8FD18B, WARN = 0xFFE8B45C;

    private record Entry(String id, ItemStack stack, String name) {
    }

    private record Group(String name, ItemStack icon, List<Entry> entries) {
    }

    private final PaletteNet.Open data;
    private final List<Group> groups = new ArrayList<>();
    private List<Entry> shown = List.of();
    private int category, scroll, listScroll, left, top, H = MAX_H;
    private EditBox search;

    PaletteScreen(PaletteNet.Open data) {
        super(Component.literal("Mason's Palette"));
        this.data = data;
        for (PaletteNet.Category c : data.categories()) {
            List<Entry> entries = new ArrayList<>();
            for (String id : c.blocks()) {
                ResourceLocation key = ResourceLocation.tryParse(id);
                Block block = key == null ? null : BuiltInRegistries.BLOCK.getOptional(key).orElse(null);
                if (block == null || block.asItem() == Items.AIR) continue;
                entries.add(new Entry(id, new ItemStack(block.asItem()), block.getName().getString()));
            }
            ResourceLocation icon = ResourceLocation.tryParse(c.icon());
            ItemStack iconStack = icon == null ? ItemStack.EMPTY : new ItemStack(BuiltInRegistries.ITEM.get(icon));
            if (!entries.isEmpty()) groups.add(new Group(c.name(), iconStack, entries));
        }
        // Open on the chosen block's category.
        for (int i = 0; i < groups.size(); i++) {
            for (Entry e : groups.get(i).entries()) if (e.id().equals(data.selected())) category = i;
        }
    }

    private int columns() {
        return (W - GRID_X - 10) / CELL;
    }

    private int visibleRows() {
        return Math.max(1, (H - GRID_Y - 26) / CELL);
    }

    /** How many categories fit down the left (the rest scroll). */
    private int visibleCategories() {
        int fit = Math.max(1, (H - GRID_Y - 8) / LIST_ROW);
        return groups.size() > fit ? fit - 1 : fit;
    }

    @Override
    protected void init() {
        // The whole panel on screen, however small the window: shorter, with fewer rows, if need be.
        H = Math.max(140, Math.min(MAX_H, height - 4));
        left = (width - W) / 2;
        top = Math.max(2, (height - H) / 2);
        String text = search == null ? "" : search.getValue();
        search = addRenderableWidget(new EditBox(font, left + 10, top + 24, GRID_X - 24, 14, Component.literal("Search")));
        search.setHint(Component.literal("Search blocks").withColor(MUTED));
        search.setValue(text);
        search.setResponder(s -> refresh());
        refresh();
    }

    private void refresh() {
        String q = search == null ? "" : search.getValue().trim().toLowerCase(Locale.ROOT);
        if (q.isEmpty()) {
            shown = groups.isEmpty() ? List.of() : groups.get(Math.min(category, groups.size() - 1)).entries();
        } else {
            List<Entry> out = new ArrayList<>();
            for (Group g : groups) for (Entry e : g.entries()) if (e.name().toLowerCase(Locale.ROOT).contains(q) || e.id().contains(q)) out.add(e);
            shown = out;
        }
        int maxScroll = Math.max(0, (shown.size() + columns() - 1) / columns() - visibleRows());
        scroll = Math.min(scroll, maxScroll);
    }

    // ---------------------------------------------------------------- drawing

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.renderBackground(g, mouseX, mouseY, partialTick);
        g.fill(left, top, left + W, top + H, PANEL);
        g.renderOutline(left, top, W, H, EDGE);
        g.fill(left + 1, top + 1, left + W - 1, top + 2, LINE);
        g.fill(left + GRID_X - 8, top + 24, left + GRID_X - 7, top + H - 8, 0x60FFFFFF);
        g.drawString(font, "Mason's Palette", left + 10, top + 9, GOLD, false);
        String level = data.usable() ? "Construction " + data.need() : "Needs Construction " + data.need() + " (you have " + data.have() + ")";
        g.drawString(font, level, left + W - 10 - font.width(level), top + 9, data.usable() ? GOOD : WARN, false);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.render(g, mouseX, mouseY, partialTick);
        boolean searching = !search.getValue().isBlank();
        // Categories.
        String clipped = null;
        for (int i = listScroll; i < groups.size() && i < listScroll + visibleCategories(); i++) {
            int y = top + GRID_Y + (i - listScroll) * LIST_ROW;
            boolean on = !searching && i == category;
            boolean over = mouseX >= left + 8 && mouseX < left + GRID_X - 10 && mouseY >= y - 1 && mouseY < y + LIST_ROW - 1;
            if (on) g.fill(left + 8, y - 1, left + GRID_X - 10, y + LIST_ROW - 1, 0x40E0AC46);
            else if (over) g.fill(left + 8, y - 1, left + GRID_X - 10, y + LIST_ROW - 1, 0x20FFFFFF);
            String name = groups.get(i).name();
            String shown = name;
            if (font.width(name) > GRID_X - 22) {
                shown = font.plainSubstrByWidth(name, GRID_X - 22 - font.width("…")) + "…";
                if (over) clipped = name;
            }
            g.drawString(font, shown, left + 11, y + 1, on ? GOLD : TEXT, false);
        }
        if (groups.size() > visibleCategories()) {
            String more = listScroll + visibleCategories() < groups.size() ? "▼" : "▲";
            g.drawString(font, more, left + GRID_X - 18, top + GRID_Y + visibleCategories() * LIST_ROW + 1, MUTED, false);
        }
        // Blocks.
        int cols = columns(), rows = visibleRows();
        String header = searching ? shown.size() + " found" : groups.isEmpty() ? "" : groups.get(category).name() + "  " + shown.size();
        g.drawString(font, header, left + GRID_X, top + 28, MUTED, false);
        Entry hovered = null;
        for (int i = scroll * cols; i < shown.size() && i < (scroll + rows) * cols; i++) {
            int r = i / cols - scroll, c = i % cols;
            int x = left + GRID_X + c * CELL, y = top + GRID_Y + r * CELL;
            Entry e = shown.get(i);
            boolean chosen = e.id().equals(data.selected());
            g.fill(x, y, x + 18, y + 18, chosen ? 0x50E0AC46 : 0x30FFFFFF);
            g.renderItem(e.stack(), x + 1, y + 1);
            if (chosen) {
                g.pose().pushPose();
                g.pose().translate(0, 0, 300);
                g.renderOutline(x - 1, y - 1, 20, 20, LINE);
                g.pose().popPose();
            }
            if (mouseX >= x && mouseX < x + 18 && mouseY >= y && mouseY < y + 18) hovered = e;
        }
        int totalRows = (shown.size() + cols - 1) / cols;
        if (totalRows > rows) {
            int trackX = left + W - 7, trackTop = top + GRID_Y, trackH = rows * CELL - 2;
            g.fill(trackX, trackTop, trackX + 2, trackTop + trackH, 0x30FFFFFF);
            int knob = Math.max(10, trackH * rows / totalRows);
            int knobY = trackTop + (trackH - knob) * scroll / Math.max(1, totalRows - rows);
            g.fill(trackX, knobY, trackX + 2, knobY + knob, LINE);
        }
        String foot = data.selected().isEmpty() ? "Pick a block for the palette to place." : "Places: " + nameOf(data.selected());
        if (clipped != null && hovered == null) g.renderTooltip(font, Component.literal(clipped), mouseX, mouseY);
        g.drawString(font, font.plainSubstrByWidth(foot, W - GRID_X - 10), left + GRID_X, top + H - 18, data.selected().isEmpty() ? MUTED : TEXT, false);
        if (hovered != null) {
            g.renderTooltip(font, List.of(Component.literal(hovered.name()).withColor(GOLD), Component.literal(hovered.id()).withColor(MUTED),
                    Component.literal(data.usable() ? "Click to choose it" : "Click to choose it (for Construction " + data.need() + ")").withColor(TEXT)), java.util.Optional.empty(), mouseX, mouseY);
        }
    }

    private String nameOf(String id) {
        for (Group g : groups) for (Entry e : g.entries()) if (e.id().equals(id)) return e.name();
        return id;
    }

    // ---------------------------------------------------------------- input

    @Override
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        for (int i = listScroll; i < groups.size() && i < listScroll + visibleCategories(); i++) {
            int y = top + GRID_Y + (i - listScroll) * LIST_ROW;
            if (mouseX >= left + 8 && mouseX < left + GRID_X - 10 && mouseY >= y - 1 && mouseY < y + LIST_ROW - 1) {
                category = i;
                scroll = 0;
                search.setValue("");
                refresh();
                return true;
            }
        }
        int cols = columns(), rows = visibleRows();
        for (int i = scroll * cols; i < shown.size() && i < (scroll + rows) * cols; i++) {
            int r = i / cols - scroll, c = i % cols;
            int x = left + GRID_X + c * CELL, y = top + GRID_Y + r * CELL;
            if (mouseX >= x && mouseX < x + 18 && mouseY >= y && mouseY < y + 18) {
                PacketDistributor.sendToServer(new PaletteNet.Select(shown.get(i).id()));
                onClose();
                return true;
            }
        }
        return super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double scrollX, double scrollY) {
        if (mouseX < left + GRID_X - 8) {
            listScroll = Math.max(0, Math.min(groups.size() - visibleCategories(), listScroll - (int) Math.signum(scrollY)));
            return true;
        }
        int cols = columns();
        int maxScroll = Math.max(0, (shown.size() + cols - 1) / cols - visibleRows());
        scroll = Math.max(0, Math.min(maxScroll, scroll - (int) Math.signum(scrollY)));
        return true;
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
