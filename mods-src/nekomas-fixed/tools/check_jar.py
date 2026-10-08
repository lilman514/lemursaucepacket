#!/usr/bin/env python3
"""Checks the built jar: every id its data and assets point at exists.

* data: recipe results and ingredients, loot entries and block conditions, tag entries, advancement items, recipe
  unlocks and copied components must be ids we register (the lists in port_data.py, which mirror the Java) or vanilla
  ids (checked against the vanilla resources jar when it is around, see VANILLA_JAR).
* assets: every block has a blockstate and a name, every item a model and a name, and every model, parent and
  texture of ours that is referenced is in the jar.

Usage, from mods-src/nekomas-fixed: python tools/check_jar.py [jar]   (default: the newest build/libs/*.jar)
"""
import json
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import port_data as spec  # noqa: E402

PROJECT = Path(__file__).resolve().parent.parent
NS = spec.NS
VANILLA_JAR = PROJECT.parent / 'lemursaucepacket-fixes' / 'build' / 'moddev' / 'artifacts' / 'neoforge-21.1.252-client-extra-aka-minecraft-resources.jar'
COMPONENTS = {f'{NS}:stored_time'}
SERIALIZERS = {f'{NS}:kilning', f'{NS}:crafting_shapeless_transmute'}
# Vanilla Backport's items, only used behind a neoforge:item_exists condition.
GUARDED = {'minecraft:resin_clump', 'minecraft:resin_brick'}

problems = []


def problem(where, what):
    problems.append(f'{where}: {what}')


