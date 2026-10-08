---
description: >-
  Signals without wires, sensors that read chests and belts, timers that run for an hour, live screens, and what each
  machine does with a signal: Create's redstone and what the other mods add.
icon: tower-broadcast
---

# Redstone, wired and wireless

Create turns redstone into a control system. Signals travel without wires, sensors read what's in a chest or on a belt, timers run for up to an hour, and screens show live numbers. Ponder (hold **W** over the item) shows how each part works, and its *Logic Components* category lists Create's. This page is the map: what exists, what it's for, and what Ponder doesn't spell out. The machines themselves are in [Create know-how](create-tips.md).

{% hint style="warning" %}
**Redstone needs Mining 20.** Redstone dust counts as a Hardness II material, like gold. Until your Mining is 20 you can carry it, keep it in a chest and lay it as wire, but a crafting grid or a machine won't take it, so repeaters, comparators, pistons and anything else made with it wait until then (or come from a friend). See [Hardness](enchanting.md#hardness-what-your-pickaxe-can-break).
{% endhint %}

- **Read a signal by looking at it.** Jade shows the power level of redstone you look at, a repeater's delay and a comparator's mode.
- **Rebuild fast.** Sneak + right-click with a Create wrench picks up dust, torches, repeaters, comparators, levers, buttons, pressure plates, observers, pistons, lamps and targets straight into your inventory.

## Wireless signals

- **Redstone Links.** A link's two item slots set its frequency: links holding the same pair of items talk to each other. Sneak + right-click a link (or right-click it with a wrench) to switch it between sending and receiving. A receiver gives out the same strength its sender gets, up to 256 blocks away, so analog signals travel too.
- **Frequencies aren't private.** Anyone who puts the same two items in a link can work your receivers. Pick an unusual pair.
- **Linked Transmitter** (Create: Connected). Craft a redstone link on its own to get one, and back. Right-click a lever, button or analog lever with it and that switch sends wirelessly, up to 128 blocks. Wax it with honeycomb so it can't be changed by accident (an axe makes it editable again); a wrench takes it off.
- **Redstone Link Wildcard** (Create: Connected). Put in a frequency slot, it matches any item there.
- **Linked Controller.** A remote for six keys: your forward, back, left, right, jump and sneak keys. Hold it and right-click a receiving link, then press one of those keys to bind it to the link's frequency. Right-click to switch the controller on: the keys now send signals instead of moving you; right-click again to stop. Sneak + right-click opens its settings. Right-click a lectern with it to use it there hands-free (sneak + right-click the lectern takes it back).
- **Linked Typewriter** (Create Simulated). The same for any key on your keyboard: hold it, right-click a receiving link, then press a key. Right-click the placed typewriter to take control. Its bindings survive breaking it, and right-clicking it with a linked controller copies that controller's keys.
- **Receivers that measure** (Create Simulated). A Modulating Linked Receiver's strength follows how far away its sender is, between a minimum and a maximum range you set; a Directional Linked Receiver's follows the angle between where it faces and the sender.

## Sensing things

- **Smart Observer.** It sees more than a vanilla observer: it gives a signal while the container or tank in front holds anything (or only what its filter allows), while the block in front matches its filter, and while items pass along a belt, chute or pipe it faces. It pulses each time an item goes in or out through a funnel.
- **Threshold Switch.** Put it on a container, tank, item vault or rope pulley. In its screen, set *Power on when... at or above* and *Power off when... at or below*: the signal holds until the lower level is reached, so it keeps a buffer topped up without flickering on and off. A filter makes it count one item only, and it can invert its signal.
- **Comparators read Create's blocks:** item vaults, basins, depots, weighted ejectors, toolboxes, fluid tanks, spouts, item drains, backtanks (their air), blaze burners (their heat), speedometers and stressometers, sequenced gearshifts (which step they're on), train stations (while a train is in), red train signals, docked portable storage interfaces, packagers, frogports, postboxes, redstone requesters and controller rails.
- **Speedometer and stressometer.** A comparator next to one gives a signal in step with the speed, or with how loaded the network is: switch heavy machines off before it overstresses.
- **Redstone Contacts** facing each other give a signal, even when one of them rides a contraption: the piston, gantry, cart or lift has arrived.
- **Train Observer.** Right-click a track with it, then place it nearby: it pulses when a train passes the marker, and its filter can make it react only to certain cargo.
- **Placard as a key.** Right-click a placard with the same item it already holds and it gives a short pulse: a door that opens only for the right item.
- **Waystone alarm.** An observer facing a waystone pulses whenever someone activates it for the first time. Wire it to a bell to hear when someone finds your hidden waystone.
- **Create Simulated's sensors.** An Optical Sensor's beam gives a signal by how far away the first block is (its filter can limit it to some blocks). A Laser Pointer's beam powers a Laser Sensor until something gets in the way. Altitude, Gimbal and Velocity Sensors give a signal by height, tilt and speed, and a Navigation Table points its signal towards a compass's or map's target. They're made for airships, but they work on the ground too.

