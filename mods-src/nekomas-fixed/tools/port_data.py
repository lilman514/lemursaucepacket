#!/usr/bin/env python3
"""Builds the mod's assets and data (src/main/resources/assets and data) for batch 1 of the port.

* Textures, models and blockstates are copied from upstream Nekoma's Fixed: its Fabric 1.21.1 branch
  (origin/1.21.1, already in 1.21.1 format), and the kiln's from main (the branch has no kiln). Only what the
  ported blocks and items reference is copied, so nothing of unported features ships.
* Recipes, loot tables, tags, recipe advancements and the English lang are written here from the lists below, in
  vanilla 1.21.1 format. Other languages are upstream main's, filtered to our keys.

The lists must match what the Java registers (registry/ModBlocks.java, ModItems.java); tools/check_jar.py checks the
built jar against the same lists.

Usage, from mods-src/nekomas-fixed:
    python tools/port_data.py [path to a git clone of github.com/GreenJAB/nekomas-fixed]
The clone defaults to ../../research/.local/nekomas-fixed/source. The script deletes and rewrites
src/main/resources/assets and src/main/resources/data.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
RESOURCES = PROJECT / 'src' / 'main' / 'resources'
NS = 'nekomasfixed'
BRANCH = 'origin/1.21.1'
MAIN = 'origin/main'

# ----------------------------------------------------------------------------------------------- what batch 1 has

VANILLA_COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
                   'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
NEW_COLOURS = ['amber', 'aqua', 'indigo', 'maroon']
ALL_COLOURS = VANILLA_COLOURS + NEW_COLOURS
FROGLIGHTS = ['clear', 'cloudy', 'cascading', 'cloudburst', 'chamoisee', 'sanguine', 'vermilion', 'mandarin', 'lemon',
              'kiwi', 'seafoam', 'teal', 'cerulean', 'navy', 'lavender', 'thulian', 'sakura']
FAMILY_KINDS = ['wool', 'carpet', 'terracotta', 'glazed_terracotta', 'concrete', 'concrete_powder', 'stained_glass',
                'stained_glass_pane', 'candle', 'candle_cake', 'bed', 'shulker_box']
BRICK_KINDS = ['bricks', 'brick_slab', 'brick_stairs', 'brick_wall']

FAMILY_BLOCKS = [f'{c}_{k}' for c in NEW_COLOURS for k in FAMILY_KINDS]
BRICK_BLOCKS = [f'{c}_{k}' for c in ALL_COLOURS for k in BRICK_KINDS]
FROGLIGHT_BLOCKS = [f'{f}_froglight' for f in FROGLIGHTS]
OTHER_BLOCKS = ['glow_torch', 'glow_wall_torch', 'clock', 'wall_clock', 'kiln']
BLOCKS = FAMILY_BLOCKS + BRICK_BLOCKS + FROGLIGHT_BLOCKS + OTHER_BLOCKS

DYES = [f'{c}_dye' for c in NEW_COLOURS]
# Blocks without an item: candle cakes (a candle on a cake), the wall torch, and the clocks (the vanilla clock places them).
BLOCKS_WITHOUT_ITEMS = {f'{c}_candle_cake' for c in NEW_COLOURS} | {'glow_wall_torch', 'clock', 'wall_clock'}
ITEMS = DYES + [b for b in BLOCKS if b not in BLOCKS_WITHOUT_ITEMS] + ['redstone_striker']

# Blocks whose loot table is another block's (Properties.dropsLike in ModBlocks).
DROPS_LIKE = {'glow_wall_torch': 'glow_torch', 'wall_clock': 'clock'}


def mc(name):
    return 'minecraft:' + name


def ours(name):
    return f'{NS}:{name}'


def dye(colour):
    return ours(colour + '_dye') if colour in NEW_COLOURS else mc(colour + '_dye')


def title(snake):
    return ' '.join(word.capitalize() for word in snake.split('_'))


# ----------------------------------------------------------------------------------------------- upstream access

class Upstream:
    """Reads files of the upstream clone straight from git, so no checkout or export is needed."""

    def __init__(self, clone):
        self.clone = clone
        self.files = {ref: set(self.git('ls-tree', '-r', '--name-only', ref).decode().splitlines()) for ref in (BRANCH, MAIN)}

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.clone), *args], check=True, capture_output=True).stdout

    def find(self, ref, rel):
        """The repo path of a resource (assets/... or data/...) on a branch: hand-written or datagen output."""
        for root in ('src/main/resources/', 'src/main/generated/'):
            if root + rel in self.files[ref]:
                return root + rel
        return None

    def read(self, ref, rel):
        path = self.find(ref, rel)
        if path is None:
            raise FileNotFoundError(f'{rel} is not on {ref}')
        return self.git('show', f'{ref}:{path}')

    def json(self, ref, rel):
        return json.loads(self.read(ref, rel).decode('utf-8'), strict=False)


# ----------------------------------------------------------------------------------------------- output

written = {}


def write_bytes(rel, data):
    if rel in written:
        raise RuntimeError(f'{rel} written twice')
    path = RESOURCES / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    written[rel] = True


def write_json(rel, obj):
    write_bytes(rel, (json.dumps(obj, indent=2, ensure_ascii=False) + '\n').encode('utf-8'))


# ----------------------------------------------------------------------------------------------- assets

def copy_assets(up):
    """Blockstates, models and textures the ported blocks and items use, followed through model parents."""
    models, textures = set(), set()

    def source(rel):
        for ref in (BRANCH, MAIN):
            if up.find(ref, rel):
                return ref
        raise FileNotFoundError(rel)

    def note_model(model_id):
        namespace, path = model_id.split(':') if ':' in model_id else ('minecraft', model_id)
        if namespace == NS:
            models.add(path)

    def walk_blockstate(state):
        for variant in state.get('variants', {}).values():
            for v in (variant if isinstance(variant, list) else [variant]):
                note_model(v['model'])
        for part in state.get('multipart', []):
            apply = part['apply']
            for v in (apply if isinstance(apply, list) else [apply]):
                note_model(v['model'])

    for block in BLOCKS:
        if block.endswith('_candle_cake'):
            continue  # written by candle_cake_assets()
        if block in ('clock', 'wall_clock'):
            state = up.json(BRANCH, f'assets/minecraft/blockstates/{block}.json')  # upstream puts the clock in minecraft:
        else:
            rel = f'assets/{NS}/blockstates/{block}.json'
            state = up.json(source(rel), rel)
        write_json(f'assets/{NS}/blockstates/{block}.json', state)
        walk_blockstate(state)

    for item in ITEMS:
        if item == 'kiln':
            write_json(f'assets/{NS}/models/item/kiln.json', {'parent': ours('block/kiln')})
            models.add('block/kiln')
            continue
        models.add(f'item/{item}')

    done = set()
    while models - done:
        path = sorted(models - done)[0]
        done.add(path)
        rel = f'assets/{NS}/models/{path}.json'
        model = up.json(source(rel), rel)
        if 'parent' in model:
            note_model(model['parent'])
        for texture in model.get('textures', {}).values():
            if not texture.startswith('#'):
                namespace, tpath = texture.split(':') if ':' in texture else ('minecraft', texture)
                if namespace == NS:
                    textures.add(tpath)
        write_json(rel, patch_render_type(path, model))

    # Textures the block entity renderers and screens use directly.
    for colour in NEW_COLOURS:
        textures.add(f'entity/bed/{colour}')
        textures.add(f'entity/shulker/shulker_{colour}')
    textures.add('gui/container/kiln')

    for tpath in sorted(textures):
        rel = f'assets/{NS}/textures/{tpath}.png'
        ref = source(rel)
        write_bytes(rel, up.read(ref, rel))
        if up.find(ref, rel + '.mcmeta'):
            write_bytes(rel + '.mcmeta', up.read(ref, rel + '.mcmeta'))

    write_bytes(f'assets/{NS}/icon.png', up.read(BRANCH, f'assets/{NS}/icon.png'))


def patch_render_type(path, model):
    """Fabric sets render layers in code (BlockRenderLayerMap); NeoForge reads them from the model."""
    name = path.split('/', 1)[1]
    if any(name.startswith(f'{c}_stained_glass') for c in NEW_COLOURS):
        return {'render_type': 'minecraft:translucent', **model}  # the glass and pane blocks, and their items
    if path.startswith('block/') and 'glow' in name and 'torch' in name:
        return {'render_type': 'minecraft:cutout', **model}
    return model


def candle_cake_assets():
    """New: upstream has no candle cakes for its candles (putting one on a cake crashed). Vanilla's models, our candle."""
    for colour in NEW_COLOURS:
        name = f'{colour}_candle_cake'
        write_json(f'assets/{NS}/blockstates/{name}.json', {'variants': {
            'lit=false': {'model': ours(f'block/{name}')},
            'lit=true': {'model': ours(f'block/{name}_lit')}}})
        for suffix, candle in (('', f'{colour}_candle'), ('_lit', f'{colour}_candle_lit')):
            write_json(f'assets/{NS}/models/block/{name}{suffix}.json', {
                'parent': mc('block/template_cake_with_candle'),
                'textures': {
                    'bottom': mc('block/cake_bottom'),
                    'candle': ours(f'block/{candle}'),
                    'particle': mc('block/cake_side'),
                    'side': mc('block/cake_side'),
                    'top': mc('block/cake_top')}})


