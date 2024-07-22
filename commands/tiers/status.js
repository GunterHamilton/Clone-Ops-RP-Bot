const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
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

      // Create a select menu for category selection
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select-${uniqueId}`)
        .setPlaceholder('Select a category')
        .addOptions([
          { label: 'ARC', value: 'arc' },
          { label: 'ARF', value: 'arf' },
          { label: 'Trooper', value: 'trooper' },
          { label: 'Republic Commando', value: 'rc' },
        ]);

      const selectRow = new ActionRowBuilder().addComponents(selectMenu);

      // Send the initial select menu
      await interaction.reply({ content: 'Please select a category to view your status:', components: [selectRow], ephemeral: true });

      // Create a collector to handle select menu interactions
      const filter = i => i.customId.endsWith(uniqueId) && i.user.id === userId;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;

        const category = i.values[0];
        let embed;

        switch (category) {
          case 'arc':
            embed = mainEmbed;
            break;
          case 'arf':
            embed = sideEmbed;
            break;
          case 'trooper':
            embed = medalsEmbed;
            break;
          case 'rc':
            embed = eventsEmbed;
            break;
          default:
            return;
        }

        await i.update({ embeds: [embed], components: [] });
      });

      collector.on('end', async () => {
        try {
          // Disable select menu after the collector ends
          selectMenu.setDisabled(true);
          await interaction.editReply({ components: [selectRow] });
        } catch (error) {
          console.error('Error editing message:', error);
        }
      });

      await connection.end();

    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error retrieving your status from the database.', ephemeral: true });
    }
  },
};
