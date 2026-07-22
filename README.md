# EQ Raidcheck Bot

A simple Discord bot for EverQuest-style raid checks. It lets you create a message with role requirements, click a role button to claim one slot, and then see who is assigned for each role.

## Features

- Create a raid target with role requirements such as `Warrior:1,Cleric:3,Enchanter:1,Wizard:1`
- Support optional `tag` values like `batphone` or `sockphone`
- Editable timeframe and requirements for each target
- Clickable role buttons that update the message in real time
- Persistent storage in `data/raidcheck-store.json`

## Setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill in the values.
3. Start the bot:
   `npm start`

## Commands

### /raidcheck channel

A member with the **Raid Leader** role (or Manage Channels permission) can tie raidcheck posts to a default text channel:

`/raidcheck channel channel:#raid-check`

Afterward, `/raid target` and `/raidcheck create` post there automatically. Their optional `channel` argument can override the configured channel for one post.

### /raid target

Select a configured raid target and post its class checklist. Members click a class button to sign up; the post updates immediately with their display name and the remaining openings. Clicking the same class again, or clicking **Remove my role**, removes the signup.

Example:

`/raid target target:"VS aka Venril sathir" channel:#raid-check`

VS currently uses the same temporary composition as the encounter catalog. The VS Pop selection uses the `sockphone` tag.

The built-in encounter catalog currently uses the temporary default `Warrior:1,Cleric:5,DPS:10`. Each encounter preset can be edited independently as its final composition is decided.

### /raidcheck create

Create a new raidcheck post from a saved preset or from any custom list of roles/classes. Add `save-preset` to keep that target as a reusable choice under `/raid target`.

Example:

`/raidcheck create target:"VS aka Venril sathir" needs:"Warrior:1,Cleric:3,Enchanter:1,Wizard:1" timeframe:"Tonight @ 8:00 PM" tag:"batphone" channel:#raid-check`

Create and save a Vindi preset:

`/raidcheck create target:"Vindi" needs:"Warrior:2,Cleric:7,DPS:10" save-preset:"vindi" channel:#raid-check`

Roles can list the classes allowed to fill them. Separate eligible classes with `|`:

`/raidcheck create target:"Vindi" needs:"Tank(Warrior|Shadow Knight|Paladin|Ranger):2,Cleric:7,DPS:10" save-preset:"vindi" channel:#raid-check`

Members signing up for a multi-class role receive a class dropdown. The checklist records both their display name and selected class. To restrict a role to one class, use `Tank(Warrior):2`; plain requirements such as `Warrior:2` continue to work.

### /raidcheck edit

Update an existing raidcheck by message ID:

`/raidcheck edit message-id:123456789012345678 needs:"Warrior:0,Cleric:3,Enchanter:2,Wizard:1" timeframe:"Tonight @ 9:00 PM" tag:"sockphone"`

Or update a saved target preset. The preset remains available in `/raid target` autocomplete:

`/raidcheck edit preset:"vindi" needs:"Warrior:2,Cleric:8,DPS:10"`

## Notes

- This starter bot is intentionally lightweight and intended for a Discord guild server.
- You must register the slash command in a guild before using it.