# ----------------------------------------------------------------------------------------------- lang

def english_names(up):
    branch = up.json(BRANCH, f'assets/{NS}/lang/en_us.json')
    names = {}
    for block in BLOCKS:
        key = f'block.{NS}.{block}'
        names[key] = branch.get(key, title(block))
    for item in DYES + ['redstone_striker']:
        key = f'item.{NS}.{item}'
        names[key] = branch[key]
    for colour in NEW_COLOURS:
        names[f'block.{NS}.{colour}_candle_cake'] = f'Cake with {title(colour)} Candle'
    # Create Deco already has "Blue Bricks" and "Red Bricks"; ours say what they are.
    for colour in ALL_COLOURS:
        for kind in BRICK_KINDS:
            names[f'block.{NS}.{colour}_{kind}'] = 'Dyed ' + title(f'{colour}_{kind}')
    names[f'block.{NS}.glow_wall_torch'] = names[f'block.{NS}.glow_torch']
    names[f'block.{NS}.clock'] = 'Clock'
    names[f'block.{NS}.wall_clock'] = 'Clock'
    names[f'block.{NS}.kiln'] = 'Kiln'
    names.update({
        f'container.{NS}.kiln': 'Kiln',
        f'itemGroup.{NS}': "Nekoma's Fixed",
        f'component.{NS}.storedtime': 'Recorded Time: %s',
        f'block.{NS}.clock.alarm': 'Alarm in %s',
    })
    for key in ('advancements.husbandry.ancient_dyes.title', 'advancements.husbandry.ancient_dyes.description',
                'advancements.husbandry.all_froglights.title', 'advancements.husbandry.all_froglights.description'):
        names[key] = branch[key]
    return names


