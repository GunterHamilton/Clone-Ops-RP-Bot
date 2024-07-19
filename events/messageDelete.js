const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        if (message.system) return; // Ignore system messages

        // Truncate message content if it exceeds 1024 characters
        const truncatedContent = message.content.length > 1024 ? `${message.content.slice(0, 1021)}...` : message.content || '[No Content]';

        const embed = new EmbedBuilder()
            .setColor(0xFF0000) // Red color
            .setTitle('Message Deleted')
            .addFields(
                { name: 'User', value: message.author.tag, inline: true },
                { name: 'Channel', value: message.channel.name, inline: true },
                { name: 'Message', value: truncatedContent, inline: false }
            )
            .setTimestamp();

        try {
            await axios.post(process.env.LOG_WEBHOOK_URL, {
                embeds: [embed.toJSON()]
            });
        } catch (error) {
            console.error('Failed to send log to webhook:', error);
        }
    }
};
