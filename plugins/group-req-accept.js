const config = require('../config')
const { cmd, commands } = require('../command')
const { sleep } = require('../lib/functions')

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

        const metadata = await conn.groupMetadata(from)
        const participants = metadata.participants || []

        return reply(
            "Bot ID: " + conn.user?.id +
            "\nBot LID: " + (conn.user?.lid || 'none') +
            "\n\nParticipants:\n" +
            participants.map(p => `${p.id} | lid: ${p.lid || 'none'} | admin: ${p.admin || 'no'}`).join('\n')
        )

    } catch (e) {
        return reply("❌ Error: " + e.message)
    }
})
