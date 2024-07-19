const { sendLog } = require('../../utils/webhook');
const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  execute(member) {
    const embed = new MessageEmbed()
      .setTitle('Member Joined')
      .setDescription(`${member.user.tag} (${member.user.id}) joined the server.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setColor('#00ff00')
      .setTimestamp();

    sendLog(embed);
  },
};