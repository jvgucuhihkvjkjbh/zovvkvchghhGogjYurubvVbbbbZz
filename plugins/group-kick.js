const { cmd } = require('../command');

cmd({
    pattern: "kick",
    alias: ["remove", "k"],
    desc: "Remove group members",
    category: "group",
    react: "🗑️",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, isOwner, isCreator, reply }) => {
    try {
        if (!isGroup)
            return reply("❌ This command only works in groups.");

        if (!isBotAdmins)
            return reply("❌ I need to be an Admin to remove members.");

        if (!isAdmins && !isOwner && !isCreator)
            return reply("⚠️ Only group admins can use this command.");

        const metadata = await conn.groupMetadata(from);
        
        // Group Admins کی لسٹ (LID اور JID دونوں کے ساتھ)
        const adminParticipants = metadata.participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
        
        let targets = [];

        if (m.quoted?.sender) {
            targets.push(m.quoted.sender);
        }

        if (m.mentionedJid?.length) {
            targets.push(...m.mentionedJid);
        }

        if (targets.length === 0)
            return reply("❌ Reply to a member or mention user(s) to kick.");

        // Duplicate IDs کو ہٹانے کے لیے
        targets = [...new Set(targets)];

        let removed = [];
        let skipped = [];

        for (const jid of targets) {
            // Check if target is an admin (handles LID, JID, and Phone)
            const targetNum = jid.replace(/[^0-9]/g, '');
            const isAdminTarget = adminParticipants.some(p => {
                const ids = [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean);
                return ids.some(id => id.replace(/[^0-9]/g, '') === targetNum);
            });

            if (isAdminTarget) {
                skipped.push(jid);
                continue;
            }

            await conn.groupParticipantsUpdate(from, [jid], "remove");
            removed.push(jid);
        }

        let msg = "";
        if (removed.length)
            msg += `🗑️ Removed:\n${removed.map(j => `@${j.split('@')[0]}`).join('\n')}\n\n`;

        if (skipped.length)
            msg += `🚫 Skipped (Admins):\n${skipped.map(j => `@${j.split('@')[0]}`).join('\n')}`;

        return reply(msg.trim(), {
            mentions: [...removed, ...skipped]
        });

    } catch (e) {
        console.log("KICK ERROR:", e);
        return reply("❌ Failed to remove member(s). Check bot permissions.");
    }
});
