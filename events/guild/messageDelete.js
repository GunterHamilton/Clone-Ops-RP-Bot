const { MessageEmbed } = require('discord.js');
const { sendLog } = require('../../utils/webhook');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (message.partial) {
      try {
        await message.fetch();
      } catch (error) {
        console.error('Error fetching partial message:', error);
        return;
      }
    }

    const content = message.content.length > 1024 ? `${message.content.slice(0, 1020)}...` : message.content;

    const embed = new MessageEmbed()
      .setTitle('Message Deleted')
      .setDescription(`Message by ${message.author.tag} in ${message.channel.name} was deleted:\n${content}`)
      .setColor('#e74c3c')
      .setTimestamp();

    sendLog(embed);
  },
};
