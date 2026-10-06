package net.lemursaucepacket.fixes.towns;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.saveddata.SavedData;

/**
 * Names for the world's towns, made up the first time someone walks into one and then kept (saved with the world),
 * so a town keeps its name even if the word lists change. Each kind of town draws from its own words (a plains town
 * sounds English, a snowy one Norse, a desert one like Al Kharid), and no two towns share a name.
 */
public final class TownNames extends SavedData {
    private static final String NAME = "lsp_towns";
    private static final Factory<TownNames> FACTORY = new Factory<>(TownNames::new, TownNames::load, null);

    private final Map<String, String> names = new HashMap<>();
    private final Set<String> used = new HashSet<>();

    public static TownNames get(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(FACTORY, NAME);
    }

    /** The name of the town whose start is at `key` (dimension and start chunk), made up and kept if it has none. */
    public String name(String key, long seed, ResourceLocation structure) {
        String n = names.get(key);
        if (n != null) return n;
        Style style = Style.of(structure);
        RandomSource r = RandomSource.create(seed ^ key.hashCode() * 0x9E3779B97F4A7C15L);
        for (int tries = 0; tries < 60 && (n == null || used.contains(n) || n.equalsIgnoreCase("Lemurton")); tries++) n = style.make(r);
        if (used.contains(n)) n = n + " " + (used.size() + 1);
        names.put(key, n);
        used.add(n);
        setDirty();
        return n;
    }

    /** The name a town already has, or null. */
    public String known(String key) {
        return names.get(key);
    }

    private static TownNames load(CompoundTag tag, HolderLookup.Provider registries) {
        TownNames t = new TownNames();
        CompoundTag all = tag.getCompound("names");
        for (String k : all.getAllKeys()) {
            t.names.put(k, all.getString(k));
            t.used.add(all.getString(k));
        }
        return t;
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider registries) {
        CompoundTag all = new CompoundTag();
        names.forEach(all::putString);
        tag.put("names", all);
        return tag;
    }

    /** How a kind of town sounds, from its structure's id. */
    enum Style {
        PLAINS(new String[] {"Ash", "Bar", "Bram", "Bright", "Brook", "Burn", "Cal", "Corn", "Dun", "East", "Elm", "Fair", "Fal", "Fern", "Glen", "Gold", "Hal", "Hart", "Hay", "High",
                "Kel", "Kings", "Lang", "Lin", "Long", "Mar", "Mill", "Mor", "North", "Oak", "Pem", "Pen", "Red", "Rim", "Rose", "Shel", "South", "Stan", "Stone", "Sum", "Thorn",
                "West", "Whit", "Wil", "Win", "Wyn"},
                new String[] {"bury", "brook", "by", "combe", "cross", "dale", "den", "field", "ford", "gate", "ham", "haven", "hill", "holt", "hurst", "ley", "mere", "minster",
                        "stead", "stow", "ton", "wick", "worth"}),
        TAIGA(new String[] {"Pine", "Fir", "Raven", "Wolf", "Elk", "Bjorn", "Hald", "Ulf", "Grim", "Dark", "Moss", "Birch", "Bear", "Owl", "Thorn", "Tarn", "Hrim", "Eld"},
                new String[] {"holm", "stead", "hollow", "wood", "dale", "garth", "moor", "lodge", "fell", "crag", "wald"}),
        SNOWY(new String[] {"Frost", "Ice", "Kald", "Rime", "Snow", "Hvit", "Vinter", "Fjell", "Skar", "Kol", "Storm", "Isa", "Nord", "Jarn", "Vind"},
                new String[] {"heim", "vik", "gard", "holm", "fell", "by", "stad", "hall", "reach", "fjord", "mark"}),
        SWAMP(new String[] {"Bog", "Fen", "Marsh", "Mire", "Reed", "Murk", "Sallow", "Willow", "Mud", "Moss", "Crane", "Peat", "Sedge"},
                new String[] {"water", "bottom", "wallow", "pool", "end", "ditch", "mere", "ton", "holme", "wick", "staithe"}),
        ALPINE(new String[] {"Alp", "Berg", "Edel", "Grin", "Hoch", "Matter", "Schwarz", "Weiss", "Zer", "Lauter", "Gold", "Stein", "Rot"},
                new String[] {"berg", "horn", "matt", "bach", "wald", "dorf", "alp", "egg", "tal", "stock"}),
        EASTERN(new String[] {"Aki", "Haru", "Kiri", "Mizu", "Sora", "Taka", "Yama", "Shiro", "Kawa", "Hana", "Tsuki", "Kaze"},
                new String[] {"mura", "hama", "zawa", "kawa", "oka", "shima", "tani", "yama", "saki", "no"}),
        DESERT(new String[] {"Ka", "Kha", "Sha", "Za", "Na", "Qa", "Ma", "Ra", "Su", "Ta", "Ba", "Fa", "Me", "So"},
                new String[] {"harid", "mirah", "zaran", "dakim", "limah", "barun", "simar", "rakesh", "nahir", "hedun", "phara", "kesh"}),
        SAVANNA(new String[] {"Ka", "Ma", "Ta", "Zu", "Ba", "Ki", "Ru", "Sa", "Lu", "Mo", "Nyo", "Wa", "Ji", "Ko"},
                new String[] {"rumba", "nanga", "mbolo", "lari", "rizi", "kota", "tanga", "warri", "selu", "nduru", "boko", "lima"}),
        JUNGLE(new String[] {"Ta", "Ka", "Ma", "Shi", "Lo", "Ru", "Ai", "Tai", "Ki", "Pa", "Ho"},
                new String[] {"moku", "rahi", "kula", "rina", "noa", "hoku", "tala", "puna", "lani", "ruka"});

