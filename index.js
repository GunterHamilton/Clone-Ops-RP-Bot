const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const mysql = require('mysql2');

// Set up MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) throw err;
  console.log('MySQL Connected...');
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

// Function to recursively read commands from directories
const readCommands = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      readCommands(filePath);
    } else if (file.endsWith('.js')) {
      const command = require(filePath);
      client.commands.set(command.data.name, command);
    }
  }
};

// Read commands from the commands directory
readCommands(path.join(__dirname, 'commands'));

const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

console.log('Starting bot...');
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('Login successful.');
}).catch(error => {
  console.error('Login failed:', error);
});
