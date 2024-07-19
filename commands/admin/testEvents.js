const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testevents')
    .setDescription('Triggers join and leave events for testing.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Select a user')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('event')
        .setDescription('Specify the event to trigger (join or leave)')
        .setRequired(true)
        .addChoices(
          { name: 'Join', value: 'join' },
          { name: 'Leave', value: 'leave' }
        )),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const event = interaction.options.getString('event');
    const member = await interaction.guild.members.fetch(user.id);

    if (event === 'join') {
      interaction.client.emit('guildMemberAdd', member);
      await interaction.reply({ content: `Triggered join event for ${user.tag}`, ephemeral: true });
    } else if (event === 'leave') {
      interaction.client.emit('guildMemberRemove', member);
      await interaction.reply({ content: `Triggered leave event for ${user.tag}`, ephemeral: true });
    } else {
      await interaction.reply({ content: 'Invalid event specified.', ephemeral: true });
    }
  },
};