def read_lang(text):
    """A lang file; upstream's es_es.json has a broken line (a baobab name), so fall back to reading line by line."""
    try:
        return json.loads(text, strict=False)
    except json.JSONDecodeError:
        entries = (re.match(r'^\s*"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$', line) for line in text.splitlines())
        return {m.group(1): json.loads(f'"{m.group(2)}"') for m in entries if m}


def write_lang(up, english):
    write_json(f'assets/{NS}/lang/en_us.json', dict(sorted(english.items())))
    # Upstream main's translations, for the keys we have. (Its brick names lack our "Dyed" prefix; only English clashes.)
    for path in sorted(up.files[MAIN]):
        prefix = f'src/main/resources/assets/{NS}/lang/'
        if not path.startswith(prefix) or path.endswith('en_us.json') or not path.endswith('.json'):
            continue
        lang = {k: v for k, v in read_lang(up.git('show', f'{MAIN}:{path}').decode('utf-8')).items() if k in english}
        if lang:
            write_json(f'assets/{NS}/lang/{path[len(prefix):]}', dict(sorted(lang.items())))


# ----------------------------------------------------------------------------------------------- recipes

recipes = {}  # id -> (folder, unlock ingredient, recipe json)


def ingredient(ref):
    return {'tag': ref[1:]} if ref.startswith('#') else {'item': ref}


