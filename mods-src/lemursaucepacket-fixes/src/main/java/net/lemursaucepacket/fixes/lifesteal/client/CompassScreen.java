package net.lemursaucepacket.fixes.lifesteal.client;

import net.lemursaucepacket.fixes.lifesteal.LifestealNet;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.CycleButton;
import net.minecraft.client.gui.components.ObjectSelectionList;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * The compass list: your own items, nearest first. Click one and the needle turns to it. The Seeker's
 * Compass has the switch between things on the ground and anything (containers and pockets too).
 */
public final class CompassScreen extends Screen {
    private final LifestealNet.CompassList data;
    private ItemList list;
    private boolean includeAll;

    CompassScreen(LifestealNet.CompassList data) {
        super(Component.literal(data.seeker() ? "Seeker's Compass" : "Lost Item Compass"));
        this.data = data;
        this.includeAll = data.includeAll();
    }

    @Override
    protected void init() {
        list = new ItemList();
        for (LifestealNet.CompassEntry entry : data.entries()) list.add(entry);
        addRenderableWidget(list);
        int y = height - 26;
        int x = width / 2;
        if (data.seeker()) {
            addRenderableWidget(CycleButton.onOffBuilder(includeAll)
                    .create(x - 154, y, 150, 20, Component.literal("Anything, not only the ground"), (b, value) -> {
                        includeAll = value;
                        PacketDistributor.sendToServer(new LifestealNet.CompassSelect(data.hand(), "?", includeAll));
                    }));
        }
        addRenderableWidget(Button.builder(Component.literal("Point at nothing"), b -> {
            PacketDistributor.sendToServer(new LifestealNet.CompassSelect(data.hand(), "", includeAll));
            onClose();
        }).bounds(data.seeker() ? x + 4 : x - 102, y, 100, 20).build());
        if (!data.seeker()) addRenderableWidget(Button.builder(Component.literal("Done"), b -> onClose()).bounds(x + 2, y, 100, 20).build());
        else addRenderableWidget(Button.builder(Component.literal("Done"), b -> onClose()).bounds(x + 108, y, 46, 20).build());
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.render(g, mouseX, mouseY, partialTick);
        g.drawCenteredString(font, title, width / 2, 8, 0xFFFFFF);
        if (data.entries().isEmpty()) {
            g.drawCenteredString(font, Component.literal(includeAll ? "Nothing of yours is known anywhere." : "Nothing of yours is lying on the ground.").withStyle(ChatFormatting.GRAY), width / 2, height / 2 - 4, 0xFFFFFF);
        }
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    private void choose(LifestealNet.CompassEntry entry) {
        PacketDistributor.sendToServer(new LifestealNet.CompassSelect(data.hand(), entry.key(), includeAll));
        onClose();
    }

    private final class ItemList extends ObjectSelectionList<Row> {
        ItemList() {
            super(Minecraft.getInstance(), CompassScreen.this.width, CompassScreen.this.height - 24 - 36, 24, 22);
        }

        void add(LifestealNet.CompassEntry entry) {
            Row row = new Row(entry);
            addEntry(row);
            if (!data.selectedKey().isEmpty() && entry.key().equals(data.selectedKey())) setSelected(row);
        }

        @Override
        public int getRowWidth() {
            return Math.min(320, width - 40);
        }
    }

    private final class Row extends ObjectSelectionList.Entry<Row> {
        private final LifestealNet.CompassEntry entry;

        Row(LifestealNet.CompassEntry entry) {
            this.entry = entry;
        }

        @Override
        public void render(GuiGraphics g, int index, int top, int left, int rowWidth, int rowHeight, int mouseX, int mouseY, boolean hovering, float partialTick) {
            g.renderItem(entry.icon(), left + 2, top + 2);
            String name = entry.icon().getHoverName().getString() + (entry.count() > 1 ? " ×" + entry.count() : "");
            g.drawString(font, name, left + 24, top + 6, 0xFFFFFF);
            String where = entry.distance() < 0 ? "in " + shortDimension(entry.dimension()) : entry.distance() + " blocks away";
            g.drawString(font, where, left + rowWidth - 4 - font.width(where), top + 6, 0xA0A0A0);
        }

        @Override
        public boolean mouseClicked(double mouseX, double mouseY, int button) {
            if (button == 0) {
                choose(entry);
                return true;
            }
            return false;
        }

        @Override
        public Component getNarration() {
            return Component.literal(entry.icon().getHoverName().getString());
        }
    }

    private static String shortDimension(String dimension) {
        return switch (dimension) {
            case "minecraft:overworld" -> "the Overworld";
            case "minecraft:the_nether" -> "the Nether";
            case "minecraft:the_end" -> "the End";
            default -> dimension;
        };
    }
}
