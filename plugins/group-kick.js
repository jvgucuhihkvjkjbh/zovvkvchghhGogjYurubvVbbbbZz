const { cmd } = require('../command');

const normalizeId = (id) => id ? id.replace(/:[0-9]+/g, '').replace(/@(lid|s\.whatsapp\.net|c\.us|g\.us)/g, '').replace(/[^\d]/g, '') : '';

async function isUserAdmin(conn, chatId, userId) {
    const metadata = await conn.groupMetadata(chatId);
    const user = normalizeId(userId);
    return (metadata.participants || []).some(p => 
        [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).some(id => normalizeId(id) === user) &&
        (p.admin === "admin" || p.admin === "superadmin")
    );
}

async function isBotAdmin(conn, chatId) {
    const metadata = await conn.groupMetadata(chatId);
    const botId = normalizeId(conn.user?.id || '');
    const botLid = normalizeId(conn.user?.lid || '');
    return (metadata.participants || []).some(p => 
        (p.admin === "admin" || p.admin === "superadmin") &&
        [p.id, p.lid, p.phoneNumber].filter(Boolean).some(id => {
            const n = normalizeId(id);
            return n === botId || n === botLid;
        })
    );
}

cmd({
    pattern: "kick",
    alias: ["remove", "k"],
    desc: "Remove group members fast",
    category: "group",
    react: "🗑️",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, sender, isOwner, isCreator, reply }) => {
    try {
        if (!isGroup) return reply("❌ This command only works in groups.");

        if (!await isBotAdmin(conn, from)) return reply("⚠️ Please make me admin first!");
        if (!isOwner && !isCreator && !await isUserAdmin(conn, from, sender)) return reply("⛔ Only group admins can use this command.");

        let targets = [];
        if (m.quoted?.sender) targets.push(m.quoted.sender);
        if (m.mentionedJid?.length) targets.push(...m.mentionedJid);
        targets = [...new Set(targets)];

        if (targets.length === 0) return reply("❌ Reply to a member or mention user(s) to kick.");

        const metadata = await conn.groupMetadata(from);
        const participants = metadata.participants || [];

        let toRemove = [];
        let skipped = [];

        for (const jid of targets) {
            const normalizedJid = normalizeId(jid);
            const isAdmin = participants.some(p => 
                [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).some(id => normalizeId(id) === normalizedJid) &&
                (p.admin === "admin" || p.admin === "superadmin")
            );

            if (isAdmin) skipped.push(jid);
            else toRemove.push(jid);
        }

        if (toRemove.length > 0) {
            await conn.groupParticipantsUpdate(from, toRemove, "remove");
        }

        let msg = "";
        if (toRemove.length) msg += `🗑️ *Removed:*\n${toRemove.map(j => `@${j.split('@')[0]}`).join('\n')}\n\n`;
        if (skipped.length) msg += `🚫 *Skipped (Admins):*\n${skipped.map(j => `@${j.split('@')[0]}`).join('\n')}`;

        return reply(msg.trim(), { mentions: [...toRemove, ...skipped] });

    } catch (e) {
        console.error("KICK ERROR:", e);
        return reply("❌ Failed to remove member(s). Check bot permissions.");
    }
});
