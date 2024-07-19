const { SlashCommandBuilder } = require('@discordjs/builders');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('main-quest')
    .setDescription('Select a main quest.')
    .addIntegerOption(option =>
      option.setName('quest')
        .setDescription('Select a main quest number (1-4)')
        .setRequired(true)
        .addChoices(
          { name: 'Quest 1', value: 1 },
          { name: 'Quest 2', value: 2 },
          { name: 'Quest 3', value: 3 },
          { name: 'Quest 4', value: 4 }
        )),
  async execute(interaction) {
    const questNumber = interaction.options.getInteger('quest');
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
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS main_quests (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          total_value INT NOT NULL DEFAULT 0,
          quests_completed JSON NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Ensure columns are correct
      await connection.execute(`
        ALTER TABLE main_quests 
        ADD COLUMN IF NOT EXISTS total_value INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS quests_completed JSON NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      `);

      // Determine the value based on the quest number
      let value;
      switch (questNumber) {
        case 1:
        case 2:
          value = 10;
          break;
        case 3:
          value = 20;
          break;
        case 4:
          value = 25;
          break;
        default:
          return interaction.reply({ content: 'Invalid quest number.', ephemeral: true });
      }

      // Check if the user has already completed this quest
      const [rows] = await connection.execute('SELECT * FROM main_quests WHERE user_id = ?', [userId]);
      let questsCompleted = [];
      let totalValue = 0;

      if (rows.length > 0) {
        questsCompleted = JSON.parse(rows[0].quests_completed);
        totalValue = rows[0].total_value;
      }

      if (questsCompleted.includes(questNumber)) {
        await interaction.reply({ content: `You have already completed Quest ${questNumber}.`, ephemeral: true });
        await connection.end();
        return;
      }

      // Update the user's total quest value and completed quests
      totalValue += value;
      questsCompleted.push(questNumber);

      const query = `
        INSERT INTO main_quests (user_id, user_name, total_value, quests_completed)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        user_name = VALUES(user_name),
        total_value = VALUES(total_value),
        quests_completed = VALUES(quests_completed),
        updated_at = CURRENT_TIMESTAMP
      `;
      await connection.execute(query, [userId, userName, totalValue, JSON.stringify(questsCompleted)]);
      await connection.end();

      await interaction.reply({ content: `Quest ${questNumber} completed with value ${value}. Your total value is now ${totalValue}.`, ephemeral: true });
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error saving your quest to the database.', ephemeral: true });
    }
  },
};
