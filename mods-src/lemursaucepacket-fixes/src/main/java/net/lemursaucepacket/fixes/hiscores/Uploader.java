package net.lemursaucepacket.fixes.hiscores;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import net.minecraft.server.MinecraftServer;
import net.neoforged.fml.loading.FMLPaths;

/**
 * Sends the records that changed to the website (play.limas.ca's hiscores-ingest function, which keeps them in its
 * Neon database). Each upload is signed with this server's own Ed25519 key, made once by /lsp hiscores keygen and kept
 * in config/lemursaucepacket/hiscores-private.key, never in the pack: the website holds only the public half, so there's
 * no shared secret to leak. Without the key nothing is sent (a test server, say).
 */
final class Uploader {
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private static Path dir() {
        return FMLPaths.CONFIGDIR.get().resolve("lemursaucepacket");
    }

    static Path privateKey() {
        return dir().resolve("hiscores-private.key");
    }

    static Path publicKey() {
        return dir().resolve("hiscores-public.key");
    }

    static boolean configured(HiscoresConfig cfg) {
        return !cfg.uploadUrl.isEmpty() && Files.isRegularFile(privateKey());
    }

    /** Makes this server's key pair; returns the public key (base64 X.509), for the website's list of servers. */
    static String keygen() throws Exception {
        KeyPair pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        Files.createDirectories(dir());
        Files.writeString(privateKey(), Base64.getEncoder().encodeToString(pair.getPrivate().getEncoded()));
        String pub = Base64.getEncoder().encodeToString(pair.getPublic().getEncoded());
        Files.writeString(publicKey(), pub);
        return pub;
    }

    static String publicKeyText() {
        try {
            return Files.isRegularFile(publicKey()) ? Files.readString(publicKey()).trim() : "";
        } catch (Exception ex) {
            return "";
        }
    }

    /**
     * Uploads the pending records (or every record), with the totals the page shows collections out of. Done off the
     * server thread; what was sent is cleared from pending back on it. The future completes with the HTTP status (or -1).
     */
    static CompletableFuture<Integer> upload(MinecraftServer server, HiscoresConfig cfg, HiscoresStore store, JsonObject totals, boolean all) {
        java.util.Map<UUID, JsonObject> sent = new java.util.HashMap<>();
        JsonArray players = new JsonArray();
        for (HiscoresStore.Entry e : store.all()) {
            if (!all && !store.pending.contains(e.uuid)) continue;
            if (e.record == null || !e.record.has("skills")) continue;
            players.add(e.record);
            sent.put(e.uuid, e.record);
        }
        if (sent.isEmpty()) return CompletableFuture.completedFuture(0);
        long time = System.currentTimeMillis();
        JsonObject body = new JsonObject();
        body.addProperty("server", "LemurSaucePacket");
        body.addProperty("time", time);
        body.add("totals", totals);
        body.add("players", players);
        String text = body.toString();
        String signature;
        try {
            PrivateKey key = KeyFactory.getInstance("Ed25519").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(Files.readString(privateKey()).trim())));
            Signature sig = Signature.getInstance("Ed25519");
            sig.initSign(key);
            sig.update((time + "\n" + text).getBytes(StandardCharsets.UTF_8));
            signature = Base64.getEncoder().encodeToString(sig.sign());
        } catch (Exception ex) {
            HiscoresModule.LOGGER.error("Couldn't sign the hiscores upload", ex);
            return CompletableFuture.completedFuture(-1);
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(cfg.uploadUrl))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("X-Hiscores-Time", Long.toString(time))
                .header("X-Hiscores-Signature", signature)
                .POST(HttpRequest.BodyPublishers.ofString(text, StandardCharsets.UTF_8))
                .build();
        return HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString()).handle((res, err) -> {
            if (err != null) {
                HiscoresModule.LOGGER.warn("Hiscores upload failed: {}", err.toString());
                return -1;
            }
            if (res.statusCode() / 100 == 2) {
                // Only what's unchanged since: a record made while this was on its way goes next time.
                server.execute(() -> sent.forEach((uuid, record) -> {
                    HiscoresStore.Entry e = store.find(uuid);
                    if (e != null && e.record == record) store.pending.remove(uuid);
                }));
                HiscoresModule.LOGGER.info("Uploaded {} hiscores record(s)", sent.size());
            } else {
                HiscoresModule.LOGGER.warn("Hiscores upload refused: HTTP {} {}", res.statusCode(), res.body().length() > 200 ? res.body().substring(0, 200) : res.body());
            }
            return res.statusCode();
        });
    }

    private Uploader() {
    }
}
