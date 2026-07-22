import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

const dataDir = join(process.cwd(), 'data');
const storePath = join(dataDir, 'raidcheck-store.json');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const RAID_ENCOUNTERS = [
  'Phinigel Autropos',
  'Protector of Sky',
  'Noble Dojorn',
  'Gorgalosk',
  'Keeper of Souls',
  'Overseer of Air',
  'The Spiroc Lord',
  'Bazzt Zzzt',
  'Sister of the Spire',
  'The Hand of Veeshan',
  'Eye of Veeshan',
  'Lord Nagafen',
  'Lady Vox',
  'Maestro of Rancor',
  'Innoruuk',
  'Cazic Thule',
  'Dracoliche',
  'Master Yael',
  'Venril Sathir',
  "Prince Selrach Di'zok",
  'Overking Bathezid',
  "Queen Velazul Di'zok",
  'Faydedar',
  'Severilous',
  'Talendor',
  'Gorenaire',
  'Trakanon',
  'Silverwing',
  'Xygoz',
  'Phara Dar',
  'Druushk',
  'Nexona',
  'Hoshkar',
  'Kelorek`Dar',
  'Wuoshi',
  'Klandicar',
  'Zlandicar',
  'Lord Yelinak',
  'Sontalak',
  'Velketor the Sorcerer',
  'Statue of Rallos Zek',
  'Derakor the Vindicator',
  'King Tormax',
  'Dain Frostreaver IV',
  'Tunare',
  'Avatar of War',
  'Telkorenar',
  'Gozzrem',
  'Lendiniara the Keeper',
  'Dozekar the Cursed',
  'Cekenar',
  'Jorlleag',
  'Ikatiar the Venom',
  'Lady Mirenilla',
  'Lady Nevederia',
  'Lord Feshlak',
  "Lord Koi'Doken",
  'Sevalak',
  'Aaryonar',
  'Zlexak',
  'Dagarn the Destroyer',
  'Eashen of the Sky',
  'Lord Kreizenn',
  'Vulak`Aerr',
  'Lord Vyemm',
  'Kerafyrm',
  'The Progenitor',
  'The Final Arbiter',
  'Master of the Guard',
  'Hraashna the Warder',
  'Nanzata the Warder',
  'Tukaarak the Warder',
  'Ventani the Warder',
  'Lord Doljonijiarnimorinar',
];

const ENCOUNTER_PRESETS = Object.fromEntries(
  RAID_ENCOUNTERS.map((target) => [presetKey(target), {
    target,
    needs: 'Warrior:1,Cleric:5,DPS:10',
    tag: 'batphone',
    windowHours: 16,
  }])
);