def main():
    jar_path = Path(sys.argv[1]) if len(sys.argv) > 1 else max((PROJECT / 'build' / 'libs').glob('*.jar'), key=lambda p: p.stat().st_mtime)
    jar = zipfile.ZipFile(jar_path)
    names = set(jar.namelist())
    blocks = {f'{NS}:{b}' for b in spec.BLOCKS}
    items = {f'{NS}:{i}' for i in spec.ITEMS}
    names = {n for n in names if not n.endswith('/')}  # skip directory entries
    recipes = {f'{NS}:' + n[len(f'data/{NS}/recipe/'):-5] for n in names if n.startswith(f'data/{NS}/recipe/')}
    our_tags = {kind: {f'#{NS}:' + n[len(f'data/{NS}/tags/{kind}/'):-5] for n in names if n.startswith(f'data/{NS}/tags/{kind}/')}
                for kind in ('block', 'item')}

    vanilla_items, vanilla_blocks, vanilla_files = None, None, None
    if VANILLA_JAR.exists():
        vanilla = zipfile.ZipFile(VANILLA_JAR).namelist()
        vanilla_files = set(vanilla)
        vanilla_items = {'minecraft:' + n[len('assets/minecraft/models/item/'):-5] for n in vanilla if n.startswith('assets/minecraft/models/item/')}
        vanilla_blocks = {'minecraft:' + n[len('assets/minecraft/blockstates/'):-5] for n in vanilla if n.startswith('assets/minecraft/blockstates/')}

    def check_item(where, ref):
        if ref.startswith('#'):
            return
        if ref.startswith(f'{NS}:'):
            if ref not in items:
                problem(where, f'unknown item {ref}')
        elif vanilla_items is not None and ref not in vanilla_items and ref not in GUARDED:
            problem(where, f'unknown vanilla item {ref}')

    def check_block(where, ref):
        if ref.startswith(f'{NS}:') and ref not in blocks:
            problem(where, f'unknown block {ref}')
        elif ref.startswith('minecraft:') and vanilla_blocks is not None and ref not in vanilla_blocks:
            problem(where, f'unknown vanilla block {ref}')

    def walk(obj, visit, key=None):
        if isinstance(obj, dict):
            for k, v in obj.items():
                walk(v, visit, k)
        elif isinstance(obj, list):
            for v in obj:
                walk(v, visit, key)
        elif isinstance(obj, str):
            visit(key, obj)

    for name in sorted(n for n in names if n.startswith('data/') and n.endswith('.json')):
        data = json.loads(jar.read(name))
        guarded = 'neoforge:conditions' in data
        if '/recipe/' in name:
            if data['type'].startswith(f'{NS}:') and data['type'] not in SERIALIZERS:
                problem(name, f'unknown recipe type {data["type"]}')
            walk(data, lambda k, v: check_item(name, v) if k in ('item', 'id') and not guarded else None)
        elif '/loot_table/' in name:
            def visit(k, v):
                if k == 'name':
                    check_item(name, v)
                elif k == 'block':
                    check_block(name, v)
                elif k == 'include' and v.startswith(f'{NS}:') and v not in COMPONENTS:
                    problem(name, f'unknown component {v}')
            walk(data, visit)
            block = f'{NS}:' + name.split('/blocks/')[1][:-5]
            if block not in blocks:
                problem(name, 'loot table for a block we do not register')
        elif '/tags/' in name:
            kind = 'block' if '/tags/block/' in name else 'item'
            for value in data['values']:
                ref = value if isinstance(value, str) else value['id']
                if ref.startswith(f'#{NS}:') and ref not in our_tags[kind]:
                    problem(name, f'unknown tag {ref}')
                elif not ref.startswith('#'):
                    (check_block if kind == 'block' else check_item)(name, ref)
        elif '/advancement/' in name:
            def visit(k, v):
                if k == 'items' and not guarded:
                    check_item(name, v)
                elif k in ('recipe', 'recipes') and v not in recipes:
                    problem(name, f'unknown recipe {v}')
            walk(data, visit)

    # Assets.
    lang = json.loads(jar.read(f'assets/{NS}/lang/en_us.json'))
    for block in spec.BLOCKS:
        if f'assets/{NS}/blockstates/{block}.json' not in names:
            problem(block, 'no blockstate')
        if f'block.{NS}.{block}' not in lang:
            problem(block, 'no English name')
        if block not in spec.DROPS_LIKE and f'data/{NS}/loot_table/blocks/{block}.json' not in names:
            problem(block, 'no loot table')
    for item in spec.ITEMS:
        if f'assets/{NS}/models/item/{item}.json' not in names:
            problem(item, 'no item model')
        if f'item.{NS}.{item}' not in lang and f'block.{NS}.{item}' not in lang:
            problem(item, 'no English name')

    def our_path(ref, folder, ext):
        """Where a model or texture id lives: in our jar, or (for minecraft: ids) in the vanilla resources jar."""
        namespace, path = ref.split(':') if ':' in ref else ('minecraft', ref)
        if namespace == NS:
            return f'assets/{NS}/{folder}/{path}{ext}'
        if namespace == 'minecraft' and vanilla_files is not None and not ref.startswith('builtin/'):
            vanilla_path = f'assets/minecraft/{folder}/{path}{ext}'
            return None if vanilla_path in vanilla_files else vanilla_path
        return None

    for name in sorted(n for n in names if n.startswith(f'assets/{NS}/') and n.endswith('.json') and '/lang/' not in n):
        data = json.loads(jar.read(name))
        if '/blockstates/' in name:
            def visit(k, v):
                path = our_path(v, 'models', '.json') if k == 'model' else None
                if path and path not in names:
                    problem(name, f'missing model {v}')
            walk(data, visit)
        elif '/models/' in name:
            parent = data.get('parent')
            if parent and our_path(parent, 'models', '.json') and our_path(parent, 'models', '.json') not in names:
                problem(name, f'missing parent {parent}')
            for texture in data.get('textures', {}).values():
                path = None if texture.startswith('#') else our_path(texture, 'textures', '.png')
                if path and path not in names:
                    problem(name, f'missing texture {texture}')
    for colour in spec.NEW_COLOURS:
        for texture in (f'entity/bed/{colour}', f'entity/shulker/shulker_{colour}'):
            if f'assets/{NS}/textures/{texture}.png' not in names:
                problem('renderers', f'missing texture {texture}')

    # Every namespaced id anywhere in the data, for the summary.
    referenced = set()
    for name in names:
        if name.startswith('data/') and name.endswith('.json'):
            referenced |= set(re.findall(rf'"#?{NS}:[a-z0-9_/.]+"', jar.read(name).decode('utf-8')))
    print(f'{jar_path.name}: {len(names)} entries, {len(blocks)} blocks, {len(items)} items, {len(recipes)} recipes, '
          f'{len(referenced)} distinct {NS}: ids referenced from data'
          + ('' if vanilla_items is not None else ' (vanilla ids not checked: no vanilla resources jar)'))
    for p in problems:
        print('PROBLEM', p)
    print('OK' if not problems else f'{len(problems)} problems')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
