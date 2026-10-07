package net.lemursaucepacket.instances;

import java.util.HashMap;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.mojang.serialization.JsonOps;

import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.server.packs.resources.SimpleJsonResourceReloadListener;
import net.minecraft.util.profiling.ProfilerFiller;

/** Reads the events: {@code data/<namespace>/lsp_instances/event/<name>.json}, on start and on /reload. */
public final class EventLoader extends SimpleJsonResourceReloadListener {
    private static Map<ResourceLocation, EventDef> events = Map.of();

    EventLoader() {
        super(new Gson(), "lsp_instances/event");
    }

    public static EventDef get(ResourceLocation id) {
        return events.get(id);
    }

    public static Map<ResourceLocation, EventDef> all() {
        return events;
    }

    @Override
    protected void apply(Map<ResourceLocation, JsonElement> files, ResourceManager manager, ProfilerFiller profiler) {
        Map<ResourceLocation, EventDef> read = new HashMap<>();
        files.forEach((id, json) -> EventDef.CODEC.parse(JsonOps.INSTANCE, json)
                .resultOrPartial(error -> LspInstances.LOGGER.error("Event {}: {}", id, error))
                .ifPresent(def -> read.put(id, def)));
        events = Map.copyOf(read);
        LspInstances.LOGGER.info("Instanced events: {} ({})", events.size(), String.join(", ", events.keySet().stream().map(ResourceLocation::toString).sorted().toList()));
    }
}
