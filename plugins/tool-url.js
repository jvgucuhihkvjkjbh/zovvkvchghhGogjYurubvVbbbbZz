const axios = require("axios");
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require("path");
const { cmd } = require("../command");
const { sendButtons } = require('gifted-btns');

const IMGBB_API_KEY = "YOUR_IMGBB_API_KEY"; // <- apni ImgBB API key yahan dalein

cmd({
  'pattern': "tourl",
  'alias': ["imgtourl", "imgurl", "url", "geturl", "upload"],
  'react': '🖇',
  'desc': "Convert media to Catbox URL",
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

    const uguuForm = new FormData();
    uguuForm.append('files[]', fs.createReadStream(tempFilePath), `file${extension}`);

    const uguuResponse = await axios.post('https://uguu.se/upload.php', uguuForm, {
      headers: {
        ...uguuForm.getHeaders(),
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 60000
    });

    if (!uguuResponse.data || !uguuResponse.data.files || !uguuResponse.data.files[0] || !uguuResponse.data.files[0].url) {
      throw "Failed to upload to Uguu";
    }

    const uguuUrl = uguuResponse.data.files[0].url;

    const catboxForm = new FormData();
    catboxForm.append('reqtype', 'urlupload');
    catboxForm.append('url', uguuUrl);

    const catboxResponse = await axios.post('https://catbox.moe/user/api.php', catboxForm, {
      headers: {
        ...catboxForm.getHeaders(),
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 60000
    });

    fs.unlinkSync(tempFilePath);

    let mediaUrl = catboxResponse.data.trim();

    if (!mediaUrl || mediaUrl.toLowerCase().includes('error')) {
      throw "Catbox upload failed";
    }

    if (mediaUrl.endsWith('.bin') && extension) {
      mediaUrl = mediaUrl.substring(0, mediaUrl.lastIndexOf('.')) + extension;
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

// URL-3 (ImgBB)
cmd({
  'pattern': "tourl3",
  'alias': ["imgtourl3", "imgurl3", "url3", "geturl3", "upload3", "imgbb"],
  'react': '🖇',
  'desc': "Convert image to ImgBB URL",
  'category': "utility",
  'use': ".tourl3 [reply to image]",
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

    const tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}${extension}`);
    fs.writeFileSync(tempFilePath, mediaBuffer);

    const imgbbForm = new FormData();
    imgbbForm.append('image', fs.createReadStream(tempFilePath));

    const imgbbResponse = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, imgbbForm, {
      headers: {
        ...imgbbForm.getHeaders(),
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 60000
    });

    fs.unlinkSync(tempFilePath);

    if (!imgbbResponse.data || !imgbbResponse.data.data || !imgbbResponse.data.data.url) {
      throw "Failed to upload to ImgBB";
    }

    const mediaUrl = imgbbResponse.data.data.url;
    const fileSizeMB = mediaBuffer.length / (1024 * 1024);
    const fileTypeName = extension ? extension.replace('.', '').toUpperCase() : 'UNKNOWN';

    const caption = `Here is Your *IMGBB* Upload Result:\n\n*File Type:* ${fileTypeName}\n*File Size:* ${fileSizeMB.toFixed(2)} MBs\n*File Url:* ${mediaUrl}\n*File Expiration:* No Expiry\n`;

    await sendButtons(client, message.chat, {
      title: '',
      text: caption,
      footer: `> *© ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`,
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
