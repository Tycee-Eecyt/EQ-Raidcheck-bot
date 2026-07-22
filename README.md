# EQ Raidcheck Bot

A simple Discord bot for EverQuest-style raid checks. It lets you create a message with role requirements, click a role button to claim one slot, and then see who is assigned for each role.

## Features

- Create a raid target with role requirements such as `Warrior:1,Cleric:3,Enchaner:1,Wizard:1`
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

### /raidcheck create

Create a new raidcheck post.

Example:

`/raidcheck create target:"VS aka Venril sathir" needs:"Warrior:1,Cleric:3,Enchaner:1,Wizard:1" timeframe:"Tonight @ 8:00 PM" tag:"batphone" channel:#raid-check`

### /raidcheck edit

Update an existing raidcheck by message id.

`/raidcheck edit message-id:123456789012345678 needs:"Warrior:0,Cleric:3,Enchaner:2,Wizard:1" timeframe:"Tonight @ 9:00 PM" tag:"sockphone"`

## Notes

- This starter bot is intentionally lightweight and intended for a Discord guild server.
- You must register the slash command in a guild before using it.
