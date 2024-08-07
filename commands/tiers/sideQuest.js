const { SlashCommandBuilder } = require('@discordjs/builders');
const mysql = require('mysql2/promise');

const VALUES = {
  clone_trooper: [4, 5, 10, 20],
  arf: [4, 5, 10, 20],
  arc: [4, 5, 10, 20],
  republic_commando: [4, 5, 10, 20]
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sidequest')
    .setDescription('Complete a side quest tier.')
    .addIntegerOption(option =>
      option.setName('tier')
        .setDescription('Select a tier number (1-4)')
        .setRequired(true)
        .addChoices(
          { name: 'Tier 1', value: 1 },
          { name: 'Tier 2', value: 2 },
          { name: 'Tier 3', value: 3 },
          { name: 'Tier 4', value: 4 }
        )),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userName = interaction.user.tag;
    const tierNumber = interaction.options.getInteger('tier');

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      // Get the user's current category and tier from the user_status table
      const [userStatus] = await connection.execute('SELECT category, tier FROM user_status WHERE user_id = ?', [userId]);

      let category = 'clone_trooper';
      let tier = 1;

      if (userStatus.length === 0) {
        // Insert default status if not found
        await connection.execute('INSERT INTO user_status (user_id, user_name, category, tier) VALUES (?, ?, ?, ?)', [userId, userName, category, tier]);
      } else {
        category = userStatus[0].category;
        tier = userStatus[0].tier;
      }

      // Ensure the necessary table exists for the user's category
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${category}_side_tiers (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          total_value INT NOT NULL DEFAULT 0,
          tiers_completed JSON NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Determine the value based on the category and tier number
      const value = VALUES[category][tierNumber - 1];

      // Fetch the user's current progress
      const [rows] = await connection.execute(`SELECT * FROM ${category}_side_tiers WHERE user_id = ?`, [userId]);
      let totalValue = 0;
      let tiersCompleted = [];

      if (rows.length > 0) {
        totalValue = rows[0].total_value;
        tiersCompleted = JSON.parse(rows[0].tiers_completed);
      }

      // Update the user's total value and completed tiers
      totalValue += value;
      tiersCompleted.push(tierNumber);

      await connection.execute(`
        INSERT INTO ${category}_side_tiers (user_id, user_name, total_value, tiers_completed)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        user_name = VALUES(user_name),
        total_value = VALUES(total_value),
        tiers_completed = VALUES(tiers_completed),
        updated_at = CURRENT_TIMESTAMP
      `, [userId, userName, totalValue, JSON.stringify(tiersCompleted)]);

      await connection.end();

      await interaction.reply({ content: `Tier ${tierNumber} completed with value ${value}. Your total value is now ${totalValue}.`, ephemeral: true });
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error saving your tier to the database.', ephemeral: true });
    }
  },
};
