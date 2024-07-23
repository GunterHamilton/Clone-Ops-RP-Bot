const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Displays your tier completion status across all categories.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Select a user to view their status')
        .setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('target') || interaction.user;
    const userId = user.id;
    const userName = user.tag;
    const uniqueId = Date.now().toString(); // Unique identifier for this interaction

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      // Ensure the necessary tables exist
      const tables = ['clone_trooper_tiers', 'arf_tiers', 'arc_tiers', 'republic_commando_tiers'];
      for (const table of tables) {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS ${table} (
            user_id VARCHAR(255) NOT NULL PRIMARY KEY,
            user_name VARCHAR(255) NOT NULL,
            total_value INT NOT NULL DEFAULT 0,
            tiers_completed JSON NOT NULL DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
      }

      const fetchCategoryStatus = async (tableName) => {
        const [rows] = await connection.execute(`SELECT * FROM ${tableName} WHERE user_id = ?`, [userId]);
        let totalValue = 0;
        let completed = [];

        if (rows.length > 0) {
          totalValue = rows[0].total_value;
          completed = JSON.parse(rows[0].tiers_completed);
          if (typeof completed !== 'object' || completed === null) {
            completed = [];
          }
          if (!Array.isArray(completed)) {
            completed = Object.values(completed).flat();
          }
        }

        return { totalValue, completed };
      };

      const mainStatus = await fetchCategoryStatus('clone_trooper_tiers');
      const sideStatus = await fetchCategoryStatus('arf_tiers');
      const medalsStatus = await fetchCategoryStatus('arc_tiers');
      const eventStatus = await fetchCategoryStatus('republic_commando_tiers');

      const createEmbed = (title, data) => {
        return new EmbedBuilder()
          .setTitle(`${userName}'s ${title}`)
          .setColor(0xFFA500) // Orange color
          .addFields(
            { name: 'Main Tier Total Value', value: `${data.main.totalValue}`, inline: true },
            { name: 'Main Tiers Completed', value: data.main.completed.length > 0 ? data.main.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
            { name: 'Side Tier Total Value', value: `${data.side.totalValue}`, inline: true },
            { name: 'Side Tiers Completed', value: data.side.completed.length > 0 ? data.side.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
            { name: 'Medals Total Value', value: `${data.medals.totalValue}`, inline: true },
            { name: 'Medals Completed', value: Object.entries(data.medals.completed).length > 0 ? Object.entries(data.medals.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : 'None', inline: true },
            { name: 'Event Victories Total Value', value: `${data.events.totalValue}`, inline: true },
            { name: 'Victories Completed', value: Object.entries(data.events.completed).length > 0 ? Object.entries(data.events.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : 'None', inline: true }
          )
          .setTimestamp();
      };

      const totalValue = mainStatus.totalValue + sideStatus.totalValue + medalsStatus.totalValue + eventStatus.totalValue;
      const totalEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Total Completion Status`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Total Value', value: `${totalValue}`, inline: true }
        )
        .setTimestamp();

      const statusData = {
        main: mainStatus,
        side: sideStatus,
        medals: medalsStatus,
        events: eventStatus,
      };

      const mainEmbed = createEmbed('Main Tier Completion Status', statusData);
      const sideEmbed = createEmbed('Side Tier Completion Status', statusData);
      const medalsEmbed = createEmbed('Medals Completion Status', statusData);
      const eventsEmbed = createEmbed('Event Victories Completion Status', statusData);

      // Create buttons for navigation
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`main-${uniqueId}`)
            .setLabel('Main Quest')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`side-${uniqueId}`)
            .setLabel('Side Quest')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`medals-${uniqueId}`)
            .setLabel('Medals')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`events-${uniqueId}`)
            .setLabel('Events')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`total-${uniqueId}`)
            .setLabel('Total Status')
            .setStyle(ButtonStyle.Success)
        );

      // Send the initial embed with buttons
      const message = await interaction.reply({ embeds: [mainEmbed], components: [buttons], fetchReply: true });

      // Create a collector to handle button interactions
      const filter = i => i.customId.endsWith(uniqueId) && i.user.id === userId;
      const collector = message.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (i.user.id !== userId) {
          return i.reply({ content: 'You are not allowed to use these buttons.', ephemeral: true });
        }
        if (i.customId === `main-${uniqueId}`) {
          await i.update({ embeds: [mainEmbed], components: [buttons] });
        } else if (i.customId === `side-${uniqueId}`) {
          await i.update({ embeds: [sideEmbed], components: [buttons] });
        } else if (i.customId === `medals-${uniqueId}`) {
          await i.update({ embeds: [medalsEmbed], components: [buttons] });
        } else if (i.customId === `events-${uniqueId}`) {
          await i.update({ embeds: [eventsEmbed], components: [buttons] });
        } else if (i.customId === `total-${uniqueId}`) {
          await i.update({ embeds: [totalEmbed], components: [buttons] });
        }
      });

      collector.on('end', async () => {
        try {
          // Disable buttons after the collector ends
          buttons.components.forEach(button => button.setDisabled(true));
          await message.edit({ components: [buttons] });
          // Delete the initial interaction message if it's still there
          if (message.deletable) {
            await message.delete();
          }
        } catch (error) {
          if (error.code === 10008) {
            console.log('Message was deleted before it could be edited.');
          } else {
            console.error('Error editing message:', error);
          }
        }
      });

      await connection.end();

    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error retrieving your status from the database.', ephemeral: true });
    }
  },
};
