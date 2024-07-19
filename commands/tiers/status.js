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

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

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
      if (!client.commands.has(command.data.name)) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(`Duplicate command name detected: ${command.data.name}`);
      }
    }
  }
};

// Read commands from the commands directory
readCommands(path.join(__dirname, 'commands'));

client.events = new Collection();

// Function to recursively read events from directories
const readEvents = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      readEvents(filePath);
    } else if (file.endsWith('.js')) {
      const event = require(filePath);
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
    }
  }
};

// Read events from the events directory
readEvents(path.join(__dirname, 'events'));

console.log('Starting bot...');
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('Login successful.');
}).catch(error => {
  console.error('Login failed:', error);
});
