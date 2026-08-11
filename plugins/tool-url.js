const axios = require("axios");
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require("path");
const { cmd } = require("../command");
const { sendButtons } = require('gifted-btns');

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '8db492efc937a635b90680a9a860dc85';
const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

cmd({
  'pattern': "imgbb",
  'alias': ["imgbburl", "bburl"],
  'react': '🖼️',
  'desc': "Convert image/URL to ImgBB URL",
  'category': "utility",
  'use': ".imgbb [reply to image] or .imgbb <image url>",
  'filename': __filename
}, async (client, message, match, { reply }) => {
  try {

    const query = Array.isArray(match) ? match.join(' ').trim() : String(match || '').trim();

    const quotedMsg = message.quoted ? message.quoted : message;
    const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';
    const urlMatch = query.match(/(https?:\/\/[^\s]+)/i);

    let imageBuffer = null;
    let imageUrl = null;

    if (mimeType && (mimeType.includes('image') || mimeType.includes('sticker'))) {
      imageBuffer = await quotedMsg.download();
      if (!imageBuffer || imageBuffer.length === 0) {
        throw "Failed to download media";
      }
    } else if (urlMatch) {
      imageUrl = urlMatch[0];
    } else {
      return reply("🍁 Please reply to an image/sticker or provide an image URL\n\n*Use:* .imgbb [reply] or .imgbb <url>");
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
      `*URL:* ${resultUrl}\n` +
      `*Size:* ${formatBytes(result.size || 0)}\n` +
      `*Dimensions:* ${result.width || '?'}x${result.height || '?'}\n\n` +
      `> *© ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`;

    await sendButtons(client, message.chat, {
      title: '',
      text: caption,
      footer: `> *ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`,
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

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
