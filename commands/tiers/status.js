const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Displays your tier completion status across all categories.'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userName = interaction.user.tag;
    const uniqueId = Date.now().toString(); // Unique identifier for this interaction
    const guildMember = interaction.guild.members.cache.get(userId);

    const roleMappings = {
      'Tier 1 Trooper': '1263921728716013710',
      'Tier 1 ARF': '1263922692965535827',
      'Tier 1 ARC': '1263922720299552862',
      'Tier 1 RC': '1263922801459462208',
      'Tier 2 Trooper': '1263922849567998014',
      'Tier 2 ARF': '1263922889007300639',
      'Tier 2 ARC': '1263922920334561331',
      'Tier 2 RC': '1263922950130765886',
      'Tier 3 Trooper': '1263922981239783577',
      'Tier 3 ARF': '1263923084797153310',
      'Tier 3 ARC': '1263923156964478989',
      'Tier 3 RC': '1263923186790174882',
      'Tier 4 Trooper': '1263923217295212697',
      'Tier 4 ARF': '1263923256147316766',
      'Tier 4 ARC': '1263923276262932570',
      'Tier 4 RC': '1263923299373813902',
    };

    const categoryNames = {
      clone_trooper: 'Trooper',
      arf: 'ARF',
      arc: 'ARC',
      republic_commando: 'RC'
    };

    const promotionQuota = {
      'Tier 1 Trooper': 250,
      'Tier 1 ARF': 400,
      'Tier 1 ARC': 500,
      'Tier 1 RC': 550,
      'Tier 2 Trooper': 600,
      'Tier 2 ARF': 700,
      'Tier 2 ARC': 800,
      'Tier 2 RC': 900,
      'Tier 3 Trooper': 1000,
      'Tier 3 ARF': 1100,
      'Tier 3 ARC': 1200,
      'Tier 3 RC': 1400,
      'Tier 4 Trooper': 1500,
      'Tier 4 ARF': 1600,
      'Tier 4 ARC': 1700,
      'Tier 4 RC': 2000
    };

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

      const roleName = `Tier ${stage} ${categoryNames[category]}`;
      const roleID = roleMappings[roleName];

      console.log(`User: ${userName} | Category: ${category} | Tier: ${stage} | Role Name: ${roleName} | Role ID: ${roleID}`);

      // Check if the user has the role
      if (roleID && !guildMember.roles.cache.has(roleID)) {
        console.log(`Assigning role ID ${roleID} to user ${userName}`);
        await guildMember.roles.add(roleID);
      } else {
        console.log(`User ${userName} already has role ID ${roleID}`);
      }

      const fetchCategoryStatus = async (tableName) => {
        const [rows] = await connection.execute(`SELECT * FROM ${category}_${tableName} WHERE user_id = ?`, [userId]);
        let totalValue = 0;

        if (rows.length > 0) {
          totalValue = rows[0].total_value;
        }

        return { totalValue };
      };

      const mainStatus = await fetchCategoryStatus('main_tiers');
      const sideStatus = await fetchCategoryStatus('side_tiers');
      const medalsStatus = await fetchCategoryStatus('medals');
      const eventStatus = await fetchCategoryStatus('victories');

      const totalValue = mainStatus.totalValue + sideStatus.totalValue + medalsStatus.totalValue + eventStatus.totalValue;

      const createEmbed = (title, totalValue) => {
        return new EmbedBuilder()
          .setTitle(`${userName}'s ${title} (${category.toUpperCase()} Tier ${stage})`)
          .setColor(0xFFA500) // Orange color
          .addFields(
            { name: 'Total Value', value: `${totalValue}`, inline: false }
          )
          .setTimestamp();
      };

      const mainEmbed = createEmbed('Main Tier Completion Status', mainStatus.totalValue);
      const sideEmbed = createEmbed('Side Tier Completion Status', sideStatus.totalValue);
      const medalsEmbed = createEmbed('Medals Completion Status', medalsStatus.totalValue);
      const eventsEmbed = createEmbed('Event Victories Completion Status', eventStatus.totalValue);

      const totalEmbed = new EmbedBuilder()
        .setTitle(`${userName}'s Total Completion Status (${category.toUpperCase()} Tier ${stage})`)
        .setColor(0xFFA500) // Orange color
        .addFields(
          { name: 'Main Tier Total Value', value: `${mainStatus.totalValue}`, inline: true },
          { name: 'Side Tier Total Value', value: `${sideStatus.totalValue}`, inline: true },
          { name: 'Medals Total Value', value: `${medalsStatus.totalValue}`, inline: true },
          { name: 'Event Victories Total Value', value: `${eventStatus.totalValue}`, inline: true },
          { name: 'Overall Total Value', value: `${totalValue}`, inline: true }
        )
        .setTimestamp();

      // Check if the user has completed the quota for the current stage
      const currentRoleName = `Tier ${stage} ${categoryNames[category]}`;
      const requiredPoints = promotionQuota[currentRoleName];
      let promotionMessage = '';

      if (totalValue >= requiredPoints) {
        let newCategory, newTier;
        switch (currentRoleName) {
          case 'Tier 1 Trooper':
            newCategory = 'arf';
            newTier = 1;
            break;
          case 'Tier 1 ARF':
            newCategory = 'arc';
            newTier = 1;
            break;
          case 'Tier 1 ARC':
            newCategory = 'republic_commando';
            newTier = 1;
            break;
          case 'Tier 1 RC':
            newCategory = 'clone_trooper';
            newTier = 2;
            break;
          case 'Tier 2 Trooper':
            newCategory = 'arf';
            newTier = 2;
            break;
          case 'Tier 2 ARF':
            newCategory = 'arc';
            newTier = 2;
            break;
          case 'Tier 2 ARC':
            newCategory = 'republic_commando';
            newTier = 2;
            break;
          case 'Tier 2 RC':
            newCategory = 'clone_trooper';
            newTier = 3;
            break;
          case 'Tier 3 Trooper':
            newCategory = 'arf';
            newTier = 3;
            break;
          case 'Tier 3 ARF':
            newCategory = 'arc';
            newTier = 3;
            break;
          case 'Tier 3 ARC':
            newCategory = 'republic_commando';
            newTier = 3;
            break;
          case 'Tier 3 RC':
            newCategory = 'clone_trooper';
            newTier = 4;
            break;
          case 'Tier 4 Trooper':
            newCategory = 'arf';
            newTier = 4;
            break;
          case 'Tier 4 ARF':
            newCategory = 'arc';
            newTier = 4;
            break;
          case 'Tier 4 ARC':
            newCategory = 'republic_commando';
            newTier = 4;
            break;
          default:
            newCategory = category;
            newTier = stage;
        }

        await connection.execute('UPDATE user_status SET category = ?, tier = ? WHERE user_id = ?', [newCategory, newTier, userId]);

        for (const table of tables) {
          await connection.execute(`DELETE FROM ${category}_${table} WHERE user_id = ?`, [userId]);
          await connection.execute(`
            INSERT INTO ${newCategory}_${table} (user_id, user_name, total_value, ${table === 'main_tiers' || table === 'side_tiers' ? 'tiers_completed' : table === 'medals' ? 'medals_completed' : 'victories_completed'}, stage)
            VALUES (?, ?, 0, ?, ?)
            ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), total_value = 0, ${table === 'main_tiers' || table === 'side_tiers' ? 'tiers_completed' : table === 'medals' ? 'medals_completed' : 'victories_completed'} = VALUES(${table === 'main_tiers' || table === 'side_tiers' ? 'tiers_completed' : table === 'medals' ? 'medals_completed' : 'victories_completed'}), stage = ?
          `, [userId, userName, table === 'main_tiers' || table === 'side_tiers' ? '[]' : '{}', newTier, newTier]);
        }

        promotionMessage = `Congrats ${categoryNames[category]} quota complete!

Fill out the Tier Checklist for ${currentRoleName} by clicking [here](https://docs.google.com/document/d/1ql3McaNUNxxwiqy3-tNfO7_LLaGLV0ST8Zx0pCAWqnY/edit). Fill out promotion log once you have been whitelisted in game.`;
      }

      await connection.end();

      // Create buttons for navigation
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`total-${uniqueId}`)
            .setLabel('Total Status')
            .setStyle(ButtonStyle.Success),
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
            .setStyle(ButtonStyle.Primary)
        );

      const embeds = [totalEmbed];
      if (promotionMessage) {
        embeds.push(new EmbedBuilder().setTitle('Promotion!').setDescription(promotionMessage).setColor(0x00FF00).setTimestamp());
      }
      const message = await interaction.reply({ embeds, components: [buttons], fetchReply: true });

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
          buttons.components.forEach(button => button.setDisabled(true));
          await message.edit({ components: [buttons] });
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

    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error retrieving your status from the database.', ephemeral: true });
    }
  },
};
