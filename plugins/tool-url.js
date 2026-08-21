const axios = require("axios");
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require("path");
const { cmd } = require("../command");
const { sendButtons } = require('gifted-btns');

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '8db492efc937a635b90680a9a860dc85';
const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

// 1. ImgBB API Command (2 Added)
cmd({
  'pattern': "tourl2",
  'alias': ["imgtourl2", "imgurl2", "url2", "geturl2", "upload2", "imgbb2"],
  'react': '🖼️',
  'desc': "Convert image/URL to ImgBB URL",
  'category': "utility",
  'use': ".tourl2 [reply to image] or .tourl2 <image url>",
  'filename': __filename
}, async (client, message, match, { reply }) => {
  try {
    const query = Array.isArray(match) ? match.join(' ').trim() : String(match || '').trim();
    const quotedMsg = message.quoted ? message.quoted : message;
    const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';
    const urlMatch = query.match(/(https?:\/\/[^\s]+)/i);

    let imageBuffer = null;
    let imageUrl = null;

    if (mimeType) {
      const imageBufferAttempt = await quotedMsg.download();
      if (!imageBufferAttempt || imageBufferAttempt.length === 0) {
        throw "Failed to download media";
      }

      if (!(mimeType.includes('image') || mimeType.includes('sticker'))) {
        return reply("❌ imgbb only supports images/stickers. Please reply to an image or sticker.");
      }

      imageBuffer = imageBufferAttempt;
    } else if (urlMatch) {
      imageUrl = urlMatch[0];
    } else {
      return reply("🍁 Please reply to an image/sticker or provide an image URL\n\n*Use:* .tourl2 [reply] or .tourl2 <url>");
    }

    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    if (imageBuffer) {
      formData.append('image', imageBuffer.toString('base64'));
    } else if (imageUrl) {
      formData.append('image', imageUrl);
    }
    formData.append('name', `upload_${Date.now()}`);

    const response = await axios.post(IMGBB_API_URL, formData, {
      headers: formData.getHeaders(),
      timeout: 60000
    });

    if (!response.data || !response.data.success) {
      throw response.data?.error?.message || "Upload failed";
    }

    const result = response.data.data;
    const resultUrl = result.url || result.display_url || result.image?.url;

    if (!resultUrl) {
      throw "No image URL in response";
    }

    const caption =
      `*Image Uploaded Successfully*\n\n` +
      `*Size:* ${formatBytes(result.size || 0)}\n` +
      `*URL:* ${resultUrl}\n\n` +
      `> *© ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`;

    await sendButtons(client, message.chat, {
      title: '',
      text: caption,
      buttons: [
        {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: '📋 Copy Url',
            copy_code: resultUrl
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🌐 Open Link',
            url: resultUrl
          })
        }
      ]
    });

  } catch (error) {
    console.error(error);
    await reply(`❌ Error: ${error.message || error}`);
  }
});

