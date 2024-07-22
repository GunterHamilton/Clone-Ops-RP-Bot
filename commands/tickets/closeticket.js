const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionsBitField, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close-ticket')
    .setDescription('Close your current open ticket'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userName = interaction.user.tag;
    const channelName = interaction.channel.name;
    
    // Adjust the category extraction logic
    const categoryName = channelName.split('-').slice(0, 2).join('-'); 

    console.log(`Attempting to close ticket for user: ${userName} in category: ${categoryName}`);

    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });

      const [rows] = await connection.execute('SELECT * FROM tickets WHERE user_id = ? AND category = ?', [userId, categoryName]);

      console.log(`Database query result: ${JSON.stringify(rows)}`);

      if (rows.length === 0) {
        return interaction.reply({ content: 'You do not have an open ticket in this category.', ephemeral: true });
      }

      const ticketNumber = rows[0].ticket_number;

      await connection.execute('DELETE FROM tickets WHERE user_id = ? AND category = ?', [userId, categoryName]);

      // Generate transcript
      async function fetchAllMessages(channel) {
        let allMessages = [];
        let lastMessageId = null;

        while (true) {
          const options = { limit: 100 };
          if (lastMessageId) {
            options.before = lastMessageId;
          }

          const messages = await channel.messages.fetch(options);
          allMessages.push(...messages.values());
          lastMessageId = messages.last().id;

          if (messages.size < 100) {
            break;
          }
        }

        return allMessages;
      }

      const messages = await fetchAllMessages(interaction.channel);
      const transcript = messages
        .map(m => `${m.author.tag} [${m.createdAt}]: ${m.content}`)
        .reverse()
        .join('\n');

      const transcriptPath = path.join(__dirname, `transcript-${ticketNumber}.txt`);
      fs.writeFileSync(transcriptPath, transcript);

      const closeEmbed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription(`The ticket created by ${userName} has been closed.`)
        .setColor(0xFF0000) // Red
        .setTimestamp();

      await interaction.channel.send({ embeds: [closeEmbed] });

      setTimeout(async () => {
        await interaction.channel.delete();
      }, 5000); // Delay to allow message to be seen before deletion

      await interaction.reply({ content: 'Your ticket has been closed and will be deleted shortly.', ephemeral: true });

      // Log to webhook
      const logEmbed = new EmbedBuilder()
        .setTitle('Ticket Closed Log')
        .addFields(
          { name: 'User', value: userName, inline: true },
          { name: 'Channel', value: channelName, inline: true },
          { name: 'Category', value: categoryName, inline: true },
          { name: 'Ticket Number', value: ticketNumber.toString(), inline: true }
        )
        .setColor(0x1E90FF) // Dodger Blue
        .setTimestamp();

      const form = new FormData();
      form.append('payload_json', JSON.stringify({ embeds: [logEmbed.toJSON()] }));
      form.append('file', fs.createReadStream(transcriptPath), {
        filename: `transcript-${ticketNumber}.txt`
      });

      try {
        await axios.post(process.env.TICKET_LOG_WEBHOOK_URL, form, {
          headers: form.getHeaders(),
        });

        // Delete the transcript file after sending
        fs.unlinkSync(transcriptPath);
      } catch (error) {
        console.error('Error logging to webhook:', error.message);
        if (error.response && error.response.data) {
          console.error('Webhook response data:', error.response.data);
        }
        // Optionally, handle the error by informing the user or taking other actions
      }

    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply({ content: 'There was an error closing your ticket.', ephemeral: true });
    }
  },
};
