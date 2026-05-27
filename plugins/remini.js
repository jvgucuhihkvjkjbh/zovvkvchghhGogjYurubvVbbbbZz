const { cmd } = require('../command');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

cmd({
  pattern: "remini",
  alias: ["enhance", "hd"],
  react: '✨',
  desc: "Enhance photo quality",
  category: "tools",
  filename: __filename
}, async (client, message, { reply, quoted }) => {

  try {

    const quotedMsg = quoted || message;
    const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';

    if (!mimeType.startsWith('image/')) {
      return reply("📸 Please reply to an image");
    }

    await client.sendMessage(message.chat, {
      react: { text: "⏳", key: message.key }
    });

    // Download image
    const mediaBuffer = await quotedMsg.download();

    if (!mediaBuffer) {
      return reply("❌ Failed to download image");
    }

    const extension = mimeType.includes('png') ? '.png' : '.jpg';
    const tempPath = path.join(
      os.tmpdir(),
      `remini_${Date.now()}${extension}`
    );

    fs.writeFileSync(tempPath, mediaBuffer);

    // Upload image
    const form = new FormData();
    form.append('fileToUpload', fs.createReadStream(tempPath));
    form.append('reqtype', 'fileupload');

    const uploadRes = await axios.post(
      'https://catbox.moe/user/api.php',
      form,
      {
        headers: form.getHeaders(),
        timeout: 60000
      }
    );

    fs.unlinkSync(tempPath);

    const uploadedUrl = uploadRes.data.trim();

    if (!uploadedUrl.startsWith('https://')) {
      return reply("❌ Image upload failed");
    }

    // New API
    const api =
      `https://api.princetechn.com/api/tools/remini?apikey=prince&url=${encodeURIComponent(uploadedUrl)}`;

    const { data } = await axios.get(api, {
      timeout: 120000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (
      !data ||
      data.status !== 200 ||
      !data.success ||
      !data.result
    ) {
      console.log("API RESPONSE:", data);
      return reply("❌ Failed to enhance image");
    }

    // Handle result URL
    let resultUrl = null;

    if (typeof data.result === "string") {
      resultUrl = data.result;
    } else if (data.result.image) {
      resultUrl = data.result.image;
    } else if (data.result.url) {
      resultUrl = data.result.url;
    }

    if (!resultUrl) {
      console.log("INVALID RESULT:", data.result);
      return reply("❌ Invalid API response");
    }

    // Send enhanced image
    await client.sendMessage(message.chat, {
      image: { url: resultUrl },
      caption:
`✨ *REMINI ENHANCEMENT COMPLETED*

> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
    }, { quoted: message });

    await client.sendMessage(message.chat, {
      react: { text: "✅", key: message.key }
    });

  } catch (err) {

    console.log("REMINI ERROR:", err.message);

    await client.sendMessage(message.chat, {
      react: { text: "❌", key: message.key }
    });

    reply(`❌ ${err.message}`);
  }
});
