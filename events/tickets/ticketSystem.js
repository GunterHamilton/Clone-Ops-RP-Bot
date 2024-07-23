const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log('Ticket system ready!');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Ensure the necessary table exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tickets (
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        ticket_number INT NOT NULL AUTO_INCREMENT,
        category VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        PRIMARY KEY (user_id, category),
        UNIQUE (ticket_number)
      )
    `);

    const channel = await client.channels.fetch(process.env.TICKET_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle('Ticket System')
      .setDescription('Welcome to the ticket system! Please select the type of ticket you want to create by clicking one of the buttons below.')
      .addFields(
        { name: '🐞 Bug Report', value: 'Select this option to report any bugs or issues you encounter in the server. Provide as much detail as possible so we can resolve the issue quickly.', inline: false },
        { name: '🚩 Player Report', value: 'Select this option to report any misconduct or rule-breaking behavior by other players. Make sure to include relevant evidence such as screenshots or video clips.', inline: false },
        { name: '❓ Other', value: 'Select this option for any other inquiries or issues not covered by the other categories. Our support team will assist you with your request.', inline: false }
      )
      .setColor(0x1E90FF) // Dodger Blue
      .setTimestamp();

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create-bug-report')
          .setLabel('Bug Report')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('create-player-report')
          .setLabel('Player Report')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('create-other-ticket')
          .setLabel('Other')
          .setStyle(ButtonStyle.Secondary)
      );

    // Check if the message already exists in the channel
    let messages = await channel.messages.fetch({ limit: 10 });
    let ticketMessage = messages.find(msg => msg.embeds[0] && msg.embeds[0].title === 'Ticket System');

    if (ticketMessage) {
      await ticketMessage.edit({ embeds: [embed], components: [buttons] });
    } else {
      await channel.send({ embeds: [embed], components: [buttons] });
    }

    const filter = i => i.customId.startsWith('create-');
    const collector = channel.createMessageComponentCollector({ filter });

    collector.on('collect', async interaction => {
      const userId = interaction.user.id;
      const userName = interaction.user.tag;
      let category;
      let categoryId;
      let roleId;

      if (interaction.customId === 'create-bug-report') {
        category = 'bug-report';
        categoryId = process.env.BUG_REPORT_CATEGORY_ID;
        roleId = process.env.BUG_REPORT_ROLE_ID;
      } else if (interaction.customId === 'create-player-report') {
        category = 'player-report';
        categoryId = process.env.PLAYER_REPORT_CATEGORY_ID;
        roleId = process.env.PLAYER_REPORT_ROLE_ID;
      } else if (interaction.customId === 'create-other-ticket') {
        category = 'other-ticket';
        categoryId = process.env.OTHER_TICKET_CATEGORY_ID;
        roleId = process.env.OTHER_TICKET_ROLE_ID;
      }

      const [rows] = await connection.execute('SELECT * FROM tickets WHERE user_id = ? AND category = ?', [userId, category]);

      if (rows.length > 0) {
        return interaction.reply({ content: 'You already have an open ticket in this category.', ephemeral: true });
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: `${category}-${userName}`,
        type: 0, // 0 is for text channels in discord.js v14
        parent: categoryId,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: userId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
          },
          {
            id: roleId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
          }
        ]
      });

      await connection.execute('INSERT INTO tickets (user_id, user_name, category, channel_id) VALUES (?, ?, ?, ?)', [userId, userName, category, ticketChannel.id]);

      const [result] = await connection.execute('SELECT ticket_number FROM tickets WHERE user_id = ? AND category = ?', [userId, category]);
      const ticketNumber = result[0].ticket_number;

      const ticketEmbed = new EmbedBuilder()
        .setTitle('Ticket Created')
        .setDescription(`Thank you for reaching out! Our support team will be with you shortly. Your ticket number is **${ticketNumber}**. In the meantime, please provide any additional information that might help us assist you.`)
        .setColor(0xFFD700) // Gold
        .setTimestamp();

      const ticketMessage = await ticketChannel.send({ embeds: [ticketEmbed] });
      await ticketMessage.pin();

      await interaction.reply({ content: `Your ticket has been created: ${ticketChannel}`, ephemeral: true });
    });
  }
};
