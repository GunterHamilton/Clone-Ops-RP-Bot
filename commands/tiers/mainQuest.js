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
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          user_name VARCHAR(255) NOT NULL,
          quest_number INT NOT NULL,
          value INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Check if the user has already completed this quest
      const [rows] = await connection.execute('SELECT * FROM main_quests WHERE user_id = ? AND quest_number = ?', [userId, questNumber]);

      if (rows.length > 0) {
        await interaction.reply({ content: `You have already completed Quest ${questNumber}.`, ephemeral: true });
        await connection.end();
        return;
      }

      // Determine the value based on the quest number
      let value;
      switch (questNumber) {
        case 1:
          value = 10;
          break;
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

      // Save the quest information to the database
      const query = 'INSERT INTO main_quests (user_id, user_name, quest_number, value) VALUES (?, ?, ?, ?)';
      await connection.execute(query, [userId, userName, questNumber, value]);
      await connection.end();

      await interaction.reply({ content: `Quest ${questNumber} completed with value ${value}.`, ephemeral: true });
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error saving your quest to the database.', ephemeral: true });
    }
  },
};