def add_recipe(name, folder, unlock, recipe):
    if name in recipes:
        raise RuntimeError(f'recipe {name} twice')
    recipes[name] = (folder, unlock, recipe)


def shaped(name, folder, unlock, category, group, pattern, key, result, count=1):
    recipe = {'type': mc('crafting_shaped'), 'category': category}
    if group:
        recipe['group'] = group
    recipe['key'] = {k: ingredient(v) for k, v in key.items()}
    recipe['pattern'] = pattern
    recipe['result'] = {'count': count, 'id': result}
    add_recipe(name, folder, unlock, recipe)


def shapeless(name, folder, unlock, category, group, ingredients, result, count=1, type_=mc('crafting_shapeless')):
    recipe = {'type': type_, 'category': category}
    if group:
        recipe['group'] = group
    recipe['ingredients'] = [[ingredient(i) for i in ing] if isinstance(ing, list) else ingredient(ing) for ing in ingredients]
    recipe['result'] = {'count': count, 'id': result}
    add_recipe(name, folder, unlock, recipe)


def cooking(name, folder, type_, category, input_, result, xp, time, conditions=None):
    recipe = {}
    if conditions:
        recipe['neoforge:conditions'] = conditions
    recipe.update({'type': type_, 'category': category, 'cookingtime': time, 'experience': xp,
                   'ingredient': ingredient(input_), 'result': {'id': result}})
    add_recipe(name, folder, input_, recipe)


def stonecutting(name, input_, result, count):
    add_recipe(name, 'building_blocks', input_, {'type': mc('stonecutting'), 'ingredient': ingredient(input_),
                                                 'result': {'count': count, 'id': result}})


def dye_recipes():
    # Upstream: 1 torchflower -> 2 maroon, 1 pitcher plant -> 2 indigo, with vanilla's torchflower -> orange and
    # pitcher plant -> cyan recipes switched off. Batch 1 leaves vanilla's recipes alone, and a single flower would
    # match both, so ours take two flowers for four dyes (the same rate). See README.
    shapeless('maroon_dye', 'misc', mc('torchflower'), 'misc', 'maroon_dye', [mc('torchflower'), mc('torchflower')], ours('maroon_dye'), 4)
    shapeless('indigo_dye', 'misc', mc('pitcher_plant'), 'misc', 'indigo_dye', [mc('pitcher_plant'), mc('pitcher_plant')], ours('indigo_dye'), 4)
    shapeless('amber_dye', 'misc', ours('maroon_dye'), 'misc', 'amber_dye', [ours('maroon_dye'), mc('white_dye')], ours('amber_dye'), 2)
    shapeless('aqua_dye', 'misc', ours('indigo_dye'), 'misc', 'aqua_dye', [ours('indigo_dye'), mc('white_dye')], ours('aqua_dye'), 2)


def kind_ids(kind, except_colour):
    """Every wool (carpet, bed...) but one colour's: the vanilla 16 and our 4."""
    return [mc(f'{c}_{kind}') for c in VANILLA_COLOURS] + [ours(f'{c}_{kind}') for c in NEW_COLOURS if c != except_colour]


