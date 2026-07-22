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
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';

const dataDir = join(process.cwd(), 'data');
const storePath = join(dataDir, 'raidcheck-store.json');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('raidcheck')
    .setDescription('Create or edit a raidcheck post.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a new raidcheck role request')
        .addStringOption((option) => option.setName('target').setDescription('Target name').setRequired(true))
        .addStringOption((option) => option.setName('needs').setDescription('Role requirements like Warrior:1,Cleric:3').setRequired(true))
        .addStringOption((option) => option.setName('timeframe').setDescription('When the raid is happening').setRequired(true))
        .addStringOption((option) => option.setName('tag').setDescription('Optional tag such as batphone or sockphone').setRequired(false))
        .addChannelOption((option) => option.setName('channel').setDescription('Channel to post in').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription('Edit an active raidcheck message')
        .addStringOption((option) => option.setName('message-id').setDescription('Message ID for the raidcheck').setRequired(true))
        .addStringOption((option) => option.setName('needs').setDescription('Updated role requirements').setRequired(false))
        .addStringOption((option) => option.setName('timeframe').setDescription('Updated timeframe').setRequired(false))
        .addStringOption((option) => option.setName('tag').setDescription('Updated tag').setRequired(false))
    )
    .toJSON(),
];

function ensureStore() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(storePath)) {
    writeFileSync(storePath, JSON.stringify({ raidchecks: {} }, null, 2));
  }
}

function loadStore() {
  ensureStore();
  return JSON.parse(readFileSync(storePath, 'utf8'));
}

function saveStore(store) {
  ensureStore();
  writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function parseNeeds(input) {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [role, count] = part.split(':').map((entry) => entry.trim());
      if (!role || !count || Number.isNaN(Number(count))) {
        return acc;
      }
      acc[role] = Number(count);
      return acc;
    }, {});
}

function formatRoleList(requirements, claims = {}) {
  return Object.entries(requirements)
    .map(([role, count]) => {
      const claimed = claims[role] ?? [];
      const remaining = Math.max(count - claimed.length, 0);
      const ownerNames = claimed.map((id) => `<@${id}>`).join(', ') || 'None';
      return `• ${role}: ${remaining}/${count} open — ${ownerNames}`;
    })
    .join('\n');
}

function buildComponents(requirements, claims = {}) {
  const rows = [];
  const roles = Object.entries(requirements);

  for (let i = 0; i < roles.length; i += 5) {
    const chunk = roles.slice(i, i + 5);
    const row = new ActionRowBuilder();

    for (const [role, required] of chunk) {
      const claimed = claims[role] ?? [];
      const remaining = Math.max(required - claimed.length, 0);
      const label = `${role} (${remaining}/${required})`;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`raidcheck-role:${encodeURIComponent(role)}`)
          .setLabel(label)
          .setStyle(remaining > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(remaining === 0)
      );
    }

    rows.push(row);
  }

  return rows;
}

function buildEmbed({ target, needs, timeframe, tag, claims = {} }) {
  const requirements = parseNeeds(needs);
  const embed = new EmbedBuilder()
    .setTitle(`Raid Check: ${target}`)
    .setDescription(`Tag: ${tag || 'None'}\nTimeframe: ${timeframe}`)
    .addFields({ name: 'Requirements', value: formatRoleList(requirements, claims) || 'No roles listed', inline: false })
    .setColor('#00AEEF')
    .setTimestamp();

  return { embed, requirements };
}

