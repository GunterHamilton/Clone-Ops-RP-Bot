const logEvent = require('../log');

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        const changes = [];

        // Check for role additions
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        if (addedRoles.size > 0) {
            changes.push({ name: 'Roles Added', value: addedRoles.map(role => role.name).join(', '), inline: false });
        }

        // Check for role removals
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
        if (removedRoles.size > 0) {
            changes.push({ name: 'Roles Removed', value: removedRoles.map(role => role.name).join(', '), inline: false });
        }

        // Check for nickname change
        if (oldMember.nickname !== newMember.nickname) {
            changes.push({ name: 'Nickname Changed', value: `${oldMember.nickname || oldMember.user.username} -> ${newMember.nickname || newMember.user.username}`, inline: false });
        }

        // Check for username change
        if (oldMember.user.username !== newMember.user.username) {
            changes.push({ name: 'Username Changed', value: `${oldMember.user.username} -> ${newMember.user.username}`, inline: false });
        }

        // Log the changes
        if (changes.length > 0) {
            const description = `Member update for ${newMember.user.tag}`;
            const fields = [
                { name: 'User ID', value: newMember.user.id, inline: true },
                ...changes
            ];
            await logEvent('Member Updated', description, 0x3498db, fields); // Blue color
        }
    },
};
