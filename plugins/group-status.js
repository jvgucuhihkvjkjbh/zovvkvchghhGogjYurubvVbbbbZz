const { cmd } = require('../command');
const { generateMessageID } = require('@whiskeysockets/baileys');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const COLORS = {
  red: 'FF0000', blue: '1DA1F2', green: '25D366', yellow: 'FFD700',
  black: '000000', white: 'FFFFFF', purple: '7B2CBF', pink: 'FFC0CB',
  orange: 'FFA500', cyan: '00FFFF', gray: '808080', navy: '001F5B'
};

const RANDOM_BG = [
  0xFF7B2CBF, 0xFF1D3557, 0xFF2B2D42, 0xFFD90429, 0xFF0077B6,
  0xFF007F5F, 0xFF5A189A, 0xFFE76F51, 0xFF2A9D8F, 0xFF1A1A1D
];

function getRandomBg() {
  return RANDOM_BG[Math.floor(Math.random() * RANDOM_BG.length)];
}

function resolveColor(val) {
  if (!val) return null;
  val = String(val).trim().replace(/^#/, '');
  if (COLORS[val.toLowerCase()]) return COLORS[val.toLowerCase()];
  if (/^[0-9A-Fa-f]{6}$/.test(val)) return val.toUpperCase();
  return null;
}

function parseFlags(text) {
  const result = { textColor: null, bgColor: null, remaining: '' };
  if (!text) return result;

  let cleaned = text
    .replace(/[-–—]?\s*color\s*[:\-]?\s*/gi, ' -color ')
    .replace(/[-–—]?\s*bg\s*[:\-]?\s*/gi, ' -bg ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const leftover = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i].replace(/^"|"$/g, '');
    const lower = tok.toLowerCase();

    if ((lower === '-color' || lower === 'color') && tokens[i + 1]) {
      const c = resolveColor(tokens[++i].replace(/^"|"$/g, ''));
      if (c) result.textColor = c;
      continue;
    }
    if ((lower === '-bg' || lower === 'bg') && tokens[i + 1]) {
      const c = resolveColor(tokens[++i].replace(/^"|"$/g, ''));
      if (c) result.bgColor = c;
      continue;
    }
    leftover.push(tok);
  }

  result.remaining = leftover.join(' ').trim();
  return result;
}

function buildColoredTextMessage(caption, textColor, bgColor, mentionedJid) {
  let textHex = textColor ? String(textColor).replace('#', '') : 'FFFFFF';
  if (textHex.length === 6) textHex = 'FF' + textHex;

  let bgArgb;
  if (bgColor) {
    let bgHex = String(bgColor).replace('#', '');
    if (bgHex.length === 6) bgHex = 'FF' + bgHex;
    bgArgb = parseInt(bgHex, 16);
  } else {
    bgArgb = getRandomBg();
  }

  return {
    extendedTextMessage: {
      text: caption,
      textArgb: parseInt(textHex, 16),
      backgroundArgb: bgArgb,
      font: 1,
      contextInfo: {
        isGroupStatus: true,
        mentionedJid
      }
    }
  };
}

async function convertToWhatsAppPTT(buffer) {
  const inputPath = path.join(os.tmpdir(), `gstatus_in_${Date.now()}.bin`);
  const outputPath = path.join(os.tmpdir(), `gstatus_out_${Date.now()}.ogg`);

  fs.writeFileSync(inputPath, buffer);

  try {
    await execAsync(
      `"\( {ffmpegPath}" -y -i " \){inputPath}" -vn -ac 1 -ar 48000 -c:a libopus -b:a 64k "${outputPath}"`
    );
    const out = fs.readFileSync(outputPath);
    return out;
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}

cmd({
  pattern: "gstatus",
  alias: ["statusgc", "gcstatus", "groupstatus", "gcs", "gc-status", "group-status"],
  desc: "Send group status in current group only",
  category: "group",
  react: "📢",
  filename: __filename
}, async (conn, mek, m, { from, text, reply }) => {
  try {
    if (!from.endsWith('@g.us')) {
      return reply("⚠️ Group only!");
    }

    const flags = parseFlags(text || '');
    let caption = flags.remaining;

    const quotedMsg = m.quoted;
    const mimeType = quotedMsg
      ? (quotedMsg.msg || quotedMsg).mimetype || ""
      : "";

    if (!quotedMsg && !caption) {
      return reply(
        `*HOW TO USE:*\n\n` +
        `Text: \`.gstatus Hello\`\n` +
        `Color: \`.gstatus Hello -color red -bg black\`\n` +
        `Reply media: \`.gstatus\`\n` +
        `Reply + title: \`.gstatus My title\`\n` +
        `Reply voice/audio: \`.gstatus\``
      );
    }

    await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

    let mentionedJid = [];
    try {
      const meta = await conn.groupMetadata(from);
      mentionedJid = (meta.participants || []).map(p => p.id);
    } catch {}

    if (quotedMsg) {
      const mediaBuffer = await quotedMsg.download();
      if (!mediaBuffer) {
        return reply("❌ Failed to download media. Try again.");
      }

      const getMsgType = () => {
        if (mimeType.startsWith("image/")) return "image";
        if (mimeType.startsWith("video/")) return "video";
        if (mimeType.startsWith("audio/")) return "audio";
        const msgType = Object.keys(quotedMsg?.message || {})[0] || "";
        if (msgType === "imageMessage") return "image";
        if (msgType === "videoMessage") return "video";
        if (msgType === "audioMessage" || msgType === "pttMessage") return "audio";
        if (quotedMsg.mtype === "imageMessage") return "image";
        if (quotedMsg.mtype === "videoMessage") return "video";
        if (quotedMsg.mtype === "audioMessage") return "audio";
        return null;
      };

      const msgType = getMsgType();

      if (!caption) {
        caption =
          quotedMsg.caption ||
          quotedMsg.text ||
          (quotedMsg.msg && quotedMsg.msg.caption) ||
          "";
      }

      const contextInfo = {
        isGroupStatus: true,
        mentionedJid
      };

      let messageContent = {};

      if (msgType === "image") {
        messageContent = {
          image: mediaBuffer,
          caption: caption || "",
          mimetype: mimeType || "image/jpeg",
          contextInfo
        };
      } else if (msgType === "video") {
        messageContent = {
          video: mediaBuffer,
          caption: caption || "",
          mimetype: mimeType || "video/mp4",
          contextInfo
        };
      } else if (msgType === "audio") {
        let audioBuffer = mediaBuffer;
        try {
          audioBuffer = await convertToWhatsAppPTT(mediaBuffer);
        } catch (e) {
          console.log("ffmpeg convert failed:", e.message);
        }

        let seconds =
          quotedMsg?.message?.audioMessage?.seconds ||
          quotedMsg?.seconds ||
          quotedMsg?.msg?.seconds ||
          undefined;

        messageContent = {
          audio: audioBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
          seconds,
          contextInfo
        };
      } else {
        return reply("❌ Only image / video / audio supported.");
      }

      await conn.sendMessage(from, messageContent);
    } else {
      const coloredMsg = buildColoredTextMessage(caption, flags.textColor, flags.bgColor, mentionedJid);
      await conn.relayMessage(from, coloredMsg, {
        messageId: generateMessageID()
      });
    }

    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

  } catch (error) {
    console.error("GStatus Error:", error);
    try {
      await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    } catch {}
    reply(`❌ ${error.message}`);
  }
});