async function refreshMessage(messageId, updated) {
  const store = loadStore();
  const raidcheck = store.raidchecks[messageId];
  if (!raidcheck) return;

  const channel = await client.channels.fetch(raidcheck.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const { embed, requirements } = buildEmbed({
    target: updated.target ?? raidcheck.target,
    needs: updated.needs ?? raidcheck.needs,
    timeframe: updated.timeframe ?? raidcheck.timeframe,
    tag: updated.tag ?? raidcheck.tag,
    claims: updated.claims ?? raidcheck.claims,
  });

  await message.edit({
    embeds: [embed],
    components: buildComponents(requirements, updated.claims ?? raidcheck.claims),
  });
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
  if (interaction.isChatInputCommand() && interaction.commandName === 'raidcheck') {
    if (interaction.options.getSubcommand() === 'create') {
      const target = interaction.options.getString('target');
      const needs = interaction.options.getString('needs');
      const timeframe = interaction.options.getString('timeframe');
      const tag = interaction.options.getString('tag') ?? 'None';
      const channel = interaction.options.getChannel('channel');

      const requirements = parseNeeds(needs);
      const claims = Object.fromEntries(Object.keys(requirements).map((role) => [role, []]));
      const { embed } = buildEmbed({ target, needs, timeframe, tag, claims });

      const message = await channel.send({
        embeds: [embed],
        components: buildComponents(requirements, claims),
      });

      const store = loadStore();
      store.raidchecks[message.id] = {
        messageId: message.id,
        channelId: channel.id,
        target,
        needs,
        timeframe,
        tag,
        claims,
      };
      saveStore(store);

      await interaction.reply({ content: `Raidcheck posted in ${channel}. Message ID: ${message.id}`, ephemeral: true });
      return;
    }

    if (interaction.options.getSubcommand() === 'edit') {
      const messageId = interaction.options.getString('message-id');
      const needs = interaction.options.getString('needs');
      const timeframe = interaction.options.getString('timeframe');
      const tag = interaction.options.getString('tag');

      const store = loadStore();
      const raidcheck = store.raidchecks[messageId];
      if (!raidcheck) {
        await interaction.reply({ content: 'No raidcheck found for that message ID.', ephemeral: true });
        return;
      }

      const updated = {
        ...raidcheck,
        needs: needs ?? raidcheck.needs,
        timeframe: timeframe ?? raidcheck.timeframe,
        tag: tag ?? raidcheck.tag,
      };

      const { embed, requirements } = buildEmbed({
        target: updated.target,
        needs: updated.needs,
        timeframe: updated.timeframe,
        tag: updated.tag,
        claims: updated.claims,
      });

      const channel = await client.channels.fetch(updated.channelId).catch(() => null);
      if (channel?.isTextBased()) {
        const existingMessage = await channel.messages.fetch(messageId).catch(() => null);
        if (existingMessage) {
          await existingMessage.edit({
            embeds: [embed],
            components: buildComponents(requirements, updated.claims),
          });
        }
      }

      store.raidchecks[messageId] = updated;
      saveStore(store);

      await interaction.reply({ content: `Raidcheck ${messageId} updated.`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const [type, encodedRole] = interaction.customId.split(':');
    if (type !== 'raidcheck-role') return;

    const role = decodeURIComponent(encodedRole);
    const store = loadStore();
    const raidcheck = store.raidchecks[interaction.message.id];
    if (!raidcheck) return;

    const requirements = parseNeeds(raidcheck.needs);
    const claims = raidcheck.claims ?? Object.fromEntries(Object.keys(requirements).map((key) => [key, []]));
    const claimantId = interaction.user.id;
    const roleClaims = claims[role] ?? [];

    if (!roleClaims.includes(claimantId) && roleClaims.length < requirements[role]) {
      roleClaims.push(claimantId);
    }

    const updatedClaims = { ...claims, [role]: roleClaims };
    const { embed } = buildEmbed({
      target: raidcheck.target,
      needs: raidcheck.needs,
      timeframe: raidcheck.timeframe,
      tag: raidcheck.tag,
      claims: updatedClaims,
    });

    raidcheck.claims = updatedClaims;
    store.raidchecks[interaction.message.id] = raidcheck;
    saveStore(store);

    await interaction.update({
      embeds: [embed],
      components: buildComponents(requirements, updatedClaims),
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