def family_recipes():
    for c in NEW_COLOURS:
        d = dye(c)
        o = lambda kind: ours(f'{c}_{kind}')
        shapeless(f'dye_{c}_wool', 'building_blocks', d, 'building', 'wool', [d, kind_ids('wool', c)], o('wool'))
        shaped(f'{c}_carpet', 'decorations', o('wool'), 'misc', 'carpet', ['##'], {'#': o('wool')}, o('carpet'), 3)
        shapeless(f'dye_{c}_carpet', 'decorations', d, 'building', 'carpet', [d, kind_ids('carpet', c)], o('carpet'))
        shaped(f'{c}_bed', 'decorations', o('wool'), 'misc', 'bed', ['###', 'XXX'], {'#': o('wool'), 'X': '#minecraft:planks'}, o('bed'))
        shapeless(f'dye_{c}_bed', 'decorations', d, 'building', 'bed', [d, kind_ids('bed', c)], o('bed'))
        shaped(f'{c}_terracotta', 'building_blocks', mc('terracotta'), 'building', 'stained_terracotta',
               ['###', '#X#', '###'], {'#': mc('terracotta'), 'X': d}, o('terracotta'), 8)
        cooking(f'{c}_glazed_terracotta', 'decorations', mc('smelting'), 'blocks', o('terracotta'), o('glazed_terracotta'), 0.1, 200)
        cooking(f'{c}_glazed_terracotta_from_kilning', 'decorations', ours('kilning'), 'blocks', o('terracotta'), o('glazed_terracotta'), kiln_xp(o('glazed_terracotta')), 100)
        shapeless(f'{c}_concrete_powder', 'building_blocks', d, 'building', 'concrete_powder',
                  [d] + [mc('sand')] * 4 + [mc('gravel')] * 4, o('concrete_powder'), 8)
        shaped(f'{c}_stained_glass', 'building_blocks', mc('glass'), 'building', 'stained_glass',
               ['###', '#X#', '###'], {'#': mc('glass'), 'X': d}, o('stained_glass'), 8)
        shaped(f'{c}_stained_glass_pane', 'decorations', o('stained_glass'), 'misc', 'stained_glass_pane',
               ['###', '###'], {'#': o('stained_glass')}, o('stained_glass_pane'), 16)
        shaped(f'{c}_stained_glass_pane_from_glass_pane', 'decorations', mc('glass_pane'), 'misc', 'stained_glass_pane',
               ['###', '#$#', '###'], {'#': mc('glass_pane'), '$': d}, o('stained_glass_pane'), 8)
        shapeless(f'{c}_candle', 'decorations', mc('candle'), 'misc', 'dyed_candle', [mc('candle'), d], o('candle'))
        # Keeps the box's contents and name (upstream's plain recipe emptied it): the box comes first.
        boxes = [mc('shulker_box')] + kind_ids('shulker_box', c)
        shapeless(f'{c}_shulker_box', 'decorations', d, 'misc', 'shulker_box_dye', [boxes, d], o('shulker_box'),
                  type_=ours('crafting_shapeless_transmute'))

    # New: back from the new colours to the vanilla ones (vanilla's own dyeing recipes don't know our blocks).
    # Shulker boxes need nothing: vanilla's box dyeing takes any box.
    for v in VANILLA_COLOURS:
        for kind, folder in (('wool', 'building_blocks'), ('carpet', 'decorations'), ('bed', 'decorations')):
            shapeless(f'dye_{v}_{kind}', folder, mc(f'{v}_dye'), 'building', kind,
                      [mc(f'{v}_dye'), [ours(f'{c}_{kind}') for c in NEW_COLOURS]], mc(f'{v}_{kind}'))


def brick_recipes():
    for c in ALL_COLOURS:
        d = dye(c)
        o = lambda kind: ours(f'{c}_{kind}')
        shaped(f'{c}_bricks_dyed', 'building_blocks', d, 'building', 'dyed_bricks', ['###', '#D#', '###'],
               {'#': mc('bricks'), 'D': d}, o('bricks'), 8)
        shaped(f'{c}_brick_slab', 'building_blocks', o('bricks'), 'building', 'dyed_brick_slab', ['###'], {'#': o('bricks')}, o('brick_slab'), 6)
        shaped(f'{c}_brick_slab_dyed', 'building_blocks', d, 'building', 'dyed_brick_slab', ['###', '#D#', '###'],
               {'#': mc('brick_slab'), 'D': d}, o('brick_slab'), 8)
        shaped(f'{c}_brick_stairs', 'building_blocks', o('bricks'), 'building', 'dyed_brick_stairs', ['#  ', '## ', '###'],
               {'#': o('bricks')}, o('brick_stairs'), 4)
        shaped(f'{c}_brick_stairs_dyed', 'building_blocks', d, 'building', 'dyed_brick_stairs', ['###', '#D#', '###'],
               {'#': mc('brick_stairs'), 'D': d}, o('brick_stairs'), 8)
        shaped(f'{c}_brick_wall', 'decorations', o('bricks'), 'misc', 'dyed_brick_wall', ['###', '###'], {'#': o('bricks')}, o('brick_wall'), 6)
        shaped(f'{c}_brick_wall_dyed', 'decorations', d, 'misc', 'dyed_brick_wall', ['###', '#D#', '###'],
               {'#': mc('brick_wall'), 'D': d}, o('brick_wall'), 8)
        stonecutting(f'{c}_brick_slab_from_{c}_bricks_stonecutting', o('bricks'), o('brick_slab'), 2)
        stonecutting(f'{c}_brick_stairs_from_{c}_bricks_stonecutting', o('bricks'), o('brick_stairs'), 1)
        stonecutting(f'{c}_brick_wall_from_{c}_bricks_stonecutting', o('bricks'), o('brick_wall'), 1)


