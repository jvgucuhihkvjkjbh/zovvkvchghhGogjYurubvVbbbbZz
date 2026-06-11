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

        const metadata = await conn.groupMetadata(from)

        const botData = metadata.participants.find(p => p.id === conn.user.id)
        if (!botData?.admin) {
            return reply("❌ Bot must be a group admin.")
        }

        // ━━━ PENDING LIST - Multiple Fallback Methods ━━━
        let pending = null

        // Method 1 - Standard
        try {
            pending = await conn.groupRequestParticipantsList(from)
            if (pending && pending.length >= 0) {
                // Method 1 کام کر گیا
            }
        } catch (e1) {
            pending = null
        }

        // Method 2 - Raw Query (RC10+)
        if (!pending) {
            try {
                const result = await conn.query({
                    tag: "iq",
                    attrs: {
                        id: conn.generateMessageTag(),
                        type: "get",
                        xmlns: "w:g2",
                        to: from,
                    },
                    content: [{ tag: "membership_approval_requests", attrs: {} }]
                })
                const requests = result?.content?.[0]?.content || []
                pending = requests.map(r => ({
                    jid: r.attrs?.jid || r.attrs?.id
                })).filter(r => r.jid)
            } catch (e2) {
                pending = null
            }
        }

        // Method 3 - groupFetchAllParticipants
        if (!pending) {
            try {
                const all = await conn.groupFetchAllParticipants(from)
                pending = all?.filter(p => p?.pending === true) || []
            } catch (e3) {
                pending = null
            }
        }

        // Method 4 - groupMetadata pending
        if (!pending) {
            try {
                const meta = await conn.groupMetadata(from)
                pending = meta?.pendingParticipants || []
            } catch (e4) {
                pending = null
            }
        }

        if (!pending || pending.length === 0) {
            return reply("❌ No pending join requests found.")
        }

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

                // Approve Method 1 - Standard
                let done = false
                try {
                    await conn.groupRequestParticipantsUpdate(from, [jid], "approve")
                    done = true
                } catch (a1) {}

                // Approve Method 2 - Raw Query
                if (!done) {
                    try {
                        await conn.query({
                            tag: "iq",
                            attrs: {
                                id: conn.generateMessageTag(),
                                type: "set",
                                xmlns: "w:g2",
                                to: from,
                            },
                            content: [{
                                tag: "membership_requests_action",
                                attrs: {},
                                content: [{
                                    tag: "approve",
                                    attrs: {},
                                    content: [{
                                        tag: "participant",
                                        attrs: { jid: jid }
                                    }]
                                }]
                            }]
                        })
                        done = true
                    } catch (a2) {}
                }

                if (done) {
                    approved++
                } else {
                    failed++
                }

                await sleep(2000)

            } catch (err) {
                failed++
                await sleep(3000)
            }
        }

        let resultMsg = `✅ Approved: ${approved}\n❌ Failed: ${failed}`
        return reply(resultMsg)

    } catch (e) {
        return reply("❌ Error: " + e.message)
    }
})
