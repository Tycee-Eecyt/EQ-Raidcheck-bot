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
  ModalBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

const dataDir = join(process.cwd(), 'data');
const storePath = join(dataDir, 'raidcheck-store.json');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CHARACTER_CLASSES = [
  { name: 'Enchanter', abbreviation: 'ENC', category: 'Caster' },
  { name: 'Magician', abbreviation: 'MAG', category: 'Caster' },
  { name: 'Necromancer', abbreviation: 'NEC', category: 'Caster' },
  { name: 'Wizard', abbreviation: 'WIZ', category: 'Caster' },
  { name: 'Cleric', abbreviation: 'CLR', category: 'Priest' },
  { name: 'Druid', abbreviation: 'DRU', category: 'Priest' },
  { name: 'Shaman', abbreviation: 'SHM', category: 'Priest' },
  { name: 'Bard', abbreviation: 'BRD', category: 'Melee' },
  { name: 'Monk', abbreviation: 'MNK', category: 'Melee' },
  { name: 'Ranger', abbreviation: 'RNG', category: 'Melee' },
  { name: 'Rogue', abbreviation: 'ROG', category: 'Melee' },
  { name: 'Paladin', abbreviation: 'PAL', category: 'Tank' },
  { name: 'Shadow Knight', abbreviation: 'SHD', category: 'Tank' },
  { name: 'Warrior', abbreviation: 'WAR', category: 'Tank' },
];

const CLASS_NAME_LOOKUP = new Map(
  CHARACTER_CLASSES.flatMap((characterClass) => [
    [characterClass.name.toLowerCase(), characterClass.name],
    [characterClass.abbreviation.toLowerCase(), characterClass.name],
  ])
);

const ROLE_TEMPLATES = {
  Warrior: { label: 'Warrior', spec: 'Warrior' },
  Cleric: { label: 'Cleric', spec: 'Cleric' },
  Tank: { label: 'Tank', spec: 'Tank(Warrior|Paladin|Shadow Knight|Ranger)' },
  Healer: { label: 'Healer', spec: 'Healer(Cleric|Druid|Shaman)' },
  DPS: { label: 'DPS', spec: 'DPS(Wizard|Rogue|Monk)' },
  Tagger: { label: 'Tagger', spec: 'Tagger(Monk)' },
};

const wizardSessions = new Map();

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
    needs: 'Warrior:1,Cleric:5,DPS(Wizard|Rogue|Monk):10',
    tag: 'batphone',
    windowHours: 16,
  }])
);

