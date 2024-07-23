const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Displays your tier completion status across all categories.')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Select the category')
        .setRequired(true)
        .addChoices(
          { name: 'ARC', value: 'arc' },
          { name: 'ARF', value: 'arf' },
          { name: 'Clone Trooper', value: 'clone_trooper' },
          { name: 'Republic Commando', value: 'republic_commando' }
        ))
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Select a user to view their status')),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const userId = targetUser.id;
    const userName = targetUser.tag;
    const uniqueId = Date.now().toString(); // Unique identifier for this interaction
    const category = interaction.options.getString('category');

    const stagePoints = {
      'trooper': [250, 600, 1000, 1500],
      'arf': [400, 700, 1100, 1600],
      'arc': [500, 800, 1200, 1700],
      'rc': [550, 900, 1400, 2000]
    };

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      // Ensure the necessary tables exist for the selected category
      const tables = ['main_tiers', 'side_tiers', 'medals', 'event_victories'];
      for (const table of tables) {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS ${category}_${table} (
            user_id VARCHAR(255) NOT NULL PRIMARY KEY,
            user_name VARCHAR(255) NOT NULL,
            total_value INT NOT NULL DEFAULT 0,
            ${table === 'main_tiers' || table === 'side_tiers' ? 'tiers_completed' : table === 'medals' ? 'medals_completed' : 'victories_completed'} JSON NOT NULL DEFAULT '${table === 'main_tiers' || table === 'side_tiers' ? '[]' : '{}'}',
            stage INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
      }

      const fetchCategoryStatus = async (tableName) => {
        const [rows] = await connection.execute(`SELECT * FROM ${category}_${tableName} WHERE user_id = ?`, [userId]);
        let totalValue = 0;
        let completed = tableName === 'main_tiers' || tableName === 'side_tiers' ? [] : {};
        let stage = 1;

        if (rows.length > 0) {
          totalValue = rows[0].total_value;
          completed = JSON.parse(rows[0][tableName === 'main_tiers' || tableName === 'side_tiers' ? 'tiers_completed' : tableName === 'medals' ? 'medals_completed' : 'victories_completed']);
          stage = rows[0].stage;
        }

        return { totalValue, completed, stage };
      };

      const mainStatus = await fetchCategoryStatus('main_tiers');
      const sideStatus = await fetchCategoryStatus('side_tiers');
      const medalsStatus = await fetchCategoryStatus('medals');
      const eventStatus = await fetchCategoryStatus('event_victories');

      const createEmbed = (title, totalValue, completed, stage) => {
        return new EmbedBuilder()
          .setTitle(`${userName}'s ${title} (${category.toUpperCase()} Stage ${stage})`)
          .setColor(0xFFA500) // Orange color
          .addFields(
            { name: 'Total Value', value: `${totalValue}`, inline: false },
            { name: 'Completed', value: completed.length > 0 ? completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: false }
          )
          .setTimestamp();
      };

      const mainEmbed = createEmbed('Main Tier Completion Status', mainStatus.totalValue, mainStatus.completed, mainStatus.stage);
      const sideEmbed = createEmbed('Side Tier Completion Status', sideStatus.totalValue, sideStatus.completed, sideStatus.stage);
      const medalsEmbed = createEmbed('Medals Completion Status', medalsStatus.totalValue, Object.entries(medalsStatus.completed).length > 0 ? Object.entries(medalsStatus.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : [], medalsStatus.stage);
      const eventsEmbed = createEmbed('Event Victories Completion Status', eventStatus.totalValue, Object.entries(eventStatus.completed).length > 0 ? Object.entries(eventStatus.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : [], eventStatus.stage);

      const totalValue = mainStatus.totalValue + sideStatus.totalValue + medalsStatus.totalValue + eventStatus.totalValue;
      const totalEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Total Completion Status (${category.toUpperCase()})`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Main Tier Total Value', value: `${mainStatus.totalValue}`, inline: true },
          { name: 'Main Tiers Completed', value: mainStatus.completed.length > 0 ? mainStatus.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
          { name: 'Side Tier Total Value', value: `${sideStatus.totalValue}`, inline: true },
          { name: 'Side Tiers Completed', value: sideStatus.completed.length > 0 ? sideStatus.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
          { name: 'Medals Total Value', value: `${medalsStatus.totalValue}`, inline: true },
          { name: 'Medals Completed', value: Object.entries(medalsStatus.completed).length > 0 ? Object.entries(medalsStatus.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : 'None', inline: true },
          { name: 'Event Victories Total Value', value: `${eventStatus.totalValue}`, inline: true },
          { name: 'Victories Completed', value: Object.entries(eventStatus.completed).length > 0 ? Object.entries(eventStatus.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : 'None', inline: true },
          { name: 'Overall Total Value', value: `${totalValue}`, inline: true }
        )
        .setTimestamp();

      // Check if the user has completed the quota for the current stage
      let resetMessage = '';
      if (mainStatus.totalValue >= stagePoints.trooper[mainStatus.stage - 1]) {
        resetMessage = `You have completed the quota to move onto the next stage! Your progress has now been reset!`;

        // Increment the user's stage and reset their progress
        const newStage = mainStatus.stage + 1;

        for (const table of tables) {
          await connection.execute(`DELETE FROM ${category}_${table} WHERE user_id = ?`, [userId]);
          await connection.execute(`
            INSERT INTO ${category}_${table} (user_id, user_name, total_value, ${table === 'main_tiers' || table === 'side_tiers' ? 'tiers_completed' : table === 'medals' ? 'medals_completed' : 'victories_completed'}, stage)
            VALUES (?, ?, 0, ?, ?)
            ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), total_value = 0, ${table === 'main_tiers' || table === 'side_tiers' ? 'tiers_completed' : table === 'medals' ? 'medals_completed' : 'victories_completed'} = VALUES(${table === 'main_tiers' || table === 'side_tiers' ? 'tiers_completed' : table === 'medals' ? 'medals_completed' : 'victories_completed'}), stage = ?
          `, [userId, userName, table === 'main_tiers' || table === 'side_tiers' ? '[]' : '{}', newStage, newStage]);
        }
      }

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

      // Send the initial embed with buttons
      const embeds = [mainEmbed];
      if (resetMessage) {
        embeds.push(new EmbedBuilder().setTitle('Stage Complete!').setDescription(resetMessage).setColor(0x00FF00).setTimestamp());
      }
      const message = await interaction.reply({ embeds, components: [buttons], fetchReply: true });

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

    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error retrieving the status from the database.', ephemeral: true });
    }
  },
};
