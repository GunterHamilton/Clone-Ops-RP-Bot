const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
require('dotenv').config();

const logEvent = async (title, description, color = 0x3498db, fields = []) => { // Default color is blue
    const webhookUrl = process.env.LOG_WEBHOOK_URL;
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .addFields(fields)
        .setColor(color)
        .setTimestamp(new Date());

    try {
        await axios.post(webhookUrl, {
            embeds: [embed]
        });
    } catch (error) {
        console.error('Failed to send log to webhook:', error);
    }
};

module.exports = logEvent;
