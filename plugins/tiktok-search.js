const fetch = require("node-fetch");
const { cmd } = require("../command");

cmd({
  pattern: "tiktoksearch",
  alias: ["tiktoks", "tiks"],
  desc: "Search for TikTok videos using a query.",
  react: '✅',
  category: 'tools',
  filename: __filename
}, async (conn, m, store, {
  from,
  args,
  reply
}) => {
  if (!args[0]) {
    return reply("*❌ Give video name or query*");
  }

  const query = args.join(" ");
  await store.react('⌛');

  try {
    const response = await fetch(`https://apis-starlights-team.koyeb.app/starlight/tiktoksearch?text=${encodeURIComponent(query)}`);
    if (!response.ok) return reply("*❌ Search API failed. Try again.*");
    
    const data = await response.json();
    if (!data || !data.data || data.data.length === 0) {
      await store.react('❌');
      return reply("*❌ No results found.*");
    }

    // پریسائس آؤٹ پٹ کے لیے رینڈم 5 رزلٹس سلیکٹ کیے گئے ہیں
    const results = data.data.slice(0, 5).sort(() => Math.random() - 0.5);

    for (const video of results) {
      const cleanTitle = video.title.length > 100 ? video.title.substring(0, 100) + "..." : video.title;
      
      const message = `*🎬 TITLE:* ${cleanTitle}\n` +
                      `👤 *AUTHOR:* ${video.author || 'Unknown'}\n` +
                      `📊 *STATS:* ${video.duration || "Unknown"}\n\n` +
                      `> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

      if (video.nowm) {
        await conn.sendMessage(from, {
          video: { url: video.nowm },
          caption: message
        }, { quoted: m });
      }
    }

    await store.react('✅');
  } catch (error) {
    console.error("TikTokSearch Error:", error.message);
    await store.react('❌');
    reply("*❌ Error occurred. Please try again.*");
  }
});
