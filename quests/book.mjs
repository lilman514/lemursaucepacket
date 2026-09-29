// The LemurSaucePacket quest book. Edit this file, then run `node quests/build.mjs`.
//
// Chapter fields: key, group, title, subtitle, icon, layout ('grid' for collections), and about / unlocks
// (the info card at the top of the chapter: what the questline is for and what finishing it lets you do).
//
// Quest fields: key (stable id, never rename once players have progress), title, subtitle, desc
// (array of lines; "" = blank line; & colour codes), after (quest keys in the same chapter),
// tasks, reward { xp, coins (in spurs: 1 bevel = 8, 1 cog = 64), items }, icon, shape, size.
// Task kinds: { item, count } { kill, count } { structure } { biome } { dimension } { advancement }
// { checkmark, title }.
//
// Rewards are mostly Numismatics coins: they feed the player economy instead of skipping progress.

const tip = (text) => `&7${text}`

// The raid captain's banner (vanilla Raid.getLeaderBannerInstance): a white banner with components.
const OMINOUS_BANNER = {
  id: 'minecraft:white_banner',
  components: {
    'minecraft:banner_patterns': [
      ['rhombus', 'cyan'],
      ['stripe_bottom', 'light_gray'],
      ['stripe_center', 'gray'],
      ['border', 'light_gray'],
      ['stripe_middle', 'black'],
      ['half_horizontal', 'light_gray'],
      ['circle', 'light_gray'],
      ['border', 'black']
    ].map(([pattern, color]) => ({ color, pattern: `minecraft:${pattern}` })),
    'minecraft:hide_additional_tooltip': {},
    'minecraft:item_name': '{"translate":"block.minecraft.ominous_banner"}'
  }
}

