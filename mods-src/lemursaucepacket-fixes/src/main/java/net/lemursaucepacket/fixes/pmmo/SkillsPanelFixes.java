package net.lemursaucepacket.fixes.pmmo;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.client.gui.screens.recipebook.RecipeBookComponent;
import net.minecraft.client.gui.screens.recipebook.RecipeUpdateListener;

/**
 * The numbers behind the Project MMO skills-panel mixins (client only). Written against
 * pmmo-1.21.1-2.10.47; re-check them when Project MMO is updated.
 */
public final class SkillsPanelFixes {
    /**
     * DetailScroll moves its rows two pixels per unit of scroll: renderContents() lays them out
     * scrollAmount higher (padding top = -scrollAmount) and AbstractScrollWidget.renderWidget()
     * translates the pose up by scrollAmount again. Project MMO's own "/ 2" in getMaxScrollAmount()
     * is there for the same reason, so all limits and steps below are in these half-pixel units.
     */
    private static final int PIXELS_PER_SCROLL_UNIT = 2;
    /** PlayerSkillWidget.HEIGHT: one skill row. */
    private static final int ROW_HEIGHT = 24;
    /**
     * AbstractScrollWidget clips its content 1 px inside its edges (scissor from y + 1 to y + height - 1).
     * DetailScroll lays rows out flush from its top edge (no innerPadding), so this 1 px is the only
     * extra room the end of the list needs to show its last row in full.
     */
    private static final int SCISSOR_INSET = 1;
    /** Vanilla RecipeBookComponent.OFFSET_X_POSITION: an open recipe book is centred, then shifted this far left. */
    private static final int RECIPE_BOOK_SHIFT = 86;

    /** Wheel notch / arrow key: one skill row. */
    public static final double SCROLL_STEP = (double) ROW_HEIGHT / PIXELS_PER_SCROLL_UNIT;

    private SkillsPanelFixes() {
    }

    /** Largest scroll amount that still has content under it: the last row ends at the bottom edge. */
    public static int maxScroll(int innerHeight, int height) {
        int overflow = innerHeight + SCISSOR_INSET - height;
        return overflow <= 0 ? 0 : Math.ceilDiv(overflow, PIXELS_PER_SCROLL_UNIT);
    }

    /**
     * Whether a side panel spanning [panelX, panelX + panelWidth) stays clear of the container screen
     * being opened (and of its recipe book, if that is open). Unknown screens count as fitting, which
     * leaves Project MMO's own choice alone.
     */
    public static boolean fitsBesideContainer(int panelX, int panelWidth) {
        if (!(Minecraft.getInstance().screen instanceof AbstractContainerScreen<?> screen)) return true;
        int occupiedLeft = screen.getGuiLeft();
        if (screen instanceof RecipeUpdateListener listener && listener.getRecipeBookComponent().isVisible()) {
            occupiedLeft = Math.min(occupiedLeft, (screen.width - RecipeBookComponent.IMAGE_WIDTH) / 2 - RECIPE_BOOK_SHIFT);
        }
        return panelX + panelWidth <= occupiedLeft;
    }
}
