const { cmd } = require('../command');
const fetch = require('node-fetch');

cmd({
pattern: "snap",
alias: ["snapchat", "ssdown"],
desc: "Download Snapchat Spotlight Videos",
category: "downloader",
react: "👻",
filename: __filename
}, async (conn, mek, m, { from, args, reply, isCreator, sender }) => {
try {
if (!isAuthorized(sender, isCreator)) {
return reply("❌ Only owner can use this command.")
}

if (!args[0]) return reply("*❌ Please provide a Snapchat link.*") 
if (!args[0].includes("snapchat.com")) return reply("*❌ Invalid Snapchat URL. Please provide a valid link.*")

await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } }) 
const inputUrl = args[0]

const res = await fetch("https://jerrycoder.oggyapi.workers.dev/down/snap?url=" + encodeURIComponent(inputUrl)) 
if (!res.ok) return reply("*❌ API request failed. Please try again later.*") 

const data = await res.json() 
if (data.status !== "success" || !data.medias || !data.medias.length) {
    return reply("*❌ Failed to fetch video or no video media found.*")
}

const videoTitle = data.title || "Snapchat Video"
const durationMs = data.duration ? parseInt(data.duration) : 0
const durationSec = durationMs ? Math.floor(durationMs / 1000) : "N/A"

const videoUrl = data.medias[0].url
if (!videoUrl) return reply("*❌ Download link not found in the response.*")

const cleanTitle = videoTitle.length > 100 ? videoTitle.substring(0, 100) + "..." : videoTitle 
const captionText = "*🎬 TITLE:* " + cleanTitle + "\n⏱️ *DURATION:* " + durationSec + "s\n\n" + `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

await conn.sendMessage(from, { video: { url: videoUrl }, caption: captionText }, { quoted: mek }) 
await conn.sendMessage(from, { react: { text: "✅", key: mek.key } }) 

} catch (err) { 
console.log("SNAP DOWNLOAD ERROR:", err.message) 
await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }) 
reply("*❌ An error occurred while processing your request.*") 
} 
});
