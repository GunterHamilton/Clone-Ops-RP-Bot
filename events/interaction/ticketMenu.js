const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mysql = require('mysql2/promise');

module.exports = {
  name: 'sendTicketMenu',
  async execute(client) {
    const channelId = process.env.CHANNEL_ID;
    const ticketMessageId = process.env.TICKET_MESSAGE_ID;
    const channel = await client.channels.fetch(channelId);

    const embed = new EmbedBuilder()
      .setTitle('Create a Ticket')
      .setDescription('Select a category for your ticket:\n\n'
        + '**Player Report:** Report a player for breaking the rules. (Staff only)\n'
        + '**Bug Report:** Report a bug or issue with the server. (Staff only)\n'
        + '**Other:** Any other inquiries or issues. (Staff only)')
      .setColor(0x00AE86);

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('player_report')
          .setLabel('Player Report')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('bug_report')
          .setLabel('Bug Report')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('other')
          .setLabel('Other')
          .setStyle(ButtonStyle.Success)
      );

    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      let ticketMessage = messages.find(msg => msg.id === ticketMessageId);

      if (ticketMessage) {
        await ticketMessage.edit({ embeds: [embed], components: [row] });
        console.log('Ticket embed updated successfully.');
      } else {
        ticketMessage = await channel.send({ embeds: [embed], components: [row] });
        console.log('Ticket embed sent successfully.');

        // Store the new ticket message ID in the environment variable (or update your storage method)
        const connection = await mysql.createConnection({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME
        });

        await connection.execute(`
          INSERT INTO bot_settings (setting_key, setting_value) VALUES ('TICKET_MESSAGE_ID', ?)
          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        `, [ticketMessage.id]);

        await connection.end();
      }
    } catch (error) {
      console.error('Error handling ticket menu:', error);
    }
  },
};
