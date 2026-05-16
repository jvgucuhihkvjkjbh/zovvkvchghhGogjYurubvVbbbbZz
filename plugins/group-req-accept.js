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

        // Menu on .accept
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

        let pending = await conn.groupRequestParticipantsList(from)

        if (!pending || pending.length === 0) {
            return reply("❌ No pending join requests found.")
        }

        const metadata = await conn.groupMetadata(from)
        const availableSlots = 1024 - metadata.participants.length

        let limit

        // .acceptall
        if (body.toLowerCase().startsWith(".acceptall")) {
            limit = pending.length
        } else {
            // .accept 56
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

        for (const user of toAccept) {
            try {
                const jid = user.jid || user.id

                await conn.groupRequestParticipantsUpdate(from, [jid], "approve")

                approved++

                await sleep(2000)

            } catch (err) {
                await sleep(3000)
            }
        }

        return reply(`✅ Successfully approved ${approved} join requests.`)

    } catch (e) {
        console.log("ACCEPT ERROR:", e)
        return reply("❌ Failed to accept join requests.")
    }
})
