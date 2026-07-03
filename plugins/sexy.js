const { cmd } = require('../command');
const fetch = require('node-fetch');
const axios = require('axios');
const fs = require('fs');

const isAuthorized = (sender, isCreator) => {
    if (isCreator) return true;
    try {
        const sudo = JSON.parse(fs.readFileSync("./lib/sudo.json"));
        const num = sender.split('@')[0].replace(/:[0-9]+/g, '').replace(/[^\d]/g, '');
        return sudo.some(n => n.replace(/[^\d]/g, '') === num);
    } catch {
        return false;
    }
};

cmd({
pattern: "xv",
alias: ["xvideo", "xhot", "xfuck"],
desc: "Search & Download Video (name or link)",
category: "downloader",
react: "🍑",
filename: __filename
}, async (conn, mek, m, { from, args, reply, isCreator, sender }) => {
try {
if (!isAuthorized(sender, isCreator)) {
return reply("❌ Only owner can use this command.")
}

if (!args[0]) return reply("*❌ Give video name or link*") 
await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } }) 
const input = args.join(" ") 
let videoUrl = "" 
let title = "Video" 
let info = "" 

if (input.includes("http")) { 
    const res = await fetch("https://jerrycoder.oggyapi.workers.dev/down/xnxx?url=" + encodeURIComponent(input)) 
    if (!res.ok) return reply("*❌ API request failed. Try again.*") 
    const data = await res.json() 
    if (data.status !== "success") return reply("*❌ Failed to fetch video.*") 
    title = data.video_title || "Video" 
    videoUrl = data.downloads && (data.downloads.high_quality || data.downloads.direct_download || data.downloads.low_quality) 
} else { 
    const search = await fetch("https://jerrycoder.oggyapi.workers.dev/search/xnxx?q=" + encodeURIComponent(input)) 
    if (!search.ok) return reply("*❌ Search API failed. Try again.*") 
    const sdata = await search.json() 
    if (sdata.status !== "success" || !sdata.results || !sdata.results.length) return reply("*❌ No results found.*") 
    const first = sdata.results[0] 
    title = first.title || "Video" 
    info = `Duration: ${first.duration || ''} | Views: ${first.views || ''}`
    const videoLink = first.url 
    if (!videoLink) return reply("*❌ No download link found.*") 
    const res = await fetch("https://jerrycoder.oggyapi.workers.dev/down/xnxx?url=" + encodeURIComponent(videoLink)) 
    if (!res.ok) return reply("*❌ Download API failed. Try again.*") 
    const data = await res.json() 
    if (data.status !== "success") return reply("*❌ Download failed.*") 
    videoUrl = data.downloads && (data.downloads.high_quality || data.downloads.direct_download || data.downloads.low_quality) 
} 

if (!videoUrl) return reply("*❌ No video URL found. Try again.*") 
const cleanTitle = title.length > 100 ? title.substring(0, 100) + "..." : title 
const captionText = "*🎬 TITLE:* " + cleanTitle + "\n" + (info ? "📊 *STATS:* " + info + "\n\n" : "\n") + "> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*" 
await conn.sendMessage(from, { video: { url: videoUrl }, caption: captionText }, { quoted: mek }) 
await conn.sendMessage(from, { react: { text: "✅", key: mek.key } }) 
} catch (err) { 
console.log("XV ERROR:", err.message) 
await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }) 
reply("*❌ Error occurred. Please try again.*") 
} 
});


cmd({
    pattern: "rvideo",
    alias: ["randomvid", "rv"],
    desc: "Random video",
    category: "fun",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, reply, isCreator, sender }) => {
    try {
        if (!isAuthorized(sender, isCreator)) {
            return reply("❌ Only owner can use this command.")
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } })

        const apiUrl = "https://arslan-apis-v2.vercel.app/leakvideos"

        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })

        if (!response.data) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } })
            return reply("❌ No video data received. Try again.")
        }

        const buffer = Buffer.from(response.data, 'binary')

        await conn.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            fileName: "Adeel-Random-" + Date.now() + ".mp4",
            caption: "> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*"
        }, { quoted: mek })

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } })

    } catch (e) {
        console.log("RVIDEO ERROR:", e.message)
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } })
        reply("❌ Video load failed. Try again.")
    }
});


cmd({
    pattern: "xv2",
    alias: ["xvideo2", "xhot2", "xfuck2"],
    desc: "Download media and send video file",
    category: "download",
    react: "📥",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        const inputUrl = args[0];
        if (!inputUrl) return reply("❌ Please provide a valid URL!");

        await conn.sendMessage(from, {
            react: { text: "⏳", key: mek.key }
        });

        const api = `https://arslan-apis-v2.vercel.app/download/xhamster?url=${encodeURIComponent(inputUrl)}`;
        const res = await axios.get(api);

        if (!res.data || res.data.status !== true) {
            return reply("❌ API returned an invalid response or failed status!");
        }

        const result = res.data.result;
        const title = result.title;
        const desc = result.desc;
        const videoList = result.video;

        const finalVideoUrl = videoList && videoList[0] ? videoList[0].url : null;

        if (!finalVideoUrl) {
            return reply("❌ Video URL could not be found in the API response!");
        }

        await conn.sendMessage(from, {
            video: { url: finalVideoUrl },
            caption: `*🎥 SEXY DOWNLOADED*

📌 *TITLE:* ${title}

📝 *DESCRIPTION:* ${desc}

> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ*`
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {
        console.error("DOWNLOAD ERROR:", e);
        reply("❌ An error occurred while processing the request!");
    }
});