const DEFAULT_PRESETS = {
  ...ENCOUNTER_PRESETS,
  vs: {
    target: 'VS aka Venril sathir',
    needs: 'Warrior:1,Cleric:5,DPS:10',
    tag: 'batphone',
    windowHours: 16,
  },
  'vs-pop': {
    target: 'VS aka Venril sathir',
    needs: 'Warrior:1,Cleric:5,DPS:10',
    tag: 'sockphone',
    windowHours: 16,
  },
};

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.on('shardError', (error) => {
  console.error('Discord shard error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

const commands = [
  new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Create a raid target checklist post.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('target')
        .setDescription('Create a raid target checklist using a preset target selection')
        .addStringOption((option) =>
          option
            .setName('target')
            .setDescription('Select the target preset')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addChannelOption((option) => option.setName('channel').setDescription('Override the configured raidcheck channel').setRequired(false))
        .addIntegerOption((option) => option.setName('window-hours').setDescription('Window length from now in hours').setRequired(false))
        .addStringOption((option) => option.setName('timeframe').setDescription('Optional descriptive window text').setRequired(false))
        .addStringOption((option) => option.setName('tag').setDescription('Optional tag such as batphone or sockphone').setRequired(false))
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('raidcheck')
    .setDescription('Create or edit a raidcheck post.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a new raidcheck role request')
        .addChannelOption((option) => option.setName('channel').setDescription('Override the configured raidcheck channel').setRequired(false))
        .addStringOption((option) => option.setName('target').setDescription('Target name').setRequired(false))
        .addStringOption((option) => option.setName('preset').setDescription('Use a saved target preset').setAutocomplete(true).setRequired(false))
        .addStringOption((option) => option.setName('save-preset').setDescription('Save this target and role list as a reusable preset').setRequired(false))
        .addStringOption((option) => option.setName('needs').setDescription('Role requirements like Warrior:1,Cleric:3').setRequired(false))
        .addIntegerOption((option) => option.setName('window-hours').setDescription('Window length from now in hours').setRequired(false))
        .addStringOption((option) => option.setName('timeframe').setDescription('Optional descriptive window text').setRequired(false))
        .addStringOption((option) => option.setName('tag').setDescription('Optional tag such as batphone or sockphone').setRequired(false))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription('Edit a posted raidcheck or saved target preset')
        .addStringOption((option) => option.setName('message-id').setDescription('Message ID for a posted raidcheck').setRequired(false))
        .addStringOption((option) => option.setName('preset').setDescription('Saved preset to edit instead').setAutocomplete(true).setRequired(false))
        .addStringOption((option) => option.setName('target').setDescription('Updated target display name').setRequired(false))
        .addStringOption((option) => option.setName('needs').setDescription('Updated role requirements').setRequired(false))
        .addIntegerOption((option) => option.setName('window-hours').setDescription('Updated window length in hours').setRequired(false))
        .addStringOption((option) => option.setName('timeframe').setDescription('Updated descriptive timeframe').setRequired(false))
        .addStringOption((option) => option.setName('tag').setDescription('Updated tag').setRequired(false))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channel')
        .setDescription('Set the default text channel for raidcheck posts')
        .addChannelOption((option) => option.setName('channel').setDescription('Default raidcheck text channel').setRequired(true))
    )
    .toJSON(),
];

function ensureStore() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(storePath)) {
    writeFileSync(storePath, JSON.stringify({ raidchecks: {}, presets: {}, guildSettings: {} }, null, 2));
  }
}

function normalizeRoleName(role) {
  if (!role || typeof role !== 'string') return role;
  return role.toLowerCase() === 'enchaner' || role.toLowerCase() === 'enchanter' ? 'Enchanter' : role;
}

function normalizeRoleSpec(input) {
  if (!input || typeof input !== 'string') return input;

  const parts = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [role, count] = part.split(':').map((entry) => entry.trim());
      if (!role || !count) return part;
      return `${normalizeRoleName(role)}:${count}`;
    });

  return parts.join(', ');
}

function normalizeStoreData(store) {
  const raidchecks = store.raidchecks ?? {};
  store.presets ??= {};
  store.guildSettings ??= {};

  for (const preset of Object.values(store.presets)) {
    preset.needs = normalizeRoleSpec(preset.needs);
  }

  for (const messageId of Object.keys(raidchecks)) {
    const raidcheck = raidchecks[messageId];
    raidcheck.needs = normalizeRoleSpec(raidcheck.needs);

    const normalizedClaims = {};
    const rawClaims = raidcheck.claims ?? {};

    for (const [role, entries] of Object.entries(rawClaims)) {
      const canonicalRole = normalizeRoleName(role);
      normalizedClaims[canonicalRole] = (entries ?? [])
        .map((entry) => normalizeClaimEntry(entry))
        .filter((entry) => entry && typeof entry === 'object' && entry.id);
    }

    raidcheck.claims = normalizedClaims;
  }

  return store;
}

