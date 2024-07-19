const { MessageEmbed } = require('discord.js');
const { sendLog } = require('../../utils/webhook');

module.exports = {
  name: 'guildMemberUpdate',
  execute(oldMember, newMember) {
    const embed = new MessageEmbed()
      .setTitle('Member Updated')
      .setDescription(`${oldMember.user.tag} (${oldMember.user.id}) updated their profile.`)
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setColor('#ffa500')
      .setTimestamp();

    sendLog(embed);
  },
};
