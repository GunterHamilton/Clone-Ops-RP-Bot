const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Displays your tier completion status across all categories.'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userName = interaction.user.tag;
    const uniqueId = Date.now().toString(); // Unique identifier for this interaction

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      // Ensure the necessary tables exist
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS main_tiers (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          total_value INT NOT NULL DEFAULT 0,
          tiers_completed JSON NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS side_tiers (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          total_value INT NOT NULL DEFAULT 0,
          tiers_completed JSON NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS medals (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          total_value INT NOT NULL DEFAULT 0,
          medals_completed JSON NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS event_victories (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          total_value INT NOT NULL DEFAULT 0,
          victories_completed JSON NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Fetch main quest status
      const [mainRows] = await connection.execute('SELECT * FROM main_tiers WHERE user_id = ?', [userId]);
      let mainTotalValue = 0;
      let mainTiersCompleted = [];

      if (mainRows.length > 0) {
        mainTotalValue = mainRows[0].total_value;
        mainTiersCompleted = JSON.parse(mainRows[0].tiers_completed);
      }

      const mainEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Main Tier Completion Status`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Total Value', value: `${mainTotalValue}`, inline: false },
          { name: 'Tiers Completed', value: mainTiersCompleted.length > 0 ? mainTiersCompleted.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: false }
        )
        .setTimestamp();

      // Fetch side quest status
      const [sideRows] = await connection.execute('SELECT * FROM side_tiers WHERE user_id = ?', [userId]);
      let sideTotalValue = 0;
      let sideTiersCompleted = [];

      if (sideRows.length > 0) {
        sideTotalValue = sideRows[0].total_value;
        sideTiersCompleted = JSON.parse(sideRows[0].tiers_completed);
      }

      const sideEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Side Tier Completion Status`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Total Value', value: `${sideTotalValue}`, inline: false },
          { name: 'Tiers Completed', value: sideTiersCompleted.length > 0 ? sideTiersCompleted.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: false }
        )
        .setTimestamp();

      // Fetch medals status
      const [medalsRows] = await connection.execute('SELECT * FROM medals WHERE user_id = ?', [userId]);
      let medalsTotalValue = 0;
      let medalsCompleted = {};

      if (medalsRows.length > 0) {
        medalsTotalValue = medalsRows[0].total_value;
        medalsCompleted = JSON.parse(medalsRows[0].medals_completed);
      }

      const medalsEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Medals Completion Status`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Total Value', value: `${medalsTotalValue}`, inline: false },
          { name: 'Tiers Completed', value: Object.entries(medalsCompleted).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') || 'None', inline: false }
        )
        .setTimestamp();

      // Fetch event victories status
      const [eventRows] = await connection.execute('SELECT * FROM event_victories WHERE user_id = ?', [userId]);
      let eventTotalValue = 0;
      let victoriesCompleted = {};

      if (eventRows.length > 0) {
        eventTotalValue = eventRows[0].total_value;
        victoriesCompleted = JSON.parse(eventRows[0].victories_completed);
      }

      const eventsEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Event Victories Completion Status`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Total Value', value: `${eventTotalValue}`, inline: false },
          { name: 'Tiers Completed', value: Object.entries(victoriesCompleted).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') || 'None', inline: false }
        )
        .setTimestamp();

      // Calculate total values and completed tiers
      const totalValue = mainTotalValue + sideTotalValue + medalsTotalValue + eventTotalValue;
      const totalTiersCompleted = [...mainTiersCompleted, ...sideTiersCompleted, ...Object.values(medalsCompleted).flat(), ...Object.values(victoriesCompleted).flat()];

      const totalEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Total Completion Status`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Total Value', value: `${totalValue}`, inline: false },
          { name: 'Tiers Completed', value: totalTiersCompleted.length > 0 ? totalTiersCompleted.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: false }
        )
        .setTimestamp();

      await connection.end();

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

      // Send the initial embed
      const message = await interaction.reply({ embeds: [mainEmbed], components: [buttons], fetchReply: true });

      // Create a collector to handle button interactions
      const filter = i => i.customId.endsWith(uniqueId) && (i.customId.startsWith('main-') || i.customId.startsWith('side-') || i.customId.startsWith('medals-') || i.customId.startsWith('events-') || i.customId.startsWith('total-'));
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

      collector.on('end', async collected => {
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
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error retrieving your status from the database.', ephemeral: true });
    }
  },
};
