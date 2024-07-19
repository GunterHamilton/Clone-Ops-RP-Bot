const { sendLog } = require('../../utils/webhook');
const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (oldMessage.partial || newMessage.partial) {
      try {
        await oldMessage.fetch();
        await newMessage.fetch();
      } catch (error) {
        console.error('Error fetching partial message:', error);
        return;
      }
    }

    const oldContent = oldMessage.content.length > 1024 ? `${oldMessage.content.slice(0, 1020)}...` : oldMessage.content;
    const newContent = newMessage.content.length > 1024 ? `${newMessage.content.slice(0, 1020)}...` : newMessage.content;

    const embed = new MessageEmbed()
      .setTitle('Message Updated')
      .setDescription(`Message by ${oldMessage.author.tag} in ${oldMessage.channel.name} was edited:\n**Before:**\n${oldContent}\n**After:**\n${newContent}`)
      .setColor('#f39c12')
      .setTimestamp();

    sendLog(embed);
  },
};
