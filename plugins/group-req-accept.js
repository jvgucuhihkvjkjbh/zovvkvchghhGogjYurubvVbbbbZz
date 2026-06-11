const config = require('../config')
const { cmd, commands } = require('../command')
const { sleep } = require('../lib/functions')

const normalizeId = (id) => {
    if (!id) return '';
    return id
        .replace(/:[0-9]+/g, '')
        .replace(/@(lid|s.whatsapp.net|c.us|g.us)/g, '')
        .replace(/[^\d]/g, '');
};

async function isBotAdmin(conn, chatId) {
    const metadata = await conn.groupMetadata(chatId);
    const participants = metadata.participants || [];
    const botId = normalizeId(conn.user?.id || '');
    const botLid = normalizeId(conn.user?.lid || '');
    return participants.some(p => {
        if (!(p.admin === "admin" || p.admin === "superadmin")) return false;
        const ids = [p.id, p.lid, p.phoneNumber].filter(Boolean);
        return ids.some(id => {
            const n = normalizeId(id);
            return n === botId || n === botLid;
        });
    });
}

cmd({
    pattern: "accept",
    alias: ["acceptall"],
    desc: "Accept group join requests",
    category: "group",
    react: "✅",
    filename: __filename
}, async (conn, mek, m, { from, body, args, isGroup, reply, isCreator, isAdmins }) => {
    try {
        if (!isGroup) return reply("⚠️ This command only works in groups.")
        if (!isAdmins && !isCreator) return reply("❌ Access Denied! Only group admins can use this command.")

        if (
            body.trim().toLowerCase() === ".accept" ||
            body.trim().toLowerCase() === `${config.PREFIX}accept`
        ) {
            return reply(`
╭━━〔 ACCEPT MENU 〕━━⬣
┃
┃ ◈ .acceptall
┃ ➜ Accept all pending requests
┃
┃ ◈ .accept 15
┃ ➜ Accept only 15 requests
┃
╰━━━━━━━━━━━━━━⬣
`)
        }

        const botAdmin = await isBotAdmin(conn, from)
        if (!botAdmin) return reply("❌ Bot must be a group admin.")

        let pending
        try {
            pending = await conn.groupRequestParticipantsList(from)
        } catch (listErr) {
            return reply("❌ List Error: " + listErr.message)
        }

        if (!pending || pending.length === 0) {
            return reply("❌ No pending join requests found.")
        }

        const metadata = await conn.groupMetadata(from)
        const availableSlots = 1024 - metadata.participants.length

        let limit

        if (body.toLowerCase().startsWith(".acceptall")) {
            limit = pending.length
        } else {
            limit = parseInt(args[0])
            if (isNaN(limit) || limit <= 0) {
                return reply("❌ Please provide a valid number.")
            }
        }

        let toAccept = pending.slice(0, Math.min(limit, availableSlots))

        if (toAccept.length === 0) {
            return reply("❌ Group is full or no requests to process.")
        }

        let approved = 0
        let failed = 0

        for (const user of toAccept) {
            try {
                const jid = user.jid || user.id
                if (!jid) continue
                await conn.groupRequestParticipantsUpdate(from, [jid], "approve")
                approved++
                await sleep(2000)
            } catch (err) {
                failed++
                await sleep(3000)
            }
        }

        return reply(`✅ Approved: ${approved}\n❌ Failed: ${failed}`)

    } catch (e) {
        return reply("❌ Error: " + e.message)
    }
})
