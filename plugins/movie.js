const { cmd } = require('../command');
const axios = require('axios');
const http = require('http');
const https = require('https');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const AXIOS_DEFAULTS = {
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
    httpAgent,
    httpsAgent
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

function dedupeQualities(downloads) {
    if (!Array.isArray(downloads)) return [];
    const seen = new Set();
    const out = [];
    for (const d of downloads) {
        if (d.url.includes("jio=yes")) continue;
        const label = d.title.match(/(\d{3,4})p/i)?.[1]
            ? `${d.title.match(/(\d{3,4})p/i)[1]}p`
            : "Low";
        if (seen.has(label)) continue;
        seen.add(label);
        out.push({ label, size: d.size, url: d.url });
    }
    return out;
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

        const movieListener = async (chatUpdate) => {
            const msg = chatUpdate.messages[0];
            if (!msg.message?.extendedTextMessage) return;

            const selectedText = msg.message.extendedTextMessage.text.trim();
            const context = msg.message.extendedTextMessage.contextInfo;
            const isReplyToBot = context && context.stanzaId === sentMsg.key.id;
            if (!isReplyToBot) return;

            const idx = parseInt(selectedText, 10);
            if (isNaN(idx) || idx < 1 || idx > limited.length) return;

            sock.ev.off("messages.upsert", movieListener);

            await sock.sendMessage(message.chat, { react: { text: "⏳", key: msg.key } });

            const selected = limited[idx - 1];
            const details = await getMovieDetails(selected.url);

            if (!details) {
                await sock.sendMessage(message.chat, { react: { text: "❌", key: msg.key } });
                return sock.sendMessage(message.chat, {
                    text: "❌ Failed to fetch movie download link. Please try again later."
                }, { quoted: msg });
            }

            const qualities = dedupeQualities(details.downloads);
            if (qualities.length === 0) {
                await sock.sendMessage(message.chat, { react: { text: "❌", key: msg.key } });
                return sock.sendMessage(message.chat, {
                    text: "❌ No download link available for this movie."
                }, { quoted: msg });
            }

            const movieName = details.movieName || selected.title;

            let qText = `╭━〔 *SELECT QUALITY* 〕━┈⊷\n┃ 🎬 *${movieName}*\n╰━━━━━━━━━━━━━━━━┈⊷\n\n`;
            qualities.forEach((qopt, i) => {
                qText += `*${i + 1}.* ${qopt.label}  (${qopt.size})\n`;
            });
            qText += `\n*ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴡɪᴛʜ ᴀ ɴᴜᴍʙᴇʀ (1-${qualities.length})*\n\n${CREDIT}`;

            const qMsg = await sock.sendMessage(message.chat, { text: qText }, { quoted: msg });
            await sock.sendMessage(message.chat, { react: { text: "✅", key: msg.key } });

            const qualityListener = async (chatUpdate2) => {
                const msg2 = chatUpdate2.messages[0];
                if (!msg2.message?.extendedTextMessage) return;

                const qSelectedText = msg2.message.extendedTextMessage.text.trim();
                const qContext = msg2.message.extendedTextMessage.contextInfo;
                const isReplyToQMsg = qContext && qContext.stanzaId === qMsg.key.id;
                if (!isReplyToQMsg) return;

                const qIdx = parseInt(qSelectedText, 10);
                if (isNaN(qIdx) || qIdx < 1 || qIdx > qualities.length) return;

                sock.ev.off("messages.upsert", qualityListener);

                await sock.sendMessage(message.chat, { react: { text: "⏳", key: msg2.key } });

                const chosen = qualities[qIdx - 1];
                const caption = `*${movieName}*\n📀 *Quality:* ${chosen.label}\n\n${CREDIT}`;

                try {
                    const response = await axios({
                        method: 'get',
                        url: chosen.url,
                        responseType: 'stream',
                        timeout: 1200000,
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        httpAgent,
                        httpsAgent,
                        headers: { "User-Agent": "Mozilla/5.0" }
                    });

                    await sock.sendMessage(message.chat, {
                        document: { stream: response.data },
                        mimetype: "video/mp4",
                        fileName: `${movieName} [${chosen.label}].mp4`,
                        caption
                    }, { quoted: msg2 });

                    await sock.sendMessage(message.chat, { react: { text: "✅", key: msg2.key } });
                } catch (e) {
                    console.error("Movie send error:", e.message);
                    await sock.sendMessage(message.chat, { react: { text: "❌", key: msg2.key } });
                    await sock.sendMessage(message.chat, {
                        text: "❌ Failed to send the movie file. Link might be expired, please try again."
                    }, { quoted: msg2 });
                }
            };

            sock.ev.on("messages.upsert", qualityListener);
            setTimeout(() => sock.ev.off("messages.upsert", qualityListener), 120000);
        };

        sock.ev.on("messages.upsert", movieListener);
        setTimeout(() => sock.ev.off("messages.upsert", movieListener), 120000);

    } catch (e) {
        console.error(e);
        reply("❌ System error occurred.");
    }
});
