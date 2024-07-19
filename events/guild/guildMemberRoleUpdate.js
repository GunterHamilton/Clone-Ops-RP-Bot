const { MessageEmbed } = require('discord.js');
const { sendLog } = require('../../utils/webhook');

module.exports = {
  name: 'guildMemberUpdate',
  execute(oldMember, newMember) {
    const oldRoles = oldMember.roles.cache.map(role => role.id);
    const newRoles = newMember.roles.cache.map(role => role.id);

    const addedRoles = newRoles.filter(role => !oldRoles.includes(role));
    const removedRoles = oldRoles.filter(role => !newRoles.includes(role));

    if (addedRoles.length || removedRoles.length) {
      let description = `${oldMember.user.tag} (${oldMember.user.id}) updated roles.`;

      if (addedRoles.length) {
        const roles = addedRoles.map(role => `<@&${role}>`).join(', ');
        description += `\n**Added Roles:** ${roles}`;
      }

      if (removedRoles.length) {
        const roles = removedRoles.map(role => `<@&${role}>`).join(', ');
        description += `\n**Removed Roles:** ${roles}`;
      }

      const embed = new MessageEmbed()
        .setTitle('Roles Updated')
        .setDescription(description)
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
        .setColor('#ffa500')
        .setTimestamp();

      sendLog(embed);
    }
  },
};