function loadStore() {
  ensureStore();

  try {
    const store = JSON.parse(readFileSync(storePath, 'utf8'));
    return normalizeStoreData(store);
  } catch (error) {
    console.error('Raidcheck store was corrupted. Resetting the local store file.', error);
    const resetStore = { raidchecks: {}, presets: {}, guildSettings: {} };
    writeFileSync(storePath, JSON.stringify(resetStore, null, 2));
    return normalizeStoreData(resetStore);
  }
}

function saveStore(store) {
  ensureStore();
  writeFileSync(storePath, JSON.stringify(normalizeStoreData(store), null, 2));
}

function normalizeClaimEntry(entry) {
  if (typeof entry === 'string') {
    return { id: entry, displayName: entry };
  }

  if (!entry || typeof entry !== 'object') {
    return { id: String(entry), displayName: String(entry) };
  }

  return {
    id: entry.id ?? entry.userId ?? String(entry),
    displayName: entry.displayName || entry.name || entry.id || String(entry),
    className: entry.className || entry.class || null,
  };
}

function dedupeClaimsByUser(claims = []) {
  const seen = new Set();
  return (claims ?? [])
    .map((entry) => normalizeClaimEntry(entry))
    .filter((entry) => {
      if (!entry || typeof entry !== 'object' || !entry.id) {
        return false;
      }

      if (seen.has(entry.id)) {
        return false;
      }

      seen.add(entry.id);
      return true;
    });
}

function getDisplayName(interaction) {
  return interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
}

async function safeDeferReply(interaction, options = {}) {
  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    console.warn('Could not defer interaction reply. The interaction may be stale or already expired.', error.message);
    return false;
  }
}

async function safeUpdateInteraction(interaction, data) {
  try {
    await interaction.update(data);
    return true;
  } catch (error) {
    console.warn('Could not update the raidcheck interaction message.', error.message);

    try {
      await interaction.message.edit(data);
      return true;
    } catch (fallbackError) {
      console.warn('Fallback message edit also failed.', fallbackError.message);
      return false;
    }
  }
}

function parseNeeds(input) {
  if (!input || typeof input !== 'string') return {};

  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [role, count] = part.split(':').map((entry) => entry.trim());
      if (!role || !count || Number.isNaN(Number(count))) {
        return acc;
      }
      acc[normalizeRoleName(role)] = Number(count);
      return acc;
    }, {});
}

function renderWindow({ timeframe, windowHours }) {
  if (timeframe && timeframe.trim()) {
    return timeframe.trim();
  }

  if (Number.isInteger(windowHours) && windowHours > 0) {
    return `Now → +${windowHours} hours`;
  }

  return 'Open window';
}

function parseRoleDefinition(roleSpec) {
  const match = roleSpec.match(/^(.+?)\((.+)\)$/);
  if (!match) return { role: roleSpec, classes: [] };
  return {
    role: match[1].trim(),
    classes: match[2].split('|').map((name) => name.trim()).filter(Boolean),
  };
}

function formatRoleList(requirements, claims = {}) {
  return Object.entries(requirements)
    .map(([role, count]) => {
      const definition = parseRoleDefinition(role);
      const claimed = dedupeClaimsByUser(claims[role] ?? []);
      const remaining = Math.max(count - claimed.length, 0);
      const ownerNames = claimed.map((entry) => `${entry.displayName}${entry.className ? ` (${entry.className})` : ''}`).join(', ') || 'None';
      const eligible = definition.classes.length ? ` (${definition.classes.join(' / ')})` : '';
      return `• ${definition.role}${eligible}: ${remaining}/${count} open — ${ownerNames}`;
    })
    .join('\n');
}

