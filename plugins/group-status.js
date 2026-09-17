const { cmd } = require('../command');
const { generateWAMessageContent, generateMessageID } = require('@whiskeysockets/baileys');

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

function statusContext(sourceType) {
  return {
    isGroupStatus: true,
    featureEligibilities: { canReceiveMultiReact: true },
    statusAttributions: [{ type: 10 }],
    pairedMediaType: 0,
    statusSourceType: sourceType,
    statusAudienceMetadata: {
      audienceType: 2,
      customName: "ADEEL-MD",
      customEmoji: "🕷️"
    }
  };
}

async function relayGroupStatus(sock, jid, messageNode) {
  const finalMsg = {
    senderKeyDistributionMessage: {
      groupId: jid,
      axolotlSenderKeyDistributionMessage: Buffer.from(
        "Mwjhu6XDBBApGiCz3ID71WBT/zyUkiLBlCAdfeVSU1hAs5tqPa+RimyiFCIhBfV5TqdCa4w9ekdTm1BAiUSQa+26MVVXXv7i45SBR3sj",
        "base64"
      )
    },
    groupStatusMessageV2: { message: messageNode }
  };

  await sock.relayMessage(jid, finalMsg, {
    messageId: generateMessageID(),
    additionalNodes: [{ tag: "meta", attrs: { is_group_status: "true" } }]
  });
}

async function sendTextStatus(sock, jid, text, textColor, bgColor) {
  const generated = await generateWAMessageContent({ text: text || ' ' }, {
    upload: sock.waUploadToServer
  });
  const msg = generated.message || generated;
  if (!msg.extendedTextMessage) throw new Error('Text failed');

  let tHex = textColor ? String(textColor).replace('#', '') : 'FFFFFF';
  if (tHex.length === 6) tHex = 'FF' + tHex;
  msg.extendedTextMessage.textArgb = parseInt(tHex, 16);

  if (bgColor) {
    let bHex = String(bgColor).replace('#', '');
    if (bHex.length === 6) bHex = 'FF' + bHex;
    msg.extendedTextMessage.backgroundArgb = parseInt(bHex, 16);
  } else {
    msg.extendedTextMessage.backgroundArgb = getRandomBg();
  }
  msg.extendedTextMessage.font = 1;
  msg.extendedTextMessage.contextInfo = statusContext(4);

  await relayGroupStatus(sock, jid, msg);
}

async function sendMediaStatus(sock, jid, type, buffer, caption, mimetype) {
  try {
    if (typeof sock.refreshMediaConn === 'function') {
      await sock.refreshMediaConn(true);
    }
  } catch {}

  let input = {};
  if (type === 'image') {
    input = { image: buffer, caption: caption || undefined, mimetype: mimetype || 'image/jpeg' };
  } else if (type === 'video') {
    input = { video: buffer, caption: caption || undefined, mimetype: mimetype || 'video/mp4' };
  } else if (type === 'audio') {
    input = { audio: buffer, mimetype: mimetype || 'audio/mp4', ptt: true };
  } else {
    throw new Error('Unknown media type');
  }

  const generated = await generateWAMessageContent(input, {
    upload: sock.waUploadToServer
  });
  const node = generated.message || generated;

  if (type === 'image') {
    if (!node.imageMessage) throw new Error('Image upload failed');
    node.imageMessage.contextInfo = { ...(node.imageMessage.contextInfo || {}), ...statusContext(0) };
    if (caption) node.imageMessage.caption = caption;
  } else if (type === 'video') {
    if (!node.videoMessage) throw new Error('Video upload failed');
    node.videoMessage.contextInfo = { ...(node.videoMessage.contextInfo || {}), ...statusContext(1) };
    if (caption) node.videoMessage.caption = caption;
  } else if (type === 'audio') {
    if (!node.audioMessage) throw new Error('Audio upload failed');
    node.audioMessage.contextInfo = { ...(node.audioMessage.contextInfo || {}), ...statusContext(3) };
    node.audioMessage.ptt = true;
  }

  await relayGroupStatus(sock, jid, node);
}

cmd({
  pattern: "gstatus",
  alias: ["statusgc", "groupstatus", "gcs", "gcstatus", "gc-status", "group-status"],
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
        `Caption me command bhi chalega`
      );
    }

    await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

    if (quotedMsg) {
      const mediaBuffer = await quotedMsg.download();
      if (!mediaBuffer || !mediaBuffer.length) {
        return reply("❌ Media download failed. Send again then reply.");
      }

      let msgType = null;
      if (mimeType.startsWith("image/")) msgType = "image";
      else if (mimeType.startsWith("video/")) msgType = "video";
      else if (mimeType.startsWith("audio/")) msgType = "audio";
      else {
        const qType = Object.keys(quotedMsg?.message || quotedMsg || {})[0] || "";
        if (qType === "imageMessage" || quotedMsg.mtype === "imageMessage") msgType = "image";
        else if (qType === "videoMessage" || quotedMsg.mtype === "videoMessage") msgType = "video";
        else if (qType === "audioMessage" || qType === "pttMessage" || quotedMsg.mtype === "audioMessage") msgType = "audio";
      }

      if (!msgType) {
        return reply("❌ Only image / video / audio supported.");
      }

      if (!caption) {
        caption =
          quotedMsg.caption ||
          quotedMsg.text ||
          (quotedMsg.msg && quotedMsg.msg.caption) ||
          "";
      }

      await sendMediaStatus(conn, from, msgType, mediaBuffer, caption, mimeType);
    } else {
      await sendTextStatus(conn, from, caption, flags.textColor, flags.bgColor);
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
