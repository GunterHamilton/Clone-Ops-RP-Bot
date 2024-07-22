const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
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
      const tables = ['main_tiers', 'side_tiers', 'medals', 'event_victories'];
      for (const table of tables) {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS ${table} (
            user_id VARCHAR(255) NOT NULL PRIMARY KEY,
            user_name VARCHAR(255) NOT NULL,
            total_value INT NOT NULL DEFAULT 0,
            ${table === 'main_tiers' || table === 'side_tiers' ? 'tiers_completed' : table === 'medals' ? 'medals_completed' : 'victories_completed'} JSON NOT NULL DEFAULT '${table === 'main_tiers' || table === 'side_tiers' ? '[]' : '{}'}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
      }

      const fetchCategoryStatus = async (tableName) => {
        const [rows] = await connection.execute(`SELECT * FROM ${tableName} WHERE user_id = ?`, [userId]);
        let totalValue = 0;
        let completed = tableName === 'main_tiers' || tableName === 'side_tiers' ? [] : {};

        if (rows.length > 0) {
          totalValue = rows[0].total_value;
          completed = JSON.parse(rows[0][tableName === 'main_tiers' || tableName === 'side_tiers' ? 'tiers_completed' : tableName === 'medals' ? 'medals_completed' : 'victories_completed']);
        }

        return { totalValue, completed };
      };

      const mainStatus = await fetchCategoryStatus('main_tiers');
      const sideStatus = await fetchCategoryStatus('side_tiers');
      const medalsStatus = await fetchCategoryStatus('medals');
      const eventStatus = await fetchCategoryStatus('event_victories');

      const createEmbed = (title, main, side, medals, events) => {
        return new EmbedBuilder()
          .setTitle(`${userName}'s ${title}`)
          .setColor(0xFFA500) // Orange color
          .addFields(
            { name: 'Main Tier Total Value', value: `${main.totalValue}`, inline: true },
            { name: 'Main Tiers Completed', value: main.completed.length > 0 ? main.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
            { name: 'Side Tier Total Value', value: `${side.totalValue}`, inline: true },
            { name: 'Side Tiers Completed', value: side.completed.length > 0 ? side.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
            { name: 'Medals Total Value', value: `${medals.totalValue}`, inline: true },
            { name: 'Medals Completed', value: Object.entries(medals.completed).length > 0 ? Object.entries(medals.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : 'None', inline: true },
            { name: 'Event Victories Total Value', value: `${events.totalValue}`, inline: true },
            { name: 'Victories Completed', value: Object.entries(events.completed).length > 0 ? Object.entries(events.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : 'None', inline: true }
          )
          .setTimestamp();
      };

      const arcEmbed = createEmbed('ARC Tier Completion Status', mainStatus, sideStatus, medalsStatus, eventStatus);
      const arfEmbed = createEmbed('ARF Tier Completion Status', mainStatus, sideStatus, medalsStatus, eventStatus);
      const trooperEmbed = createEmbed('Trooper Tier Completion Status', mainStatus, sideStatus, medalsStatus, eventStatus);
      const rcEmbed = createEmbed('Republic Commando Tier Completion Status', mainStatus, sideStatus, medalsStatus, eventStatus);

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
      const filter = i => i.customId === `select-${uniqueId}` && i.user.id === userId;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;

        const category = i.values[0];
        let embed;

        switch (category) {
          case 'arc':
            embed = arcEmbed;
            break;
          case 'arf':
            embed = arfEmbed;
            break;
          case 'trooper':
            embed = trooperEmbed;
            break;
          case 'rc':
            embed = rcEmbed;
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
