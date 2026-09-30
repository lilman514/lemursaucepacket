package net.lemursaucepacket.fixes.lifesteal.client;

import java.util.ArrayList;
import java.util.List;

import net.lemursaucepacket.fixes.lifesteal.LifestealNet;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.components.events.GuiEventListener;
import net.minecraft.client.gui.screens.DeathScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.contents.TranslatableContents;
import net.neoforged.neoforge.client.event.ScreenEvent;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * The death screen of an eliminated player: "Respawn" becomes "Accept elimination…", which walks through
 * three warnings (what will be erased; type ERASE; hold a button for five seconds) before the confirmation
 * goes to the server. The other button just leaves the server to wait for a revive.
 */
public final class EliminationScreens {
    private static final Component ACCEPT = Component.literal("Accept elimination…");
    private static final Component WAIT = Component.literal("Leave and wait for a revive");

    static boolean isPatched(DeathScreen screen) {
        for (GuiEventListener child : screen.children()) {
            if (child instanceof Button button && button.getMessage().equals(ACCEPT)) return true;
        }
        return false;
    }

    static void onScreenInit(ScreenEvent.Init.Post event) {
        if (!(event.getScreen() instanceof DeathScreen screen) || !LifestealClient.limbo.eliminated()) return;
        Button respawn = null;
        for (GuiEventListener child : new ArrayList<>(event.getListenersList())) {
            if (!(child instanceof Button button)) continue;
            String key = button.getMessage().getContents() instanceof TranslatableContents t ? t.getKey() : "";
            if (key.equals("deathScreen.respawn") || key.equals("deathScreen.spectate")) respawn = button;
            else if (key.equals("deathScreen.titleScreen")) button.setMessage(WAIT);
        }
        if (respawn == null) return;
        event.removeListener(respawn);
        Button accept = Button.builder(ACCEPT, b -> Minecraft.getInstance().setScreen(new WarningScreen(screen, 1)))
                .bounds(respawn.getX(), respawn.getY(), respawn.getWidth(), respawn.getHeight()).build();
        event.addListener(accept);
    }

    static void onScreenRender(ScreenEvent.Render.Post event) {
        if (!(event.getScreen() instanceof DeathScreen screen) || !LifestealClient.limbo.eliminated()) return;
        GuiGraphics g = event.getGuiGraphics();
        var font = Minecraft.getInstance().font;
        int x = screen.width / 2;
        int y = screen.height / 4 + 60 + 4;
        g.drawCenteredString(font, Component.literal("You have no hearts left.").withStyle(ChatFormatting.RED), x, y, 0xFFFFFF);
        g.drawCenteredString(font, Component.literal("A friend holding a Heart can /revive you, even while you are away.").withStyle(ChatFormatting.GRAY), x, y + 11, 0xFFFFFF);
        g.drawCenteredString(font, Component.literal("Accepting elimination erases what you built and what is yours.").withStyle(ChatFormatting.GRAY), x, y + 22, 0xFFFFFF);
    }

    /** Steps 1 to 3, then "erasing". */
    public static final class WarningScreen extends Screen {
        private final DeathScreen parent;
        private final int step;
        private EditBox box;
        private Button next;
        private boolean holding;
        private int held;
        private boolean sent;
        private int holdX, holdY, holdW = 200, holdH = 20;

        WarningScreen(DeathScreen parent, int step) {
            super(Component.literal("Accept elimination?"));
            this.parent = parent;
            this.step = step;
        }

        /** Where the wrapped warning text ends (render() draws it from y = 60, 11 px a line). */
        private int textBottom() {
            int y = 60;
            for (Component line : lines()) y += 11 * font.split(line, width - 40).size();
            return y;
        }

