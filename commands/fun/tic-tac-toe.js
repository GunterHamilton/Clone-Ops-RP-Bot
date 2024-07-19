const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tic-tac-toe')
        .setDescription('Play a game of Tic-Tac-Toe')
        .addUserOption(option => 
            option.setName('opponent')
                .setDescription('The user you want to challenge')
                .setRequired(true)),
    async execute(interaction) {
        const opponent = interaction.options.getUser('opponent');
        const challenger = interaction.user;

        if (opponent.id === challenger.id) {
            return interaction.reply({ content: 'You cannot play against yourself.', ephemeral: true });
        }

        const board = [
            ['⬜', '⬜', '⬜'],
            ['⬜', '⬜', '⬜'],
            ['⬜', '⬜', '⬜']
        ];

        let currentPlayer = challenger;
        const playerSymbols = {
            [challenger.id]: '❌',
            [opponent.id]: '⭕'
        };

        const renderBoard = () => board.map(row => row.join('')).join('\n');

        const createButton = (id) => new ButtonBuilder()
            .setCustomId(id)
            .setLabel('\u200b')
            .setStyle(ButtonStyle.Secondary);

        const components = board.map((row, rowIndex) => 
            new ActionRowBuilder().addComponents(
                row.map((_, colIndex) => createButton(`ttt_${rowIndex}_${colIndex}`))
            )
        );

        const embed = new EmbedBuilder()
            .setTitle('Tic-Tac-Toe')
            .setDescription(renderBoard())
            .setColor('#00FF00')
            .setFooter({ text: `It's ${currentPlayer.tag}'s turn!` });

        await interaction.reply({ embeds: [embed], components });

        const filter = i => i.customId.startsWith('ttt_') && (i.user.id === challenger.id || i.user.id === opponent.id);
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== currentPlayer.id) {
                return i.reply({ content: 'It is not your turn!', ephemeral: true });
            }

            const [_, row, col] = i.customId.split('_').map(Number);

            if (board[row][col] !== '⬜') {
                return i.reply({ content: 'This cell is already taken.', ephemeral: true });
            }

            board[row][col] = playerSymbols[currentPlayer.id];
            currentPlayer = currentPlayer.id === challenger.id ? opponent : challenger;

            const winner = checkWinner(board);
            if (winner) {
                embed.setDescription(renderBoard())
                    .setColor('#00FF00')
                    .setFooter({ text: `${winner.tag} wins!` });

                await i.update({ embeds: [embed], components: [] });
                return collector.stop();
            }

            const draw = board.flat().every(cell => cell !== '⬜');
            if (draw) {
                embed.setDescription(renderBoard())
                    .setColor('#FFA500')
                    .setFooter({ text: `It's a draw!` });

                await i.update({ embeds: [embed], components: [] });
                return collector.stop();
            }

            embed.setDescription(renderBoard())
                .setFooter({ text: `It's ${currentPlayer.tag}'s turn!` });

            await i.update({ embeds: [embed], components });
        });

        collector.on('end', async () => {
            components.forEach(row => row.components.forEach(button => button.setDisabled(true)));
            await interaction.editReply({ components });
        });

        function checkWinner(board) {
            const winningCombinations = [
                // Rows
                [[0, 0], [0, 1], [0, 2]],
                [[1, 0], [1, 1], [1, 2]],
                [[2, 0], [2, 1], [2, 2]],
                // Columns
                [[0, 0], [1, 0], [2, 0]],
                [[0, 1], [1, 1], [2, 1]],
                [[0, 2], [1, 2], [2, 2]],
                // Diagonals
                [[0, 0], [1, 1], [2, 2]],
                [[0, 2], [1, 1], [2, 0]]
            ];

            for (const combination of winningCombinations) {
                const [a, b, c] = combination;
                if (board[a[0]][a[1]] !== '⬜' && board[a[0]][a[1]] === board[b[0]][b[1]] && board[a[0]][a[1]] === board[c[0]][c[1]]) {
                    return interaction.guild.members.cache.get(Object.keys(playerSymbols).find(key => playerSymbols[key] === board[a[0]][a[1]]));
                }
            }

            return null;
        }
    },
};
