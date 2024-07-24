const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quotaupdate')
    .setDescription('Update a user\'s category or tier.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Select a user to update')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Select the new category')
        .setRequired(true)
        .addChoices(
          { name: 'ARC', value: 'arc' },
          { name: 'ARF', value: 'arf' },
          { name: 'Clone Trooper', value: 'clone_trooper' },
          { name: 'Republic Commando', value: 'republic_commando' }
        ))
    .addIntegerOption(option =>
      option.setName('tier')
        .setDescription('Select the new tier')
        .setRequired(true)
        .addChoices(
          { name: '1', value: 1 },
          { name: '2', value: 2 },
          { name: '3', value: 3 },
          { name: '4', value: 4 }
        )),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('target');
    const userId = targetUser.id;
    const userName = targetUser.tag;
    const newCategory = interaction.options.getString('category');
    const newTier = interaction.options.getInteger('tier');

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      // Ensure the user_status table exists
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS user_status (
          user_id VARCHAR(255) NOT NULL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          category VARCHAR(255) NOT NULL DEFAULT 'clone_trooper',
          tier INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Update the user's category and tier
      await connection.execute(`
        INSERT INTO user_status (user_id, user_name, category, tier)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        user_name = VALUES(user_name),
        category = VALUES(category),
        tier = VALUES(tier),
        updated_at = CURRENT_TIMESTAMP
      `, [userId, userName, newCategory, newTier]);

      await connection.end();

      await interaction.reply({ content: `Successfully updated ${userName}'s category to ${newCategory} and tier to ${newTier}.`, ephemeral: true });
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error updating the user\'s status in the database.', ephemeral: true });
    }
  },
};
