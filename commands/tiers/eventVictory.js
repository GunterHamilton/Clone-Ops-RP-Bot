const { SlashCommandBuilder } = require('@discordjs/builders');
const mysql = require('mysql2/promise');

const VALUES = {
  'clone_trooper': [6, 9, 20, 35],
  'arf': [20, 10, 25, 50],
  'arc': [6, 15, 27, 67],
  'republic_commando': [8, 25, 30, 85]
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event_victories')
    .setDescription('Complete an event victory.'),
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

      // Ensure the user_status table exists and fetch the user's current category and tier
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS user_status (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          category VARCHAR(255) NOT NULL,
          tier INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

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

      const tableName = `${category}_victories`;

      // Ensure the necessary table exists for the user's category
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          total_value INT NOT NULL DEFAULT 0,
          victories_completed JSON NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Determine the value based on the category and tier
      const value = VALUES[category][tier - 1];

      // Fetch current victories status
      const [rows] = await connection.execute(`SELECT * FROM ${tableName} WHERE user_id = ?`, [userId]);
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
        INSERT INTO ${tableName} (user_id, user_name, total_value, victories_completed)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        user_name = VALUES(user_name),
        total_value = VALUES(total_value),
        victories_completed = VALUES(victories_completed),
        updated_at = CURRENT_TIMESTAMP
      `, [userId, userName, totalValue, JSON.stringify(victoriesCompleted)]);

      await interaction.reply({
        content: `${category.replace('_', ' ')} Tier ${tier} completed with value ${value}. Your total value is now ${totalValue}.`,
        ephemeral: true
      });

      await connection.end();
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error saving your event victory to the database.', ephemeral: true });
    }
  },
};