const DEFAULT_PRESETS = {
  ...ENCOUNTER_PRESETS,
  vs: {
    target: 'VS aka Venril sathir',
    needs: 'Warrior:1,Cleric:5,DPS(Wizard|Rogue|Monk):10',
    tag: 'batphone',
    windowHours: 16,
  },
  'vs-pop': {
    target: 'VS aka Venril sathir',
    needs: 'Warrior:1,Cleric:5,DPS(Wizard|Rogue|Monk):10',
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
    .setDescription('Post a raid checklist for a selected encounter.')
    .addStringOption((option) =>
      option
        .setName('target')
        .setDescription('Select the raid encounter')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('raidcheck')
    .setDescription('Create or edit a raidcheck post.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Open a form to create a raidcheck')
        .addStringOption((option) => option.setName('target').setDescription('Search for the raid target').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription('Open a form to edit a raidcheck or preset')
        .addStringOption((option) => option.setName('target').setDescription('Search for the raid target preset').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channel')
        .setDescription('Set the default text channel for raidcheck posts')
        .addChannelOption((option) => option.setName('channel').setDescription('Default raidcheck text channel').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a raid target preset')
        .addStringOption((option) => option.setName('target').setDescription('Search for the raid target to remove').setRequired(true).setAutocomplete(true))
    )
    .toJSON(),
];

function ensureStore() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(storePath)) {
    writeFileSync(storePath, JSON.stringify({ raidchecks: {}, presets: {}, guildSettings: {}, disabledPresets: {} }, null, 2));
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
  store.disabledPresets ??= {};

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
    const resetStore = { raidchecks: {}, presets: {}, guildSettings: {}, disabledPresets: {} };
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

function parseRoleDefinition(roleSpec) {
  const match = roleSpec.match(/^(.+?)\((.+)\)$/);
  if (!match) return { role: roleSpec, classes: [] };
  return {
    role: match[1].trim(),
    classes: match[2]
      .split('|')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => CLASS_NAME_LOOKUP.get(name.toLowerCase()) || name),
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

function buildEmbed({ target, needs, claims = {} }) {
  const requirements = parseNeeds(needs);
  const embed = new EmbedBuilder()
    .setTitle(`Raid Check: ${target}`)
    .addFields({ name: 'Requirements', value: formatRoleList(requirements, claims) || 'No roles listed', inline: false })
    .setColor('#00AEEF')
    .setTimestamp();

  return { embed, requirements };
}

function presetKey(name) {
  return name?.trim?.().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function allPresets(store) {
  const presets = { ...DEFAULT_PRESETS, ...(store?.presets ?? {}) };
  for (const key of Object.keys(store?.disabledPresets ?? {})) delete presets[key];
  return presets;
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

function textInput(customId, label, { required = false, placeholder = '', style = TextInputStyle.Short } = {}) {
  const input = new TextInputBuilder().setCustomId(customId).setLabel(label).setStyle(style).setRequired(required);
  if (placeholder) input.setPlaceholder(placeholder);
  return new ActionRowBuilder().addComponents(input);
}

function buildCreateModal() {
  return new ModalBuilder()
    .setCustomId('raidcheck-create-modal')
    .setTitle('Create Raid Check')
    .addComponents(
      textInput('preset', 'Existing preset key (optional)', { placeholder: 'vindi' }),
      textInput('target', 'Target name (optional with preset)', { placeholder: 'Derakor the Vindicator' }),
      textInput('needs', 'Roles / classes (optional with preset)', {
        placeholder: 'Warrior:1,Cleric:5,DPS(WIZ|ROG|MNK):10',
        style: TextInputStyle.Paragraph,
      }),
      textInput('savePreset', 'Save as preset key (optional)', { placeholder: 'vindi' })
    );
}

function buildEditModal() {
  return new ModalBuilder()
    .setCustomId('raidcheck-edit-modal')
    .setTitle('Edit Raid Check')
    .addComponents(
      textInput('identifier', 'Preset key or message ID', { required: true, placeholder: 'vindi or 123456789012345678' }),
      textInput('target', 'New target name (optional)'),
      textInput('needs', 'New roles / classes (optional)', {
        placeholder: 'Warrior:1,Cleric:5,DPS(WIZ|ROG|MNK):10',
        style: TextInputStyle.Paragraph,
      })
    );
}

function wizardKey(interaction) {
  return `${interaction.guildId}:${interaction.user.id}`;
}

function wizardSources(store, guildId, mode) {
  const presets = Object.entries(allPresets(store)).map(([key, preset]) => ({
    label: preset.target,
    description: `Preset: ${key}`,
    value: `preset:${key}`,
    target: preset.target,
    needs: preset.needs,
  }));
  if (mode === 'create') return presets;
  const posts = Object.values(store.raidchecks)
    .filter((raidcheck) => !guildId || client.channels.cache.get(raidcheck.channelId)?.guildId === guildId)
    .map((raidcheck) => ({
      label: raidcheck.target,
      description: `Posted message: ${raidcheck.messageId}`,
      value: `post:${raidcheck.messageId}`,
      target: raidcheck.target,
      needs: raidcheck.needs,
    }));
  return [...posts, ...presets];
}

function sourcePickerComponents(session) {
  const pageCount = Math.max(Math.ceil(session.sources.length / 25), 1);
  session.page = Math.min(Math.max(session.page, 0), pageCount - 1);
  const options = session.sources.slice(session.page * 25, session.page * 25 + 25).map((source) => ({
    label: source.label.slice(0, 100),
    description: source.description.slice(0, 100),
    value: source.value,
  }));
  const rows = [new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('wizard-source')
      .setPlaceholder('Select a raid encounter or saved post')
      .addOptions(options)
  )];
  if (pageCount > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wizard-prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(session.page === 0),
      new ButtonBuilder().setCustomId('wizard-next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(session.page === pageCount - 1)
    ));
  }
  return rows;
}

function selectedTemplateCounts(needs) {
  const requirements = parseNeeds(needs);
  const counts = {};
  for (const [roleSpec, count] of Object.entries(requirements)) {
    const roleName = parseRoleDefinition(roleSpec).role;
    if (ROLE_TEMPLATES[roleName]) counts[roleName] = count;
  }
  return counts;
}

function selectedTemplateClasses(needs) {
  const classes = {};
  for (const roleSpec of Object.keys(parseNeeds(needs))) {
    const definition = parseRoleDefinition(roleSpec);
    if (!ROLE_TEMPLATES[definition.role]) continue;
    classes[definition.role] = definition.classes.length
      ? definition.classes
      : (CLASS_NAME_LOOKUP.has(definition.role.toLowerCase()) ? [CLASS_NAME_LOOKUP.get(definition.role.toLowerCase())] : []);
  }
  return classes;
}

function rolePickerComponents(session) {
  const selected = new Set(Object.keys(session.counts));
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('wizard-roles')
        .setPlaceholder('Select up to four required roles')
        .setMinValues(1)
        .setMaxValues(4)
        .addOptions(Object.entries(ROLE_TEMPLATES).map(([value, template]) => ({
          label: template.label,
          description: parseRoleDefinition(template.spec).classes.join(', ').slice(0, 100) || `${template.label} only`,
          value,
          default: selected.has(value),
        })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard-to-classes')
        .setLabel('Continue to classes')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(selected.size === 0)
    ),
  ];
}

function classPickerComponents(session) {
  const rows = Object.keys(session.counts).slice(0, 4).map((role) => {
    const selected = new Set(session.classes[role] ?? []);
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`wizard-classes:${role}`)
        .setPlaceholder(`${role}: select eligible classes`)
        .setMinValues(1)
        .setMaxValues(CHARACTER_CLASSES.length)
        .addOptions(CHARACTER_CLASSES.map((characterClass) => ({
          label: characterClass.name,
          description: `${characterClass.category} • ${characterClass.abbreviation}`,
          value: characterClass.name,
          default: selected.has(characterClass.name),
        })))
    );
  });
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('wizard-back-roles').setLabel('Change roles').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wizard-to-counts').setLabel('Set counts').setStyle(ButtonStyle.Primary)
  ));
  return rows;
}

function classPickerContent(session) {
  const roleList = Object.keys(session.counts)
    .slice(0, 4)
    .map((role, index) => `**${index + 1}. ${role}**`)
    .join('\n');
  return `**${session.target}**\nChoose which classes can fill each role. The dropdowns follow this order:\n${roleList}`;
}

function countPickerComponents(session) {
  const rows = Object.entries(session.counts).slice(0, 4).map(([role, selectedCount]) =>
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`wizard-count:${role}`)
        .setPlaceholder(`${role} required: ${selectedCount}`)
        .addOptions(Array.from({ length: 20 }, (_, index) => ({
          label: `${index + 1} ${role}`,
          value: String(index + 1),
          default: selectedCount === index + 1,
        })))
    )
  );
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('wizard-back-roles').setLabel('Change roles').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wizard-back-classes').setLabel('Edit classes').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wizard-confirm').setLabel(session.mode === 'create' ? 'Save & Post' : 'Save Changes').setStyle(ButtonStyle.Success)
  ));
  return rows;
}

