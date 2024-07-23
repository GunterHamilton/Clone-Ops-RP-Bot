const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('newstatus')
    .setDescription('Displays your tier completion status across all categories.'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userName = interaction.user.tag;
    const uniqueId = Date.now().toString(); // Unique identifier for this interaction
    const guildMember = interaction.guild.members.cache.get(userId);
    const roleID = '1263921728716013710';

    // Check if the user has the role
    if (!guildMember.roles.cache.has(roleID)) {
      await guildMember.roles.add(roleID);
    }

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

      // Ensure the necessary tables exist for each category
      const categories = ['arc', 'arf', 'clone_trooper', 'republic_commando'];
      const tables = ['main_tiers', 'side_tiers', 'medals', 'victories'];

      for (const category of categories) {
        for (const table of tables) {
          await connection.execute(`
            CREATE TABLE IF NOT EXISTS ${category}_${table} (
              user_id VARCHAR(255) NOT NULL PRIMARY KEY,
              user_name VARCHAR(255) NOT NULL,
              total_value INT NOT NULL DEFAULT 0,
              ${table === 'main_tiers' || table === 'side_tiers' ? 'tiers_completed' : table === 'medals' ? 'medals_completed' : 'victories_completed'} JSON NOT NULL DEFAULT '${table === 'main_tiers' || table === 'side_tiers' ? '[]' : '{}'}',
              stage INT NOT NULL DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
          `);
        }
      }

      // Fetch the user's status
      let [userRows] = await connection.execute('SELECT * FROM user_status WHERE user_id = ?', [userId]);

      if (userRows.length === 0) {
        // Insert default status if not found
        await connection.execute('INSERT INTO user_status (user_id, user_name, category, tier) VALUES (?, ?, ?, ?)', [userId, userName, 'clone_trooper', 1]);
        [userRows] = await connection.execute('SELECT * FROM user_status WHERE user_id = ?', [userId]);
      }

      const userStatus = userRows[0];
      const category = userStatus.category;
      const stage = userStatus.tier;

      const fetchCategoryStatus = async (tableName) => {
        const [rows] = await connection.execute(`SELECT * FROM ${category}_${tableName} WHERE user_id = ?`, [userId]);
        let totalValue = 0;
        let completed = tableName === 'main_tiers' || tableName === 'side_tiers' ? [] : {};

        if (rows.length > 0) {
          totalValue = rows[0].total_value;
          completed = JSON.parse(rows[0][tableName === 'main_tiers' || tableName === 'side_tiers' ? 'tiers_completed' : tableName === 'medals' ? 'medals_completed' : 'victories_completed']);
        }

        return { totalValue, completed };
      };

      const mainStatus = await fetchCategoryStatus('main_tiers');
      const sideStatus = await fetchCategoryStatus('side_tiers');
      const medalsStatus = await fetchCategoryStatus('medals');
      const eventStatus = await fetchCategoryStatus('victories');

      const createEmbed = (title, totalValue, completed) => {
        let completedValue = 'None';
        if (Array.isArray(completed)) {
          completedValue = completed.length > 0 ? completed.map(tier => `Tier ${tier}`).join('\n') : 'None';
        } else if (typeof completed === 'object' && completed !== null) {
          completedValue = Object.entries(completed).length > 0 ? Object.entries(completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : 'None';
        }
        return new EmbedBuilder()
          .setTitle(`${userName}'s ${title} (${category.toUpperCase()} Tier ${stage})`)
          .setColor(0xFFA500) // Orange color
          .addFields(
            { name: 'Total Value', value: `${totalValue}`, inline: false },
            { name: 'Completed', value: completedValue, inline: false }
          )
          .setTimestamp();
      };

      const mainEmbed = createEmbed('Main Tier Completion Status', mainStatus.totalValue, mainStatus.completed);
      const sideEmbed = createEmbed('Side Tier Completion Status', sideStatus.totalValue, sideStatus.completed);
      const medalsEmbed = createEmbed('Medals Completion Status', medalsStatus.totalValue, medalsStatus.completed);
      const eventsEmbed = createEmbed('Event Victories Completion Status', eventStatus.totalValue, eventStatus.completed);

      const totalValue = mainStatus.totalValue + sideStatus.totalValue + medalsStatus.totalValue + eventStatus.totalValue;
      const totalEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Total Completion Status (${category.toUpperCase()} Tier ${stage})`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Main Tier Total Value', value: `${mainStatus.totalValue}`, inline: true },
          { name: 'Main Tiers Completed', value: mainStatus.completed.length > 0 ? mainStatus.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
          { name: 'Side Tier Total Value', value: `${sideStatus.totalValue}`, inline: true },
          { name: 'Side Tiers Completed', value: sideStatus.completed.length > 0 ? sideStatus.completed.map(tier => `Tier ${tier}`).join('\n') : 'None', inline: true },
          { name: 'Medals Total Value', value: `${medalsStatus.totalValue}`, inline: true },
          { name: 'Medals Completed', value: Object.entries(medalsStatus.completed).length > 0 ? Object.entries(medalsStatus.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : 'None', inline: true },
          { name: 'Event Victories Total Value', value: `${eventStatus.totalValue}`, inline: true },
          { name: 'Victories Completed', value: Object.entries(eventStatus.completed).length > 0 ? Object.entries(eventStatus.completed).map(([category, tiers]) => `${category}: ${tiers.map(tier => `Tier ${tier}`).join(', ')}`).join('\n') : 'None', inline: true },
          { name: 'Overall Total Value', value: `${totalValue}`, inline: true }
        )
        .setTimestamp();

      // Create buttons for navigation
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`main-${uniqueId}`)
            .setLabel('Main Quest')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`side-${uniqueId}`)
            .setLabel('Side Quest')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`medals-${uniqueId}`)
            .setLabel('Medals')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`events-${uniqueId}`)
            .setLabel('Events')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`total-${uniqueId}`)
            .setLabel('Total Status')
            .setStyle(ButtonStyle.Success)
        );

      // Send the initial embed with buttons
      const message = await interaction.reply({ embeds: [mainEmbed], components: [buttons], fetchReply: true });

      // Create a collector to handle button interactions
      const filter = i => i.customId.endsWith(uniqueId) && i.user.id === userId;
      const collector = message.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (i.user.id !== userId) {
          return i.reply({ content: 'You are not allowed to use these buttons.', ephemeral: true });
        }
        if (i.customId === `main-${uniqueId}`) {
          await i.update({ embeds: [mainEmbed], components: [buttons] });
        } else if (i.customId === `side-${uniqueId}`) {
          await i.update({ embeds: [sideEmbed], components: [buttons] });
        } else if (i.customId === `medals-${uniqueId}`) {
          await i.update({ embeds: [medalsEmbed], components: [buttons] });
        } else if (i.customId === `events-${uniqueId}`) {
          await i.update({ embeds: [eventsEmbed], components: [buttons] });
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
