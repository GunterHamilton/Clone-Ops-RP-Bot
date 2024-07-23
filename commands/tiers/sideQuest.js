const { SlashCommandBuilder } = require('@discordjs/builders');
const mysql = require('mysql2/promise');

const STAGE_COMPLETION_POINTS = {
  'arc': 500,
  'arf': 400,
  'clone_trooper': 250,
  'republic_commando': 550
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('side-quest')
    .setDescription('Select a side tier.')
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
    .addIntegerOption(option =>
      option.setName('tier')
        .setDescription('Select a side tier number (1-4)')
        .setRequired(true)
        .addChoices(
          { name: 'Tier 1', value: 1 },
          { name: 'Tier 2', value: 2 },
          { name: 'Tier 3', value: 3 },
          { name: 'Tier 4', value: 4 }
        )),
  async execute(interaction) {
    const tierNumber = interaction.options.getInteger('tier');
    const category = interaction.options.getString('category');
    const userId = interaction.user.id;
    const userName = interaction.user.tag;

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      // Check if the table exists, and create it if it doesn't
      const tableName = `${category}_side_tiers`;
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          total_value INT NOT NULL DEFAULT 0,
          tiers_completed JSON NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Determine the value based on the tier number
      let value;
      switch (tierNumber) {
        case 1:
          value = 4;
          break;
        case 2:
          value = 5;
          break;
        case 3:
          value = 10;
          break;
        case 4:
          value = 20;
          break;
        default:
          return interaction.reply({ content: 'Invalid tier number.', ephemeral: true });
      }

      // Check if the user has already completed this tier
      const [rows] = await connection.execute(`SELECT * FROM ${tableName} WHERE user_id = ?`, [userId]);
      let tiersCompleted = [];
      let totalValue = 0;

      if (rows.length > 0) {
        tiersCompleted = JSON.parse(rows[0].tiers_completed);
        totalValue = rows[0].total_value;
      }

      // Update the user's total tier value and completed tiers
      totalValue += value;
      tiersCompleted.push(tierNumber);

      const query = `
        INSERT INTO ${tableName} (user_id, user_name, total_value, tiers_completed)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        user_name = VALUES(user_name),
        total_value = VALUES(total_value),
        tiers_completed = VALUES(tiers_completed),
        updated_at = CURRENT_TIMESTAMP
      `;
      await connection.execute(query, [userId, userName, totalValue, JSON.stringify(tiersCompleted)]);

      // Check if the user has completed the current stage and reset progress if necessary
      if (totalValue >= STAGE_COMPLETION_POINTS[category]) {
        await connection.execute(`DELETE FROM ${tableName} WHERE user_id = ?`, [userId]);
        await interaction.reply({
          content: `You have completed the quota to move onto the next stage! Your progress has now been reset!`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `Tier ${tierNumber} completed with value ${value} in the ${category} category. Your total value is now ${totalValue}.`,
          ephemeral: true
        });
      }

      await connection.end();
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error saving your tier to the database.', ephemeral: true });
    }
  },
};
