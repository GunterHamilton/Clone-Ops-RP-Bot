const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

const VALUES = {
  'Clone Trooper': [6, 18, 30, 50],
  ARF: [20, 20, 38, 75],
  ARC: [12, 25, 40, 100],
  'Republic Commando': [15, 25, 45, 125]
};

const STAGE_COMPLETION_POINTS = {
  'Clone Trooper': 250,
  ARF: 400,
  ARC: 500,
  'Republic Commando': 550
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('medals')
    .setDescription('Select a medal category and tier.'),
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

      // Ensure the medals table exists
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

      await connection.end();

      // Create category select menu
      const categoryMenu = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`category-${uniqueId}`)
            .setPlaceholder('Select a category')
            .addOptions([
              { label: 'Clone Trooper', value: 'Clone Trooper' },
              { label: 'ARF', value: 'ARF' },
              { label: 'ARC', value: 'ARC' },
              { label: 'Republic Commando', value: 'Republic Commando' }
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

            // Fetch current medals status
            const [rows] = await connection.execute('SELECT * FROM medals WHERE user_id = ?', [userId]);
            let totalValue = 0;
            let medalsCompleted = {};

            if (rows.length > 0) {
              totalValue = rows[0].total_value;
              medalsCompleted = JSON.parse(rows[0].medals_completed);
            }

            // Update medals completed and total value
            if (!medalsCompleted[category]) {
              medalsCompleted[category] = [];
            }
            medalsCompleted[category].push(tier);
            totalValue += value;

            // Insert or update medals in the database
            await connection.execute(`
              INSERT INTO medals (user_id, user_name, total_value, medals_completed)
              VALUES (?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
              user_name = VALUES(user_name),
              total_value = VALUES(total_value),
              medals_completed = VALUES(medals_completed),
              updated_at = CURRENT_TIMESTAMP
            `, [userId, userName, totalValue, JSON.stringify(medalsCompleted)]);

            // Check if the user has completed the current stage and reset progress if necessary
            if (totalValue >= STAGE_COMPLETION_POINTS[category]) {
              await connection.execute(`DELETE FROM medals WHERE user_id = ?`, [userId]);
              await j.reply({
                content: `You have completed the quota to move onto the next stage! Your progress has now been reset!`,
                ephemeral: true
              });
            } else {
              await j.reply({
                content: `${category} Tier ${tier} completed with value ${value}. Your total value is now ${totalValue}.`,
                ephemeral: true
              });
            }

            await connection.end();
            // Delete the initial interaction message
            await message.delete();
          } catch (error) {
            console.error('Database error:', error);
            await j.reply({ content: 'There was an error saving your medal to the database.', ephemeral: true });
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
      await interaction.reply({ content: 'There was an error initializing your medal selection.', ephemeral: true });
    }
  },
};
