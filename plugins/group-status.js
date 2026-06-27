const { cmd } = require('../command');

cmd({
    pattern: "groupstatus",
    alias: ["gstatus", "poststatus", "statuspost"],
    desc: "Post text or media to WhatsApp Status",
    category: "group",
    react: "📡",
    filename: __filename
}, async (client, m, message, { from, reply, sender, isOwner, pushname, args }) => {
    try {

        const caption = args.join(" ");

        // TEXT STATUS
        if (!m.quoted && caption) {
            await client.sendMessage("status@broadcast", {
                text:
`╭━━〔 ᴀᴅᴇᴇʟ-ᴍᴅ 〕━━⬣
┃ 👤 User : ${pushname}
┃ ⏰ Time : ${new Date().toLocaleString()}
┃
┃ 💬 Message:
┃ ${caption}
╰━━━━━━━━━━━━━━━━⬣`
            });
            return reply("✅ Text status posted successfully.");
        }

        if (!m.quoted) {
            return reply("❌ Reply to an image, video, audio, or sticker.\n\nExample:\n.groupstatus Hello World");
        }

        const quoted = m.quoted;

        // ✅ Media key check
        const hasMediaKey =
            quoted.message?.imageMessage?.mediaKey ||
            quoted.message?.videoMessage?.mediaKey ||
            quoted.message?.audioMessage?.mediaKey ||
            quoted.message?.stickerMessage?.mediaKey;

        if (!hasMediaKey && quoted.mtype !== 'conversation' && quoted.mtype !== 'extendedTextMessage') {
            return reply("❌ Media expired. Please forward the media again and reply to that fresh message.");
        }

        let media;
        try {
            media = await quoted.download();
        } catch (e) {
            return reply("❌ Could not download media. Reply to a fresh/recent message.");
        }

        if (!media) return reply("❌ Media download failed.");

        // IMAGE
        if (quoted.mtype === 'imageMessage') {
            await client.sendMessage("status@broadcast", {
                image: media,
                caption:
`📸 ᴀᴅᴇᴇʟ-ᴍᴅ

👤 Posted By: ${pushname}
🕒 ${new Date().toLocaleString()}

${caption || "No Caption"}`
            });
            return reply("✅ Image status posted.");
        }

        // VIDEO
        if (quoted.mtype === 'videoMessage') {
            await client.sendMessage("status@broadcast", {
                video: media,
                caption:
`🎥 ᴀᴅᴇᴇʟ-ᴍᴅ

👤 Posted By: ${pushname}
🕒 ${new Date().toLocaleString()}

${caption || "No Caption"}`
            });
            return reply("✅ Video status posted.");
        }

        // AUDIO
        if (quoted.mtype === 'audioMessage') {
            await client.sendMessage("status@broadcast", {
                audio: media,
                mimetype: "audio/mp4",
                ptt: false
            });
            return reply("✅ Audio status posted.");
        }

        // STICKER
        if (quoted.mtype === 'stickerMessage') {
            await client.sendMessage("status@broadcast", {
                sticker: media
            });
            return reply("✅ Sticker status posted.");
        }

        return reply("❌ Unsupported media type.");

    } catch (err) {
        console.log("GROUPSTATUS ERROR:", err);
        return reply(`❌ Status Error\n\n${err.message}`);
    }
});
