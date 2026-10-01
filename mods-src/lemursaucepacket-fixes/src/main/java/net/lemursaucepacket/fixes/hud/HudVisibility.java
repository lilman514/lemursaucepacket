package net.lemursaucepacket.fixes.hud;

import net.neoforged.neoforge.common.ModConfigSpec;

/** Visibility uses the mods' own switches; only layers without a switch are suppressed by us. */
final class HudVisibility {
    private static Object invoke(Object object, String method) throws Exception {
        return object.getClass().getMethod(method).invoke(object);
    }

    private static Object jadeGeneral() throws Exception {
        Object config = Reflect.cls("snownee.jade.api.config.IWailaConfig").getMethod("get").invoke(null);
        return invoke(config, "getGeneral");
    }

    private static Object voiceEntry(String id) throws Exception {
        Object config = Reflect.staticField("de.maxhenkel.voicechat.VoicechatClient", "CLIENT_CONFIG");
        return config.getClass().getField(id.equals("voice_icon") ? "showHudIcons" : "showGroupHud").get(config);
    }

    private static Object xaeroChannel() throws Exception {
        return invoke(Reflect.staticField("xaero.common.HudMod", "INSTANCE"), "getHudConfigs");
    }

    private static Object xaeroOption() throws Exception {
        return Reflect.staticField("xaero.hud.minimap.common.config.option.MinimapProfiledConfigOptions", "DISPLAY_MINIMAP");
    }

    private static ModConfigSpec.ConfigValue<?> pmmo(String id) throws Exception {
        return Reflect.configValue("pmmo-client.toml", "Client.GUI.Display " + (id.equals("pmmo_skills") ? "Skill" : "Gain") + " List");
    }

    private static Object pinned() throws Exception {
        return Reflect.staticField("dev.ftb.mods.ftbquests.client.FTBQuestsClientConfig", "PINNED_VISIBILITY");
    }

    static boolean shown(String id) {
        try {
            return switch (id) {
                case "effects" -> HudConfig.EFFECTS_VISIBLE.get();
                case "boss_bar" -> HudConfig.BOSS_VISIBLE.get();
                case "create_goggles" -> HudConfig.GOGGLES_VISIBLE.get();
                case "pmmo_skills", "pmmo_gains" -> Boolean.TRUE.equals(pmmo(id).get());
                case "jade" -> (boolean) Reflect.cls("snownee.jade.api.config.IWailaConfig$IConfigGeneral")
                        .getMethod("shouldDisplayTooltip").invoke(jadeGeneral());
                case "voice_icon", "voice_group" -> (boolean) invoke(voiceEntry(id), "get");
                case "ftb_pinned" -> !((Enum<?>) invoke(pinned(), "get")).name().equals("HIDDEN");
                case "xaero_minimap" -> (boolean) invoke(xaeroChannel(), "getClientConfigManager").getClass()
                        .getMethod("getEffective", Reflect.cls("xaero.lib.common.config.option.ConfigOption"))
                        .invoke(invoke(xaeroChannel(), "getClientConfigManager"), xaeroOption());
                default -> throw new IllegalArgumentException("Unknown HUD element " + id);
            };
        } catch (Exception e) {
            HudElements.warnOnce("visibility of " + id, e);
            return true;
        }
    }

    static void save(String id, boolean shown) throws Exception {
        switch (id) {
            case "effects", "boss_bar", "create_goggles" -> {
                (id.equals("effects") ? HudConfig.EFFECTS_VISIBLE : id.equals("boss_bar") ? HudConfig.BOSS_VISIBLE : HudConfig.GOGGLES_VISIBLE).set(shown);
                HudConfig.SPEC.save();
            }
            case "pmmo_skills", "pmmo_gains" -> {
                Reflect.set(pmmo(id), shown);
                Reflect.specOf("pmmo-client.toml").save();
                (id.equals("pmmo_skills") ? HudConfig.PMMO_SKILLS_VISIBLE : HudConfig.PMMO_GAINS_VISIBLE).set(shown ? 1 : 0);
                HudConfig.SPEC.save();
            }
            case "jade" -> {
                Reflect.cls("snownee.jade.api.config.IWailaConfig$IConfigGeneral").getMethod("setDisplayTooltip", boolean.class).invoke(jadeGeneral(), shown);
                invoke(Reflect.staticField("snownee.jade.Jade", "CONFIG"), "save");
            }
            case "voice_icon", "voice_group" -> {
                Object entry = voiceEntry(id);
                Reflect.cls("de.maxhenkel.voicechat.configbuilder.entry.ConfigEntry").getMethod("set", Object.class).invoke(entry, shown);
                invoke(entry, "save");
            }
            case "ftb_pinned" -> {
                Object value = Reflect.staticField("dev.ftb.mods.ftbquests.client.PinnedTrackerVisibility", shown ? "ALL" : "HIDDEN");
                Reflect.cls("dev.ftb.mods.ftblibrary.snbt.config.BaseValue").getMethod("set", Object.class).invoke(pinned(), value);
                Object manager = Reflect.cls("dev.ftb.mods.ftblibrary.config.manager.ConfigManager").getMethod("getInstance").invoke(null);
                manager.getClass().getMethod("save", String.class).invoke(manager, "ftbquests-client");
            }
            case "xaero_minimap" -> {
                Object channel = xaeroChannel();
                Object profile = invoke(invoke(channel, "getClientConfigManager"), "getCurrentProfile");
                profile.getClass().getMethod("set", Reflect.cls("xaero.lib.common.config.option.ConfigOption"), Object.class).invoke(profile, xaeroOption(), shown);
                Object io = invoke(channel, "getClientConfigProfileIO");
                io.getClass().getMethod("save", Reflect.cls("xaero.lib.common.config.profile.ConfigProfile")).invoke(io, profile);
            }
            default -> throw new IllegalArgumentException("Unknown HUD element " + id);
        }
    }

    private HudVisibility() {}
}
