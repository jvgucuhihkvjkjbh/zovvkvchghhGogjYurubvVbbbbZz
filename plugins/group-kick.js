const { cmd } = require('../command')

cmd({
    pattern: "kick",
    alias: ["remove", "k"],
    desc: "Remove group members",
    category: "group",
    react: "🗑️",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, reply, sender }) => {
    try {
        if (!isGroup)
            return reply("❌ This command only works in groups.")

        const metadata = await conn.groupMetadata(from)
        const participants = metadata.participants

        const normalize = (jid) => (jid || "").replace(/@.*$/, "").replace(/:.+$/, "")

        const admins = participants
            .filter(p => p.admin)
            .map(p => normalize(p.id))

        const senderNorm = normalize(sender)
        const senderAlt = normalize(mek.key.participantAlt || mek.key.participant)

        const isSenderAdmin =
            admins.includes(senderNorm) ||
            admins.includes(senderAlt)

        if (!isSenderAdmin)
            return reply("⚠️ Only group admins can use this command.")

        const botNumber = normalize(conn.user.id)
        const isBotAdmin = admins.includes(botNumber)
        if (!isBotAdmin)
            return reply("⚠️ I need to be an admin to remove members.")

        let targets = []

        if (m.quoted?.sender) {
            targets.push(m.quoted.sender)
        }

        if (m.mentionedJid?.length) {
            targets.push(...m.mentionedJid)
        }

        if (targets.length === 0)
            return reply("❌ Reply to a member or mention user(s) to kick.")

        let removed = []
        let skipped = []

        for (const jid of targets) {
            if (admins.includes(normalize(jid))) {
                skipped.push(jid)
                continue
            }

            await conn.groupParticipantsUpdate(from, [jid], "remove")
            removed.push(jid)
        }

        let msg = ""
        if (removed.length)
            msg += `🗑️ Removed:\n${removed.map(j => `@${j.split('@')[0]}`).join('\n')}\n\n`

        if (skipped.length)
            msg += `🚫 Skipped (Admins):\n${skipped.map(j => `@${j.split('@')[0]}`).join('\n')}`

        return reply(msg.trim(), {
            mentions: [...removed, ...skipped]
        })

    } catch (e) {
        console.log("KICK ERROR:", e)
        return reply("❌ Failed to remove member(s). Check bot permissions.")
    }
})