        private final String[] first;
        private final String[] last;

        Style(String[] first, String[] last) {
            this.first = first;
            this.last = last;
        }

        String make(RandomSource r) {
            String a = first[r.nextInt(first.length)];
            String b = last[r.nextInt(last.length)];
            // "Bury" after "Ash", but not "Burnbrook" twice over: skip doubled letters at the seam.
            if (a.length() > 1 && Character.toLowerCase(a.charAt(a.length() - 1)) == b.charAt(0)) b = b.substring(1);
            String n = a + b;
            // Now and then the desert's "Al ..." and an "Upper"/"Lower" or "Great"/"Little" for the English towns.
            if (this == DESERT && r.nextInt(4) == 0) n = "Al " + n;
            if (this == PLAINS && r.nextInt(9) == 0) n = (r.nextBoolean() ? (r.nextBoolean() ? "Upper " : "Lower ") : (r.nextBoolean() ? "Great " : "Little ")) + n;
            return n;
        }

        static Style of(ResourceLocation structure) {
            String p = structure.getPath();
            if (p.contains("desert") || p.contains("badlands") || p.contains("pueblo") || p.contains("mesa")) return DESERT;
            if (p.contains("savanna")) return SAVANNA;
            if (p.contains("snow") || p.contains("ice") || p.contains("frozen") || p.contains("viking") || p.contains("igloo")) return SNOWY;
            if (p.contains("taiga")) return TAIGA;
            if (p.contains("swamp") || p.contains("mangrove")) return SWAMP;
            if (p.contains("jungle") || p.contains("tribal") || p.contains("polynesian")) return JUNGLE;
            if (p.contains("japanese") || p.contains("cherry")) return EASTERN;
            if (p.contains("meadow") || p.contains("swiss") || p.contains("alpine")) return ALPINE;
            return PLAINS;
        }

        /** The line under a grand capital's name. */
        String capitalTitle() {
            return switch (this) {
                case DESERT -> "Capital of the sands";
                case SAVANNA -> "Capital of the savanna";
                case SNOWY -> "Capital of the snows";
                case TAIGA -> "Capital of the pines";
                default -> "Capital of the plains";
            };
        }
    }
}