## Machines on a signal

- **A signal stops these:** funnels, smart chutes, mechanical arms, deployers, weighted ejectors, gantry carriages (the shaft's rotation passes to the carriage instead), portable storage interfaces (the fixed one won't dock), Create: Connected's inventory access ports and inventory bridges, and display links (they stop updating).
- **One cycle per pulse.** Arms and deployers finish the move they started before they stop, so a short pulse *off* makes them do exactly one.
- **A pulse starts these:** a packager packs its inventory into a package; a redstone requester sends its order; a mechanical crafter grid makes a recipe that doesn't fill every crafter; a sequenced gearshift or pulse generator runs its program; the vanilla Crafter crafts one item.
- **Gears on a signal.** A clutch disconnects while powered and a gearshift reverses; Create: Connected's inverted clutch and inverted gearshift do the opposite. An adjustable chain gearshift doubles the speed it sends along its chain, and an analog signal sets anything between 1x and 2x. Create Simulated's directional gearshift drives forward with one side powered, in reverse with the other, and not at all with both; its analog transmission sets a gear ratio by the signal's strength.
- **Emergency stop.** Create: Connected's Brake, when powered, loads its network until the whole thing stalls. Its recipe takes obsidian, so making one needs Mining 30. An overstress clutch lets go by itself when its network overstresses; reset it with a wrench.
- **Moving builds.** A powered cart assembler mounts its build on a passing minecart, and an unpowered one takes passing cart contraptions apart. A sticker, toggled by each signal, holds the block in front so it moves with a contraption, or lets it go. Contraption controls that are powered when the contraption is put together start the machines they control switched off. A pulse at an elevator contact calls the cabin, and each contact gives a signal while the cabin is at its floor.
- **Tesla coil** (Crafts & Additions). While powered it zaps every player and mob within 3 blocks, once a second.
- **Steam whistle.** On a heated tank it sounds while powered. Use another whistle on it to lower its note; a wrench switches its octave.
- **Desk bell.** Right-click it for a ding and a short pulse: a doorbell.
- **Rose quartz lamps** light on a signal and stay lit. In a group of them, lighting one turns the others off, and a comparator reads how far away the lit one is: a selector. A wrench toggles one by hand.
- **Controller rail.** A one-way powered rail whose push follows the signal's strength.

## Timers and memory

| Part | What it does |
|---|---|
| Pulse Repeater | One short pulse, a set time after its input comes on (up to an hour) |
| Pulse Extender | Makes a signal last longer: its output stays on for the set time (up to an hour) |
| Pulse Timer | Pulses over and over at the set interval. Powering its input pauses and resets it; right-click its base to invert it (on except during each pulse) |
| Powered Latch | A lever that redstone works: a signal at its back turns it on, one at a side turns it off. Right-click toggles it |
| Powered Toggle Latch | Each signal at its back flips it on or off. Right-click toggles it |
| Analog Lever | Right-click raises its output by one (0 to 15), sneak + right-click lowers it |
| Throttle Lever (Create Simulated) | Click and drag to set any strength from 0 to 15; a wrench inverts it |
| Sequenced Gearshift | Turns its shaft by a program (turn an angle, move a piston a set distance, wait, wait for a pulse; Create: Connected adds sustain, timed turns and loops). A signal starts it, and a comparator reads which step it's on |
| Sequenced Pulse Generator (Create: Connected) | The same for signals: output for a time, output until the input reaches a level, transform the input, loop. A signal at its back starts it, one at a side stops and resets it; a comparator reads its progress |
| Redstone Accumulator (Create Simulated) | Stores a strength: a signal at its back raises it, at its sides lowers it, at the rate on its panel (steps of up to an hour). For counters and long timers |
| Redstone Inductor (Create Simulated) | Its output slides towards its input at the rate on its panel: smooth ramps and delays |
| Copper bulb (vanilla) | Each pulse switches it on or off; a comparator reads 15 while it's lit |
| Copper button (Friends&Foes) | Two copper ingots, one on the other. Its pulse lasts 10 ticks, and shortens to 7, 4 and 1 as it weathers; wax it with honeycomb to keep it as it is |

