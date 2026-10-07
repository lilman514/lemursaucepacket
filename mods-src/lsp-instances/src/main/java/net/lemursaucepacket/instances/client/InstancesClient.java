package net.lemursaucepacket.instances.client;

import net.lemursaucepacket.instances.InstanceNet;
import net.minecraft.client.Minecraft;

/** Client side: opens, refreshes and closes the event window as the server says. */
public final class InstancesClient {
    public static void init() {
    }

    public static void window(InstanceNet.Window w) {
        Minecraft mc = Minecraft.getInstance();
        EventScreen open = mc.screen instanceof EventScreen s && s.event().equals(w.event()) ? s : null;
        if (w.mode() == InstanceNet.CLOSE) {
            if (open != null) mc.setScreen(null);
        } else if (open != null) {
            open.update(w);
        } else if (w.mode() == InstanceNet.OPEN) {
            mc.setScreen(new EventScreen(w));
        }
    }

    private InstancesClient() {
    }
}
