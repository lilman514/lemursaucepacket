package net.lemursaucepacket.fixes.construction;

import java.util.ArrayList;
import java.util.List;

import net.lemursaucepacket.fixes.economy.Coins;
import net.lemursaucepacket.fixes.skills.Levels;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.phys.BlockHitResult;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * The server side of the Mason's Palette: placing its block (as if from a stack that never runs out, through the usual
 * place event, so safe zones and claims still apply), choosing a block from the screen or the world, and having another
 * made by Gerta the Mason.
 */
public final class Palette {
    /** Gerta the Mason in Lemurton (npcs/npcs.mjs shop_builder). */
    static final String MAKER = "lsp_npc.shop_builder";
    private static final double MAKER_REACH = 8;

    public static boolean usable(ServerPlayer p) {
        return Levels.of(p, "construction") >= BuildRules.paletteLevel();
    }

    private static void tell(ServerPlayer p, String text) {
        p.displayClientMessage(Component.literal(text).withStyle(ChatFormatting.RED), true);
    }

    static InteractionResult place(ServerPlayer p, UseOnContext ctx) {
        if (!usable(p)) {
            tell(p, "The Mason's Palette needs Construction " + BuildRules.paletteLevel() + " (you have " + Levels.of(p, "construction") + ").");
            return InteractionResult.FAIL;
        }
        Block block = selected(ctx.getItemInHand());
        if (block == null || !BuildRules.paletteAllows(block)) {
            open(p);
            return InteractionResult.SUCCESS;
        }
        ItemStack stack = new ItemStack(block.asItem());
        BlockHitResult hit = new BlockHitResult(ctx.getClickLocation(), ctx.getClickedFace(), ctx.getClickedPos(), ctx.isInside());
        InteractionResult result;
        Construction.PALETTE.set(true);
        try {
            result = stack.useOn(new BlockPlaceContext(p, ctx.getHand(), stack, hit));
        } finally {
            Construction.PALETTE.set(false);
        }
        if (result.consumesAction()) {
            // The block's own sound plays for everyone but the placer, whose client would have played it itself.
            SoundType sound = block.defaultBlockState().getSoundType();
            p.playNotifySound(sound.getPlaceSound(), SoundSource.BLOCKS, (sound.getVolume() + 1f) / 2f, sound.getPitch() * 0.8f);
        }
        return result;
    }

    static Block selected(ItemStack palette) {
        ResourceLocation id = palette.get(ConstructionModule.PALETTE_BLOCK.get());
        return id == null ? null : BuiltInRegistries.BLOCK.getOptional(id).orElse(null);
    }

    /** The palette in a hand: the main hand's first. */
    static ItemStack held(ServerPlayer p) {
        for (InteractionHand hand : InteractionHand.values()) {
            ItemStack s = p.getItemInHand(hand);
            if (s.is(ConstructionModule.MASONS_PALETTE.get())) return s;
        }
        return ItemStack.EMPTY;
    }

    /** The picker, with every block the palette has and which is chosen. */
    static void open(ServerPlayer p) {
        ItemStack palette = held(p);
        Block chosen = palette.isEmpty() ? null : selected(palette);
        List<PaletteNet.Category> categories = new ArrayList<>();
        for (BuildRules.Category c : BuildRules.palette()) {
            categories.add(new PaletteNet.Category(c.name(), c.icon().toString(), c.blocks().stream().map(b -> BuiltInRegistries.BLOCK.getKey(b).toString()).toList()));
        }
        PacketDistributor.sendToPlayer(p, new PaletteNet.Open(categories, chosen == null ? "" : BuiltInRegistries.BLOCK.getKey(chosen).toString(),
                usable(p), BuildRules.paletteLevel(), Levels.of(p, "construction")));
    }

