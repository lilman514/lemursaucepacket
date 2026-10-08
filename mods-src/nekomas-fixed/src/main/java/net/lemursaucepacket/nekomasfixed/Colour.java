package net.lemursaucepacket.nekomasfixed;

import java.util.List;

import com.mojang.serialization.Codec;

import net.minecraft.util.StringRepresentable;
import net.minecraft.world.item.DyeColor;

/**
 * The 20 colours of Nekoma's palette: the 16 vanilla dye colours and the four new ones (amber, aqua, indigo, maroon).
 *
 * <p>{@link DyeColor} can't be extended on NeoForge 1.21.1, so wherever vanilla code insists on a DyeColor (beds,
 * shulker boxes, stained glass, carpets) a new colour lends one: amber is yellow, aqua light blue, indigo magenta and
 * maroon red, as upstream does. Our own textures, renderers and beacon tint still show the real colour.
 */
public enum Colour implements StringRepresentable {
    WHITE(DyeColor.WHITE),
    ORANGE(DyeColor.ORANGE),
    MAGENTA(DyeColor.MAGENTA),
    LIGHT_BLUE(DyeColor.LIGHT_BLUE),
    YELLOW(DyeColor.YELLOW),
    LIME(DyeColor.LIME),
    PINK(DyeColor.PINK),
    GRAY(DyeColor.GRAY),
    LIGHT_GRAY(DyeColor.LIGHT_GRAY),
    CYAN(DyeColor.CYAN),
    PURPLE(DyeColor.PURPLE),
    BLUE(DyeColor.BLUE),
    BROWN(DyeColor.BROWN),
    GREEN(DyeColor.GREEN),
    RED(DyeColor.RED),
    BLACK(DyeColor.BLACK),
    AMBER("amber", DyeColor.YELLOW, 0xE0AF0B),
    AQUA("aqua", DyeColor.LIGHT_BLUE, 0xA6CEC7),
    INDIGO("indigo", DyeColor.MAGENTA, 0x453C8F),
    MAROON("maroon", DyeColor.RED, 0xA62D10);

    /** The four new colours, in upstream's order. */
    public static final List<Colour> NEW = List.of(AMBER, AQUA, INDIGO, MAROON);
    public static final Codec<Colour> CODEC = StringRepresentable.fromEnum(Colour::values);

    private final String name;
    /** The vanilla colour this one stands in for (itself for the 16 vanilla colours). */
    public final DyeColor base;
    /** The dye's own colour as 0xRRGGBB. */
    public final int rgb;

    Colour(DyeColor vanilla) {
        this(vanilla.getSerializedName(), vanilla, vanilla.getTextureDiffuseColor() & 0xFFFFFF);
    }

    Colour(String name, DyeColor base, int rgb) {
        this.name = name;
        this.base = base;
        this.rgb = rgb;
    }

    public boolean isNew() {
        return ordinal() >= AMBER.ordinal();
    }

    @Override
    public String getSerializedName() {
        return name;
    }
}
