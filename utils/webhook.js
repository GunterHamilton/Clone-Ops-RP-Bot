const { WebhookClient, MessageEmbed } = require('discord.js');
require('dotenv').config();

const webhookClient = new WebhookClient({ url: process.env.LOG_WEBHOOK_URL });

const sendLog = (embed) => {
  webhookClient.send({
    embeds: [embed],
  }).catch(console.error);
};

module.exports = { sendLog };