def froglight_recipes(up):
    # Upstream's: any of the 20 froglights plus a dye makes another (the only way to get the new ones).
    froglight_ids = [ours(f'{f}_froglight') for f in FROGLIGHTS] + [mc(f'{v}_froglight') for v in ('ochre', 'verdant', 'pearlescent')]
    for f in FROGLIGHTS + ['ochre', 'verdant', 'pearlescent']:
        recipe = up.json(BRANCH, f'data/{NS}/recipe/dye_{f}_froglight.json')
        inputs = {i['item'] for i in recipe['ingredients'][0]}
        result = recipe['result']['id']
        assert inputs == set(froglight_ids) - {result}, f
        add_recipe(f'dye_{f}_froglight', 'misc', recipe['ingredients'][1]['item'], recipe)


def tool_recipes():
    shaped('glow_torch', 'misc', mc('glow_ink_sac'), 'misc', None, ['X', '#'], {'#': mc('stick'), 'X': mc('glow_ink_sac')}, ours('glow_torch'), 4)
    shaped('redstone_striker', 'redstone', mc('redstone'), 'equipment', None, ['RG', 'FR'],
           {'F': mc('flint'), 'G': mc('gold_ingot'), 'R': mc('redstone')}, ours('redstone_striker'))
    shaped('kiln', 'decorations', mc('furnace'), 'misc', None, ['###', '#D#', 'CCC'],
           {'#': mc('mud_bricks'), 'D': mc('furnace'), 'C': mc('terracotta')}, ours('kiln'))


# Vanilla's smelting XP for what the kiln makes (1.21.1's recipe files). Upstream pays 0.4 for every kiln smelt, four
# times the furnace's for most, which made a cobblestone generator feeding a kiln an XP farm: the kiln is faster, not
# richer. Anything not listed (glazed terracotta, cracked bricks, smooth stone...) gets the furnace's usual 0.1.
VANILLA_KILN_XP = {'minecraft:brick': 0.3, 'minecraft:terracotta': 0.35, 'minecraft:sponge': 0.15}


def kiln_xp(result):
    return VANILLA_KILN_XP.get(result, 0.1)


def kiln_recipes(up):
    """Main's 39 kiln recipes (26.x format there): the glazed terracotta of our colours is in family_recipes()."""
    for path in sorted(up.files[MAIN]):
        prefix = f'src/main/resources/data/{NS}/recipe/'
        if not path.startswith(prefix) or not path.endswith('_from_kilning.json'):
            continue
        name = path[len(prefix):-5]
        if any(name == f'{c}_glazed_terracotta_from_kilning' for c in NEW_COLOURS):
            continue
        recipe = json.loads(up.git('show', f'{MAIN}:{path}').decode('utf-8'))
        input_, result = recipe['ingredient'], recipe['result']['id']
        conditions = None
        if 'resin' in input_ or 'resin' in result:
            # Resin is 1.21.4 content; in this pack Vanilla Backport adds it under minecraft:. Skip the recipe without it.
            conditions = [{'type': 'neoforge:item_exists', 'item': input_}, {'type': 'neoforge:item_exists', 'item': result}]
        folder = 'building_blocks' if recipe['category'] == 'blocks' else 'misc'
        cooking(name, folder, ours('kilning'), recipe['category'], input_, result, kiln_xp(result), recipe['cookingtime'], conditions)


