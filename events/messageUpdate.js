const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        if (oldMessage.system || newMessage.system) return; // Ignore system messages
        if (oldMessage.content === newMessage.content) return; // Ignore updates that don't change content

        // Truncate message content if it exceeds 1024 characters
        const truncatedOldContent = oldMessage.content.length > 1024 ? `${oldMessage.content.slice(0, 1021)}...` : oldMessage.content || '[No Content]';
        const truncatedNewContent = newMessage.content.length > 1024 ? `${newMessage.content.slice(0, 1021)}...` : newMessage.content || '[No Content]';

        const embed = new EmbedBuilder()
            .setColor(0xFFA500) // Orange color
            .setTitle('Message Updated')
            .addFields(
                { name: 'User', value: oldMessage.author.tag, inline: true },
                { name: 'Channel', value: oldMessage.channel.name, inline: true },
                { name: 'Before', value: truncatedOldContent, inline: false },
                { name: 'After', value: truncatedNewContent, inline: false }
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
