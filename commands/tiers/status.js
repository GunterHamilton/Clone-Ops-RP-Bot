const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Displays your tier completion status across all categories.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Select a user to view their status')
        .setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('target') || interaction.user;
    const userId = user.id;
    const userName = user.tag;
    const uniqueId = Date.now().toString(); // Unique identifier for this interaction

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      // Ensure the necessary tables exist
      const tables = ['clone_trooper_tiers', 'arf_tiers', 'arc_tiers', 'republic_commando_tiers'];
      for (const table of tables) {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS ${table} (
            user_id VARCHAR(255) NOT NULL PRIMARY KEY,
            user_name VARCHAR(255) NOT NULL,
            total_value INT NOT NULL DEFAULT 0,
            tiers_completed JSON NOT NULL DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
      }

      const fetchCategoryStatus = async (tableName) => {
        const [rows] = await connection.execute(`SELECT * FROM ${tableName} WHERE user_id = ?`, [userId]);
        let totalValue = 0;
        let completed = [];

        if (rows.length > 0) {
          totalValue = rows[0].total_value;
          completed = JSON.parse(rows[0].tiers_completed);
          if (typeof completed !== 'object' || completed === null) {
            completed = [];
          }
          if (!Array.isArray(completed)) {
            completed = Object.values(completed).flat();
          }
        }

        return { totalValue, completed };
      };

      const cloneTrooperStatus = await fetchCategoryStatus('clone_trooper_tiers');
      const arfStatus = await fetchCategoryStatus('arf_tiers');
      const arcStatus = await fetchCategoryStatus('arc_tiers');
      const republicCommandoStatus = await fetchCategoryStatus('republic_commando_tiers');

      const createEmbed = (title, data) => {
        return new EmbedBuilder()
          .setTitle(`${userName}'s ${title}`)
          .setColor(0xFFA500) // Orange color
          .addFields(
            { name: 'Clone Trooper Total Value', value: `${data.cloneTrooper.totalValue}`, inline: true },
            { name: 'Clone Trooper Tiers Completed', value: data.cloneTrooper.completed.length > 0 ? data.cloneTrooper.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
            { name: 'ARF Total Value', value: `${data.arf.totalValue}`, inline: true },
            { name: 'ARF Tiers Completed', value: data.arf.completed.length > 0 ? data.arf.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
            { name: 'ARC Total Value', value: `${data.arc.totalValue}`, inline: true },
            { name: 'ARC Tiers Completed', value: data.arc.completed.length > 0 ? data.arc.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
            { name: 'Republic Commando Total Value', value: `${data.republicCommando.totalValue}`, inline: true },
            { name: 'Republic Commando Tiers Completed', value: data.republicCommando.completed.length > 0 ? data.republicCommando.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true }
          )
          .setTimestamp();
      };

      const totalValue = cloneTrooperStatus.totalValue + arfStatus.totalValue + arcStatus.totalValue + republicCommandoStatus.totalValue;
      const totalEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Total Completion Status`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Total Value', value: `${totalValue}`, inline: true }
        )
        .setTimestamp();

      const statusData = {
        cloneTrooper: cloneTrooperStatus,
        arf: arfStatus,
        arc: arcStatus,
        republicCommando: republicCommandoStatus,
      };

      const cloneTrooperEmbed = createEmbed('Clone Trooper Completion Status', statusData);
      const arfEmbed = createEmbed('ARF Completion Status', statusData);
      const arcEmbed = createEmbed('ARC Completion Status', statusData);
      const republicCommandoEmbed = createEmbed('Republic Commando Completion Status', statusData);

      // Create buttons for navigation
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`cloneTrooper-${uniqueId}`)
            .setLabel('Clone Trooper')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`arf-${uniqueId}`)
            .setLabel('ARF')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`arc-${uniqueId}`)
            .setLabel('ARC')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`republicCommando-${uniqueId}`)
            .setLabel('Republic Commando')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`total-${uniqueId}`)
            .setLabel('Total Status')
            .setStyle(ButtonStyle.Success)
        );

      // Send the initial embed with buttons
      const message = await interaction.reply({ embeds: [cloneTrooperEmbed], components: [buttons], fetchReply: true });

      // Create a collector to handle button interactions
      const filter = i => i.customId.endsWith(uniqueId) && i.user.id === userId;
      const collector = message.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (i.user.id !== userId) {
          return i.reply({ content: 'You are not allowed to use these buttons.', ephemeral: true });
        }
        if (i.customId === `cloneTrooper-${uniqueId}`) {
          await i.update({ embeds: [cloneTrooperEmbed], components: [buttons] });
        } else if (i.customId === `arf-${uniqueId}`) {
          await i.update({ embeds: [arfEmbed], components: [buttons] });
        } else if (i.customId === `arc-${uniqueId}`) {
          await i.update({ embeds: [arcEmbed], components: [buttons] });
        } else if (i.customId === `republicCommando-${uniqueId}`) {
          await i.update({ embeds: [republicCommandoEmbed], components: [buttons] });
        } else if (i.customId === `total-${uniqueId}`) {
          await i.update({ embeds: [totalEmbed], components: [buttons] });
        }
      });

      collector.on('end', async () => {
        try {
          // Disable buttons after the collector ends
          buttons.components.forEach(button => button.setDisabled(true));
          await message.edit({ components: [buttons] });
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

      await connection.end();

    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error retrieving your status from the database.', ephemeral: true });
    }
  },
};
