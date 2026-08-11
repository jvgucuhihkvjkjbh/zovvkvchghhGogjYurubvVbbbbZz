const axios = require("axios");
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require("path");
const { cmd } = require("../command");
const { sendButtons } = require('gifted-btns');

cmd({
  'pattern': "imgbb",
  'alias': ["tobb", "bbimg"],
  'react': '🖇',
  'desc': "Convert image to ImgBB URL",
  'category': "utility",
  'use': ".imgbb [reply to image]",
  'filename': __filename
}, async (client, message, match, { reply }) => {
  try {

    const quotedMsg = message.quoted ? message.quoted : message;
    const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';

    if (!mimeType) {
      return reply("🍁 Please reply to an image message");
    }

    if (!mimeType.includes('image/')) {
      return reply("❌ ImgBB only supports image files (jpg, png, webp, sticker).");
    }

    const mediaBuffer = await quotedMsg.download();

    if (!mediaBuffer || mediaBuffer.length === 0) {
      throw "Failed to download media";
    }

    let extension = '';
    if (mimeType.includes('image/jpeg')) extension = '.jpg';
    else if (mimeType.includes('image/png')) extension = '.png';
    else if (mimeType.includes('image/webp')) extension = '.webp';

    const fileName = `image${extension}`;

    const uploadResult = await uploadToImgBB(mediaBuffer, fileName);

    if (!uploadResult || !uploadResult.url) {
      throw "Failed to upload to ImgBB";
    }

    const fileSizeMB = mediaBuffer.length / (1024 * 1024);
    const fileTypeName = extension ? extension.replace('.', '').toUpperCase() : 'UNKNOWN';

    const caption = `Here is Your *IMGBB* Upload Result:\n\n*File Type:* ${fileTypeName}\n*File Size:* ${fileSizeMB.toFixed(2)} MBs\n*File Url:* ${uploadResult.url}\n*File Expiration:* No Expiry\n`;

    await sendButtons(client, message.chat, {
      title: '',
      text: caption,
      footer: `> *© ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`,
      buttons: [
        {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: '📋 Copy Url',
            copy_code: uploadResult.url
          })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '🌐 Open Link',
            url: uploadResult.url
          })
        }
      ]
    });

  } catch (error) {
    console.error("Upload Error:", error);
    await reply(`❌ Failed to upload to ImgBB. Error: ${error.message || error}`);
  }
});

// URL-2
cmd({
  'pattern': "tourl2",
  'alias': ["imgtourl2", "imgurl2", "url2", "geturl2", "upload2"],
  'react': '🖇',
  'desc': "Convert media to Catbox URL",
  'category': "utility",
  'use': ".tourl2 [reply to media]",
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

    fs.unlinkSync(tempFilePath);

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

    await reply(
      `*${mediaType} Uploaded Successfully*\n\n` +
      `*Size:* ${formatBytes(mediaBuffer.length)}\n` +
      `*URL:* ${mediaUrl}\n\n` +
      `> *© ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`
    );

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
