const config = require('../config');
const { cmd } = require('../command');
const { sleep } = require('../lib/functions');

// Helper function for Random Delay (Anti-Ban)
const getRandomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

cmd({
    pattern: "accept",
    alias: ["acceptall"],
    desc: "Accept group join requests safely",
    category: "group",
    react: "✅",
    filename: __filename
}, async (conn, mek, m, { from, body, args, isGroup, isAdmins, isOwner, isCreator, reply, prefix }) => {
    try {
        if (!isGroup) return reply("⚠️ This command only works in groups.");

        if (!isOwner && !isCreator && !isAdmins) {
            return reply("❌ Access Denied! Only group admins can use this command.");
        }

        // Dynamic Prefix detection
        const currentPrefix = prefix || config.PREFIX || '.';
        const cleanBody = body.trim().toLowerCase();

        if (
            cleanBody === `${currentPrefix}accept` ||
            cleanBody === `.accept`
        ) {
            return reply(`
╭━━〔 ACCEPT MENU 〕━━⬣
┃
┃ ◈ ${currentPrefix}acceptall
┃ ➜ Accept all pending requests
┃
┃ ◈ ${currentPrefix}accept 15
┃ ➜ Accept only 15 requests
┃
╰━━━━━━━━━━━━━━⬣
`);
        }

        let pending = await conn.groupRequestParticipantsList(from);

        if (!pending || pending.length === 0) {
            return reply("❌ No pending join requests found.");
        }

        const metadata = await conn.groupMetadata(from);
        const availableSlots = 1024 - metadata.participants.length;

        let limit;

        if (cleanBody.startsWith(`${currentPrefix}acceptall`) || cleanBody.startsWith(`.acceptall`)) {
            limit = pending.length;
        } else {
            limit = parseInt(args[0]);

            if (isNaN(limit) || limit <= 0) {
                return reply("❌ Please provide a valid number.");
            }
        }

        // Anti-Ban Safety Constraint: Max 30 requests per batch
        const MAX_SAFE_BATCH = 30;
        let finalLimit = Math.min(limit, availableSlots, MAX_SAFE_BATCH);

        let toAccept = pending.slice(0, finalLimit);

        if (toAccept.length === 0) {
            return reply("❌ Group is full or no requests to process.");
        }

        let approved = 0;

        for (let i = 0; i < toAccept.length; i++) {
            try {
                const user = toAccept[i];
                const jid = user.jid || user.id;

                await conn.groupRequestParticipantsUpdate(from, [jid], "approve");
                approved++;

                // Anti-Ban Delay (Hidden in backend)
                const randomSleep = getRandomDelay(4000, 7000);
                await sleep(randomSleep);

                if ((i + 1) % 5 === 0 && i !== toAccept.length - 1) {
                    const batchPause = getRandomDelay(12000, 18000);
                    await sleep(batchPause);
                }

            } catch (err) {
                await sleep(getRandomDelay(6000, 10000));
            }
        }

        return reply(`✅ Successfully approved ${approved} join requests.`);

    } catch (e) {
        console.log("ACCEPT ERROR:", e);
        return reply("❌ Failed to accept join requests.");
    }
});