function wizardNeeds(session) {
  return Object.entries(session.counts)
    .map(([role, count]) => {
      const classes = session.classes[role] ?? [];
      const plainClassRole = classes.length === 1 && classes[0] === role;
      return `${plainClassRole ? role : `${role}(${classes.join('|')})`}:${count}`;
    })
    .join(',');
}

async function startRaidcheckWizard(interaction, mode) {
  const store = loadStore();
  const session = { mode, page: 0, sources: wizardSources(store, interaction.guildId, mode), counts: {}, classes: {} };
  wizardSessions.set(wizardKey(interaction), session);
  await interaction.reply({
    content: mode === 'create' ? '**Create Raid Check**\nSelect an encounter.' : '**Edit Raid Check**\nSelect a saved preset or posted raidcheck.',
    components: sourcePickerComponents(session),
    flags: MessageFlags.Ephemeral,
  });
}

function requirementsToEditor(needs) {
  return Object.entries(parseNeeds(needs)).map(([roleSpec, count]) => {
    const definition = parseRoleDefinition(roleSpec);
    const classes = definition.classes.length ? definition.classes : [definition.role];
    return `${definition.role} | ${classes.join(', ')} | ${count}`;
  }).join('\n');
}

function editorToRequirements(input) {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const requirements = [];
  for (const line of lines) {
    const [roleInput, classesInput, countInput, ...extra] = line.split('|').map((part) => part.trim());
    const count = Number(countInput);
    if (!roleInput || !classesInput || extra.length || !Number.isInteger(count) || count < 1) {
      return { error: `Invalid line: \`${line}\`. Use \`Role | Class, Class | Count\`.` };
    }
    const classes = classesInput.split(',').map((name) => name.trim()).filter(Boolean)
      .map((name) => CLASS_NAME_LOOKUP.get(name.toLowerCase()) || name);
    if (!classes.length) return { error: `List at least one class for \`${roleInput}\`.` };
    const plainClassRole = classes.length === 1 && classes[0].toLowerCase() === roleInput.toLowerCase();
    requirements.push(`${plainClassRole ? classes[0] : `${roleInput}(${classes.join('|')})`}:${count}`);
  }
  if (!requirements.length) return { error: 'Add at least one role.' };
  return { needs: requirements.join(',') };
}