// 2. Main Adeel-Xtech / Catbox API Command (Clean Pattern - No 2 or 3)
cmd({
  'pattern': "tourl",
  'alias': ["imgtourl", "imgurl", "url", "geturl", "upload"],
  'react': '🖇',
  'desc': "Convert media to Catbox URL via Adeel-Xtech API",
  'category': "utility",
  'use': ".tourl [reply to media]",
  'filename': __filename
}, async (client, message, match, { reply }) => {
  try {
    const quotedMsg = message.quoted ? message.quoted : message;
    const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';
    
    if (!mimeType) {
      return reply("🍁 Please reply to an image, video, or audio message");
    }

    const mediaBuffer = await quotedMsg.download();
    if (!mediaBuffer || mediaBuffer.length === 0) {
      throw new Error("Failed to download media");
    }

    let extension = '';
    if (mimeType.includes('image/jpeg')) extension = '.jpg';
    else if (mimeType.includes('image/png')) extension = '.png';
    else if (mimeType.includes('image/webp')) extension = '.webp';
    else if (mimeType.includes('video/mp4')) extension = '.mp4';
    else if (mimeType.includes('audio/mpeg')) extension = '.mp3';
    else if (mimeType.includes('audio/ogg')) extension = '.ogg';
    else if (mimeType.includes('audio/mp4')) extension = '.m4a';
    else if (mimeType.includes('audio/x-m4a')) extension = '.m4a';
    else if (mimeType.includes('audio/wav')) extension = '.wav';
    
    const tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}${extension}`);
    fs.writeFileSync(tempFilePath, mediaBuffer);

    const form = new FormData();
    form.append('file', fs.createReadStream(tempFilePath), `file${extension}`);

    const apiResponse = await axios.post('https://adeel-xtech-apis.vercel.app/api/imgtourl', form, {
      headers: {
        ...form.getHeaders(),
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 60000
    });

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    if (!apiResponse.data || apiResponse.data.status !== true || !apiResponse.data.result || !apiResponse.data.result.url) {
      throw new Error("Failed to upload to Adeel-Xtech API");
    }

    const mediaUrl = apiResponse.data.result.url.trim();

    let mediaType = 'File';
    if (mimeType.includes('image')) mediaType = 'Image';
    else if (mimeType.includes('video')) mediaType = 'Video';
    else if (mimeType.includes('audio')) mediaType = 'Audio';

    const caption =
      `*${mediaType} Uploaded Successfully*\n\n` +
      `*Size:* ${formatBytes(mediaBuffer.length)}\n` +
      `*URL:* ${mediaUrl}\n\n` +
      `> *© ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`;

    await sendButtons(client, message.chat, {
      title: '',
      text: caption,
      buttons: [
        {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: '📋 Copy Url',
            copy_code: mediaUrl
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🌐 Open Link',
            url: mediaUrl
          })
        }
      ]
    });

  } catch (error) {
    console.error(error);
    await reply(`❌ Error: ${error.message || error}`);
  }
});

// 3. Qu.ax API Command (3 Added)
cmd({
  'pattern': "tourl3",
  'alias': ["imgtourl3", "imgurl3", "url3", "geturl3", "upload3", "quax3"],
  'react': '🖇',
  'desc': "Convert media to Qu.ax URL",
  'category': "utility",
  'use': ".tourl3 [reply to media]",
  'filename': __filename
}, async (client, message, match, { reply }) => {
  try {
    const quotedMsg = message.quoted ? message.quoted : message;
    const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';
    
    if (!mimeType) {
      return reply("🍁 Please reply to an image, video, or audio message");
    }

    const mediaBuffer = await quotedMsg.download();
    if (!mediaBuffer || mediaBuffer.length === 0) {
      throw "Failed to download media";
    }

    let extension = '';
    if (mimeType.includes('image/jpeg')) extension = '.jpg';
    else if (mimeType.includes('image/png')) extension = '.png';
    else if (mimeType.includes('image/webp')) extension = '.webp';
    else if (mimeType.includes('video/mp4')) extension = '.mp4';
    else if (mimeType.includes('audio/mpeg')) extension = '.mp3';
    else if (mimeType.includes('audio/ogg')) extension = '.ogg';
    else if (mimeType.includes('audio/mp4')) extension = '.m4a';
    else if (mimeType.includes('audio/x-m4a')) extension = '.m4a';
    else if (mimeType.includes('audio/wav')) extension = '.wav';
    
    const tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}${extension}`);
    fs.writeFileSync(tempFilePath, mediaBuffer);

    const quaxForm = new FormData();
    quaxForm.append('files[]', fs.createReadStream(tempFilePath), `file${extension}`);

    const quaxResponse = await axios.post('https://qu.ax/upload.php', quaxForm, {
      headers: {
        Origin: 'https://qu.ax',
        Referer: 'https://qu.ax/',
        ...quaxForm.getHeaders(),
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 60000
    });

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    if (!quaxResponse.data || !quaxResponse.data.files || !quaxResponse.data.files[0] || !quaxResponse.data.files[0].url) {
      throw "Failed to upload to Qu.ax";
    }

    let mediaUrl = quaxResponse.data.files[0].url.trim();

    if (!mediaUrl || mediaUrl.toLowerCase().includes('error')) {
      throw "Qu.ax upload failed";
    }

    let mediaType = 'File';
    if (mimeType.includes('image')) mediaType = 'Image';
    else if (mimeType.includes('video')) mediaType = 'Video';
    else if (mimeType.includes('audio')) mediaType = 'Audio';

    const caption =
      `*${mediaType} Uploaded Successfully*\n\n` +
      `*Size:* ${formatBytes(mediaBuffer.length)}\n` +
      `*URL:* ${mediaUrl}\n\n` +
      `> *© ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`;

    await sendButtons(client, message.chat, {
      title: '',
      text: caption,
      buttons: [
        {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: '📋 Copy Url',
            copy_code: mediaUrl
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🌐 Open Link',
            url: mediaUrl
          })
        }
      ]
    });

  } catch (error) {
    console.error(error);
    await reply(`❌ Error: ${error.message || error}`);
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
