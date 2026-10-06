package net.lemursaucepacket.fixes.hub;

import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import net.minecraft.world.level.block.Rotation;
import net.neoforged.fml.loading.FMLPaths;

/**
 * The capital, as written by structures/hub.mjs to config/lemursaucepacket/hub_plan.json. Every position is
 * relative to the city's centre (the market) and its ground level (y 0 = the street surface). It is built between
 * {@code minDistance} and {@code searchRadius} blocks from world spawn (further if no good site turns up there);
 * {@code arrival} is where travellers come in (the compass and /lsp hub goto lead there).
 */
public record HubPlan(int version, String name, int flatRadius, int blend, int minDistance, int searchRadius, int searchStep, List<Paving> paving,
                      List<Placement> placements, List<Single> blocks, List<String> commands, Waystone waystone, int[] arrival, Zone zone) {

    /** A rectangle of street surface at height y, from a weighted mix of block states. */
    public record Paving(int x1, int z1, int x2, int z2, int y, List<String> states, List<Integer> weights) {
    }

    /** A structure template placed with its origin at p, turned by rotation. */
    public record Placement(String template, int x, int y, int z, Rotation rotation) {
    }

    public record Single(int x, int y, int z, String state) {
    }

    public record Waystone(int x, int y, int z, String name, String facing) {
    }

    public record Zone(String name, int x1, int z1, int x2, int z2) {
    }

    public static Path file() {
        return FMLPaths.CONFIGDIR.get().resolve("lemursaucepacket").resolve("hub_plan.json");
    }

    public static HubPlan read() throws Exception {
        try (Reader reader = Files.newBufferedReader(file())) {
            return parse(JsonParser.parseReader(reader).getAsJsonObject());
        }
    }

    private static int[] ints(JsonElement e) {
        JsonArray a = e.getAsJsonArray();
        int[] out = new int[a.size()];
        for (int i = 0; i < out.length; i++) out[i] = a.get(i).getAsInt();
        return out;
    }

    private static Rotation rotation(String r) {
        return switch (r) {
            case "cw90" -> Rotation.CLOCKWISE_90;
            case "cw180" -> Rotation.CLOCKWISE_180;
            case "ccw90" -> Rotation.COUNTERCLOCKWISE_90;
            default -> Rotation.NONE;
        };
    }

    static HubPlan parse(JsonObject j) {
        JsonObject flat = j.getAsJsonObject("flatten");
        JsonObject search = j.getAsJsonObject("search");
        List<Paving> paving = new ArrayList<>();
        for (JsonElement e : j.getAsJsonArray("paving")) {
            JsonObject o = e.getAsJsonObject();
            int[] box = ints(o.get("box"));
            List<String> states = new ArrayList<>();
            List<Integer> weights = new ArrayList<>();
            for (JsonElement m : o.getAsJsonArray("mix")) {
                JsonArray pair = m.getAsJsonArray();
                weights.add(pair.get(0).getAsInt());
                states.add(pair.get(1).getAsString());
            }
            paving.add(new Paving(box[0], box[1], box[2], box[3], o.has("y") ? o.get("y").getAsInt() : 0, states, weights));
        }
        List<Placement> placements = new ArrayList<>();
        for (JsonElement e : j.getAsJsonArray("placements")) {
            JsonObject o = e.getAsJsonObject();
            int[] p = ints(o.get("p"));
            placements.add(new Placement(o.get("t").getAsString(), p[0], p[1], p[2], rotation(o.has("r") ? o.get("r").getAsString() : "none")));
        }
        List<Single> blocks = new ArrayList<>();
        if (j.has("blocks")) for (JsonElement e : j.getAsJsonArray("blocks")) {
            JsonObject o = e.getAsJsonObject();
            int[] p = ints(o.get("p"));
            blocks.add(new Single(p[0], p[1], p[2], o.get("s").getAsString()));
        }
        // Commands run last, from the city's centre at street level (so ~ coordinates are city coordinates).
        List<String> commands = new ArrayList<>();
        if (j.has("commands")) for (JsonElement e : j.getAsJsonArray("commands")) commands.add(e.getAsString());
        JsonObject w = j.getAsJsonObject("waystone");
        int[] wp = ints(w.get("p"));
        JsonObject z = j.getAsJsonObject("zone");
        int[] zb = ints(z.get("box"));
        return new HubPlan(j.get("version").getAsInt(), j.get("name").getAsString(), flat.get("radius").getAsInt(), flat.get("blend").getAsInt(),
                search.has("minDistance") ? search.get("minDistance").getAsInt() : 0, search.get("radius").getAsInt(), search.get("step").getAsInt(), paving, placements, blocks, commands,
                new Waystone(wp[0], wp[1], wp[2], w.get("name").getAsString(), w.has("facing") ? w.get("facing").getAsString() : "south"),
                ints(j.get(j.has("arrival") ? "arrival" : "spawn")), new Zone(z.get("name").getAsString(), zb[0], zb[1], zb[2], zb[3]));
    }
}
