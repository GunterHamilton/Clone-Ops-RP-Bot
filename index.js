const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const { readdirSync } = require('fs');
const mysql = require('mysql2');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection();

// Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect(err => {
  if (err) throw err;
  console.log('Connected to MySQL Database.');
});

// Load Commands
const commandFolders = readdirSync('./commands');
for (const folder of commandFolders) {
  const commandFiles = readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(`./commands/${folder}/${file}`);
    client.commands.set(command.data.name, command);
  }
}

// Load Events
const eventFolders = readdirSync('./events');
for (const folder of eventFolders) {
  const eventFiles = readdirSync(`./events/${folder}`).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(`./events/${folder}/${file}`);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client, db));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client, db));
    }
  }
}

// Register Slash Commands
const commands = [];
for (const folder of commandFolders) {
  const commandFiles = readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(`./commands/${folder}/${file}`);
    commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

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

client.login(process.env.DISCORD_TOKEN);