export default {
  title: 'LemurSaucePacket',
  icon: 'create:cogwheel',
  groups: [
    { key: 'ages', title: 'The Ages' },
    { key: 'guides', title: 'Field Guides' }
  ],
  chapters: [
    // ================================================================= THE AGES
    {
      key: 'landfall',
      group: 'ages',
      title: 'Landfall',
      subtitle: 'Find your feet in a world that has been reworked.',
      about: "Start here. Learn the server's rules, settle a base, and gather the basics every other chapter builds on.",
      unlocks: "your first backpack, a bed in a village, and the wrench that starts Create.",
      icon: 'minecraft:oak_sapling',
      quests: [
        {
          key: 'welcome',
          title: '&6Welcome to LemurSaucePacket',
          subtitle: 'Read me first',
          shape: 'gear',
          size: 2,
          icon: 'create:cogwheel',
          desc: [
            'This is a Create server that still feels like Minecraft.',
            '',
            '&eThe rules of the world:&r',
            '• &cPvP is on&r and there are no land claims. Pick your spot with care and keep valuables close.',
            '• Die and your items wait in a &egrave&r where you fell.',
            '• No waystones or teleports. You travel by &etrain, airship, horse and happy ghast&r, so the rail network matters.',
            '• The launcher keeps everyone on the same mods. Your own extras live in its Mods tab.',
            '',
            tip('Quests never lock content. They are a road map and they pay you in coins.')
          ],
          tasks: [{ checkmark: true, title: 'I have read this' }],
          reward: { xp: 10, coins: 8 }
        },
        {
          key: 'field_notes',
          title: 'Field Notes',
          after: ['welcome'],
          icon: 'minecraft:book',
          desc: [
            'Three keys that answer most questions:',
            '• &eR&r on an item: how to make it (JEI). &eU&r: what it is used for.',
            '• Hold &eW&r over a Create item: a Ponder scene shows it working.',
            '• Wear &eEngineer\'s Goggles&r to read speed and stress off machines.',
            '• &eF5&r cycles to an over-the-shoulder camera, handy for exploring and fights.',
            '',
            tip('The Mods tab in the launcher lists every mod with a short description.')
          ],
          tasks: [{ checkmark: true, title: 'Got it' }],
          reward: { xp: 5 }
        },
        {
          key: 'workbench',
          title: 'First Things First',
          after: ['welcome'],
          tasks: [{ item: 'minecraft:crafting_table' }],
          reward: { xp: 5 }
        },
        {
          key: 'stone',
          title: 'Stone Age',
          after: ['workbench'],
          tasks: [{ advancement: 'minecraft:story/upgrade_tools', title: 'Make a stone pickaxe' }],
          icon: 'minecraft:stone_pickaxe',
          reward: { coins: 4 }
        },
        {
          key: 'night',
          title: 'Survive the Night',
          after: ['workbench'],
          tasks: [{ advancement: 'minecraft:adventure/sleep_in_bed', title: 'Sleep in a bed' }],
          icon: 'minecraft:red_bed',
          reward: { coins: 4 }
        },
        {
          key: 'iron',
          title: 'Iron',
          after: ['stone'],
          tasks: [{ item: 'minecraft:iron_ingot', count: 8 }],
          reward: { coins: 8 }
        },
        {
          key: 'andesite',
          title: 'The Grey Stone',
          after: ['stone'],
          desc: ['Andesite is everywhere, and Create is built on it. Gather a stack.'],
          tasks: [{ item: 'minecraft:andesite', count: 64 }],
          reward: { coins: 8 }
        },
        {
          key: 'backpack',
          title: 'Pack Mule',
          after: ['iron'],
          desc: [
            'A leather backpack is your first real storage on the move. Wear it in the &eback slot&r (the Curios tab in your inventory) and open it with &eB&r.',
            '',
            tip('The Backpack Workshop chapter covers the upgrades.')
          ],
          tasks: [{ item: 'sophisticatedbackpacks:backpack' }],
          reward: { coins: 8 }
        },
        {
          key: 'village',
          title: 'Neighbours',
          after: ['night'],
          desc: ['Find a village. Villages here come in many new shapes, and some have taverns.'],
          tasks: [{ structure: '#minecraft:village' }],
          icon: 'minecraft:bell',
          reward: { coins: 16 }
        },
        {
          key: 'landfall_done',
          title: '&aLandfall',
          subtitle: 'On to the First Rotation',
          after: ['iron', 'andesite', 'backpack'],
          shape: 'gear',
          size: 1.5,
          desc: ['You have the basics. Everything from here turns on rotation.'],
          tasks: [{ item: 'create:wrench' }],
          reward: { commands: ['lsp cape flag {p} chapter:landfall'], xp: 25, coins: 32 }
        }
      ]
    },
    {
      key: 'first_rotation',
      group: 'ages',
      title: 'First Rotation',
      subtitle: 'The Andesite Age: power, presses and belts.',
      about: "Turn water and wind into rotational power, then use it to press sheets, wash ores and move items on belts.",
      unlocks: "automatic ore and sheet processing, moving contraptions, and infinite ore veins to mine.",
      icon: 'create:water_wheel',
      quests: [
        {
          key: 'alloy',
          title: 'Andesite Alloy',
          desc: ['Andesite plus iron nuggets (or zinc) makes the alloy almost every early machine needs.'],
          tasks: [{ item: 'create:andesite_alloy', count: 16 }],
          reward: { coins: 8 }
        },
        {
          key: 'shafts',
          title: 'Shafts and Cogs',
          after: ['alloy'],
          desc: ['Shafts carry rotation in a line; cogwheels turn corners and change speed.'],
          tasks: [
            { item: 'create:shaft', count: 16 },
            { item: 'create:cogwheel', count: 8 },
            { item: 'create:large_cogwheel', count: 2 }
          ],
          reward: { coins: 8 }
        },
        {
          key: 'water_wheel',
          title: 'Water Power',
          after: ['shafts'],
          desc: ['A water wheel next to flowing water gives steady rotation, day and night.'],
          tasks: [{ item: 'create:water_wheel' }],
          reward: { coins: 8 }
        },
        {
          key: 'windmill',
          title: 'Wind Power',
          after: ['shafts'],
          desc: ['A windmill bearing plus sails (wool, or sail blocks) glued together turns in the wind. More sails, more power.'],
          tasks: [{ item: 'create:windmill_bearing' }],
          reward: { coins: 8 }
        },
        {
          key: 'press',
          title: 'Under Pressure',
          after: ['water_wheel'],
          desc: ['A mechanical press over a depot or belt flattens ingots into sheets. Sheets are the core of the Andesite Age.'],
          tasks: [{ item: 'create:mechanical_press' }],
          reward: { coins: 16 }
        },
        {
          key: 'sheets',
          title: 'Sheet Metal',
          after: ['press'],
          tasks: [
            { item: 'create:iron_sheet', count: 16 },
            { item: 'create:copper_sheet', count: 16 }
          ],
          reward: { coins: 16 }
        },
        {
          key: 'millstone',
          title: 'Grinding',
          after: ['windmill'],
          desc: ['A millstone grinds ores and crops. Crushed ore gives extra nuggets when you wash it.'],
          tasks: [{ item: 'create:millstone' }],
          reward: { coins: 8 }
        },
        {
          key: 'fan',
          title: 'Bulk Processing',
          after: ['press'],
          desc: [
            'An encased fan blows items through whatever is in front of it:',
            '• water: &ewashing&r   • fire: &esmoking&r   • lava: &eblasting&r',
            'Point one at a belt and let the fan cook for you.'
          ],
          tasks: [{ item: 'create:encased_fan' }],
          reward: { coins: 16 }
        },
        {
          key: 'belts',
          title: 'Conveyor',
          after: ['press'],
          tasks: [
            { item: 'create:belt_connector', count: 8 },
            { item: 'create:depot', count: 2 }
          ],
          reward: { coins: 8 }
        },
        {
          key: 'goggles',
          title: 'Engineer\'s Goggles',
          after: ['sheets'],
          desc: [
            'With goggles on you can read speed and stress off any machine. Every network has a stress budget; add more wheels when it runs out.',
            '',
            tip('Cyber Goggles (optional, in the launcher\'s Mods tab) show exact numbers.')
          ],
          tasks: [{ item: 'create:goggles' }],
          reward: { coins: 8 }
        },
        {
          key: 'contraptions',
          title: 'It Moves!',
          after: ['sheets'],
          desc: ['Glue blocks to a mechanical bearing or piston and they move as one contraption. Drills and saws mine and cut as they go.'],
          tasks: [
            { item: 'create:mechanical_bearing' },
            { item: 'create:super_glue' },
            { item: 'create:mechanical_drill' }
          ],
          icon: 'create:mechanical_drill',
          reward: { coins: 24 }
        },
        {
          key: 'zinc',
          title: 'Zinc Hunt',
          after: ['sheets'],
          desc: [
            'Zinc hides in the middle and lower layers. Press &eR&r on zinc ore in JEI to see the heights it spawns at.',
            'You will need a lot of it for brass.'
          ],
          tasks: [{ item: 'create:raw_zinc', count: 16 }],
          reward: { coins: 16 }
        },
        {
          key: 'veins',
          title: 'Prospector',
          after: ['zinc'],
          desc: [
            'Deep under the world lie ore veins that never run dry. A vein finder points at the nearest one; a drilling machine on top mines it forever.',
            '',
            tip('No diamond, emerald or netherite veins: those you still dig for.')
          ],
          tasks: [{ item: 'createoreexcavation:vein_finder' }],
          reward: { coins: 24 }
        },
        {
          key: 'andesite_age',
          title: '&aThe Andesite Age',
          subtitle: 'Casing up',
          after: ['fan', 'belts', 'contraptions'],
          shape: 'gear',
          size: 1.75,
          desc: ['Andesite casing is the mark of a finished early factory.'],
          tasks: [{ item: 'create:andesite_casing', count: 32 }],
          reward: { xp: 50, coins: 64 }
        }
      ]
    },
    {
      key: 'brass_age',
      group: 'ages',
      title: 'Brass Age',
      subtitle: 'Heat, mixing and precision.',
      about: "Capture a blaze to heat your basins. Brass and precision mechanisms are the gateway to Create's smarter machines.",
      unlocks: "mechanical arms and crafters, sorting with brass tunnels, steam engines and electricity.",
      icon: 'create:brass_ingot',
      quests: [
        {
          key: 'nether',
          title: 'Through the Portal',
          desc: ['Brass needs heat, and heat means blazes. Build a portal.'],
          tasks: [{ dimension: 'minecraft:the_nether' }],
          icon: 'minecraft:obsidian',
          reward: { coins: 16 }
        },
        {
          key: 'blaze_burner',
          title: 'Captive Flame',
          after: ['nether'],
          desc: ['Right-click a blaze with an empty blaze burner to capture it. Feed it fuel to heat whatever sits on top.'],
          tasks: [{ item: 'create:blaze_burner' }],
          reward: { coins: 24 }
        },
        {
          key: 'mixer',
          title: 'Mix It Up',
          after: ['nether'],
          desc: ['A mechanical mixer above a basin combines ingredients, heated or not.'],
          tasks: [
            { item: 'create:basin' },
            { item: 'create:mechanical_mixer' }
          ],
          icon: 'create:mechanical_mixer',
          reward: { coins: 16 }
        },
        {
          key: 'brass',
          title: 'Brass',
          after: ['blaze_burner', 'mixer'],
          desc: ['Copper and zinc in a heated basin give brass.'],
          tasks: [{ item: 'create:brass_ingot', count: 16 }],
          reward: { coins: 32 }
        },
        {
          key: 'rose_quartz',
          title: 'Rose Quartz',
          after: ['mixer'],
          desc: ['Redstone mixed into quartz, then polished on a belt with sandpaper or a deployer.'],
          tasks: [{ item: 'create:polished_rose_quartz', count: 8 }],
          reward: { coins: 16 }
        },
        {
          key: 'tubes',
          title: 'Electron Tubes',
          after: ['rose_quartz'],
          tasks: [{ item: 'create:electron_tube', count: 8 }],
          reward: { coins: 16 }
        },
        {
          key: 'brass_casing',
          title: 'Brass Casing',
          after: ['brass'],
          tasks: [{ item: 'create:brass_casing', count: 16 }],
          reward: { coins: 32 }
        },
        {
          key: 'precision',
          title: 'Precision Mechanism',
          after: ['deployer'],
          desc: [
            'Made by sequenced assembly: a golden sheet goes round a loop of deployers and a press, several times.',
            tip('JEI shows every step. Long recipes have pages: scroll to flip.')
          ],
          tasks: [{ item: 'create:precision_mechanism', count: 4 }],
          reward: { coins: 64 }
        },
        {
          key: 'deployer',
          title: 'A Helping Hand',
          after: ['brass_casing', 'tubes'],
          desc: ['Deployers use items the way a player would: placing, using, applying.'],
          tasks: [{ item: 'create:deployer' }],
          reward: { coins: 16 }
        },
        {
          key: 'arm',
          title: 'Mechanical Arm',
          after: ['precision'],
          desc: ['Arms pick items up and put them down wherever you point them, even into machines.'],
          tasks: [{ item: 'create:mechanical_arm' }],
          reward: { coins: 32 }
        },
        {
          key: 'crafters',
          title: 'Mechanical Crafting',
          after: ['brass_casing'],
          desc: ['Link a grid of mechanical crafters for recipes too big for a crafting table.'],
          tasks: [{ item: 'create:mechanical_crafter', count: 9 }],
          reward: { coins: 32 }
        },
        {
          key: 'sorting',
          title: 'Smart Logistics',
          after: ['brass_casing'],
          tasks: [
            { item: 'create:smart_chute' },
            { item: 'create:brass_tunnel', count: 2 },
            { item: 'create:brass_funnel', count: 2 }
          ],
          icon: 'create:brass_tunnel',
          reward: { coins: 24 }
        },
        {
          key: 'steam',
          title: 'Full Steam',
          after: ['brass_casing'],
          desc: ['Fluid tanks over heated blaze burners, fed with water, drive steam engines: the strongest early power.'],
          tasks: [
            { item: 'create:steam_engine' },
            { item: 'create:fluid_tank', count: 4 }
          ],
          icon: 'create:steam_engine',
          reward: { coins: 48 }
        },
        {
          key: 'electricity',
          title: 'Sparks',
          after: ['brass'],
          desc: ['Crafts & Additions turns rotation into electricity and back. Handy for long distances and for charging tools.'],
          tasks: [
            { item: 'createaddition:alternator' },
            { item: 'createaddition:electric_motor' }
          ],
          icon: 'createaddition:electric_motor',
          reward: { coins: 32 }
        },
        {
          key: 'brass_age_done',
          title: '&aThe Brass Age',
          subtitle: 'Controlled speed',
          after: ['arm', 'crafters', 'steam'],
          shape: 'gear',
          size: 1.75,
          desc: ['A rotation speed controller lets one network run machines at exactly the speed you choose.'],
          tasks: [{ item: 'create:rotation_speed_controller' }],
          reward: { commands: ['lsp cape flag {p} chapter:brass_age'], xp: 100, coins: 128 }
        }
      ]
    },
    {
      key: 'banners',
      group: 'ages',
      title: 'Banners of the Overworld',
      subtitle: 'Outposts, forts and ruined factories. Salvage what you can.',
      about: "Pillagers hold the high ground and old Create ruins dot the world. Fight, explore and bring the loot home.",
      unlocks: "raid and fort loot, salvaged Create parts, and cheaper trades as Hero of the Village.",
      icon: OMINOUS_BANNER,
      quests: [
        {
          key: 'outpost',
          title: 'Outpost',
          desc: ['Pillagers hold the high ground, and their outposts now come in a style for every biome.'],
          tasks: [{ structure: '#minecraft:pillager_outpost' }],
          icon: 'minecraft:crossbow',
          reward: { coins: 24 }
        },
        {
          key: 'raiders',
          title: 'Hold the Line',
          after: ['outpost'],
          tasks: [
            { kill: 'minecraft:pillager', count: 10 },
            { kill: 'minecraft:vindicator', count: 5 }
          ],
          icon: 'minecraft:iron_axe',
          reward: { coins: 32 }
        },
        {
          key: 'hero',
          title: 'Hero of the Village',
          after: ['raiders'],
          desc: ['Defeat a raid. Villages remember who stood with them.'],
          tasks: [{ advancement: 'minecraft:adventure/hero_of_the_village' }],
          icon: 'minecraft:emerald',
          reward: { xp: 50, coins: 96 }
        },
        {
          key: 'illager_fort',
          title: 'The Illager Fort',
          after: ['outpost'],
          desc: ['Illager Invasion adds fortified camps with new illagers: basher, provoker, invoker. Bring friends.'],
          tasks: [{ structure: 'illagerinvasion:illager_fort' }],
          icon: 'minecraft:stone_bricks',
          reward: { coins: 48 }
        },
        {
          key: 'invoker',
          title: 'The Invoker',
          after: ['illager_fort'],
          tasks: [{ kill: 'illagerinvasion:invoker' }],
          icon: 'minecraft:totem_of_undying',
          reward: { xp: 100, coins: 128 }
        },
        {
          key: 'lost_station',
          title: 'The Lost Station',
          after: ['quarry'],
          desc: ['Somewhere a train station was abandoned mid-schedule. Salvage its parts.'],
          tasks: [{ structure: 'create_structures_arise:createlosttrainstation' }],
          icon: 'create:track_station',
          reward: { coins: 48 }
        },
        {
          key: 'sky_pirates',
          title: 'Sky Pirates',
          after: ['lost_station'],
          desc: ['Pillagers have learned to fly. Find one of their steam-powered airships.'],
          tasks: [{ structure: 'create_structures_arise:pillagersteampunkairship' }],
          icon: 'create:propeller',
          reward: { coins: 64 }
        },
        {
          key: 'quarry',
          title: 'Abandoned Quarry',
          after: ['rustic_windmill'],
          tasks: [{ structure: 'create_ltab:quarry' }],
          icon: 'create:mechanical_drill',
          reward: { coins: 32 }
        },
        {
          key: 'kings_castle',
          title: 'The King\'s Castle',
          after: ['sky_pirates'],
          desc: ['A castle full of Create machinery. Explore it carefully.'],
          tasks: [{ structure: 'create_ltab:kings_castle' }],
          icon: 'minecraft:golden_helmet',
          reward: { coins: 64 }
        },
        {
          key: 'rustic_windmill',
          title: 'Rustic Windmill',
          desc: ['An old working windmill. See how it was built, then build your own.'],
          tasks: [{ structure: 'create_rustic_structures:rustic_windmill' }],
          icon: 'create:windmill_bearing',
          reward: { coins: 24 }
        },
        {
          key: 'banners_done',
          title: '&aBanners of the Overworld',
          after: ['hero', 'invoker', 'kings_castle'],
          shape: 'gear',
          size: 1.5,
          desc: ['Raise your own banner over what you have taken back.'],
          tasks: [{ item: 'minecraft:white_banner' }],
          reward: { xp: 100, coins: 128 }
        }
      ]
    },
    {
      key: 'iron_roads',
      group: 'ages',
      title: 'Iron Roads',
      subtitle: 'Trains, stations and freight.',
      about: "Lay track between bases, run trains on schedules, and let parcels and stock links move your goods.",
      unlocks: "fast travel between towns, automated freight, and ordering items from anywhere on your network.",
      icon: 'create:track',
      quests: [
        {
          key: 'track',
          title: 'Lay Track',
          desc: ['Train track is laid by clicking two points; it curves and climbs on its own.'],
          tasks: [{ item: 'create:track', count: 64 }],
          reward: { coins: 32 }
        },
        {
          key: 'station',
          title: 'Station',
          after: ['track'],
          tasks: [{ item: 'create:track_station' }],
          reward: { coins: 16 }
        },
        {
          key: 'train',
          title: 'Your First Train',
          after: ['station'],
          desc: [
            'Place bogeys on the track at a station, build a carriage from railway casing, add train controls and assemble it at the station.',
            tip('Hold W over the station item for the Ponder walkthrough.')
          ],
          tasks: [
            { item: 'create:railway_casing', count: 16 },
            { item: 'create:controls' }
          ],
          icon: 'create:controls',
          reward: { coins: 48 }
        },
        {
          key: 'schedule',
          title: 'On Schedule',
          after: ['train'],
          desc: ['A schedule tells a train where to go and when. Give it to a conductor: any seated mob, or a blaze burner.'],
          tasks: [{ item: 'create:schedule' }],
          reward: { coins: 24 }
        },
        {
          key: 'signals',
          title: 'Signals',
          after: ['train'],
          desc: ['Signals split track into blocks so several trains share a line without crashing.'],
          tasks: [{ item: 'create:track_signal', count: 4 }],
          reward: { coins: 24 }
        },
        {
          key: 'navigator',
          title: 'Timetables',
          after: ['schedule'],
          desc: ['Railways Navigator adds a route planner and station clocks, like a real rail network.'],
          tasks: [
            { item: 'createrailwaysnavigator:navigator' },
            { item: 'createrailwaysnavigator:train_station_clock' }
          ],
          icon: 'createrailwaysnavigator:navigator',
          reward: { coins: 32 }
        },
        {
          key: 'boards',
          title: 'Departure Board',
          after: ['schedule'],
          tasks: [
            { item: 'create:display_board', count: 4 },
            { item: 'create:display_link' }
          ],
          icon: 'create:display_board',
          reward: { coins: 24 }
        },
        {
          key: 'packager',
          title: 'Parcels',
          after: ['station'],
          desc: ['Create packs items into parcels with a packager. Parcels can be addressed and sent anywhere a frogport or train reaches.'],
          tasks: [
            { item: 'create:packager' },
            { item: 'create:package_frogport' }
          ],
          icon: 'create:packager',
          reward: { coins: 32 }
        },
        {
          key: 'stock',
          title: 'Stock Keeping',
          after: ['packager'],
          desc: ['Stock links network your storage; a stock keeper lets you order from all of it at once.'],
          tasks: [
            { item: 'create:stock_link' },
            { item: 'create:stock_ticker' }
          ],
          icon: 'create:stock_ticker',
          reward: { coins: 48 }
        },
        {
          key: 'factory_gauge',
          title: 'Factory Gauges',
          after: ['stock'],
          desc: ['Factory gauges keep a factory topped up: set a target and it requests ingredients by itself.'],
          tasks: [
            { item: 'create:factory_gauge', count: 2 },
            { item: 'create:redstone_requester' }
          ],
          icon: 'create:factory_gauge',
          reward: { coins: 64 }
        },
        {
          key: 'connect',
          title: 'Connect Two Towns',
          after: ['signals', 'navigator'],
          shape: 'gear',
          size: 1.5,
          desc: [
            'Run a line from your base to another player\'s, with a station at each end.',
            '',
            '&cNote:&r trains can cross Nether portals, but riding through one is still buggy. Send freight across unmanned.'
          ],
          tasks: [{ checkmark: true, title: 'Our towns are connected' }],
          icon: 'create:track_station',
          reward: { commands: ['lsp cape flag {p} chapter:iron_roads'], xp: 100, coins: 192 }
        }
      ]
    },
    {
      key: 'skyward',
      group: 'ages',
      title: 'Skyward',
      subtitle: 'Create Aeronautics: balloons, propellers and airships.',
      about: "Build ships that fly. Lift, thrust and steering all come from real Create machinery.",
      unlocks: "flying bases and travel over any terrain.",
      icon: 'aeronautics:propeller_bearing',
      quests: [
        {
          key: 'propeller',
          title: 'Propeller',
          desc: ['A propeller bearing with blades attached pushes air. Mount one on anything you want to move.'],
          tasks: [
            { item: 'aeronautics:propeller_bearing' },
            { item: 'aeronautics:wooden_propeller' }
          ],
          icon: 'aeronautics:wooden_propeller',
          reward: { coins: 32 }
        },
        {
          key: 'envelope',
          title: 'Lift',
          after: ['propeller'],
          desc: ['Envelopes filled with hot air lift a ship; an adjustable burner controls how much.'],
          tasks: [
            { item: 'aeronautics:white_envelope', count: 16 },
            { item: 'aeronautics:adjustable_burner' }
          ],
          icon: 'aeronautics:white_envelope',
          reward: { coins: 48 }
        },
        {
          key: 'levitite',
          title: 'Levitite',
          after: ['envelope'],
          desc: ['Levitite floats on its own. Ships built with it need less balloon.'],
          tasks: [{ item: 'aeronautics:levitite', count: 4 }],
          reward: { coins: 48 }
        },
        {
          key: 'goggles',
          title: 'Aviator',
          after: ['propeller'],
          tasks: [{ item: 'aeronautics:aviators_goggles' }],
          reward: { coins: 16 }
        },
        {
          key: 'smart',
          title: 'Steering',
          after: ['envelope'],
          desc: ['Smart and gyroscopic propellers give you finer control over thrust and direction.'],
          tasks: [
            { item: 'aeronautics:smart_propeller' },
            { item: 'aeronautics:gyroscopic_propeller_bearing' }
          ],
          icon: 'aeronautics:smart_propeller',
          reward: { coins: 64 }
        },
        {
          key: 'maiden_voyage',
          title: '&aMaiden Voyage',
          after: ['smart', 'levitite'],
          shape: 'gear',
          size: 1.75,
          desc: ['Fly a ship you built from one of your bases to another without touching the ground.'],
          tasks: [{ checkmark: true, title: 'I flew it' }],
          icon: 'aeronautics:propeller_bearing',
          reward: { commands: ['lsp cape flag {p} chapter:skyward'], xp: 150, coins: 256 }
        }
      ]
    },
    {
      key: 'crown_of_fire',
      group: 'ages',
      title: 'Crown of Fire',
      subtitle: 'The Nether, properly.',
      about: "Brave fortresses and bastions for blaze rods, netherite and the Wither's star.",
      unlocks: "superheated blaze burners for the hardest recipes, netherite gear, and a beacon.",
      icon: 'minecraft:blaze_powder',
      quests: [
        {
          key: 'fortress',
          title: 'Fortress',
          desc: ['Nether fortresses are bigger and meaner now. Blazes live here.'],
          tasks: [{ structure: '#lemursaucepacket:fortresses' }],
          icon: 'minecraft:nether_bricks',
          reward: { coins: 32 }
        },
        {
          key: 'blaze_rods',
          title: 'Blaze Rods',
          after: ['fortress'],
          tasks: [{ item: 'minecraft:blaze_rod', count: 12 }],
          reward: { coins: 32 }
        },
        {
          key: 'wither_skeletons',
          title: 'Bone Collector',
          after: ['fortress'],
          tasks: [{ kill: 'minecraft:wither_skeleton', count: 10 }],
          icon: 'minecraft:wither_skeleton_skull',
          reward: { coins: 48 }
        },
        {
          key: 'piglins',
          title: 'The Piglin Castes',
          desc: ['Piglins now have castes: travellers wander the wastes, alchemists brew. Bartering with them is worth your gold.'],
          tasks: [{ kill: 'piglinproliferation:piglin_alchemist' }],
          icon: 'minecraft:gold_ingot',
          reward: { coins: 32 }
        },
        {
          key: 'bastion',
          title: 'Bastion',
          after: ['piglins'],
          desc: ['Piglin bastions hold gold and ancient debris. Some have been taken over by Create machinery.'],
          tasks: [{ structure: '#lemursaucepacket:bastions' }],
          icon: 'minecraft:gilded_blackstone',
          reward: { coins: 48 }
        },
        {
          key: 'superheated',
          title: 'Superheated',
          after: ['blaze_rods'],
          desc: ['Feed a blaze burner a blaze cake and it burns hot enough for the toughest recipes.'],
          tasks: [{ item: 'create:blaze_cake', count: 4 }],
          reward: { coins: 48 }
        },
        {
          key: 'netherite',
          title: 'Netherite',
          after: ['bastion'],
          tasks: [{ item: 'minecraft:netherite_ingot' }],
          reward: { xp: 100, coins: 128 }
        },
        {
          key: 'wither',
          title: '&cThe Wither',
          after: ['wither_skeletons'],
          shape: 'gear',
          size: 1.5,
          tasks: [{ kill: 'minecraft:wither' }],
          icon: 'minecraft:nether_star',
          reward: { commands: ['lsp cape flag {p} chapter:crown_of_fire'], xp: 200, coins: 256 }
        }
      ]
    },
    {
      key: 'legacy',
      group: 'ages',
      title: 'Legacy',
      subtitle: 'The End, and what you leave behind.',
      about: "Face the dragon, earn your wings, and turn enchanting into an assembly line.",
      unlocks: "elytra flight, automated enchanting, banking, and a build the whole server will remember.",
      icon: 'minecraft:dragon_egg',
      quests: [
        {
          key: 'stronghold',
          title: 'The Stronghold',
          tasks: [{ structure: 'betterstrongholds:stronghold' }],
          icon: 'minecraft:ender_eye',
          reward: { commands: ['lsp cape flag {p} chapter:legacy'], coins: 48 }
        },
        {
          key: 'the_end',
          title: 'The End',
          after: ['stronghold'],
          tasks: [{ dimension: 'minecraft:the_end' }],
          icon: 'minecraft:end_stone',
          reward: { coins: 64 }
        },
        {
          key: 'dragon',
          title: '&5The Dragon',
          after: ['the_end'],
          tasks: [{ kill: 'minecraft:ender_dragon' }],
          icon: 'minecraft:dragon_head',
          reward: { xp: 300, coins: 512 }
        },
        {
          key: 'elytra',
          title: 'Wings',
          after: ['dragon'],
          tasks: [{ item: 'minecraft:elytra' }],
          reward: { coins: 128 }
        },
        {
          key: 'enchanting',
          title: 'Enchantment Industry',
          after: ['crushing'],
          desc: ['Liquid experience, blaze enchanters and printers turn enchanting into a production line.'],
          tasks: [
            { item: 'create_enchantment_industry:blaze_enchanter' },
            { item: 'create_enchantment_industry:printer' },
            { item: 'create_enchantment_industry:experience_bucket' }
          ],
          icon: 'create_enchantment_industry:blaze_enchanter',
          reward: { coins: 96 }
        },
        {
          key: 'crushing',
          title: 'Crushing Wheels',
          desc: ['A pair of crushing wheels doubles ore output and eats almost anything.'],
          tasks: [{ item: 'create:crushing_wheel', count: 2 }],
          reward: { coins: 64 }
        },
        {
          key: 'bank',
          title: 'Bank',
          after: ['enchanting'],
          desc: ['Blaze bankers and bank terminals turn Numismatics coins into accounts. Every shop on the server can be paid by card.'],
          tasks: [
            { item: 'numismatics:bank_terminal' },
            { item: 'numismatics:blaze_banker' }
          ],
          icon: 'numismatics:blaze_banker',
          reward: { coins: 64 }
        },
        {
          key: 'legacy',
          title: '&6Legacy',
          after: ['elytra', 'bank'],
          shape: 'gear',
          size: 2,
          desc: ['Build something the whole server will still be using long after you log off: a station, a market, a monument. Then tick this.'],
          tasks: [{ checkmark: true, title: 'I built my legacy' }],
          icon: 'minecraft:beacon',
          reward: { xp: 500, coins: 1024 }
        }
      ]
    },

    // ================================================================= FIELD GUIDES
    {
      key: 'backpack_workshop',
      group: 'guides',
      title: 'Backpack Workshop',
      subtitle: 'Fair backpacks: every tier is built from its age\'s Create parts.',
      about: "Backpacks here follow your Create progress: each tier needs parts from the matching age.",
      unlocks: "more room on the move, plus pickup, magnet, feeding and restock upgrades.",
      icon: 'sophisticatedbackpacks:backpack',
      quests: [
        {
          key: 'rules',
          title: 'How Backpacks Work Here',
          desc: [
            '• Wear one backpack in the &eback slot&r. Only that one runs its upgrades; others in your inventory are plain storage.',
            '• Carry more than &e3&r and you slow down.',
            '• No backpacks inside backpacks, and none found in loot.',
            '• One stack upgrade per backpack, at most &e4x&r.',
            '• Pump, battery and mob-catcher upgrades are off: Create does those jobs.'
          ],
          tasks: [{ checkmark: true, title: 'Understood' }],
          icon: 'minecraft:leather',
          reward: { coins: 4 }
        },
        {
          key: 'leather',
          title: 'Leather Backpack',
          after: ['rules'],
          tasks: [{ item: 'sophisticatedbackpacks:backpack' }],
          reward: { coins: 8 }
        },
        {
          key: 'copper',
          title: 'Copper Backpack',
          after: ['leather'],
          desc: ['Copper sheets and andesite alloy around your backpack. Everything inside comes along.'],
          tasks: [{ item: 'sophisticatedbackpacks:copper_backpack' }],
          reward: { coins: 16 }
        },
        {
          key: 'iron',
          title: 'Iron Backpack',
          after: ['copper'],
          desc: ['Iron sheets and andesite casing.'],
          tasks: [{ item: 'sophisticatedbackpacks:iron_backpack' }],
          reward: { coins: 24 }
        },
        {
          key: 'gold',
          title: 'Gold Backpack',
          after: ['iron'],
          desc: ['Golden sheets and brass casing: this one waits for the Brass Age.'],
          tasks: [{ item: 'sophisticatedbackpacks:gold_backpack' }],
          reward: { coins: 48 }
        },
        {
          key: 'diamond',
          title: 'Diamond Backpack',
          after: ['gold'],
          desc: ['Diamonds and precision mechanisms.'],
          tasks: [{ item: 'sophisticatedbackpacks:diamond_backpack' }],
          reward: { coins: 96 }
        },
        {
          key: 'netherite',
          title: 'Netherite Backpack',
          after: ['diamond'],
          tasks: [{ item: 'sophisticatedbackpacks:netherite_backpack' }],
          reward: { coins: 128 }
        },
        {
          key: 'upgrade_base',
          title: 'Upgrade Base',
          after: ['leather'],
          tasks: [{ item: 'sophisticatedbackpacks:upgrade_base', count: 2 }],
          reward: { coins: 8 }
        },
        {
          key: 'pickup',
          title: 'Pickup and Magnet',
          after: ['upgrade_base'],
          tasks: [
            { item: 'sophisticatedbackpacks:pickup_upgrade' },
            { item: 'sophisticatedbackpacks:magnet_upgrade' }
          ],
          icon: 'sophisticatedbackpacks:magnet_upgrade',
          reward: { coins: 16 }
        },
        {
          key: 'feeding',
          title: 'Feeding and Restock',
          after: ['upgrade_base'],
          tasks: [
            { item: 'sophisticatedbackpacks:feeding_upgrade' },
            { item: 'sophisticatedbackpacks:restock_upgrade' }
          ],
          icon: 'sophisticatedbackpacks:feeding_upgrade',
          reward: { coins: 16 }
        },
        {
          key: 'stack_1',
          title: 'Stack Upgrade I',
          after: ['upgrade_base'],
          tasks: [{ item: 'sophisticatedbackpacks:stack_upgrade_tier_1' }],
          reward: { coins: 24 }
        },
        {
          key: 'stack_2',
          title: 'Stack Upgrade II',
          after: ['stack_1', 'gold'],
          desc: ['The highest stack upgrade on this server (4x). It needs brass casing.'],
          tasks: [{ item: 'sophisticatedbackpacks:stack_upgrade_tier_2' }],
          reward: { coins: 64 }
        }
      ]
    },
    {
      key: 'homestead',
      group: 'guides',
      title: 'Homestead',
      subtitle: 'Farms, kitchens and the happy ghast.',
      about: "Grow new crops, cook proper meals, breed animals and raise a happy ghast.",
      unlocks: "food that lasts far longer, automated kitchens, and a friendly flying mount.",
      icon: 'farmersdelight:cooking_pot',
      quests: [
        {
          key: 'knife',
          title: 'Kitchen Knife',
          tasks: [{ item: 'farmersdelight:flint_knife' }],
          reward: { coins: 4 }
        },
        {
          key: 'board',
          title: 'Cutting Board',
          after: ['knife'],
          tasks: [{ item: 'farmersdelight:cutting_board' }],
          reward: { coins: 8 }
        },
        {
          key: 'pot',
          title: 'Cooking Pot',
          after: ['knife'],
          desc: ['Set a cooking pot over a fire or stove. Hearty meals keep you fed far longer than bread.'],
          tasks: [{ item: 'farmersdelight:cooking_pot' }],
          reward: { coins: 16 }
        },
        {
          key: 'crops',
          title: 'New Crops',
          after: ['knife'],
          desc: ['Wild tomatoes, cabbages, onions and rice grow around the world. Replant them at home.'],
          tasks: [
            { item: 'farmersdelight:tomato' },
            { item: 'farmersdelight:cabbage' },
            { item: 'farmersdelight:onion' },
            { item: 'farmersdelight:rice' }
          ],
          icon: 'farmersdelight:tomato',
          reward: { coins: 16 }
        },
        {
          key: 'rich_soil',
          title: 'Rich Soil',
          after: ['crops'],
          tasks: [{ item: 'farmersdelight:rich_soil', count: 16 }],
          reward: { coins: 16 }
        },
        {
          key: 'automated',
          title: 'Automated Kitchen',
          after: ['pot', 'board'],
          desc: ['Slice & Dice adds a slicer and sprinklers; Central Kitchen lets Create machines run cooking pots and cutting boards.'],
          tasks: [
            { item: 'sliceanddice:slicer' },
            { item: 'sliceanddice:sprinkler' }
          ],
          icon: 'sliceanddice:slicer',
          reward: { coins: 48 }
        },
        {
          key: 'feast',
          title: 'Feast',
          after: ['pot'],
          tasks: [{ item: 'farmersdelight:shepherds_pie_block' }],
          reward: { coins: 32 }
        },
        {
          key: 'breeding',
          title: 'Herd',
          tasks: [{ advancement: 'minecraft:husbandry/breed_an_animal' }],
          icon: 'minecraft:wheat',
          reward: { coins: 8 }
        },
        {
          key: 'happy_ghast',
          title: 'Happy Ghast',
          after: ['breeding'],
          desc: [
            'A dried ghast placed in water slowly revives into a ghastling, and grows into a gentle happy ghast. Saddle it with a harness and it will carry up to four players.',
            tip('The friendliest way to fly before you have an airship.')
          ],
          tasks: [
            { item: 'minecraft:dried_ghast' },
            { item: 'minecraft:white_harness' }
          ],
          icon: 'minecraft:dried_ghast',
          reward: { coins: 64 }
        }
      ]
    },
    {
      key: 'bestiary',
      group: 'guides',
      title: 'Bestiary',
      subtitle: 'New faces, old foes.',
      about: "The world has new creatures and tougher bosses. Track down each one.",
      unlocksLabel: "Rewards",
      unlocks: "coins for every first encounter, and tips on what each creature does.",
      icon: 'minecraft:creeper_head',
      layout: 'grid',
      quests: [
        {
          key: 'creepers',
          title: 'Creepers of Every Kind',
          desc: ['Creepers now match their biome, and each variant has its own trick.'],
          tasks: [
            { kill: 'creeperoverhaul:desert_creeper' },
            { kill: 'creeperoverhaul:jungle_creeper' },
            { kill: 'creeperoverhaul:snowy_creeper' },
            { kill: 'creeperoverhaul:cave_creeper' }
          ],
          icon: 'minecraft:creeper_head',
          reward: { coins: 32 }
        },
        {
          key: 'variants',
          title: 'Undead Variants',
          desc: ['Zombies and skeletons adapt to their homes: frozen gelids, swamp murks, jungle thickets.'],
          tasks: [
            { kill: 'variantsandventures:gelid' },
            { kill: 'variantsandventures:murk' },
            { kill: 'variantsandventures:thicket' }
          ],
          icon: 'minecraft:zombie_head',
          reward: { coins: 32 }
        },
        {
          key: 'iceologer',
          title: 'The Iceologer',
          desc: ['An illager who throws ice. Look for it in the cold.'],
          tasks: [{ kill: 'friendsandfoes:iceologer' }],
          icon: 'minecraft:ice',
          reward: { coins: 32 }
        },
        {
          key: 'illusioner',
          title: 'The Illusioner',
          tasks: [{ kill: 'friendsandfoes:illusioner' }],
          icon: 'minecraft:bow',
          reward: { coins: 32 }
        },
        {
          key: 'wildfire',
          title: 'Wildfire',
          desc: ['A blaze queen shielded by a ring of fire. She lives in the Nether. Bring fire resistance.'],
          tasks: [{ kill: 'friendsandfoes:wildfire' }],
          icon: 'minecraft:fire_charge',
          reward: { xp: 100, coins: 128 }
        },
        {
          key: 'breeze',
          title: 'Breeze',
          desc: ['Found in trial chambers deep underground.'],
          tasks: [{ kill: 'minecraft:breeze', count: 2 }],
          icon: 'minecraft:wind_charge',
          reward: { coins: 32 }
        },
        {
          key: 'friends',
          title: 'Friends',
          desc: [
            'Not everything wants to fight. Meet a moobloom, a glare and a rascal, and the wildlife of the world: bears, deer, snails, butterflies.',
            tip('Glares point out dark places where mobs can spawn.')
          ],
          tasks: [{ checkmark: true, title: 'I made some friends' }],
          icon: 'minecraft:poppy',
          reward: { coins: 32 }
        },
        {
          key: 'creaking',
          title: 'The Creaking',
          desc: ['In the pale garden, something only moves when you look away. Break its heart to stop it.'],
          tasks: [{ item: 'minecraft:creaking_heart' }],
          icon: 'minecraft:creaking_heart',
          reward: { coins: 48 }
        }
      ]
    },
    {
      key: 'atlas',
      group: 'guides',
      title: 'Atlas',
      subtitle: 'A world worth crossing by rail.',
      about: "Terralith biomes and rebuilt structures are worth the trip. Visit each landmark once.",
      unlocksLabel: "Rewards",
      unlocks: "coins for exploring, and a head start on where to lay rail lines.",
      icon: 'minecraft:filled_map',
      layout: 'grid',
      quests: [
        { key: 'cherry', title: 'Cherry Grove', tasks: [{ biome: 'minecraft:cherry_grove' }], icon: 'minecraft:cherry_sapling', reward: { coins: 16 } },
        { key: 'pale', title: 'Pale Garden', tasks: [{ biome: 'minecraft:pale_garden' }], icon: 'minecraft:pale_oak_sapling', reward: { coins: 24 } },
        { key: 'moonlight', title: 'Moonlight Grove', tasks: [{ biome: 'terralith:moonlight_grove' }], icon: 'minecraft:spruce_sapling', reward: { coins: 24 } },
        { key: 'yellowstone', title: 'Yellowstone', tasks: [{ biome: 'terralith:yellowstone' }], icon: 'minecraft:yellow_terracotta', reward: { coins: 24 } },
        { key: 'volcanic', title: 'Volcanic Peaks', tasks: [{ biome: 'terralith:volcanic_peaks' }], icon: 'minecraft:basalt', reward: { coins: 24 } },
        { key: 'mirage', title: 'Mirage Isles', tasks: [{ biome: 'terralith:mirage_isles' }], icon: 'minecraft:prismarine', reward: { coins: 24 } },
        { key: 'skylands', title: 'Skylands', desc: ['Islands floating high above the clouds. Easier to reach by airship.'], tasks: [{ biome: '#lemursaucepacket:skylands' }], icon: 'minecraft:grass_block', reward: { coins: 32 } },
        { key: 'amethyst', title: 'Amethyst Canyon', tasks: [{ biome: 'terralith:amethyst_canyon' }], icon: 'minecraft:amethyst_cluster', reward: { coins: 24 } },
        { key: 'lavender', title: 'Lavender Valley', tasks: [{ biome: 'terralith:lavender_valley' }], icon: 'minecraft:lilac', reward: { coins: 16 } },
        { key: 'sakura', title: 'Sakura Valley', tasks: [{ biome: 'terralith:sakura_valley' }], icon: 'minecraft:pink_petals', reward: { coins: 16 } },
        { key: 'tavern', title: 'A Warm Tavern', desc: ['Taverns sit along the roads. Travellers trade here.'], tasks: [{ structure: '#lemursaucepacket:taverns' }], icon: 'minecraft:barrel', reward: { coins: 24 } },
        { key: 'monument', title: 'Ocean Monument', tasks: [{ structure: 'betteroceanmonuments:ocean_monument' }], icon: 'minecraft:prismarine_bricks', reward: { coins: 48 } },
        { key: 'desert_temple', title: 'Desert Temple', tasks: [{ structure: 'betterdeserttemples:desert_temple' }], icon: 'minecraft:sandstone', reward: { coins: 32 } },
        { key: 'jungle_temple', title: 'Jungle Temple', tasks: [{ structure: 'betterjungletemples:jungle_temple' }], icon: 'minecraft:mossy_cobblestone', reward: { coins: 32 } },
        { key: 'trial', title: 'Trial Chambers', tasks: [{ structure: 'minecraft:trial_chambers' }], icon: 'minecraft:trial_key', reward: { coins: 48 } }
      ]
    },
    {
      key: 'commerce',
      group: 'guides',
      title: 'Coin & Commerce',
      subtitle: 'The server economy runs on Numismatics.',
      about: "Quest rewards are Numismatics coins. Trade them with other players or open a shop of your own.",
      unlocks: "pay-to-use machines, player shops that sell while you're offline, and bank accounts.",
      icon: 'numismatics:cog',
      quests: [
        {
          key: 'coins',
          title: 'Coinage',
          desc: [
            'Quest rewards are paid in Numismatics coins:',
            '&espur&r 1 · &ebevel&r 8 · &esprocket&r 16 · &ecog&r 64 · &ecrown&r 512 · &esun&r 4096',
            'Use them to trade with other players.'
          ],
          tasks: [{ item: 'numismatics:bevel' }],
          icon: 'numismatics:cog',
          reward: { coins: 8 }
        },
        {
          key: 'depositor',
          title: 'Depositor',
          after: ['coins'],
          desc: ['A depositor takes coins before it sends a redstone pulse: pay-to-use doors, farms and rides.'],
          tasks: [{ item: 'numismatics:andesite_depositor' }],
          reward: { coins: 16 }
        },
        {
          key: 'shop',
          title: 'Open a Shop',
          after: ['depositor'],
          desc: ['Put a vendor in front of your storage, set a price, and sell to anyone who walks by, even while you are offline.'],
          tasks: [{ checkmark: true, title: 'My shop is open' }],
          icon: 'minecraft:emerald',
          reward: { coins: 64 }
        },
        {
          key: 'bank_terminal',
          title: 'Bank Account',
          after: ['coins'],
          tasks: [{ item: 'numismatics:bank_terminal' }],
          reward: { coins: 32 }
        }
      ]
    },
    {
      key: 'armory',
      group: 'guides',
      title: 'The Armory',
      subtitle: "The pack's own gear: tools that save time, weapons with real stats, armour sets with bonuses.",
      about: 'Everything here is made with Create and gated by skills. Tooltips show the stats and how to get each piece; JEI (R on an item) has the recipe and an info page with the same text.',
      unlocks: 'a tree-felling axe, a 3x3 pickaxe, an auto-smelting pickaxe, a scythe, a wand, and five armour sets.',
      icon: 'lemursaucepacket:brass_sabre',
      quests: [
        {
          key: 'rules',
          title: 'How Gear Works',
          desc: [
            '• Every piece has &estats&r in its tooltip: damage, crit chance, crit damage, defense, speed, luck.',
            '• A &efull set&r (all four pieces) adds a bonus; some pieces have a perk on their own.',
            '• A set plus one specific &dRelics&r item is a &esynergy&r: stronger than either alone.',
            '• Recipes are Create mechanical crafting and compacting. Some pieces only drop in dungeons.',
            '• Each piece needs a skill level. Item tooltips say which.'
          ],
          tasks: [{ checkmark: true, title: 'Understood' }],
          icon: 'lemursaucepacket:compacted_diamond',
          reward: { coins: 8 }
        },
        {
          key: 'lumber_axe',
          title: 'Lumber Axe',
          after: ['rules'],
          desc: ['Iron sheets, andesite alloy and a mechanical saw in the mechanical crafter. Chop one log and the whole tree comes down.', tip('Needs Woodcutting 30.')],
          tasks: [{ item: 'lemursaucepacket:lumber_axe' }],
          reward: { coins: 32, xp: 200 }
        },
        {
          key: 'prospectors_pickaxe',
          title: "Prospector's Pickaxe",
          after: ['lumber_axe'],
          desc: ['A blaze burner in the head: ores come out already smelted.', tip('Needs Mining 30.')],
          tasks: [{ item: 'lemursaucepacket:prospectors_pickaxe' }],
          reward: { coins: 32, xp: 200 }
        },
        {
          key: 'excavators_pickaxe',
          title: "Excavator's Pickaxe",
          after: ['prospectors_pickaxe'],
          desc: ['A mechanical drill and brass: mines a 3x3. Sneak to mine one block.', tip('Needs Mining 40.')],
          tasks: [{ item: 'lemursaucepacket:excavators_pickaxe' }],
          reward: { coins: 48, xp: 300 }
        },
        {
          key: 'harvesters_scythe',
          title: "Harvester's Scythe",
          after: ['lumber_axe'],
          desc: ['A mechanical harvester on a handle. Right-click a ripe crop: a 5x5 is harvested and replanted.', tip('Needs Farming 30.')],
          tasks: [{ item: 'lemursaucepacket:harvesters_scythe' }],
          reward: { coins: 32, xp: 200 }
        },
        {
          key: 'builders_wand',
          title: "Builder's Wand",
          after: ['harvesters_scythe'],
          desc: ['Brass, a precision mechanism and a schematicannon. Right-click a block face to extend it with matching blocks from your inventory, up to 32 at a time.', tip('Needs Crafting 30.')],
          tasks: [{ item: 'lemursaucepacket:builders_wand' }],
          reward: { coins: 64, xp: 300 }
        },
        {
          key: 'brass_sabre',
          title: 'Brass Sabre',
          after: ['rules'],
          desc: ['Fast, with +10% crit chance. Brass ingots and a sturdy sheet.', tip('Needs Attack 25.')],
          tasks: [{ item: 'lemursaucepacket:brass_sabre' }],
          reward: { coins: 32, xp: 200 }
        },
        {
          key: 'sturdy_warhammer',
          title: 'Sturdy Warhammer',
          after: ['brass_sabre'],
          desc: ['Slow and heavy, and it sends things flying. Sturdy sheets and a precision mechanism.', tip('Needs Attack 45.')],
          tasks: [{ item: 'lemursaucepacket:sturdy_warhammer' }],
          reward: { coins: 64, xp: 400 }
        },
        {
          key: 'stormcallers_sabre',
          title: "Stormcaller's Sabre",
          after: ['sturdy_warhammer'],
          desc: ['No recipe. It waits in pillager outposts and Dungeons Arise chests; one hit in ten shocks the target.', tip('Needs Attack 50.')],
          tasks: [{ item: 'lemursaucepacket:stormcallers_sabre' }],
          reward: { coins: 128, xp: 600 }
        },
        {
          key: 'anglers_cap',
          title: "Angler's Cap",
          after: ['rules'],
          desc: ['Leather and a fishing rod. +2 Luck: better catches, better loot.', tip('Needs Fishing 25.')],
          tasks: [{ item: 'lemursaucepacket:anglers_cap' }],
          reward: { coins: 24, xp: 150 }
        },
        {
          key: 'prospector_set',
          title: "Prospector's Set",
          after: ['anglers_cap'],
          desc: ['Brass casings, andesite alloy and a lantern. The lamp alone gives Night Vision underground; the full set gives Haste and a chance of double ore drops.', tip('Needs Mining 35. With the Clot of Time relic: Haste II.')],
          tasks: [
            { item: 'lemursaucepacket:prospector_helmet' },
            { item: 'lemursaucepacket:prospector_chestplate' },
            { item: 'lemursaucepacket:prospector_leggings' },
            { item: 'lemursaucepacket:prospector_boots' }
          ],
          reward: { coins: 96, xp: 500 }
        },
        {
          key: 'aeronaut_set',
          title: "Aeronaut's Set",
          after: ['prospector_set'],
          desc: ['Leather, sturdy sheets and propeller bearings. The boots alone cancel fall damage; the full set makes you faster, lets you step up whole blocks and swim faster.', tip('Needs Agility 40. With the Kinetic Belt relic: faster still.')],
          tasks: [
            { item: 'lemursaucepacket:aeronaut_helmet' },
            { item: 'lemursaucepacket:aeronaut_chestplate' },
            { item: 'lemursaucepacket:aeronaut_leggings' },
            { item: 'lemursaucepacket:aeronaut_boots' }
          ],
          reward: { coins: 96, xp: 500 }
        },
        {
          key: 'duelist_set',
          title: 'Brass Duelist Set',
          after: ['aeronaut_set'],
          desc: ["Brass sheets, precision mechanisms and a Duelist's Pattern per piece. Patterns only drop in Dungeons Arise, stronghold and ancient city chests. Every piece adds crit chance; the full set adds crit damage.", tip('Needs Attack 40. With the Ring of the Seven Deadly Sins relic: more crit damage.')],
          tasks: [
            { item: 'lemursaucepacket:duelist_helmet' },
            { item: 'lemursaucepacket:duelist_chestplate' },
            { item: 'lemursaucepacket:duelist_leggings' },
            { item: 'lemursaucepacket:duelist_boots' }
          ],
          reward: { coins: 160, xp: 800 }
        },
        {
          key: 'compacted_diamond',
          title: 'Compacted Diamond',
          after: ['rules'],
          desc: ['Four diamonds in a basin under a mechanical press.'],
          tasks: [{ item: 'lemursaucepacket:compacted_diamond', count: 4 }],
          reward: { coins: 48, xp: 200 }
        },
        {
          key: 'compacted_diamond_set',
          title: 'Compacted Diamond Set',
          after: ['compacted_diamond'],
          desc: ['Compacted diamond, sturdy sheets and precision mechanisms. Bulwark: the full set takes 10% less damage from everything.', tip('Needs Defence 45.')],
          tasks: [
            { item: 'lemursaucepacket:compacted_diamond_helmet' },
            { item: 'lemursaucepacket:compacted_diamond_chestplate' },
            { item: 'lemursaucepacket:compacted_diamond_leggings' },
            { item: 'lemursaucepacket:compacted_diamond_boots' }
          ],
          reward: { coins: 160, xp: 800 }
        },
        {
          key: 'compacted_netherite_set',
          title: '&aCompacted Netherite Set',
          after: ['compacted_diamond_set'],
          shape: 'gear',
          size: 1.75,
          desc: ['Four netherite ingots compacted under a heated press, then smithed over compacted diamond. +4 hearts and Bulwark. The last armour you will need.', tip('Needs Defence 60.')],
          tasks: [
            { item: 'lemursaucepacket:compacted_netherite_helmet' },
            { item: 'lemursaucepacket:compacted_netherite_chestplate' },
            { item: 'lemursaucepacket:compacted_netherite_leggings' },
            { item: 'lemursaucepacket:compacted_netherite_boots' }
          ],
          reward: { commands: ['lsp cape flag {p} chapter:armory'], coins: 512, xp: 2000 }
        },
        {
          key: 'ember_crown',
          title: 'Ember Crown',
          after: ['compacted_diamond'],
          desc: ['No recipe: Nether fortress and bastion chests. Fire Resistance while worn, and +1 damage.', tip('Needs Defence 40.')],
          tasks: [{ item: 'lemursaucepacket:ember_crown' }],
          reward: { coins: 128, xp: 600 }
        }
      ]
    }
  ]
}
