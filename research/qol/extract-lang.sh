#!/bin/bash
# Extract assets/<modid>/lang/en_us.json from every jar (and nested jarjar jars) into qol/lang/<jar>/<modid>.json
SP="/c/Users/Shawn/AppData/Local/Temp/claude/C--Create-Modpack/ab1859ba-46fb-401e-9816-544fdbbd5524/scratchpad"
OUT="$SP/qol/lang"
TMP="$SP/qol/tmpjar"
mkdir -p "$OUT" "$TMP"
extract_one() {
  local jar="$1" name="$2"
  mkdir -p "$OUT/$name"
  unzip -Z1 "$jar" 2>/dev/null | grep -E '^assets/[^/]+/lang/en_us\.json$' | while read -r p; do
    mid=$(echo "$p" | cut -d/ -f2)
    unzip -p "$jar" "$p" > "$OUT/$name/$mid.json"
  done
  # also mods.toml for mod ids/descriptions
  unzip -p "$jar" META-INF/neoforge.mods.toml > "$OUT/$name/_mods.toml" 2>/dev/null || true
  unzip -Z1 "$jar" 2>/dev/null | grep -E '^META-INF/jarjar/.*\.jar$' | while read -r nj; do
    local base=$(basename "$nj" .jar)
    unzip -p "$jar" "$nj" > "$TMP/$base.jar"
    extract_one "$TMP/$base.jar" "$name/$base"
  done
}
for dir in "$SP/headless/instance/mods" "$SP/server-test/mods"; do
  for jar in "$dir"/*.jar; do
    name=$(basename "$jar" .jar)
    [ -d "$OUT/$name" ] && continue
    extract_one "$jar" "$name"
  done
done
rm -rf "$TMP"
find "$OUT" -name '*.json' | wc -l
