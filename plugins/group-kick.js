const { cmd } = require('../command');

cmd({
    pattern: "kick",
    alias: ["remove"],
    desc: "Remove a member from the group",
    category: "group",
    react: "🚪",
    filename: __filename
}, async (conn, mek, m, { from, args, isGroup, isAdmins, isBotAdmins, isOwner, isCreator, reply }) => {
    try {
        if (!isGroup) return reply("⚠️ This command only works in groups.");

        if (!isBotAdmins) return reply("❌ I need to be an Admin to remove members.");

        if (!isOwner && !isCreator && !isAdmins) {
            return reply("❌ Access Denied! Only group admins can use this command.");
        }

        let users = m.mentionedJid[0] 
            ? m.mentionedJid[0] 
            : m.quoted 
            ? m.quoted.sender 
            : args[0] 
            ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' 
            : false;

        if (!users) return reply("⚠️ Please mention a user, quote their message, or give their phone number to kick.");

        await conn.groupParticipantsUpdate(from, [users], "remove");

        return reply(`✅ Successfully removed @${users.split('@')[0]} from the group.`, {
            mentions: [users]
        });

    } catch (e) {
        console.log("KICK ERROR:", e);
        return reply("❌ Failed to remove user from the group.");
    }
});