## Screens and displays

- **Display Link.** Right-click the screen with the link first (a display board, nixie tubes, a sign or a lectern), then place the link on the block to read from, up to 64 blocks away. Open it to pick what it sends: item and fluid counts or lists, how full something is, items per second, minute or hour, rotation speed, network stress, a boiler's status, the time of day, a stopwatch, train arrivals and schedules, a passing train's name, an elevator's floor, factory gauges, redstone power, scoreboards and player deaths. Ponder's *Sources for Display Links* lists every block it can read. A redstone signal pauses its updates.
- **Display Board.** A sign that grows as you place more beside it. It needs rotation, at least 30 RPM. Right-click a line with a written clipboard for text, or with dye to colour it; an empty hand clears it.
- **Nixie Tubes** show the strength of the signal they get as digits. A written clipboard gives them text, and dye a colour. On a train signal they make its lights easier to see.
- **Departure boards.** A display link reading a train station (*Train Station Summary*) onto a display board lists what's coming.
- **Dashboard** (Create: Connected). A four-line mini display: whoever sits in front of it sees its text on their HUD (a wrench turns that off).
- **Instruments.** Display links also read Create Simulated's sensors, Aeronautics' balloons (lift and volume) and propellers (thrust and airflow), and the charge of a kinetic battery or an accumulator.

## Trains and logistics

- **Stations** give a comparator signal while a train is in.
- **Train signals** turn red on a redstone signal, and a red signal gives a comparator output.
- **Schedules** can wait for *Station Powered*, or for a *Redstone Link* channel to switch on or off.
- **Stock links** stop sharing their inventory at full power; a weaker signal lowers their priority, so other links act first.
- **Factory gauges** can power a redstone link while stock is at or above their target, and a receiving link can pause a gauge.
- **Re-packager.** Powered, it wraps the parts of an order back into one package once they've all arrived.

## Other mods and vanilla

| Mod | Part | What it does |
|---|---|---|
| Minecraft | Crafter | Crafts one item per pulse; click a slot to lock it; a hopper feeds it. Here it works at its operator's skill levels, like Create's machines ([Create know-how](create-tips.md#machines-and-your-skills)) |
| Minecraft | Wind charge | Where one bursts, it presses buttons, flips levers and opens doors and trapdoors |
| [Nekoma's Fixed](nekomas-fixed.md) | Redstone Striker | Right-click a block to power that spot at 15 for 16 ticks (one tick when sneaking): dust, a block, a lamp, door or piston; an observer pulses |
| [Nekoma's Fixed](nekomas-fixed.md) | Clock | Right-click a block with a clock to hang it. A comparator reads the hour; record a time on the clock (right-click the air) and, placed, it pulses at that time every day |
| Friends&Foes | Copper golem | A lightning rod on a carved pumpkin on a copper block. It wanders about and now and then presses a copper button: a random pulse. It weathers until it freezes as a statue; scrape it with an axe, wax it with honeycomb |
| Create Deco | Cage lamps | Dark until the block they hang on gets a signal. Right-click one with an empty hand to swap that: lit until powered |
| Create Deco | Locked doors | Craft one of Create Deco's metal doors with a redstone torch: the Locked door opens only with redstone |
| Macaw's Doors | Garage doors, metal doors | Place one garage door on a ceiling, and a signal rolls it down. The metal doors open only with redstone |
| Waystones | Warp plate | With a redstone torch in its slots, a signal switches it off |
| Sophisticated Backpacks | Placed backpack | A comparator reads how full it is |
| Farmer's Delight | Kitchen blocks | Comparators read cooking pots, cabinets, baskets, cutting boards, feasts (servings left), pies and organic compost. A dispenser holding a knife uses it on the cutting board in front of it |
| Lootr | Loot chests | A comparator always reads 1, whatever is inside |
