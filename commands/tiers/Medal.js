const { SlashCommandBuilder } = require('@discordjs/builders');
const mysql = require('mysql2/promise');

const VALUES = {
  'clone_trooper': [6, 18, 30, 50],
  'arf': [20, 20, 38, 75],
  'arc': [12, 25, 40, 100],
  'republic_commando': [15, 25, 45, 125]
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('medals')
    .setDescription('Complete a medal.')
    .addIntegerOption(option => 
      option.setName('tier')
        .setDescription('Select a tier')
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
    const tier = interaction.options.getInteger('tier');

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      // Ensure the user_status table exists and fetch the user's current category
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

      const [userStatus] = await connection.execute('SELECT category FROM user_status WHERE user_id = ?', [userId]);

      let category = 'clone_trooper';

      if (userStatus.length === 0) {
        // Insert default status if not found
        await connection.execute('INSERT INTO user_status (user_id, user_name, category, tier) VALUES (?, ?, ?, ?)', [userId, userName, category, 1]);
      } else {
        category = userStatus[0].category;
      }

      const tableName = `${category}_medals`;

      // Ensure the necessary table exists for the user's category
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          total_value INT NOT NULL DEFAULT 0,
          medals_completed JSON NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Determine the value based on the category and tier
      const value = VALUES[category][tier - 1];

      // Fetch current medals status
      const [rows] = await connection.execute(`SELECT * FROM ${tableName} WHERE user_id = ?`, [userId]);
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
        INSERT INTO ${tableName} (user_id, user_name, total_value, medals_completed)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        user_name = VALUES(user_name),
        total_value = VALUES(total_value),
        medals_completed = VALUES(medals_completed),
        updated_at = CURRENT_TIMESTAMP
      `, [userId, userName, totalValue, JSON.stringify(medalsCompleted)]);

      await interaction.reply({
        content: `${category.replace('_', ' ')} Tier ${tier} completed with value ${value}. Your total value is now ${totalValue}.`,
        ephemeral: true
      });

      await connection.end();
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error saving your medal to the database.', ephemeral: true });
    }
  },
};
