package net.lemursaucepacket.fixes.economy.client;

import java.util.Locale;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.economy.Coins;
import net.lemursaucepacket.fixes.economy.EconomyNet;
import net.minecraft.ChatFormatting;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.neoforged.neoforge.network.PacketDistributor;
import org.lwjgl.glfw.GLFW;

/**
 * "How many coins?": a box that takes 1500, 1,500, 1.5k or 2m, for a trade offer or an exact split. Done or Enter sends
 * it; Escape goes back to the window it came from.
 */
public class CoinAmountScreen extends Screen {
    @Nullable
    private final Screen parent;
    private final int purpose;
    private final long max;
    private final long initial;
    private final int containerId;
    private final int slot;
    private EditBox box;
    private Button done;

    CoinAmountScreen(@Nullable Screen parent, int purpose, long max, long initial, int containerId, int slot) {
        super(Component.literal(purpose == EconomyNet.PURPOSE_TRADE ? "Coins to offer" : "Coins to take"));
        this.parent = parent;
        this.purpose = purpose;
        this.max = max;
        this.initial = initial;
        this.containerId = containerId;
        this.slot = slot;
    }

    @Override
    protected void init() {
        int cx = width / 2;
        int cy = height / 2;
        box = new EditBox(font, cx - 70, cy - 10, 140, 20, Component.literal("Amount"));
        box.setMaxLength(24);
        box.setFilter(s -> s.matches("[0-9.,]*[kKmMbB]?"));
        box.setValue(initial > 0 ? Long.toString(initial) : "");
        box.setResponder(s -> done.active = parse(s) >= (purpose == EconomyNet.PURPOSE_TRADE ? 0 : 1));
        addRenderableWidget(box);
        setInitialFocus(box);
        addRenderableWidget(Button.builder(Component.literal("All"), b -> box.setValue(Long.toString(max))).bounds(cx - 70, cy + 16, 44, 20).build());
        done = addRenderableWidget(Button.builder(Component.literal("Done"), b -> submit()).bounds(cx - 22, cy + 16, 44, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Cancel"), b -> onClose()).bounds(cx + 26, cy + 16, 44, 20).build());
        done.active = parse(box.getValue()) >= (purpose == EconomyNet.PURPOSE_TRADE ? 0 : 1);
    }

    /** The amount typed (clamped to what's there), or -1 if it isn't a number. */
    long parse(String text) {
        String s = text.trim().replace(",", "").toLowerCase(Locale.ROOT);
        if (s.isEmpty()) return -1;
        double mult = 1;
        char last = s.charAt(s.length() - 1);
        if (last == 'k' || last == 'm' || last == 'b') {
            mult = last == 'k' ? 1e3 : last == 'm' ? 1e6 : 1e9;
            s = s.substring(0, s.length() - 1);
        }
        try {
            double v = Double.parseDouble(s) * mult;
            if (Double.isNaN(v) || v < 0) return -1;
            return Math.min(max, (long) Math.floor(v + 1e-9));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private void submit() {
        long amount = parse(box.getValue());
        if (amount < 0) return;
        PacketDistributor.sendToServer(new EconomyNet.CoinInput(purpose, amount, containerId, slot));
        onClose();
    }

    @Override
    public boolean keyPressed(int key, int scan, int mods) {
        if ((key == GLFW.GLFW_KEY_ENTER || key == GLFW.GLFW_KEY_KP_ENTER) && done.active) {
            submit();
            return true;
        }
        return super.keyPressed(key, scan, mods);
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        super.render(graphics, mouseX, mouseY, partialTick);
        int cx = width / 2;
        int cy = height / 2;
        graphics.drawCenteredString(font, title, cx, cy - 40, 0xFFD700);
        graphics.drawCenteredString(font, Component.literal("You have ").withStyle(ChatFormatting.GRAY).append(Coins.text(max)), cx, cy - 26, 0xFFFFFF);
        long amount = parse(box.getValue());
        if (amount >= 0) graphics.drawCenteredString(font, Component.literal("= ").withStyle(ChatFormatting.DARK_GRAY).append(Coins.text(amount)), cx, cy + 42, 0xFFFFFF);
    }

    @Override
    public void onClose() {
        minecraft.setScreen(parent);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
