const axios = require("axios");
const { cmd } = require("../command");

cmd({
  pattern: "rig",
  alias: ["ringtone", "callring"],
  react: "🔔",
  desc: "Download Nokia ringtones and show title + Adeel footer",
  category: "download",
  use: ".rig <song name>",
  filename: __filename
}, async (conn, mek, m, { args, reply }) => {
  try {
    if (!args[0]) return reply("🔔 Please provide a song name, e.g., .rig nokia");

    const songName = args.join(" ").toLowerCase();

    // API call
    const response = await axios.get(`https://gtech-api-xtp1.onrender.com/api/download/ringtone?title=${encodeURIComponent(songName)}&apikey=APIKEY`);
    
    const data = response.data;

    if (!data || !data.result || data.result.length === 0) return reply("❌ No ringtone found for this song.");

    // Get the first result
    const ringtone = data.result[0];

    // Caption with Title first and your name at last
    const caption = `${ringtone.title}\n\n🩶ᴘᴏᴡᴇʀᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ🩶`;

    // Send audio with caption
    await conn.sendMessage(m.from, {
      audio: { url: ringtone.audio },
      mimetype: "audio/mpeg",
      fileName: `${ringtone.title}.mp3`,
      caption: caption
    }, { quoted: m });

  } catch (error) {
    console.error(error);
    reply("❌ Something went wrong while fetching the ringtone.");
  }
});