---
description: >-
  Proximity voice chat (setting it up, who hears you, private groups), chat, and the two kinds of party.
icon: microphone
---

# Chat, voice and teams

Voice chat here is proximity voice: whoever is near hears you, friend or foe. Groups make talk private. Parties come in two kinds: a team shares quests and your place on the map, a skill party shares skill XP.

## Setting up voice

Press **V**. The first time, a setup guide opens: pick your microphone, your speaker and how you talk. Until you finish it, your screen says "Press V to set up".

| How you talk | What to know |
|---|---|
| Push to Talk | Hold a key while you speak. It has no key until you pick one, in the guide or in Controls → Key Binds → Voice Chat → Push to Talk |
| Voice Activation | The mic opens when you speak; the guide's microphone test checks it hears you. You start muted when the guide closes: press **O** to unmute |

- **Skipped the guide?** You're on Push to Talk with no key, so nobody hears you until you bind one.
- **No microphone?** You can still listen. Voice chat is optional in the launcher's Mods tab, on by default.
- **Nothing works?** See the [FAQ](faq.md): voice needs UDP.

## Who hears you

- **Everyone within 48 blocks,** enemies too. Voices come from where the speaker stands.
- **Whisper** carries 24 blocks. Its key is unbound: bind **Whisper** in Controls. With Push to Talk, holding Whisper opens your mic too.
- **O** mutes your mic when you use Voice Activation. With Push to Talk there's nothing to mute: just let go.
- **N** switches voice chat off: you hear nobody and nobody hears you.
- **A group changes who hears you:** see below.
- **You can be recorded.** The server allows voice recording, so anyone who hears you can keep it.

## Private groups

Open **V** and click **Group** (the Group Management key is unbound, since **G** opens your Curios slots). Type a name, add a password if you like, pick a type and click **Create Group**.

| Type | Outsiders hear you | You hear outsiders |
|---|---|---|
| Normal | No | Yes |
| Open | Yes | Yes |
| Isolated | No | No |

- **For private talk,** make it Isolated, with a password.
- **Joining.** Others pick your group in V → Group and type the password. Or invite them: `/voicechat invite <player>`, or the invite button in Social Interactions (**P**). They click **ACCEPT** in chat, which lets them in without the password.
- **Commands.** `/voicechat join <group> [password]` and `/voicechat leave`, or leave from the group screen.
- **In a group,** members' heads show at the top left, outlined while they talk; move them with [HUD Layout](esc-menu.md#hud-layout). Players outside see a group icon next to your head: they can tell you're in one, but not what you say.

## Voice settings

**V → Settings** has the rest:

- **Activation:** the method, and the voice activation threshold, automatic or set by hand.
- **Tests:** the microphone test lets you hear yourself; the speaker test plays a sound.
- **Noise suppression** and **automatic gain** are on. Keep gain on, so everyone hears you at the same volume.
- **3D audio:** Normal, Reduced or Off.
- **Adjust Volumes:** search for a player and drag their slider. 0 % mutes them for you only; past 100 % makes them louder. Its key is unbound.
- **Icons** by names and on your screen show who's talking or whispering, a muted mic, voice switched off, and "not connected" (no voice mod, or blocked by a firewall). Hide them with the button in the V menu; move yours with HUD Layout.

## Chat

- **T** opens chat and **/** starts a command; `/msg <player> <message>` is private. See [Commands](commands.md).
- **Heads in chat.** Each message shows its sender's head (Chat Heads, optional in the launcher).
- **Heart news goes to everyone:** who took a heart from whom and how many they have left, who used whose Heart, who brought whom back, and who lost their last heart.
- **Sharing a waypoint** (**U**, pick it, **Share**) posts it in public chat for everyone to add. Never share your base. The **Teleport** button doesn't work here: there are no teleport commands.
- **Hide someone's chat** in Social Interactions (**P**). It hides it for you only.
- **Trading** goes through `/trade`: see [Trading with other players](economy.md#trading-with-other-players).

## Two kinds of party

They're separate, so make both with your friends.

| Party | Start one with | It shares |
|---|---|---|
| Team (FTB Teams) | **;** or ESC → Team | Quests, and where you are on the map |
| Skill party (Project MMO) | `/pmmo party create <name>` | Skill XP, within 50 blocks |

Neither stops PvP: party members can still hurt each other.

### Your team

- **The team screen:** **;** (semicolon), ESC → **Team**, or **My Team** in your inventory.
- **Create a Party** and give it a name (a description and colour if you like). The owner and officers invite with **Invite Player(s)**; the player gets **Accept** and **Decline** buttons in chat.
- **Quests are shared:** everyone gets the quest and can claim its rewards ([Quests](quests.md#how-rewards-scale)).
- **You see each other.** Party members show on each other's minimap and as a marker in the world, even far away.
- **Team chat.** The chat toggle in the team screen sends what you type to your party until you toggle it back. `/ftbteams msg <text>` sends one message.
- **Allies.** **Manage Allies** marks players as your team's allies. Once two teams have marked each other, their players show on each other's maps too. Allies share nothing else.
- **Running it.** The owner can promote members to officer, demote them, kick them or hand over ownership, and has to hand it over before leaving. **Leave Party** and **Disband Party** are in the same screen. **Free to Join**, in the team's properties, lets anyone join without an invite.
- **Relics** count your party as your own team when you choose who an ability hits ([Relics in a fight](combat.md#relics-in-a-fight)).
- **Commands:** `/ftbteams party create <name>`, `/ftbteams party invite <player>`, `/ftbteams party leave`.

### Skill party

- `/pmmo party create <name>`, then `/pmmo party invite <player>`: they accept in chat. `/pmmo party list` shows who's in; `/pmmo party leave` leaves.
- **Everyone in it within 50 blocks gets the skill XP any of you earns, in full,** so training side by side pays each of you. Brewing and Construction XP isn't shared.
- It's a different party from your team, so being in one doesn't put you in the other.
