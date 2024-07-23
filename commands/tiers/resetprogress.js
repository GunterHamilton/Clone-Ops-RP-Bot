const { SlashCommandBuilder } = require('@discordjs/builders');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-progress')
    .setDescription('Reset the progress of a user in a specific category.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Select the user to reset')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Select the category')
        .setRequired(true)
        .addChoices(
          { name: 'ARC', value: 'arc' },
          { name: 'ARF', value: 'arf' },
          { name: 'Clone Trooper', value: 'clone_trooper' },
          { name: 'Republic Commando', value: 'republic_commando' }
        )),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const userId = targetUser.id;
    const userName = targetUser.tag;
    const category = interaction.options.getString('category');

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      const tables = ['main_tiers', 'side_tiers', 'medals', 'victories'];
      
      for (const table of tables) {
        await connection.execute(`DELETE FROM ${category}_${table} WHERE user_id = ?`, [userId]);
      }

      await connection.end();

      await interaction.reply({ content: `Successfully reset the progress of ${userName} in the ${category} category.`, ephemeral: true });
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error resetting the user\'s progress.', ephemeral: true });
    }
  },
};
