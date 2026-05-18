const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { cmd } = require("../command");

// TEMP URL STORAGE
global.mediaUrlStore = global.mediaUrlStore || {};

cmd({
  pattern: "tourl",
  alias: ["imgtourl", "imgurl", "url", "geturl", "upload"],
  react: "🖇",
  desc: "Convert media to Catbox URL",
  category: "utility",
  use: ".tourl [reply to media]",
  filename: __filename
}, async (conn, m, match, { reply, from, sender }) => {

  try {

    const quoted = m.quoted ? m.quoted : m;

    const mime =
      (quoted.msg || quoted).mimetype || "";

    if (!mime) {
      return reply(
        "🍁 Please reply to image/video/audio"
      );
    }

    const buffer = await quoted.download();

    if (!buffer || !buffer.length) {
      throw "Failed to download media";
    }

    let ext = "";

    if (mime.includes("image/jpeg")) ext = ".jpg";
    else if (mime.includes("image/png")) ext = ".png";
    else if (mime.includes("image/webp")) ext = ".webp";
    else if (mime.includes("video/mp4")) ext = ".mp4";
    else if (mime.includes("audio/mpeg")) ext = ".mp3";
    else if (mime.includes("audio/ogg")) ext = ".ogg";
    else if (mime.includes("audio/mp4")) ext = ".m4a";

    const tempPath = path.join(
      os.tmpdir(),
      `upload_${Date.now()}${ext}`
    );

    fs.writeFileSync(tempPath, buffer);

    // UGUU UPLOAD
    const uguuForm = new FormData();

    uguuForm.append(
      "files[]",
      fs.createReadStream(tempPath)
    );

    const uguuRes = await axios.post(
      "https://uguu.se/upload.php",
      uguuForm,
      {
        headers: {
          ...uguuForm.getHeaders()
        }
      }
    );

    const uguuUrl =
      uguuRes.data.files[0].url;

    // CATBOX UPLOAD
    const catboxForm = new FormData();

    catboxForm.append(
      "reqtype",
      "urlupload"
    );

    catboxForm.append(
      "url",
      uguuUrl
    );

    const catboxRes = await axios.post(
      "https://catbox.moe/user/api.php",
      catboxForm,
      {
        headers: {
          ...catboxForm.getHeaders()
        }
      }
    );

    fs.unlinkSync(tempPath);

    const mediaUrl =
      catboxRes.data.trim();

    // SAVE USER URL
    global.mediaUrlStore[sender] = mediaUrl;

    let mediaType = "File";

    if (mime.includes("image")) {
      mediaType = "Image";
    } else if (mime.includes("video")) {
      mediaType = "Video";
    } else if (mime.includes("audio")) {
      mediaType = "Audio";
    }

    // BUTTON MESSAGE
    await conn.sendMessage(from, {
      text:
`📁 *TYPE:* ${mediaType}

💾 *SIZE:* ${formatBytes(buffer.length)}

✅ *UPLOAD SUCCESSFUL*

> *© ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`,

      footer: "Click button below to get URL",

      buttons: [
        {
          buttonId: "get_uploaded_url",
          buttonText: {
            displayText: "📋 COPY URL"
          },
          type: 1
        }
      ],

      headerType: 1

    }, { quoted: m });

  } catch (e) {

    console.error(e);

    reply(
      `❌ Error: ${e.message || e}`
    );
  }
});

// BUTTON RESPONSE HANDLER
cmd({
  on: "body"
}, async (conn, m, store, { from, sender }) => {

  try {

    const selected =
      m.message?.buttonsResponseMessage
        ?.selectedButtonId;

    if (selected === "get_uploaded_url") {

      const savedUrl =
        global.mediaUrlStore[sender];

      if (!savedUrl) return;

      await conn.sendMessage(from, {
        text:
`📋 *YOUR URL*

${savedUrl}

> *© ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
      }, { quoted: m });

    }

  } catch (err) {
    console.error(err);
  }
});

function formatBytes(bytes) {

  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;

  const sizes = [
    "Bytes",
    "KB",
    "MB",
    "GB"
  ];

  const i = Math.floor(
    Math.log(bytes) / Math.log(k)
  );

  return (
    parseFloat(
      (bytes / Math.pow(k, i)).toFixed(2)
    ) +
    " " +
    sizes[i]
  );
}
