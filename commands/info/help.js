const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows help information for commands'),
    async execute(interaction) {
        try {
            // Immediately acknowledge the interaction
            await interaction.deferReply({ ephemeral: true });

            const commandFolders = fs.readdirSync('./commands');
            const categories = commandFolders.map(folder => {
                const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
                return {
                    label: folder.charAt(0).toUpperCase() + folder.slice(1),
                    description: `Commands for ${folder}`,
                    commands: commandFiles.map(file => {
                        try {
                            const command = require(`../${folder}/${file}`);
                            return {
                                name: command.data.name,
                                description: command.data.description
                            };
                        } catch (error) {
                            console.error(`Failed to load command ${file} in folder ${folder}:`, error);
                            return {
                                name: file.replace('.js', ''),
                                description: 'Error loading command'
                            };
                        }
                    })
                };
            });

            const options = categories.map(category => ({
                label: category.label,
                description: category.description,
                value: category.label.toLowerCase()
            }));

            const menu = new StringSelectMenuBuilder()
                .setCustomId('help_menu')
                .setPlaceholder('Choose a category')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(menu);

            const embed = new EmbedBuilder()
                .setTitle('Help Menu')
                .setDescription('Select a category from the menu below to see the commands!')
                .setColor('#4169E1');

            const initialResponse = await interaction.editReply({ embeds: [embed], components: [row] });

            const filter = i => i.customId === 'help_menu' && i.user.id === interaction.user.id;
            const collector = initialResponse.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                try {
                    const selectedCategory = categories.find(category => category.label.toLowerCase() === i.values[0]);
                    const commandsDescription = selectedCategory.commands.length > 0 
                        ? selectedCategory.commands.map(cmd => `**/${cmd.name}**: ${cmd.description}`).join('\n')
                        : 'No commands found!';

                    const categoryEmbed = new EmbedBuilder()
                        .setTitle(`${selectedCategory.label} Commands`)
                        .setColor('#4169E1')
                        .setDescription(commandsDescription);

                    await i.update({ embeds: [categoryEmbed], components: [row] });
                } catch (error) {
                    console.error('Error updating interaction:', error);
                    await i.followUp({ content: 'There was an error while updating the command list.', ephemeral: true });
                }
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    try {
                        await interaction.editReply({ components: [] });
                    } catch (error) {
                        console.error('Error editing reply after collector end:', error);
                    }
                }
            });
        } catch (error) {
            console.error('Error executing help command:', error);
            await interaction.followUp({ content: 'There was an error executing the help command.', ephemeral: true });
        }
    }
};