function buildComponents(requirements, claims = {}) {
  const rows = [];
  const roles = Object.entries(requirements);
  let buttonRow = new ActionRowBuilder();

  for (const [role, required] of roles) {
    const definition = parseRoleDefinition(role);
    const claimed = dedupeClaimsByUser(claims[role] ?? []);
    const remaining = Math.max(required - claimed.length, 0);

    if (definition.classes.length > 1) {
      if (buttonRow.components.length) {
        rows.push(buttonRow);
        buttonRow = new ActionRowBuilder();
      }
      if (rows.length < 4) {
        rows.push(new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`raidcheck-role-select:${encodeURIComponent(role)}`)
            .setPlaceholder(`Sign up as ${definition.role} (${remaining}/${required} open)`)
            .addOptions(definition.classes.slice(0, 25).map((className) => ({ label: className, value: className })))
        ));
      }
      continue;
    }

    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`raidcheck-role:${encodeURIComponent(role)}`)
        .setLabel(`${definition.role} (${remaining}/${required})`)
        .setStyle(remaining > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
    if (buttonRow.components.length === 5) {
      rows.push(buttonRow);
      buttonRow = new ActionRowBuilder();
    }
  }

  if (buttonRow.components.length && rows.length < 4) rows.push(buttonRow);

  if (roles.length > 0 && rows.length < 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('raidcheck-remove')
          .setLabel('Remove my role')
          .setStyle(ButtonStyle.Danger)
      )
    );
  }

  return rows;
}

function buildEmbed({ target, needs, timeframe, tag, claims = {}, windowHours }) {
  const requirements = parseNeeds(needs);
  const embed = new EmbedBuilder()
    .setTitle(`Raid Check: ${target}`)
    .setDescription(`Tag: ${tag || 'None'}\nWindow: ${renderWindow({ timeframe, windowHours })}`)
    .addFields({ name: 'Requirements', value: formatRoleList(requirements, claims) || 'No roles listed', inline: false })
    .setColor('#00AEEF')
    .setTimestamp();

  return { embed, requirements };
}

