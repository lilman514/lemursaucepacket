package net.lemursaucepacket.instances.client;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import net.lemursaucepacket.instances.InstanceNet;
import net.minecraft.Util;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.FormattedCharSequence;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * An event's window, opened by speaking to its NPC: the event's description, then either the ways in (alone, open a
 * co-op fight, or join one someone else opened) or, once in a co-op fight, who's in it and Begin / Leave. If the keeper
 * holds things for you, a button takes them back.
 */
public final class EventScreen extends Screen {
    private static final int WIDTH = 270, BUTTON = 20, GAP = 4;
    private static final int PANEL = 0xE8141820, EDGE = 0xFF6B5A3C, GOLD = 0xFFF8D982, TEXT = 0xFFE5E2D9, MUTED = 0xFFA8A499;
    private static final UUID NOBODY = Util.NIL_UUID;
    private InstanceNet.Window data;
    private List<FormattedCharSequence> lines = List.of();
    private List<FormattedCharSequence> party = List.of();
    private int top, height0;

    EventScreen(InstanceNet.Window data) {
        super(Component.literal(data.title()));
        this.data = data;
    }

    ResourceLocation event() {
        return data.event();
    }

    void update(InstanceNet.Window w) {
        data = w;
        rebuildWidgets();
    }

    @Override
    protected void init() {
        int textWidth = WIDTH - 24;
        List<FormattedCharSequence> text = new ArrayList<>();
        for (String line : data.lines()) text.addAll(font.split(Component.literal(line), textWidth));
        lines = text;
        party = data.mine().map(m -> font.split(Component.literal((data.hosting() ? "Your co-op fight: " : m.hostName() + "'s co-op fight: ")
                + String.join(", ", m.members()) + " (" + m.members().size() + "/" + m.max() + ")"
                + (data.hosting() ? "" : ". Waiting for " + m.hostName() + " to begin.")), textWidth)).orElse(List.of());

        List<Button> buttons = new ArrayList<>();
        int full = WIDTH - 24, half = (full - GAP) / 2;
        if (data.mine().isEmpty()) {
            Button solo = Button.builder(Component.literal("Fight alone"), b -> send(InstanceNet.SOLO, NOBODY)).size(half, BUTTON).build();
            Button host = Button.builder(Component.literal("Open a co-op fight"), b -> send(InstanceNet.HOST, NOBODY)).size(half, BUTTON).build();
            if (!data.canStart()) {
                for (Button b : List.of(solo, host)) {
                    b.active = false;
                    if (!data.startNote().isEmpty()) b.setTooltip(Tooltip.create(Component.literal(data.startNote())));
                }
            }
            buttons.add(solo);
            buttons.add(host);
            for (InstanceNet.LobbyView lobby : data.lobbies()) {
                buttons.add(Button.builder(Component.literal("Join " + lobby.hostName() + "'s fight (" + lobby.members().size() + "/" + lobby.max() + ")"),
                        b -> send(InstanceNet.JOIN, lobby.host())).size(full, BUTTON).build());
            }
        } else if (data.hosting()) {
            buttons.add(Button.builder(Component.literal("Begin"), b -> send(InstanceNet.BEGIN, NOBODY)).size(half, BUTTON).build());
            buttons.add(Button.builder(Component.literal("Call it off"), b -> send(InstanceNet.LEAVE, NOBODY)).size(half, BUTTON).build());
        } else {
            buttons.add(Button.builder(Component.literal("Leave this fight"), b -> send(InstanceNet.LEAVE, NOBODY)).size(full, BUTTON).build());
        }
        if (data.kept() > 0) {
            buttons.add(Button.builder(Component.literal("Take back your things (" + data.kept() + (data.kept() == 1 ? " stack)" : " stacks)")),
                    b -> send(InstanceNet.RECLAIM, NOBODY)).size(full, BUTTON).build());
        }
        buttons.add(Button.builder(Component.literal("Close"), b -> onClose()).size(full, BUTTON).build());

        // Height: title, text, the party line, buttons (two halves share a row).
        int rows = 0;
        for (int i = 0; i < buttons.size(); i++) {
            if (buttons.get(i).getWidth() == half && i + 1 < buttons.size() && buttons.get(i + 1).getWidth() == half) i++;
            rows++;
        }
        height0 = 12 + 12 + lines.size() * 10 + 8 + (party.isEmpty() ? 0 : party.size() * 10 + 6) + rows * (BUTTON + GAP) + 8;
        top = Math.max(4, (height - height0) / 2);
        int left = (width - WIDTH) / 2 + 12;
        int y = top + 12 + 12 + lines.size() * 10 + 8 + (party.isEmpty() ? 0 : party.size() * 10 + 6);
        for (int i = 0; i < buttons.size(); i++) {
            Button b = buttons.get(i);
            if (b.getWidth() == half && i + 1 < buttons.size() && buttons.get(i + 1).getWidth() == half) {
                b.setPosition(left, y);
                buttons.get(i + 1).setPosition(left + half + GAP, y);
                addRenderableWidget(b);
                addRenderableWidget(buttons.get(++i));
            } else {
                b.setPosition(left, y);
                addRenderableWidget(b);
            }
            y += BUTTON + GAP;
        }
    }

    private void send(int action, UUID target) {
        PacketDistributor.sendToServer(new InstanceNet.Action(data.event(), data.npc(), action, target));
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.render(g, mouseX, mouseY, partialTick);
    }

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.renderBackground(g, mouseX, mouseY, partialTick);
        int left = (width - WIDTH) / 2;
        g.fill(left, top, left + WIDTH, top + height0, PANEL);
        g.renderOutline(left, top, WIDTH, height0, EDGE);
        g.fill(left + 1, top + 1, left + WIDTH - 1, top + 2, 0xFFE0AC46);
        g.drawCenteredString(font, title, width / 2, top + 10, GOLD);
        int y = top + 12 + 12;
        for (FormattedCharSequence line : lines) {
            g.drawString(font, line, left + 12, y, TEXT, false);
            y += 10;
        }
        y += 8;
        if (!party.isEmpty()) {
            for (FormattedCharSequence line : party) {
                g.drawString(font, line, left + 12, y, MUTED, false);
                y += 10;
            }
        }
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