function buildCompositionModal(mode, presetKeyValue, preset) {
  const sessionId = `${mode}:${presetKeyValue}`;
  return new ModalBuilder()
    .setCustomId(`raidcheck-composition:${sessionId}`.slice(0, 100))
    .setTitle(`${mode === 'create' ? 'Create' : 'Edit'}: ${preset.target}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('composition')
          .setLabel('Role | Eligible classes | Count')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(requirementsToEditor(preset.needs).slice(0, 4000))
          .setPlaceholder('Tank | Warrior, Paladin, Shadow Knight | 2\nDPS | Wizard, Rogue, Monk | 10')
      )
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

    if (interaction.isModalSubmit() && interaction.customId.startsWith('raidcheck-composition:')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const [, mode, key] = interaction.customId.split(':');
      const store = loadStore();
      const preset = resolvePreset(key, store);
      if (!preset) {
        await interaction.editReply({ content: 'That raid target preset no longer exists.' });
        return;
      }
      const parsed = editorToRequirements(interaction.fields.getTextInputValue('composition'));
      if (parsed.error) {
        await interaction.editReply({ content: parsed.error });
        return;
      }
      const updatedPreset = { ...preset, needs: parsed.needs };
      store.presets[key] = updatedPreset;

      if (mode === 'edit') {
        saveStore(store);
        await interaction.editReply({ content: `${preset.target} was updated and remains available under \`/raid\`.` });
        return;
      }

      const channel = await resolveRaidcheckChannel(interaction, null, store);
      if (!isUsableTextChannel(channel)) {
        await interaction.editReply({ content: 'A Raid Leader must first set the posting channel with `/raidcheck channel`.' });
        return;
      }
      const requirements = parseNeeds(parsed.needs);
      const claims = Object.fromEntries(Object.keys(requirements).map((role) => [role, []]));
      const { embed } = buildEmbed({ target: preset.target, needs: parsed.needs, claims });
      const message = await channel.send({ embeds: [embed], components: buildComponents(requirements, claims) });
      store.raidchecks[message.id] = {
        messageId: message.id,
        channelId: channel.id,
        target: preset.target,
        needs: parsed.needs,
        timeframe: preset.timeframe ?? '',
        tag: preset.tag ?? 'None',
        windowHours: preset.windowHours,
        claims,
      };
      saveStore(store);
      await interaction.editReply({ content: `${preset.target} was saved and posted in ${channel}.` });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('raidcheck-target-remove:')) {
      if (!canConfigureRaidcheck(interaction)) {
        await interaction.reply({ content: 'Only a Raid Leader or member with Manage Channels permission can remove targets.', flags: MessageFlags.Ephemeral });
        return;
      }
      const key = interaction.customId.slice('raidcheck-target-remove:'.length);
      const store = loadStore();
      const preset = resolvePreset(key, store);
      if (!preset) {
        await interaction.update({ content: 'That raid target has already been removed.', components: [] });
        return;
      }
      delete store.presets[key];
      store.disabledPresets[key] = true;
      saveStore(store);
      await interaction.update({ content: `Removed raid target **${preset.target}**. Existing posted raidchecks were not deleted.`, components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId === 'raidcheck-target-remove-cancel') {
      await interaction.update({ content: 'Raid target removal cancelled.', components: [] });
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'raidcheck-create-modal') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const store = loadStore();
      const presetInput = interaction.fields.getTextInputValue('preset').trim();
      const targetInput = interaction.fields.getTextInputValue('target').trim();
      const needsInput = interaction.fields.getTextInputValue('needs').trim();
      const savePresetInput = interaction.fields.getTextInputValue('savePreset').trim();
      const preset = resolvePreset(presetInput, store);
      const target = targetInput || preset?.target;
      const needs = needsInput || preset?.needs;
      const timeframe = preset?.timeframe ?? '';
      const tag = preset?.tag || 'None';
      const windowHours = preset?.windowHours;
      const channel = await resolveRaidcheckChannel(interaction, null, store);
      const requirements = parseNeeds(needs);

      if (!target || !hasValidRequirements(requirements)) {
        await interaction.editReply({ content: 'Enter a valid preset, or provide a target and requirements such as `Warrior:1,Cleric:5,DPS(WIZ|ROG|MNK):10`.' });
        return;
      }
      if (!isUsableTextChannel(channel)) {
        await interaction.editReply({ content: 'A Raid Leader must first set the posting channel with `/raidcheck channel`.' });
        return;
      }

      if (savePresetInput) {
        const key = presetKey(savePresetInput);
        if (!key) {
          await interaction.editReply({ content: 'The preset key must contain at least one letter or number.' });
          return;
        }
        store.presets[key] = { target, needs: normalizeRoleSpec(needs), timeframe, tag, windowHours };
      }

      const claims = Object.fromEntries(Object.keys(requirements).map((role) => [role, []]));
      const { embed } = buildEmbed({ target, needs, claims });
      const message = await channel.send({ embeds: [embed], components: buildComponents(requirements, claims) });
      store.raidchecks[message.id] = { messageId: message.id, channelId: channel.id, target, needs, timeframe, tag, windowHours, claims };
      saveStore(store);
      await interaction.editReply({ content: `Raidcheck posted in ${channel}.${savePresetInput ? ` Preset \`${presetKey(savePresetInput)}\` was saved.` : ''}` });
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'raidcheck-edit-modal') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const store = loadStore();
      const identifier = interaction.fields.getTextInputValue('identifier').trim();
      const targetInput = interaction.fields.getTextInputValue('target').trim();
      const needsInput = interaction.fields.getTextInputValue('needs').trim();
      const raidcheck = store.raidchecks[identifier];

      if (raidcheck) {
        const updated = {
          ...raidcheck,
          target: targetInput || raidcheck.target,
          needs: needsInput ? normalizeRoleSpec(needsInput) : raidcheck.needs,
        };
        const requirements = parseNeeds(updated.needs);
        if (!updated.target || !hasValidRequirements(requirements)) {
          await interaction.editReply({ content: 'Enter valid requirements such as `Warrior:1,Cleric:5,DPS(WIZ|ROG|MNK):10`.' });
          return;
        }
        const claims = flattenClaims(updated.claims);
        const { embed } = buildEmbed({ target: updated.target, needs: updated.needs, claims });
        const channel = await client.channels.fetch(updated.channelId).catch(() => null);
        const message = channel?.isTextBased() ? await channel.messages.fetch(identifier).catch(() => null) : null;
        if (!message) {
          await interaction.editReply({ content: 'The stored raidcheck message could not be found.' });
          return;
        }
        await message.edit({ embeds: [embed], components: buildComponents(requirements, claims) });
        updated.claims = claims;
        store.raidchecks[identifier] = updated;
        saveStore(store);
        await interaction.editReply({ content: `Raidcheck ${identifier} updated.` });
        return;
      }

      const key = presetKey(identifier);
      const preset = resolvePreset(key, store);
      if (!preset) {
        await interaction.editReply({ content: 'No posted raidcheck or saved preset was found for that value.' });
        return;
      }
      const updatedPreset = {
        ...preset,
        target: targetInput || preset.target,
        needs: needsInput ? normalizeRoleSpec(needsInput) : preset.needs,
      };
      if (!updatedPreset.target || !hasValidRequirements(parseNeeds(updatedPreset.needs))) {
        await interaction.editReply({ content: 'Enter valid requirements such as `Warrior:1,Cleric:5,DPS(WIZ|ROG|MNK):10`.' });
        return;
      }
      store.presets[key] = updatedPreset;
      saveStore(store);
      await interaction.editReply({ content: `Preset \`${key}\` updated.` });
      return;
    }

    if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('wizard-')) {
      const session = wizardSessions.get(wizardKey(interaction));
      if (!session) {
        await interaction.reply({ content: 'This wizard expired. Run the command again.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (interaction.customId === 'wizard-prev' || interaction.customId === 'wizard-next') {
        session.page += interaction.customId === 'wizard-next' ? 1 : -1;
        await interaction.update({ components: sourcePickerComponents(session) });
        return;
      }

      if (interaction.customId === 'wizard-source' && interaction.isStringSelectMenu()) {
        const source = session.sources.find((entry) => entry.value === interaction.values[0]);
        if (!source) return;
        session.sourceValue = source.value;
        session.target = source.target;
        session.counts = selectedTemplateCounts(source.needs);
        session.classes = selectedTemplateClasses(source.needs);
        await interaction.update({
          content: `**${session.mode === 'create' ? 'Create' : 'Edit'} Raid Check: ${session.target}**\nSelect the roles required for this encounter.`,
          components: rolePickerComponents(session),
        });
        return;
      }

      if (interaction.customId === 'wizard-roles' && interaction.isStringSelectMenu()) {
        session.counts = Object.fromEntries(interaction.values.map((role) => [role, session.counts[role] || 1]));
        session.classes = Object.fromEntries(interaction.values.map((role) => [
          role,
          session.classes[role] ?? parseRoleDefinition(ROLE_TEMPLATES[role].spec).classes
            .concat(parseRoleDefinition(ROLE_TEMPLATES[role].spec).classes.length ? [] : [role]),
        ]));
        await interaction.update({
          content: `**${session.target}**\nSelect the roles required for this encounter, then press Continue.`,
          components: rolePickerComponents(session),
        });
        return;
      }

      if (interaction.customId === 'wizard-to-classes') {
        await interaction.update({
          content: classPickerContent(session),
          components: classPickerComponents(session),
        });
        return;
      }

      if (interaction.customId.startsWith('wizard-classes:') && interaction.isStringSelectMenu()) {
        const role = interaction.customId.slice('wizard-classes:'.length);
        session.classes[role] = [...interaction.values];
        await interaction.update({ components: classPickerComponents(session) });
        return;
      }

      if (interaction.customId === 'wizard-to-counts') {
        await interaction.update({
          content: `**${session.target}**\nChoose how many players are required for each role.`,
          components: countPickerComponents(session),
        });
        return;
      }

      if (interaction.customId === 'wizard-back-roles') {
        await interaction.update({
          content: `**${session.target}**\nSelect the roles required for this encounter.`,
          components: rolePickerComponents(session),
        });
        return;
      }

      if (interaction.customId === 'wizard-back-classes') {
        await interaction.update({
          content: classPickerContent(session),
          components: classPickerComponents(session),
        });
        return;
      }

      if (interaction.customId.startsWith('wizard-count:') && interaction.isStringSelectMenu()) {
        const role = interaction.customId.slice('wizard-count:'.length);
        session.counts[role] = Number(interaction.values[0]);
        await interaction.update({ components: countPickerComponents(session) });
        return;
      }

      if (interaction.customId === 'wizard-confirm') {
        await interaction.deferUpdate();
        const store = loadStore();
        const needs = wizardNeeds(session);
        const requirements = parseNeeds(needs);
        const [sourceType, sourceId] = session.sourceValue.split(':');

        if (session.mode === 'create') {
          const channel = await resolveRaidcheckChannel(interaction, null, store);
          if (!isUsableTextChannel(channel)) {
            await interaction.editReply({ content: 'A Raid Leader must first set the posting channel with `/raidcheck channel`.', components: [] });
            return;
          }
          const originalPreset = resolvePreset(sourceId, store) ?? {};
          store.presets[sourceId] = { ...originalPreset, target: session.target, needs };
          const claims = Object.fromEntries(Object.keys(requirements).map((role) => [role, []]));
          const { embed } = buildEmbed({ target: session.target, needs, claims });
          const message = await channel.send({ embeds: [embed], components: buildComponents(requirements, claims) });
          store.raidchecks[message.id] = {
            messageId: message.id,
            channelId: channel.id,
            target: session.target,
            needs,
            timeframe: originalPreset.timeframe ?? '',
            tag: originalPreset.tag ?? 'None',
            windowHours: originalPreset.windowHours,
            claims,
          };
          saveStore(store);
          wizardSessions.delete(wizardKey(interaction));
          await interaction.editReply({ content: `Raidcheck saved and posted in ${channel}.`, components: [] });
          return;
        }

        if (sourceType === 'preset') {
          const originalPreset = resolvePreset(sourceId, store) ?? {};
          store.presets[sourceId] = { ...originalPreset, target: session.target, needs };
          saveStore(store);
        } else {
          const raidcheck = store.raidchecks[sourceId];
          const claims = flattenClaims(raidcheck.claims);
          raidcheck.needs = needs;
          raidcheck.claims = claims;
          const channel = await client.channels.fetch(raidcheck.channelId).catch(() => null);
          const message = channel?.isTextBased() ? await channel.messages.fetch(sourceId).catch(() => null) : null;
          if (!message) {
            await interaction.editReply({ content: 'The posted raidcheck message could not be found.', components: [] });
            return;
          }
          const { embed } = buildEmbed({ target: raidcheck.target, needs, claims });
          await message.edit({ embeds: [embed], components: buildComponents(requirements, claims) });
          saveStore(store);
        }
        wizardSessions.delete(wizardKey(interaction));
        await interaction.editReply({ content: `${session.target} was updated.`, components: [] });
        return;
      }
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'raid') {
        if (!(await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral }))) {
          return;
        }

        const targetChoice = interaction.options.getString('target');

        const store = loadStore();
        const channel = await resolveRaidcheckChannel(interaction, null, store);
        const preset = resolvePreset(targetChoice, store);
        const target = preset?.target;
        const needs = preset?.needs;
        const timeframe = preset?.timeframe ?? '';
        const tag = preset?.tag || 'None';
        const windowHours = preset?.windowHours;

        if (!target || !needs) {
          await interaction.editReply({ content: 'Choose a supported raid target such as `vs` or `vs-pop`.' });
          return;
        }

        const requirements = parseNeeds(needs);
        if (!isUsableTextChannel(channel)) {
          await interaction.editReply({ content: 'A Raid Leader must first set the posting channel with `/raidcheck channel`.' });
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

    if (interaction.isChatInputCommand() && interaction.commandName === 'raidcheck') {
      if (interaction.options.getSubcommand() === 'remove') {
        if (!canConfigureRaidcheck(interaction)) {
          await interaction.reply({ content: 'Only a Raid Leader or member with Manage Channels permission can remove targets.', flags: MessageFlags.Ephemeral });
          return;
        }
        const key = presetKey(interaction.options.getString('target'));
        const preset = resolvePreset(key, loadStore());
        if (!preset) {
          await interaction.reply({ content: 'Select an existing raid target from autocomplete.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.reply({
          content: `Remove **${preset.target}** from the raid target list? Existing posted raidchecks will remain.`,
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`raidcheck-target-remove:${key}`).setLabel('Remove target').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('raidcheck-target-remove-cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
          )],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

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
        const key = presetKey(interaction.options.getString('target'));
        const selectedPreset = resolvePreset(key, loadStore());
        if (!selectedPreset) {
          await interaction.reply({ content: 'Select a raid target from autocomplete.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.showModal(buildCompositionModal('create', key, selectedPreset));
        return;
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
        const key = presetKey(interaction.options.getString('target'));
        const selectedPreset = resolvePreset(key, loadStore());
        if (!selectedPreset) {
          await interaction.reply({ content: 'Select a raid target preset from autocomplete.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.showModal(buildCompositionModal('edit', key, selectedPreset));
        return;
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
