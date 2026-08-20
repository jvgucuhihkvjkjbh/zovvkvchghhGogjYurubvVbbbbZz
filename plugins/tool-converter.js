const converter = require('../data/converter');
const stickerConverter = require('../data/sticker-converter');
const { cmd } = require('../command');

cmd({
    pattern: 'toimg',
    alias: ['toimage', 'tophoto'],
    desc: 'Convert stickers to images',
    category: 'media',
    react: '🖼️',
    filename: __filename
}, async (client, match, message, { from }) => {
    try {
        if (!message.quoted || message.quoted.mtype !== 'stickerMessage') {
            return await client.sendMessage(from, {
                text: "✨ *Sticker Converter*\n\nPlease reply to a sticker message to convert it into an image.\n\nExample: `.toimg` (reply to a sticker)"
            }, { quoted: message });
        }

        const stickerBuffer = await message.quoted.download();
        if (!stickerBuffer) return;

        const imageBuffer = await stickerConverter.convertStickerToImage(stickerBuffer);

        await client.sendMessage(from, {
            image: imageBuffer,
            caption: '> *sᴛɪᴄᴋᴇʀ ᴛᴏ ɪᴍɢ*'
        }, { quoted: message });

    } catch (e) {
        console.error('convert error:', e);
    }
});

cmd({
    pattern: 'tovideo',
    alias: ['tovid', 'tomp4'],
    desc: 'Convert animated stickers to MP4 video',
    category: 'media',
    react: '🎬',
    filename: __filename
}, async (client, match, message, { from }) => {
    try {
        if (!message.quoted || message.quoted.mtype !== 'stickerMessage') {
            return await client.sendMessage(from, {
                text: "✨ *Sticker to Video*\n\nPlease reply to an animated sticker to convert it into an MP4.\n\nExample: `.tovideo` (reply to an animated sticker)"
            }, { quoted: message });
        }

        const stickerBuffer = await message.quoted.download();
        if (!stickerBuffer) return;

        const videoBuffer = await stickerConverter.convertStickerToVideo(stickerBuffer);

        await client.sendMessage(from, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            caption: '> *sᴛɪᴄᴋᴇʀ ᴛᴏ ᴠɪᴅᴇᴏ*'
        }, { quoted: message });

    } catch (e) {
        console.error('tovideo error:', e);
        await client.sendMessage(from, {
            text: "❌ Failed to convert sticker to video. Make sure it's an animated sticker."
        }, { quoted: message });
    }
});

cmd({
    pattern: 'tomp3',
    desc: 'Convert media to audio',
    category: 'audio',
    react: '🎵',
    filename: __filename
}, async (client, match, message, { from }) => {
    if (!match.quoted) {
        return await client.sendMessage(from, {
            text: "*🔊 Please reply to a video/audio message*"
        }, { quoted: message });
    }

    if (!['videoMessage', 'audioMessage'].includes(match.quoted.mtype)) {
        return await client.sendMessage(from, {
            text: "❌ Only video/audio messages can be converted"
        }, { quoted: message });
    }

    if (match.quoted.seconds > 300) {
        return await client.sendMessage(from, {
            text: "⏱️ Media too long (max 5 minutes)"
        }, { quoted: message });
    }

    await client.sendMessage(from, {
        text: "🔄 Converting to audio..."
    }, { quoted: message });

    try {
        const buffer = await match.quoted.download();
        const ext = match.quoted.mtype === 'videoMessage' ? 'mp4' : 'm4a';
        const audio = await converter.toAudio(buffer, ext);

        await client.sendMessage(from, {
            audio: audio,
            mimetype: 'audio/mpeg'
        }, { quoted: message });

    } catch (e) {
        console.error('Conversion error:', e.message);
        await client.sendMessage(from, {
            text: "❌ Failed to process audio"
        }, { quoted: message });
    }
});

cmd({
    pattern: 'toptt',
    desc: 'Convert media to voice message',
    category: 'audio',
    react: '🎙️',
    filename: __filename
}, async (client, match, message, { from }) => {
    if (!match.quoted) {
        return await client.sendMessage(from, {
            text: "*🗣️ Please reply to a video/audio message*"
        }, { quoted: message });
    }

    if (!['videoMessage', 'audioMessage'].includes(match.quoted.mtype)) {
        return await client.sendMessage(from, {
            text: "❌ Only video/audio messages can be converted"
        }, { quoted: message });
    }

    if (match.quoted.seconds > 60) {
        return await client.sendMessage(from, {
            text: "⏱️ Media too long for voice (max 1 minute)"
        }, { quoted: message });
    }

    await client.sendMessage(from, {
        text: "🔄 Converting to voice message..."
    }, { quoted: message });

    try {
        const buffer = await match.quoted.download();
        const ext = match.quoted.mtype === 'videoMessage' ? 'mp4' : 'm4a';
        const ptt = await converter.toPTT(buffer, ext);

        await client.sendMessage(from, {
            audio: ptt,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: message });

    } catch (e) {
        console.error('PTT conversion error:', e.message);
        await client.sendMessage(from, {
            text: "❌ Failed to create voice message"
        }, { quoted: message });
    }
});
