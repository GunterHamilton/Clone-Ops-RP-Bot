const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trooperstatus')
    .setDescription('Displays your tier completion status across all categories.'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userName = interaction.user.tag;
    const uniqueId = Date.now().toString(); // Unique identifier for this interaction

    const menu = new SelectMenuBuilder()
      .setCustomId(`select-${uniqueId}`)
      .setPlaceholder('Select a category')
      .addOptions([
        { label: 'ARC', value: 'arc' },
        { label: 'ARF', value: 'arf' },
        { label: 'Trooper', value: 'trooper' },
        { label: 'Republic Commando', value: 'rc' },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Please select a category to view your status:',
      components: [row],
      ephemeral: true,
    });

    const filter = (i) => i.customId === `select-${uniqueId}` && i.user.id === userId;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (i) => {
      if (!i.isSelectMenu()) return;

      const category = i.values[0];
      let tableName = '';
      let title = '';

      switch (category) {
        case 'arc':
          tableName = 'arc_tiers';
          title = 'ARC Tier Completion Status';
          break;
        case 'arf':
          tableName = 'arf_tiers';
          title = 'ARF Tier Completion Status';
          break;
        case 'trooper':
          tableName = 'trooper_tiers';
          title = 'Trooper Tier Completion Status';
          break;
        case 'rc':
          tableName = 'rc_tiers';
          title = 'Republic Commando Tier Completion Status';
          break;
        default:
          return;
      }

      // Ensure the necessary table exists
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

      // Fetch status from the selected table
      const [rows] = await connection.execute(`SELECT * FROM ${tableName} WHERE user_id = ?`, [userId]);
      let totalValue = 0;
      let tiersCompleted = [];

      if (rows.length > 0) {
        totalValue = rows[0].total_value;
        tiersCompleted = JSON.parse(rows[0].tiers_completed);
      }

      const embed = new EmbedBuilder()
        .setTitle(`${userName}'s ${title}`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Total Value', value: `${totalValue}`, inline: false },
          { name: 'Tiers Completed', value: tiersCompleted.length > 0 ? tiersCompleted.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: false }
        )
        .setTimestamp();

      await i.update({ embeds: [embed], components: [] });
    });

    collector.on('end', async () => {
      try {
        // Disable menu after the collector ends
        menu.setDisabled(true);
        await interaction.editReply({ components: [row] });
      } catch (error) {
        console.error('Error editing message:', error);
      }
    });
  },
};