def write_recipes():
    for name, (folder, unlock, recipe) in sorted(recipes.items()):
        write_json(f'data/{NS}/recipe/{name}.json', recipe)
        advancement = {}
        if 'neoforge:conditions' in recipe:
            advancement['neoforge:conditions'] = recipe['neoforge:conditions']
        criterion = 'has_' + unlock.split(':')[1].lstrip('#')
        advancement.update({
            'parent': mc('recipes/root'),
            'criteria': {
                criterion: {'conditions': {'items': [{'items': unlock}]}, 'trigger': mc('inventory_changed')},
                'has_the_recipe': {'conditions': {'recipe': ours(name)}, 'trigger': mc('recipe_unlocked')}},
            'requirements': [['has_the_recipe', criterion]],
            'rewards': {'recipes': [ours(name)]}})
        write_json(f'data/{NS}/advancement/recipes/{folder}/{name}.json', advancement)


# ----------------------------------------------------------------------------------------------- loot tables

def loot(block, pool):
    write_json(f'data/{NS}/loot_table/blocks/{block}.json',
               {'type': mc('block'), 'pools': [pool], 'random_sequence': ours(f'blocks/{block}')})


SURVIVES = [{'condition': mc('survives_explosion')}]
SILK_TOUCH = [{'condition': mc('match_tool'), 'predicate': {'predicates': {'minecraft:enchantments': [
    {'enchantments': mc('silk_touch'), 'levels': {'min': 1}}]}}}]


def drops_itself(block, conditions=SURVIVES, functions=None):
    entry = {'type': mc('item'), 'name': ours(block)}
    if functions:
        entry['functions'] = functions
    pool = {'bonus_rolls': 0.0, 'entries': [entry], 'rolls': 1.0}
    if conditions:
        pool = {'bonus_rolls': 0.0, 'conditions': conditions, 'entries': [entry], 'rolls': 1.0}
    loot(block, pool)


def state_is(block, prop, value):
    return {'block': ours(block), 'condition': mc('block_state_property'), 'properties': {prop: value}}


def write_loot_tables():
    for block in BLOCKS:
        if block in DROPS_LIKE:
            continue
        if block.endswith('_stained_glass') or block.endswith('_stained_glass_pane'):
            drops_itself(block, SILK_TOUCH)
        elif block.endswith('_candle'):
            counts = [{'add': False, 'conditions': [state_is(block, 'candles', str(n))], 'count': float(n), 'function': mc('set_count')}
                      for n in (2, 3, 4)]
            drops_itself(block, None, counts + [{'function': mc('explosion_decay')}])
        elif block.endswith('_candle_cake'):
            candle = block[:-len('_cake')]
            loot(block, {'bonus_rolls': 0.0, 'entries': [{'type': mc('item'), 'name': ours(candle)}], 'rolls': 1.0})
        elif block.endswith('_bed'):
            loot(block, {'bonus_rolls': 0.0, 'conditions': SURVIVES,
                         'entries': [{'type': mc('item'), 'conditions': [state_is(block, 'part', 'head')], 'name': ours(block)}], 'rolls': 1.0})
        elif block.endswith('_shulker_box'):
            drops_itself(block, None, [{'function': mc('copy_components'), 'source': 'block_entity',
                                        'include': [mc('custom_name'), mc('container'), mc('lock'), mc('container_loot')]}])
        elif block.endswith('_slab'):
            drops_itself(block, None, [{'add': False, 'conditions': [state_is(block, 'type', 'double')], 'count': 2.0,
                                        'function': mc('set_count')}, {'function': mc('explosion_decay')}])
        elif block == 'kiln':
            drops_itself(block, SURVIVES, [{'function': mc('copy_components'), 'source': 'block_entity', 'include': [mc('custom_name')]}])
        elif block == 'clock':
            # The vanilla clock, with the time it recorded (and its glint and name).
            loot(block, {'bonus_rolls': 0.0, 'conditions': SURVIVES, 'entries': [{
                'type': mc('item'), 'name': mc('clock'), 'functions': [{
                    'function': mc('copy_components'), 'source': 'block_entity',
                    'include': [ours('stored_time'), mc('enchantment_glint_override'), mc('custom_name')]}]}], 'rolls': 1.0})
        else:
            drops_itself(block)


# ----------------------------------------------------------------------------------------------- tags

def write_tag(rel, values):
    write_json(rel, {'values': values})


