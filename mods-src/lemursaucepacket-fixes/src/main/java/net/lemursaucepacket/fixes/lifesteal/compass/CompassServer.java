package net.lemursaucepacket.fixes.lifesteal.compass;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.lifesteal.LifestealConfig;
import net.lemursaucepacket.fixes.lifesteal.LifestealNet;
import net.lemursaucepacket.fixes.lifesteal.PlacedBlocks;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.GlobalPos;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.LodestoneTracker;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * The two compasses (registered by KubeJS as plain items; docs/lifesteal.md). Right-click opens a list of the
 * player's own items; picking one binds the compass to it. The binding lives in the item's custom data with a
 * uuid for the client's needle cache; the vanilla lodestone tracker on the item gives the last known spot for
 * a fresh login. While held, the server tells the client the live position once a second.
 */
public final class CompassServer {
    public static final ResourceLocation LOST_ITEM_COMPASS = ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "lost_item_compass");
    public static final ResourceLocation SEEKERS_COMPASS = ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "seekers_compass");
    public static final String DATA_KEY = "lsp_compass";

    public static boolean isCompass(ItemStack stack) {
        return isSeeker(stack) || BuiltInRegistries.ITEM.getKey(stack.getItem()).equals(LOST_ITEM_COMPASS);
    }

    public static boolean isSeeker(ItemStack stack) {
        return BuiltInRegistries.ITEM.getKey(stack.getItem()).equals(SEEKERS_COMPASS);
    }

    @Nullable
    public static ServerLevel level(MinecraftServer server, String dimension) {
        ResourceLocation id = ResourceLocation.tryParse(dimension);
        return id == null ? null : server.getLevel(ResourceKey.create(Registries.DIMENSION, id));
    }

    /** The compass's own id (given when it is first bound), which the client's needle cache is keyed by. */
    @Nullable
    public static UUID compassId(ItemStack stack) {
        CustomData data = stack.get(DataComponents.CUSTOM_DATA);
        if (data == null) return null;
        CompoundTag tag = data.getUnsafe().getCompound(DATA_KEY);
        return tag.hasUUID("id") ? tag.getUUID("id") : null;
    }

    private static UUID ensureId(ItemStack stack) {
        UUID existing = compassId(stack);
        if (existing != null) return existing;
        UUID id = UUID.randomUUID();
        CustomData.update(DataComponents.CUSTOM_DATA, stack, t -> {
            CompoundTag c = t.getCompound(DATA_KEY);
            c.putUUID("id", id);
            t.put(DATA_KEY, c);
        });
        return id;
    }

    private static CompoundTag data(ItemStack stack) {
        CustomData data = stack.get(DataComponents.CUSTOM_DATA);
        return data == null ? new CompoundTag() : data.getUnsafe().getCompound(DATA_KEY);
    }

    private static void write(ItemStack stack, String target, boolean includeAll) {
        CustomData.update(DataComponents.CUSTOM_DATA, stack, t -> {
            CompoundTag c = t.getCompound(DATA_KEY);
            c.putString("target", target);
            c.putBoolean("all", includeAll);
            t.put(DATA_KEY, c);
        });
    }

    // ---- the list ----

    @SubscribeEvent
    public static void onRightClick(PlayerInteractEvent.RightClickItem event) {
        if (!LifestealConfig.COMPASS_ENABLED.get() || !isCompass(event.getItemStack())) return;
        event.setCancellationResult(InteractionResult.SUCCESS);
        event.setCanceled(true);
        if (event.getEntity() instanceof ServerPlayer player) openList(player, event.getHand());
    }

    public static void openList(ServerPlayer player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);
        if (!isCompass(stack)) return;
        if (!player.connection.hasChannel(LifestealNet.CompassList.TYPE)) {
            player.sendSystemMessage(Component.literal("The compass needs the LemurSaucePacket Fixes mod on your client.").withStyle(ChatFormatting.RED));
            return;
        }
        boolean seeker = isSeeker(stack);
        CompoundTag data = data(stack);
        boolean includeAll = seeker && data.getBoolean("all");
        List<LifestealNet.CompassEntry> entries = entries(player, includeAll);
        PacketDistributor.sendToPlayer(player, new LifestealNet.CompassList(hand == InteractionHand.MAIN_HAND ? 0 : 1, seeker, includeAll, data.getString("target"), entries));
    }

    private static List<LifestealNet.CompassEntry> entries(ServerPlayer player, boolean includeAll) {
        MinecraftServer server = player.server;
        UUID owner = player.getUUID();
        String here = PlacedBlocks.dimension(player.serverLevel());
        List<LifestealNet.CompassEntry> out = new ArrayList<>();
        for (LostItemIndex.Entry e : LostItemIndex.get(server).of(owner)) {
            out.add(new LifestealNet.CompassEntry(e.key(), icon(e.item()), e.count(), e.dimension(), distance(player, here, e.dimension(), e.pos())));
        }
        if (includeAll) {
            for (ContainerIndex.Entry e : ContainerIndex.get(server).of(owner, true)) {
                BlockPos pos = e.pos();
                String dim = e.dimension();
                if (e.holder() != null) {
                    ServerPlayer holder = server.getPlayerList().getPlayer(e.holder());
                    if (holder != null) {
                        pos = holder.blockPosition();
                        dim = PlacedBlocks.dimension(holder.serverLevel());
                    }
                }
                out.add(new LifestealNet.CompassEntry(e.key(), icon(e.item()), e.count(), dim, distance(player, here, dim, pos)));
            }
            for (ServerPlayer other : server.getPlayerList().getPlayers()) {
                if (other == player) continue;
                ContainerIndex.scanPlayer(other);
            }
            for (ContainerIndex.Entry e : ContainerIndex.get(server).of(owner, true)) {
                if (e.holder() == null || server.getPlayerList().getPlayer(e.holder()) == null) continue;
                ServerPlayer holder = server.getPlayerList().getPlayer(e.holder());
                String key = e.key();
                if (out.stream().anyMatch(x -> x.key().equals(key))) continue;
                String dim = PlacedBlocks.dimension(holder.serverLevel());
                out.add(new LifestealNet.CompassEntry(key, icon(e.item()), e.count(), dim, distance(player, here, dim, holder.blockPosition())));
            }
        }
        out.sort(Comparator.comparingInt((LifestealNet.CompassEntry e) -> e.distance() < 0 ? Integer.MAX_VALUE : e.distance()).thenComparing(e -> e.icon().getHoverName().getString()));
        if (out.size() > 200) out = new ArrayList<>(out.subList(0, 200));
        return out;
    }

    private static ItemStack icon(String itemId) {
        ResourceLocation id = ResourceLocation.tryParse(itemId);
        Item item = id == null ? null : BuiltInRegistries.ITEM.get(id);
        return item == null ? ItemStack.EMPTY : new ItemStack(item);
    }

    private static int distance(ServerPlayer player, String here, String dimension, BlockPos pos) {
        if (!here.equals(dimension)) return -1;
        return (int) Math.sqrt(player.blockPosition().distSqr(pos));
    }

    // ---- selection ----

    public static void select(ServerPlayer player, LifestealNet.CompassSelect payload) {
        InteractionHand hand = payload.hand() == 0 ? InteractionHand.MAIN_HAND : InteractionHand.OFF_HAND;
        ItemStack stack = player.getItemInHand(hand);
        if (!isCompass(stack)) return;
        boolean includeAll = isSeeker(stack) && payload.includeAll();
        if (payload.key().equals("?")) {
            // The toggle changed: keep the binding, send the list again with the new scope.
            write(stack, data(stack).getString("target"), includeAll);
            openList(player, hand);
            return;
        }
        write(stack, payload.key(), includeAll);
        UUID id = ensureId(stack);
        if (payload.key().isEmpty()) {
            stack.remove(DataComponents.LODESTONE_TRACKER);
            push(player, id, null);
            player.sendSystemMessage(Component.literal("The compass points at nothing.").withStyle(ChatFormatting.GRAY));
            return;
        }
        GlobalPos target = resolve(player, payload.key(), includeAll);
        if (target == null) {
            stack.remove(DataComponents.LODESTONE_TRACKER);
            push(player, id, null);
            player.sendSystemMessage(Component.literal("That item is not where it was.").withStyle(ChatFormatting.GRAY));
            return;
        }
        stack.set(DataComponents.LODESTONE_TRACKER, new LodestoneTracker(Optional.of(target), false));
        push(player, id, target);
        player.sendSystemMessage(Component.literal("The needle turns.").withStyle(ChatFormatting.GRAY));
    }

    /** Where the bound thing is now, or null. Seeker's compasses fall back to any place holding the same item. */
    @Nullable
    private static GlobalPos resolve(ServerPlayer player, String key, boolean includeAll) {
        MinecraftServer server = player.server;
        String item = null;
        if (key.startsWith("g:")) {
            try {
                LostItemIndex.Entry e = LostItemIndex.get(server).entry(UUID.fromString(key.substring(2)));
                if (e != null) return globalPos(e.dimension(), e.pos());
            } catch (IllegalArgumentException ignored) {
            }
        } else if (key.startsWith("c:") || key.startsWith("p:")) {
            item = key.substring(key.lastIndexOf(':') + 1);
            for (ContainerIndex.Entry e : ContainerIndex.get(server).of(player.getUUID(), true)) {
                if (!e.key().equals(key)) continue;
                if (e.holder() != null) {
                    ServerPlayer holder = server.getPlayerList().getPlayer(e.holder());
                    if (holder != null) return GlobalPos.of(holder.serverLevel().dimension(), holder.blockPosition());
                }
                return globalPos(e.dimension(), e.pos());
            }
        }
        if (!includeAll || item == null) return null;
        // Follow the item itself: the nearest place that holds it now.
        GlobalPos best = null;
        double bestDistance = Double.MAX_VALUE;
        String here = PlacedBlocks.dimension(player.serverLevel());
        for (LostItemIndex.Entry e : LostItemIndex.get(server).of(player.getUUID())) {
            if (!e.item().equals(item)) continue;
            double d = e.dimension().equals(here) ? e.pos().distSqr(player.blockPosition()) : Double.MAX_VALUE / 2;
            if (d < bestDistance) {
                bestDistance = d;
                best = globalPos(e.dimension(), e.pos());
            }
        }
        for (ContainerIndex.Entry e : ContainerIndex.get(server).of(player.getUUID(), true)) {
            if (!e.item().equals(item)) continue;
            BlockPos pos = e.pos();
            String dim = e.dimension();
            if (e.holder() != null) {
                ServerPlayer holder = server.getPlayerList().getPlayer(e.holder());
                if (holder != null) {
                    pos = holder.blockPosition();
                    dim = PlacedBlocks.dimension(holder.serverLevel());
                }
            }
            double d = dim.equals(here) ? pos.distSqr(player.blockPosition()) : Double.MAX_VALUE / 2;
            if (d < bestDistance) {
                bestDistance = d;
                best = globalPos(dim, pos);
            }
        }
        return best;
    }

    @Nullable
    private static GlobalPos globalPos(String dimension, BlockPos pos) {
        ResourceLocation id = ResourceLocation.tryParse(dimension);
        return id == null ? null : GlobalPos.of(ResourceKey.create(Registries.DIMENSION, id), pos);
    }

    private static void push(ServerPlayer player, UUID compass, @Nullable GlobalPos target) {
        if (!player.connection.hasChannel(LifestealNet.CompassTarget.TYPE)) return;
        PacketDistributor.sendToPlayer(player, target == null
                ? new LifestealNet.CompassTarget(compass, false, "", BlockPos.ZERO)
                : new LifestealNet.CompassTarget(compass, true, target.dimension().location().toString(), target.pos()));
    }

    /** Once a second: every held compass with a binding learns where its item is now. */
    @SubscribeEvent
    public static void onTick(ServerTickEvent.Post event) {
        if (!LifestealConfig.COMPASS_ENABLED.get() || event.getServer().getTickCount() % 20 != 0) return;
        for (ServerPlayer player : event.getServer().getPlayerList().getPlayers()) {
            for (InteractionHand hand : InteractionHand.values()) {
                ItemStack stack = player.getItemInHand(hand);
                if (!isCompass(stack)) continue;
                CompoundTag data = data(stack);
                String key = data.getString("target");
                if (key.isEmpty()) continue;
                UUID id = compassId(stack);
                if (id == null) continue;
                push(player, id, resolve(player, key, isSeeker(stack) && data.getBoolean("all")));
            }
        }
    }

    private CompassServer() {
    }
}
