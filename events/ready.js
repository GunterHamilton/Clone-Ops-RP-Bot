module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
      console.log(`Ready! Logged in as ${client.user.tag}`);
      
      const { REST } = require('@discordjs/rest');
      const { Routes } = require('discord-api-types/v9');
      const commands = client.commands.map(cmd => cmd.data.toJSON());
      const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);
  
      (async () => {
        try {
          console.log('Started refreshing application (/) commands.');
  
          await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
          );
  
          console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
          console.error(error);
        }
      })();
    },
  };
  