        @Override
        protected void init() {
            int x = width / 2 - 100;
            // Below the text however far it wraps (the ERASE box sits above the button on step 2), but on screen.
            int below = textBottom() + 8 + (step == 2 ? 26 : 0);
            int y = Math.min(Math.max(height / 2 + 20, below), height - 50);
            if (step == 1) {
                addRenderableWidget(Button.builder(Component.literal("I understand, continue"), b -> minecraft.setScreen(new WarningScreen(parent, 2))).bounds(x, y, 200, 20).build());
            } else if (step == 2) {
                box = new EditBox(font, x, y - 26, 200, 20, Component.literal("ERASE"));
                box.setMaxLength(16);
                box.setResponder(s -> next.active = s.trim().equalsIgnoreCase("ERASE"));
                addRenderableWidget(box);
                setInitialFocus(box);
                next = Button.builder(Component.literal("Continue"), b -> minecraft.setScreen(new WarningScreen(parent, 3))).bounds(x, y, 200, 20).build();
                next.active = false;
                addRenderableWidget(next);
            } else {
                holdX = x;
                holdY = y;
            }
            addRenderableWidget(Button.builder(Component.literal("Back, I want to wait"), b -> minecraft.setScreen(parent)).bounds(x, y + 26, 200, 20).build());
        }

        private List<Component> lines() {
            LifestealNet.LimboState s = LifestealClient.limbo;
            List<Component> lines = new ArrayList<>();
            if (step == 1) {
                lines.add(Component.literal("If you accept, this happens and cannot be undone by you:").withStyle(ChatFormatting.RED));
                lines.add(Component.literal("Every block you ever placed is removed: at least " + s.blocks() + " in loaded chunks, plus " + s.unloadedChunks() + " chunks not loaded now.").withStyle(ChatFormatting.GRAY));
                lines.add(Component.literal("Every item that is yours is deleted wherever it is: " + s.items() + " known right now, more as they turn up.").withStyle(ChatFormatting.GRAY));
                lines.add(Component.literal("Chests you placed break and drop what belongs to others.").withStyle(ChatFormatting.GRAY));
                lines.add(Component.literal("You start over at spawn with 10 hearts. Skills, quests and capes stay.").withStyle(ChatFormatting.GRAY));
                lines.add(Component.literal("Or leave now and wait: a friend with a Heart can /revive you.").withStyle(ChatFormatting.YELLOW));
            } else if (step == 2) {
                lines.add(Component.literal("Second warning. Type ERASE to go on.").withStyle(ChatFormatting.RED));
            } else if (!sent) {
                lines.add(Component.literal("Last warning. Hold the button for five seconds.").withStyle(ChatFormatting.RED));
            } else {
                lines.add(Component.literal("Erasing. You will respawn in a moment.").withStyle(ChatFormatting.GRAY));
            }
            return lines;
        }

        @Override
        public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
            super.render(g, mouseX, mouseY, partialTick);
            g.drawCenteredString(font, title, width / 2, 40, 0xFFFFFF);
            int y = 60;
            for (Component line : lines()) {
                for (var part : font.split(line, width - 40)) {
                    g.drawCenteredString(font, part, width / 2, y, 0xFFFFFF);
                    y += 11;
                }
            }
            if (step == 3 && !sent) {
                int progress = Math.min(holdW, holdW * held / 100);
                g.fill(holdX, holdY, holdX + holdW, holdY + holdH, 0xFF3A2020);
                g.fill(holdX, holdY, holdX + progress, holdY + holdH, 0xFFB03030);
                g.renderOutline(holdX, holdY, holdW, holdH, 0xFFFFFFFF);
                g.drawCenteredString(font, holding ? "Keep holding… " + (5 - held / 20) : "Hold to erase everything", holdX + holdW / 2, holdY + 6, 0xFFFFFF);
            }
        }

        @Override
        public void tick() {
            if (step == 3 && holding && !sent) {
                held++;
                if (held >= 100) {
                    sent = true;
                    holding = false;
                    PacketDistributor.sendToServer(new LifestealNet.ConfirmElimination(LifestealClient.limbo.nonce()));
                }
            }
        }

        @Override
        public boolean mouseClicked(double mouseX, double mouseY, int button) {
            if (step == 3 && !sent && button == 0 && mouseX >= holdX && mouseX < holdX + holdW && mouseY >= holdY && mouseY < holdY + holdH) {
                holding = true;
                held = 0;
                return true;
            }
            return super.mouseClicked(mouseX, mouseY, button);
        }

        @Override
        public boolean mouseReleased(double mouseX, double mouseY, int button) {
            if (holding) {
                holding = false;
                held = 0;
                return true;
            }
            return super.mouseReleased(mouseX, mouseY, button);
        }

        @Override
        public boolean shouldCloseOnEsc() {
            return false;
        }

        @Override
        public boolean isPauseScreen() {
            return false;
        }
    }

    private EliminationScreens() {
    }
}
