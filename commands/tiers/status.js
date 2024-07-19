const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mysql = require('mysql2/promise');

const MAX_MAIN_TOTAL_VALUE = 65;
const MAX_SIDE_TOTAL_VALUE = 39;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Displays your tier completion status.'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userName = interaction.user.tag;

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      // Ensure the main_tiers table exists
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

      // Ensure the side_tiers table exists
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
          { name: 'Total Value', value: `${mainTotalValue}/${MAX_MAIN_TOTAL_VALUE}`, inline: false },
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
          { name: 'Total Value', value: `${sideTotalValue}/${MAX_SIDE_TOTAL_VALUE}`, inline: false },
          { name: 'Tiers Completed', value: sideTiersCompleted.length > 0 ? sideTiersCompleted.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: false }
        )
        .setTimestamp();

      await connection.end();

      // Create buttons for navigation
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('main')
            .setLabel('Main Quest')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('side')
            .setLabel('Side Quest')
            .setStyle(ButtonStyle.Primary)
        );

      // Send the initial embed
      const message = await interaction.reply({ embeds: [mainEmbed], components: [buttons], fetchReply: true });

      // Create a collector to handle button interactions
      const filter = i => (i.customId === 'main' || i.customId === 'side') && i.user.id === userId;
      const collector = message.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (i.customId === 'main') {
          await i.update({ embeds: [mainEmbed], components: [buttons] });
        } else if (i.customId === 'side') {
          await i.update({ embeds: [sideEmbed], components: [buttons] });
        }
      });

      collector.on('end', async collected => {
        try {
          // Disable buttons after the collector ends
          buttons.components.forEach(button => button.setDisabled(true));
          await message.edit({ components: [buttons] });
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
