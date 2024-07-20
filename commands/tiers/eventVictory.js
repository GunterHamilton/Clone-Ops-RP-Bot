const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

const VALUES = {
  TT: [6, 9, 20, 35],
  AFT: [20, 10, 25, 50],
  ACT: [6, 15, 27, 67],
  RCT: [8, 25, 30, 85]
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event_victories')
    .setDescription('Select an event victory category and tier.'),
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

      // Ensure the event_victories table exists
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

      await connection.end();

      // Create category select menu
      const categoryMenu = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`category-${uniqueId}`)
            .setPlaceholder('Select a category')
            .addOptions([
              { label: 'TT', value: 'TT' },
              { label: 'AFT', value: 'AFT' },
              { label: 'ACT', value: 'ACT' },
              { label: 'RCT', value: 'RCT' }
            ])
        );

      // Send the initial embed with category selection
      const message = await interaction.reply({
        content: 'Select a category:',
        components: [categoryMenu],
        fetchReply: true
      });

      // Create a collector to handle category selection
      const categoryFilter = i => i.customId === `category-${uniqueId}` && i.user.id === userId;
      const categoryCollector = message.createMessageComponentCollector({ filter: categoryFilter, time: 60000 });

      categoryCollector.on('collect', async i => {
        const category = i.values[0];
        const tierMenu = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`tier-${uniqueId}`)
              .setPlaceholder('Select a tier')
              .addOptions([
                { label: 'Tier 1', value: '1' },
                { label: 'Tier 2', value: '2' },
                { label: 'Tier 3', value: '3' },
                { label: 'Tier 4', value: '4' }
              ])
          );

        await i.update({
          content: `Selected category: ${category}. Now select a tier:`,
          components: [tierMenu]
        });

        // Create a collector to handle tier selection
        const tierFilter = j => j.customId === `tier-${uniqueId}` && j.user.id === userId;
        const tierCollector = message.createMessageComponentCollector({ filter: tierFilter, time: 60000 });

        tierCollector.on('collect', async j => {
          const tier = parseInt(j.values[0]);
          const value = VALUES[category][tier - 1];

          try {
            const connection = await mysql.createConnection({
              host: process.env.DB_HOST,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME
            });

            // Fetch current victories status
            const [rows] = await connection.execute('SELECT * FROM event_victories WHERE user_id = ?', [userId]);
            let totalValue = 0;
            let victoriesCompleted = {};

            if (rows.length > 0) {
              totalValue = rows[0].total_value;
              victoriesCompleted = JSON.parse(rows[0].victories_completed);
            }

            // Update victories completed and total value
            if (!victoriesCompleted[category]) {
              victoriesCompleted[category] = [];
            }
            victoriesCompleted[category].push(tier);
            totalValue += value;

            // Insert or update victories in the database
            await connection.execute(`
              INSERT INTO event_victories (user_id, user_name, total_value, victories_completed)
              VALUES (?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
              user_name = VALUES(user_name),
              total_value = VALUES(total_value),
              victories_completed = VALUES(victories_completed),
              updated_at = CURRENT_TIMESTAMP
            `, [userId, userName, totalValue, JSON.stringify(victoriesCompleted)]);

            await connection.end();

            await j.reply({ content: `${category} Tier ${tier} completed with value ${value}. Your total value is now ${totalValue}.`, ephemeral: true });
            // Delete the initial interaction message
            await message.delete();
          } catch (error) {
            console.error('Database error:', error);
            await j.reply({ content: 'There was an error saving your event victory to the database.', ephemeral: true });
          }
        });
      });

      categoryCollector.on('end', async collected => {
        try {
          // Disable category menu after the collector ends
          categoryMenu.components.forEach(menu => menu.setDisabled(true));
          await message.edit({ components: [categoryMenu] });
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
      await interaction.reply({ content: 'There was an error initializing your event victory selection.', ephemeral: true });
    }
  },
};