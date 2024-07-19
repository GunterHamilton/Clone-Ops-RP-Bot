const { sendLog } = require('../../utils/webhook');
const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'guildMemberRemove',
  execute(member) {
    const embed = new MessageEmbed()
      .setTitle('Member Left')
      .setDescription(`${member.user.tag} (${member.user.id}) left the server.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setColor('#ff0000')
      .setTimestamp();

    sendLog(embed);
  },
};