    /** From the picker: the palette in hand places this block from now on. */
    public static void select(ServerPlayer p, String id) {
        ItemStack palette = held(p);
        ResourceLocation key = ResourceLocation.tryParse(id);
        Block block = key == null ? null : BuiltInRegistries.BLOCK.getOptional(key).orElse(null);
        if (palette.isEmpty() || block == null) return;
        if (!BuildRules.paletteAllows(block)) {
            tell(p, "The palette can't place " + block.getName().getString() + ".");
            return;
        }
        palette.set(ConstructionModule.PALETTE_BLOCK.get(), key);
        p.displayClientMessage(Component.literal("The palette places ").withStyle(ChatFormatting.GRAY).append(block.getName().copy().withStyle(ChatFormatting.GOLD)), true);
        p.playNotifySound(SoundEvents.BOOK_PAGE_TURN, SoundSource.PLAYERS, 0.6f, 1.2f);
    }

    /** Middle-click with the palette in hand: choose the kind of block you're looking at, if the palette has it. */
    static void pick(ServerPlayer p, BlockPos pos) {
        if (held(p).isEmpty() || !p.canInteractWithBlock(pos, 1.0) || !p.level().isLoaded(pos)) return;
        Block block = p.level().getBlockState(pos).getBlock();
        if (!BuildRules.paletteAllows(block)) {
            tell(p, "The palette can't place " + block.getName().getString() + ".");
            return;
        }
        select(p, BuiltInRegistries.BLOCK.getKey(block).toString());
    }

    // ---------------------------------------------------------------- another one, from Gerta

    static ItemStack stack() {
        return new ItemStack(ConstructionModule.MASONS_PALETTE.get());
    }

    public static void give(ServerPlayer p) {
        ItemStack stack = stack();
        if (!p.getInventory().add(stack)) p.drop(stack, false);
    }

    /** Gerta's "I've lost my palette": what it costs, and a link to have one made. */
    static void offer(ServerPlayer p, Entity npc) {
        String who = npc.getName().getString();
        if (!usable(p)) {
            p.sendSystemMessage(Component.literal(who + ": \"That palette is for masters of the craft. Come back at Construction " + BuildRules.paletteLevel() + ".\"").withStyle(ChatFormatting.GRAY));
            return;
        }
        long price = BuildRules.paletteCoins();
        p.sendSystemMessage(Component.literal(who + ": \"Lost your palette? I can make you another for ").withStyle(ChatFormatting.GRAY).append(Coins.text(price))
                .append(Component.literal(".\" ").withStyle(ChatFormatting.GRAY))
                .append(Component.literal("[Have one made]").withStyle(s -> s.withColor(ChatFormatting.GREEN)
                        .withClickEvent(new ClickEvent(ClickEvent.Action.RUN_COMMAND, "/palette buy"))
                        .withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, Component.literal("A new Mason's Palette for " + Coins.exact(price) + " coins"))))));
    }

    /** /palette buy, by Gerta: Construction 99 and the coins, and she's close by. */
    public static boolean buy(ServerPlayer p) {
        Entity maker = p.serverLevel().getEntities(p, p.getBoundingBox().inflate(MAKER_REACH), e -> e.getTags().contains(MAKER)).stream().findFirst().orElse(null);
        if (maker == null) {
            p.sendSystemMessage(Component.literal("Gerta the Mason in Lemurton makes Mason's Palettes: ask her.").withStyle(ChatFormatting.RED));
            return false;
        }
        if (!usable(p)) {
            p.sendSystemMessage(Component.literal("Only a Construction " + BuildRules.paletteLevel() + " can have a palette made.").withStyle(ChatFormatting.RED));
            return false;
        }
        long price = BuildRules.paletteCoins();
        if (!Coins.take(p, price)) {
            p.sendSystemMessage(Component.literal("A new palette costs ").withStyle(ChatFormatting.RED).append(Coins.text(price)).append(Component.literal(".").withStyle(ChatFormatting.RED)));
            return false;
        }
        give(p);
        p.sendSystemMessage(Component.literal(maker.getName().getString() + " hands you a new Mason's Palette.").withStyle(ChatFormatting.GOLD));
        p.level().playSound(null, p.getX(), p.getY(), p.getZ(), SoundEvents.VILLAGER_WORK_MASON, SoundSource.PLAYERS, 1f, 1f);
        ConstructionModule.LOGGER.info("{} bought another Mason's Palette for {} coins", p.getGameProfile().getName(), price);
        return true;
    }

    private Palette() {
    }
}
