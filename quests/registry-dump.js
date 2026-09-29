// Registry dump for quest validation. Not part of the pack.
// Copy into a test server's kubejs/server_scripts/, start the server once, then copy the written
// kubejs/registry-dump.json to quests/.registry.json. quests/build.mjs validates against it
// (exact registry contents) and falls back to the jar scan in quests/.id-index.json.

ServerEvents.loaded((event) => {
  const Registries = Java.loadClass('net.minecraft.core.registries.Registries')
  const access = event.server.registryAccess()
  const ids = (key) => {
    const out = []
    access.registryOrThrow(key).keySet().forEach((id) => out.push(String(id)))
    return out.sort()
  }
  const tags = (key) => {
    const out = []
    access.registryOrThrow(key).getTagNames().forEach((tag) => out.push('#' + String(tag.location())))
    return out.sort()
  }
  const advancements = []
  event.server.getAdvancements().getAllAdvancements().forEach((holder) => advancements.push(String(holder.id())))
  const recipes = []
  event.server.getRecipeManager().getRecipes().forEach((holder) => recipes.push(String(holder.id())))

  JsonIO.write('kubejs/registry-dump.json', {
    item: ids(Registries.ITEM),
    entity: ids(Registries.ENTITY_TYPE),
    biome: ids(Registries.BIOME),
    biomeTag: tags(Registries.BIOME),
    structure: ids(Registries.STRUCTURE),
    structureTag: tags(Registries.STRUCTURE),
    dimension: ids(Registries.LEVEL_STEM),
    advancement: advancements.sort(),
    recipe: recipes.sort()
  })
  console.info('Registry dump written to kubejs/registry-dump.json')
})