def write_tags():
    def of(kind, colours=NEW_COLOURS):
        return [ours(f'{c}_{kind}') for c in colours]

    block_tags = {
        'mineable/pickaxe': of('terracotta') + of('glazed_terracotta') + of('concrete')
                            + of('bricks', ALL_COLOURS) + of('brick_slab', ALL_COLOURS) + of('brick_stairs', ALL_COLOURS) + [ours('kiln')],
        'wool': of('wool'), 'wool_carpets': of('carpet'), 'terracotta': of('terracotta'), 'concrete_powder': of('concrete_powder'),
        'candles': of('candle'), 'candle_cakes': of('candle_cake'), 'beds': of('bed'), 'shulker_boxes': of('shulker_box'),
        'impermeable': of('stained_glass'), 'walls': of('brick_wall', ALL_COLOURS), 'slabs': of('brick_slab', ALL_COLOURS),
        'stairs': of('brick_stairs', ALL_COLOURS), 'wall_post_override': [ours('glow_torch'), ours('glow_wall_torch')],
    }
    item_tags = {
        'wool': of('wool'), 'wool_carpets': of('carpet'), 'terracotta': of('terracotta'), 'candles': of('candle'),
        'beds': of('bed'), 'walls': of('brick_wall', ALL_COLOURS), 'slabs': of('brick_slab', ALL_COLOURS),
        'stairs': of('brick_stairs', ALL_COLOURS), 'enchantable/durability': [ours('redstone_striker')],
    }
    for name, values in block_tags.items():
        write_tag(f'data/minecraft/tags/block/{name}.json', values)
    for name, values in item_tags.items():
        write_tag(f'data/minecraft/tags/item/{name}.json', values)

    # NeoForge's common tags, for other mods' recipes. Not #c:dyes: see ModItems.DYES.
    common_blocks = {'glass_blocks/cheap': of('stained_glass'), 'glass_panes': of('stained_glass_pane'),
                     'concretes': of('concrete'), 'glazed_terracottas': of('glazed_terracotta')}
    common_items = dict(common_blocks, **{'concrete_powders': of('concrete_powder'), 'shulker_boxes': of('shulker_box')})
    common_items.update({f'dyes/{c}': [ours(f'{c}_dye')] for c in NEW_COLOURS})
    for name, values in common_blocks.items():
        write_tag(f'data/c/tags/block/{name}.json', values)
    for name, values in common_items.items():
        write_tag(f'data/c/tags/item/{name}.json', values)

    # Upstream's own groups (its dyed brushes, a later batch, paint them).
    froglights = [ours(f'{f}_froglight') for f in FROGLIGHTS] + [mc(f'{v}_froglight') for v in ('ochre', 'verdant', 'pearlescent')]
    own = {'froglights': froglights, 'bricks': of('bricks', ALL_COLOURS), 'brick_slabs': of('brick_slab', ALL_COLOURS),
           'brick_stairs': of('brick_stairs', ALL_COLOURS), 'brick_walls': of('brick_wall', ALL_COLOURS),
           'glazed_terracottas': of('glazed_terracotta')}
    for name, values in own.items():
        write_tag(f'data/{NS}/tags/block/{name}.json', values)
        write_tag(f'data/{NS}/tags/item/{name}.json', values)


def write_challenge_advancements(up):
    for name in ('ancient_dyes', 'all_froglights'):
        write_json(f'data/{NS}/advancement/husbandry/{name}.json', up.json(BRANCH, f'data/{NS}/advancement/husbandry/{name}.json'))


# ----------------------------------------------------------------------------------------------- main

def main():
    clone = Path(sys.argv[1]) if len(sys.argv) > 1 else PROJECT.parent.parent / 'research' / '.local' / 'nekomas-fixed' / 'source'
    up = Upstream(clone)
    for top in ('assets', 'data'):
        shutil.rmtree(RESOURCES / top, ignore_errors=True)

    copy_assets(up)
    candle_cake_assets()
    english = english_names(up)
    write_lang(up, english)

    dye_recipes()
    family_recipes()
    brick_recipes()
    froglight_recipes(up)
    tool_recipes()
    kiln_recipes(up)
    write_recipes()
    write_loot_tables()
    write_tags()
    write_challenge_advancements(up)

    print(f'{len(BLOCKS)} blocks, {len(ITEMS)} items, {len(recipes)} recipes; wrote {len(written)} files under {RESOURCES}')


if __name__ == '__main__':
    main()
