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
        let failedErrors = []

        for (const user of toAccept) {
            try {
                const jid = user.jid || user.id
                await conn.groupRequestParticipantsUpdate(from, [jid], "approve")
                approved++
                await sleep(2000)
            } catch (err) {
                failed++
                failedErrors.push(err.message)
                await sleep(3000)
            }
        }

        let resultMsg = `✅ Approved: ${approved}\n❌ Failed: ${failed}`
        if (failedErrors.length > 0) {
            resultMsg += `\n\n⚠️ Errors:\n${[...new Set(failedErrors)].join('\n')}`
        }

        return reply(resultMsg)

    } catch (e) {
        return reply("❌ Error: " + e.message)
    }
})
