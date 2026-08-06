const { cmd } = require('../command');
const axios = require('axios');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
};

const CREDIT = "> *⚡ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ⚡*";

async function searchMovies(query) {
    try {
        const res = await axios.get(
            `https://arslan-apis-v2.vercel.app/movie/moviesearch?q=${encodeURIComponent(query)}`,
            AXIOS_DEFAULTS
        );
        if (res.data?.status && Array.isArray(res.data?.result)) return res.data.result;
    } catch (e) {
        console.log("Movie Search API Error:", e.message);
    }
    return null;
}

async function getMovieDetails(pageUrl) {
    try {
        const res = await axios.get(
            `https://arslan-apis-v2.vercel.app/movie/moviesdl?url=${encodeURIComponent(pageUrl)}`,
            AXIOS_DEFAULTS
        );
        if (res.data?.status && res.data?.result?.success) return res.data.result;
    } catch (e) {
        console.log("Movie DL API Error:", e.message);
    }
    return null;
}

function bestQualityLink(downloads) {
    if (!Array.isArray(downloads) || downloads.length === 0) return null;
    const clean = downloads.filter(d => !d.url.includes("jio=yes"));
    const pool = clean.length ? clean : downloads;
    return pool[pool.length - 1]; // highest quality (last entry = 720p in API's order)
}

cmd({
    pattern: "movie",
    alias: ["film", "mve"],
    desc: "Search and download movies by name",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (sock, message, m, { q, reply }) => {
    try {
        if (!q) return reply("⚠️ Please provide a Movie Name!");

        const results = await searchMovies(q);
        if (!results || results.length === 0) return reply("❌ No movie found with that name!");

        const limited = results.slice(0, 10);

        let listText = `╭━〔 *MOVIE SEARCH* 〕━┈⊷\n┃ 🔎 *QUERY:* ${q}\n┃ 📦 *RESULTS:* ${limited.length}\n╰━━━━━━━━━━━━━━━━┈⊷\n\n`;
        limited.forEach((item, i) => {
            listText += `*${i + 1}.* ${item.title}\n\n`;
        });
        listText += `*ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴡɪᴛʜ ᴀ ɴᴜᴍʙᴇʀ (1-${limited.length})*\n\n${CREDIT}`;

        const sentMsg = await sock.sendMessage(message.chat, {
            image: { url: limited[0].poster },
            caption: listText
        }, { quoted: message });

        const listener = async (chatUpdate) => {
            const msg = chatUpdate.messages[0];
            if (!msg.message?.extendedTextMessage) return;

            const selectedText = msg.message.extendedTextMessage.text.trim();
            const context = msg.message.extendedTextMessage.contextInfo;
            const isReplyToBot = context && context.stanzaId === sentMsg.key.id;
            if (!isReplyToBot) return;

            const idx = parseInt(selectedText, 10);
            if (isNaN(idx) || idx < 1 || idx > limited.length) return;

            sock.ev.off("messages.upsert", listener);

            await sock.sendMessage(message.chat, { react: { text: "⏳", key: msg.key } });

            const selected = limited[idx - 1];
            const details = await getMovieDetails(selected.url);

            if (!details) {
                await sock.sendMessage(message.chat, { react: { text: "❌", key: msg.key } });
                return sock.sendMessage(message.chat, {
                    text: "❌ Failed to fetch movie download link. Please try again later."
                }, { quoted: msg });
            }

            const bestLink = bestQualityLink(details.downloads);
            if (!bestLink) {
                await sock.sendMessage(message.chat, { react: { text: "❌", key: msg.key } });
                return sock.sendMessage(message.chat, {
                    text: "❌ No download link available for this movie."
                }, { quoted: msg });
            }

            const movieName = details.movieName || selected.title;
            const caption = `*${movieName}*\n\n${CREDIT}`;

            await sock.sendMessage(message.chat, {
                document: { url: bestLink.url },
                mimetype: "video/mp4",
                fileName: `${movieName}.mp4`,
                caption
            }, { quoted: msg });

            await sock.sendMessage(message.chat, { react: { text: "✅", key: msg.key } });
        };

        sock.ev.on("messages.upsert", listener);
        setTimeout(() => sock.ev.off("messages.upsert", listener), 120000);

    } catch (e) {
        console.error(e);
        reply("❌ System error occurred.");
    }
});