function presetKey(name) {
  return name?.trim?.().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function allPresets(store) {
  return { ...DEFAULT_PRESETS, ...(store?.presets ?? {}) };
}

function resolvePreset(preset, store = null) {
  return allPresets(store)[presetKey(preset)];
}

function presetChoices(store, query = '') {
  const search = query.toLowerCase();
  return Object.entries(allPresets(store))
    .filter(([key, preset]) => key.includes(search) || preset.target.toLowerCase().includes(search))
    .slice(0, 25)
    .map(([value, preset]) => ({ name: `${preset.target} (${value})`.slice(0, 100), value }));
}

function isUsableTextChannel(channel) {
  return channel?.isTextBased?.() && !channel.isDMBased?.();
}

async function resolveRaidcheckChannel(interaction, requestedChannel, store) {
  if (requestedChannel) return requestedChannel;
  const channelId = store.guildSettings?.[interaction.guildId]?.raidcheckChannelId;
  if (!channelId) return null;
  return client.channels.fetch(channelId).catch(() => null);
}

function canConfigureRaidcheck(interaction) {
  return interaction.memberPermissions?.has('ManageChannels')
    || interaction.member?.roles?.cache?.some((role) => role.name.toLowerCase().includes('raid leader'));
}

function hasValidRequirements(requirements) {
  return Object.keys(requirements).length > 0
    && Object.values(requirements).every((count) => Number.isInteger(count) && count > 0);
}

function flattenClaims(claims = {}) {
  return Object.fromEntries(
    Object.entries(claims).map(([role, list]) => [normalizeRoleName(role), dedupeClaimsByUser(list ?? [])])
  );
}

function removeClaimantFromAllRoles(claims = {}, claimantId) {
  return Object.fromEntries(
    Object.entries(claims).map(([role, list]) => [normalizeRoleName(role), dedupeClaimsByUser(list ?? []).filter((entry) => entry.id !== claimantId)])
  );
}

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }

  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused(true);
      if (focused.name === 'target' || focused.name === 'preset') {
        await interaction.respond(presetChoices(loadStore(), String(focused.value)));
      }
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'raid') {
      if (interaction.options.getSubcommand() === 'target') {
        if (!(await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral }))) {
          return;
        }

        const requestedChannel = interaction.options.getChannel('channel');
        const targetChoice = interaction.options.getString('target');
        const timeframeInput = interaction.options.getString('timeframe');
        const tagInput = interaction.options.getString('tag');
        const windowHoursInput = interaction.options.getInteger('window-hours');

        const store = loadStore();
        const channel = await resolveRaidcheckChannel(interaction, requestedChannel, store);
        const preset = resolvePreset(targetChoice, store);
        const target = preset?.target;
        const needs = preset?.needs;
        const timeframe = timeframeInput || (preset?.timeframe ?? '');
        const tag = tagInput || preset?.tag || 'None';
        const windowHours = windowHoursInput ?? preset?.windowHours;

        if (!target || !needs) {
          await interaction.editReply({ content: 'Choose a supported raid target such as `vs` or `vs-pop`.' });
          return;
        }

        const requirements = parseNeeds(needs);
        if (!isUsableTextChannel(channel)) {
          await interaction.editReply({ content: 'Choose a server text channel where I can post the checklist.' });
          return;
        }

        if (!hasValidRequirements(requirements)) {
          await interaction.editReply({ content: 'That target does not have a valid class checklist configured.' });
          return;
        }

        const claims = Object.fromEntries(Object.keys(requirements).map((role) => [role, []]));
        const { embed } = buildEmbed({ target, needs, timeframe, tag, claims, windowHours });

        const message = await channel.send({
          embeds: [embed],
          components: buildComponents(requirements, claims),
        });

        store.raidchecks[message.id] = {
          messageId: message.id,
          channelId: channel.id,
          target,
          needs,
          timeframe,
          tag,
          windowHours,
          claims,
        };
        saveStore(store);

        await interaction.editReply({ content: `Raid target posted in ${channel}. Message ID: ${message.id}` });
        return;
      }
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'raidcheck') {
      if (interaction.options.getSubcommand() === 'channel') {
        if (!(await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral }))) return;

        if (!canConfigureRaidcheck(interaction)) {
          await interaction.editReply({ content: 'Only a Raid Leader or member with Manage Channels permission can change this setting.' });
          return;
        }

        const channel = interaction.options.getChannel('channel');
        if (!isUsableTextChannel(channel)) {
          await interaction.editReply({ content: 'Choose a server text channel for raidcheck posts.' });
          return;
        }

        const store = loadStore();
        store.guildSettings[interaction.guildId] = {
          ...(store.guildSettings[interaction.guildId] ?? {}),
          raidcheckChannelId: channel.id,
        };
        saveStore(store);
        await interaction.editReply({ content: `Raidcheck posts are now tied to ${channel}.` });
        return;
      }

      if (interaction.options.getSubcommand() === 'create') {
        if (!(await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral }))) {
          return;
        }

        const requestedChannel = interaction.options.getChannel('channel');
        const targetInput = interaction.options.getString('target');
        const presetInput = interaction.options.getString('preset');
        const savePresetInput = interaction.options.getString('save-preset');
        const needsInput = interaction.options.getString('needs');
        const timeframeInput = interaction.options.getString('timeframe');
        const tagInput = interaction.options.getString('tag');
        const windowHoursInput = interaction.options.getInteger('window-hours');

        const store = loadStore();
        const channel = await resolveRaidcheckChannel(interaction, requestedChannel, store);
        const preset = resolvePreset(presetInput, store);
        const target = targetInput || preset?.target;
        const needs = needsInput || preset?.needs;
        const timeframe = timeframeInput || (preset?.timeframe ?? '');
        const tag = tagInput || preset?.tag || 'None';
        const windowHours = windowHoursInput ?? preset?.windowHours;

        if (!target || !needs) {
          await interaction.editReply({ content: 'Provide either a target and needs, or use a valid preset such as `vs` or `vs-pop`.' });
          return;
        }

        const requirements = parseNeeds(needs);
        if (!isUsableTextChannel(channel)) {
          await interaction.editReply({ content: 'Choose a server text channel where I can post the checklist.' });
          return;
        }

        if (!hasValidRequirements(requirements)) {
          await interaction.editReply({ content: 'Requirements must look like `Warrior:1,Cleric:3` with positive whole-number counts.' });
          return;
        }

        if (savePresetInput) {
          const key = presetKey(savePresetInput);
          if (!key) {
            await interaction.editReply({ content: 'The preset name must contain at least one letter or number.' });
            return;
          }
          store.presets[key] = { target, needs: normalizeRoleSpec(needs), timeframe, tag, windowHours };
        }

        const claims = Object.fromEntries(Object.keys(requirements).map((role) => [role, []]));
        const { embed } = buildEmbed({ target, needs, timeframe, tag, claims, windowHours });

        const message = await channel.send({
          embeds: [embed],
          components: buildComponents(requirements, claims),
        });

        store.raidchecks[message.id] = {
          messageId: message.id,
          channelId: channel.id,
          target,
          needs,
          timeframe,
          tag,
          windowHours,
          claims,
        };
        saveStore(store);

        const savedText = savePresetInput ? ` Preset \`${presetKey(savePresetInput)}\` was saved.` : '';
        await interaction.editReply({ content: `Raidcheck posted in ${channel}. Message ID: ${message.id}.${savedText}` });
        return;
      }

      if (interaction.options.getSubcommand() === 'edit') {
        if (!(await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral }))) {
          return;
        }

        const messageId = interaction.options.getString('message-id');
        const presetInput = interaction.options.getString('preset');
        const target = interaction.options.getString('target');
        const needs = interaction.options.getString('needs');
        const timeframe = interaction.options.getString('timeframe');
        const tag = interaction.options.getString('tag');
        const windowHours = interaction.options.getInteger('window-hours');

        const store = loadStore();

        if ((!messageId && !presetInput) || (messageId && presetInput)) {
          await interaction.editReply({ content: 'Provide either `message-id` to edit a post or `preset` to edit a saved target.' });
          return;
        }

        if (presetInput) {
          const key = presetKey(presetInput);
          const existingPreset = resolvePreset(key, store);
          if (!existingPreset) {
            await interaction.editReply({ content: 'No saved preset found with that name.' });
            return;
          }

          if (DEFAULT_PRESETS[key] && !store.presets[key]) {
            store.presets[key] = { ...DEFAULT_PRESETS[key] };
          }

          const updatedPreset = {
            ...existingPreset,
            target: target ?? existingPreset.target,
            needs: needs ? normalizeRoleSpec(needs) : existingPreset.needs,
            timeframe: timeframe ?? existingPreset.timeframe ?? '',
            tag: tag ?? existingPreset.tag ?? 'None',
            windowHours: windowHours ?? existingPreset.windowHours,
          };

          if (!updatedPreset.target || !hasValidRequirements(parseNeeds(updatedPreset.needs))) {
            await interaction.editReply({ content: 'The preset needs a target and requirements such as `Warrior:2,Cleric:7,DPS:10`.' });
            return;
          }

          store.presets[key] = updatedPreset;
          saveStore(store);
          await interaction.editReply({ content: `Preset \`${key}\` updated.` });
          return;
        }

        const raidcheck = store.raidchecks[messageId];
        if (!raidcheck) {
          await interaction.editReply({ content: 'No raidcheck found for that message ID.' });
          return;
        }

        const updated = {
          ...raidcheck,
          target: target ?? raidcheck.target,
          needs: needs ?? raidcheck.needs,
          timeframe: timeframe ?? raidcheck.timeframe,
          tag: tag ?? raidcheck.tag,
          windowHours: windowHours ?? raidcheck.windowHours,
        };

        const normalizedClaims = flattenClaims(updated.claims);
        const { embed, requirements } = buildEmbed({
          target: updated.target,
          needs: updated.needs,
          timeframe: updated.timeframe,
          tag: updated.tag,
          claims: normalizedClaims,
          windowHours: updated.windowHours,
        });

        const channel = await client.channels.fetch(updated.channelId).catch(() => null);
        if (channel?.isTextBased()) {
          const existingMessage = await channel.messages.fetch(messageId).catch(() => null);
          if (existingMessage) {
            await existingMessage.edit({
              embeds: [embed],
              components: buildComponents(requirements, normalizedClaims),
            });
          }
        }

        updated.claims = normalizedClaims;
        store.raidchecks[messageId] = updated;
        saveStore(store);

        await interaction.editReply({ content: `Raidcheck ${messageId} updated.` });
      }
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const store = loadStore();
      const raidcheck = store.raidchecks[interaction.message.id];
      if (!raidcheck) return;

      const requirements = parseNeeds(raidcheck.needs);
      const claimantId = interaction.user.id;
      const claimantName = getDisplayName(interaction);

      if (interaction.customId === 'raidcheck-remove') {
        const clearedClaims = removeClaimantFromAllRoles(
          flattenClaims(raidcheck.claims ?? Object.fromEntries(Object.keys(requirements).map((key) => [key, []]))),
          claimantId
        );

        const { embed } = buildEmbed({
          target: raidcheck.target,
          needs: raidcheck.needs,
          timeframe: raidcheck.timeframe,
          tag: raidcheck.tag,
          claims: clearedClaims,
          windowHours: raidcheck.windowHours,
        });

        raidcheck.claims = clearedClaims;
        store.raidchecks[interaction.message.id] = raidcheck;
        saveStore(store);

        await safeUpdateInteraction(interaction, {
          embeds: [embed],
          components: buildComponents(requirements, clearedClaims),
        });
        return;
      }

      const [type, encodedRole] = interaction.customId.split(':');
      if (type !== 'raidcheck-role' && type !== 'raidcheck-role-select') return;

      const role = decodeURIComponent(encodedRole);
      const definition = parseRoleDefinition(role);
      const selectedClass = interaction.isStringSelectMenu()
        ? interaction.values[0]
        : (definition.classes.length === 1 ? definition.classes[0] : null);
      const claims = flattenClaims(raidcheck.claims ?? Object.fromEntries(Object.keys(requirements).map((key) => [key, []])));
      const roleClaims = dedupeClaimsByUser(claims[role] ?? []);
      const userHasClaim = roleClaims.some((entry) => entry.id === claimantId);

      let updatedClaims = removeClaimantFromAllRoles(claims, claimantId);

      if (userHasClaim && interaction.isButton()) {
        updatedClaims = { ...updatedClaims, [role]: roleClaims.filter((entry) => entry.id !== claimantId) };
      } else if ((updatedClaims[role] ?? []).length < (requirements[role] ?? 0)) {
        updatedClaims = {
          ...updatedClaims,
          [role]: [...(updatedClaims[role] ?? []), { id: claimantId, displayName: claimantName, className: selectedClass }],
        };
      }

      const { embed } = buildEmbed({
        target: raidcheck.target,
        needs: raidcheck.needs,
        timeframe: raidcheck.timeframe,
        tag: raidcheck.tag,
        claims: updatedClaims,
        windowHours: raidcheck.windowHours,
      });

      raidcheck.claims = updatedClaims;
      store.raidchecks[interaction.message.id] = raidcheck;
      saveStore(store);

      await safeUpdateInteraction(interaction, {
        embeds: [embed],
        components: buildComponents(requirements, updatedClaims),
      });
    }
  } catch (error) {
    console.error('Interaction failed:', error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'Something went wrong while processing that interaction.' }).catch(() => {});
    } else if (interaction.isRepliable()) {
      await interaction.reply({ content: 'Something went wrong while processing that interaction.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
