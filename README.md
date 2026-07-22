# EQ Raidcheck Bot

A simple Discord bot for EverQuest-style raid checks. It lets you create a message with role requirements, click a role button to claim one slot, and then see who is assigned for each role.

## Features

- Create a raid target with role requirements such as `Warrior:1,Cleric:3,Enchanter:1,Wizard:1`
- Editable requirements for each target
- Clickable role buttons that update the message in real time
- One-hour signup countdown that closes the raidcheck automatically
- Persistent storage in `data/raidcheck-store.json`

## Setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill in the values.
3. Start the bot:
   `npm start`

## MongoDB persistence

Set `MONGODB_URI` to an Atlas connection string and optionally set `MONGODB_DB_NAME` (defaults to `eq_raidcheck`). The bot stores its complete state in the `bot_state` collection and restores it before connecting to Discord. If MongoDB is unavailable or not configured, local development falls back to `data/raidcheck-store.json`.

For Render, add `MONGODB_URI` and `MONGODB_DB_NAME` under the service's Environment settings. Keep database credentials out of Git and allow the Render service to reach the Atlas cluster through Atlas Network Access.

## Commands

### /raidcheck channel

A member with the **Raid Leader** role (or Manage Channels permission) can tie raidcheck posts to a default text channel:

`/raidcheck channel channel:#raid-check`

Afterward, `/raid` and `/raidcheck create` post there automatically.

### /raid

Select a configured raid target and post its class checklist. Members click a class button to sign up; the post updates immediately with their display name and the remaining openings. Clicking the same class again, or clicking **Remove my role**, removes the signup.

Each posted raidcheck remains open for one hour. Discord displays a live relative countdown, and the bot removes all signup controls when the deadline passes.

Example:

`/raid target:"VS aka Venril sathir"`

VS currently uses the same temporary composition as the encounter catalog. The VS Pop selection uses the `sockphone` tag.

The built-in encounter catalog currently uses the temporary default `Warrior:1,Cleric:5,DPS(Wizard|Rogue|Monk):10`. DPS signups use individual Wizard, Rogue, and Monk buttons that share the DPS slot count. Each encounter preset can be edited independently as its final composition is decided.

### /raidcheck create

Run `/raidcheck create`, then type part of the mob name and select it from autocomplete. A single editor opens with the complete composition visible. Each line uses `Role | Eligible classes | Count`; save the form to update the preset and post its checklist.

Example:

For example: `DPS | Wizard, Rogue, Monk | 10`. Edit any role or count directly, delete a line, or add a new role such as `Tagger | Monk | 1`.

Members signing up for a multi-class role receive one button per eligible class. The checklist records both their display name and selected class.

Recognized classes and abbreviations are: Enchanter (`ENC`), Magician (`MAG`), Necromancer (`NEC`), Wizard (`WIZ`), Cleric (`CLR`), Druid (`DRU`), Shaman (`SHM`), Bard (`BRD`), Monk (`MNK`), Ranger (`RNG`), Rogue (`ROG`), Paladin (`PAL`), Shadow Knight (`SHD`), and Warrior (`WAR`). Abbreviations are expanded in the checklist, so `DPS(WIZ|ROG|MNK):10` displays Wizard, Rogue, and Monk.

### /raidcheck edit

Run `/raidcheck edit` and search for the mob with autocomplete. Choose **Rename mob** for a dedicated name-only form, or **Edit roles/classes** for the composition editor. Renamed and updated presets remain available in `/raid` autocomplete.

### /raidcheck remove

Search for a raid target and remove it after confirmation:

`/raidcheck remove target:<mob name>`

Only a Raid Leader or member with Manage Channels permission can remove targets. Existing posted raidchecks are left in place.

## Notes

- This starter bot is intentionally lightweight and intended for a Discord guild server.
- You must register the slash command in a guild before using it.
