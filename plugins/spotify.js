const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

cmd({
    pattern: "spotify",
    alias: ["splay", "sp"],
    react: "💡",
    desc: "Direct Spotify Song Downloader",
    category: "downloader",
    use: '.spotify <song name>',
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("❌ Please provide a song name.\nExample: .spotify pasoori");

        // Step 1: Search API Calling
        const searchUrl = `https://jerrycoder.oggyapi.workers.dev/search/spotify?q=${encodeURIComponent(q)}&limit=5`;
        const searchRes = await axios.get(searchUrl, { timeout: 20000 });

        if (!searchRes.data || !searchRes.data.tracks || searchRes.data.tracks.length === 0) {
            return reply("❌ No song found!");
        }

        const bestSong = searchRes.data.tracks[0];

        // Step 2: Download API Calling
        const dlUrl = `https://jerrycoder.oggyapi.workers.dev/down/spotify?url=${encodeURIComponent(bestSong.spotifyUrl)}`;
        const dlRes = await axios.get(dlUrl, { timeout: 20000 });

        if (!dlRes.data || dlRes.data.status !== "success" || !dlRes.data.download_link) {
            return reply("❌ Failed to fetch download link");
        }

        const dlData = dlRes.data;
        const audioUrl = dlData.download_link;
        const title = dlData.title || bestSong.trackName;
        const artist = dlData.artist || bestSong.artist;
        const thumbnail = dlData.thumbnail || bestSong.image;

        // Step 3: Stream Audio to Temp File
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempFile = path.join(tempDir, `spotify_${Date.now()}.mp3`);
        const audioResponse = await axios({
            method: 'GET',
            url: audioUrl,
            responseType: 'stream',
            timeout: 120000,
        });

        await pipeline(audioResponse.data, fs.createWriteStream(tempFile));
        const audioBuffer = fs.readFileSync(tempFile);

        // Step 4: Send Thumbnail + Metadata
        const customCaption = 
`🎵 *Title:* ${title}
👤 *Artist:* ${artist}
💿 *Album:* ${bestSong.album || 'Unknown'}
⏱️ *Duration:* ${bestSong.durationMs || 'Unknown'}
🔗 *Link:* ${bestSong.spotifyUrl}

🤍 ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🤍`;

        if (thumbnail) {
            await conn.sendMessage(from, {
                image: { url: thumbnail },
                caption: customCaption
            }, { quoted: mek });
        } else {
            await reply(customCaption);
        }

        // Step 5: Send Document/Audio Audio File
        await conn.sendMessage(from, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${title.replace(/[^\w\s]/gi, '')}.mp3`
        }, { quoted: mek });

        // Cleanup temp file
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

    } catch (error) {
        console.error('Spotify Error:', error);
        reply("❌ Something went wrong. Please try again later.");
    }
});
