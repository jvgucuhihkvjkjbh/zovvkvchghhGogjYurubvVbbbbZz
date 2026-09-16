const {
  generateWAMessageContent,
  generateMessageID,
  downloadMediaMessage,
  prepareWAMessageMedia
} = require('@whiskeysockets/baileys');
const { cmd } = require("../command");

(function patchProtobuf() {
  try {
    const baileys = require('@whiskeysockets/baileys');
    const WAProto = baileys.proto || baileys.WAProto;
    if (!WAProto?.ContextInfo?.StatusAudienceMetadata) return;
    const SAM = WAProto.ContextInfo.StatusAudienceMetadata;
    if (SAM._isFullyPatched) return;

    const origFromObject = SAM.fromObject;
    SAM.fromObject = function (d) {
      if (d instanceof SAM) return d;
      const m = typeof origFromObject === 'function' ? origFromObject(d) : new SAM();
      if (d.audienceType != null) m.audienceType = typeof d.audienceType === 'number' ? d.audienceType : 2;
      if (d.customName != null) m.customName = String(d.customName);
      if (d.customEmoji != null) m.customEmoji = String(d.customEmoji);
      if (d.groupJid != null) m.groupJid = String(d.groupJid);
      return m;
    };
    SAM.encode = function (m, w) {
      if (!w) {
        const protobuf = require('protobufjs/minimal');
        w = protobuf.Writer.create();
      }
      if (m.audienceType != null) w.uint32(8).int32(m.audienceType);
      if (m.customName != null) w.uint32(18).string(m.customName);
      if (m.customEmoji != null) w.uint32(26).string(m.customEmoji);
      if (m.groupJid != null) w.uint32(34).string(m.groupJid);
      return w;
    };
    SAM._isFullyPatched = true;
  } catch (e) {}
})();

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

function getRealMessage(message) {
  if (!message) return null;
  if (message.ephemeralMessage) return getRealMessage(message.ephemeralMessage.message);
  if (message.viewOnceMessage) return getRealMessage(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2) return getRealMessage(message.viewOnceMessageV2.message);
  if (message.viewOnceMessageV2Extension) return getRealMessage(message.viewOnceMessageV2Extension.message);
  if (message.documentWithCaptionMessage) return getRealMessage(message.documentWithCaptionMessage.message);
  return message;
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

async function downloadQuotedMedia(conn, mek, m, realQuoted, mtype) {
  // 1) m.quoted.download
  try {
    if (m?.quoted?.download) {
      const buf = await m.quoted.download();
      if (buf?.length > 100) return Buffer.from(buf);
    }
  } catch (e) {
    console.log('dl1:', e.message);
  }

  const ctx = mek?.message?.extendedTextMessage?.contextInfo || {};

  // 2) full quoted message
  try {
    const buf = await downloadMediaMessage(
      {
        key: {
          remoteJid: fromSafe(mek),
          id: ctx.stanzaId,
          participant: ctx.participant,
          fromMe: false
        },
        message: realQuoted
      },
      'buffer',
      {},
      { reuploadRequest: conn.updateMediaMessage }
    );
    if (buf?.length > 100) return Buffer.from(buf);
  } catch (e) {
    console.log('dl2:', e.message);
  }

  // 3) only media type node
  try {
    const buf = await downloadMediaMessage(
      {
        key: {
          remoteJid: fromSafe(mek),
          id: ctx.stanzaId,
          participant: ctx.participant,
          fromMe: false
        },
        message: { [mtype]: realQuoted[mtype] }
      },
      'buffer',
      {},
      { reuploadRequest: conn.updateMediaMessage }
    );
    if (buf?.length > 100) return Buffer.from(buf);
  } catch (e) {
    console.log('dl3:', e.message);
  }

  throw new Error('Media download failed');
}

function fromSafe(mek) {
  return mek?.key?.remoteJid || mek?.key?.participant || '';
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
    groupStatusMessageV2: {
      message: messageNode
    }
  };

  await sock.relayMessage(jid, finalMsg, {
    messageId: generateMessageID(),
    additionalNodes: [{ tag: "meta", attrs: { is_group_status: "true" } }]
  });
}

async function sendTextStatus(sock, jid, text, textColor, bgColor) {
  const content = { text: text || ' ' };
  const generated = await generateWAMessageContent(content, {
    upload: sock.waUploadToServer
  });

  const msg = generated.message || generated;
  if (!msg.extendedTextMessage) throw new Error('Text content failed');

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

async function sendMediaStatus(sock, jid, type, buffer, caption) {
  try {
    if (typeof sock.refreshMediaConn === 'function') {
      await sock.refreshMediaConn(true);
    }
  } catch {}

  let mediaInput = {};
  if (type === 'img') {
    mediaInput = { image: buffer, caption: caption || undefined };
  } else if (type === 'vid') {
    mediaInput = { video: buffer, caption: caption || undefined };
  } else if (type === 'vn') {
    mediaInput = { audio: buffer, mimetype: 'audio/mp4', ptt: true };
  } else {
    throw new Error('Unknown media type');
  }

  // Prefer prepareWAMessageMedia for reliable upload
  let uploaded;
  try {
    uploaded = await prepareWAMessageMedia(mediaInput, {
      upload: sock.waUploadToServer
    });
  } catch (e) {
    console.log('prepareWAMessageMedia failed, fallback generateWAMessageContent', e.message);
    uploaded = await generateWAMessageContent(mediaInput, {
      upload: sock.waUploadToServer
    });
    uploaded = uploaded.message || uploaded;
  }

  // Normalize structure
  let node = uploaded.message ? uploaded.message : uploaded;

  if (type === 'img') {
    if (!node.imageMessage) throw new Error('Image upload failed');
    node.imageMessage.contextInfo = {
      ...(node.imageMessage.contextInfo || {}),
      ...statusContext(0)
    };
    if (caption) node.imageMessage.caption = caption;
  } else if (type === 'vid') {
    if (!node.videoMessage) throw new Error('Video upload failed');
    node.videoMessage.contextInfo = {
      ...(node.videoMessage.contextInfo || {}),
      ...statusContext(1)
    };
    if (caption) node.videoMessage.caption = caption;
  } else if (type === 'vn') {
    if (!node.audioMessage) throw new Error('Audio upload failed');
    node.audioMessage.contextInfo = {
      ...(node.audioMessage.contextInfo || {}),
      ...statusContext(3)
    };
    node.audioMessage.ptt = true;
  }

  await relayGroupStatus(sock, jid, node);
}

cmd({
  pattern: "groupstatus",
  alias: ["group-status", "gcstatus", "gc-status", "gcs"],
  desc: "Send group status",
  category: "group",
  react: "📢",
  filename: __filename
}, async (conn, mek, m, { from, quoted, q, reply }) => {
  try {
    if (!from.endsWith('@g.us')) {
      return reply("⚠️ Group only!");
    }

    const flags = parseFlags(q || '');
    const realQuoted = quoted && Object.keys(quoted).length ? getRealMessage(quoted) : null;

    if (!realQuoted && !flags.remaining) {
      return reply(`*HOW TO USE:*
Reply photo/video/audio: \`.gcs\`
Text: \`.gcs Hello\`
Color: \`.gcs hello -color white -bg red\``);
    }

    const TYPE_MAP = {
      imageMessage: 'img',
      videoMessage: 'vid',
      audioMessage: 'vn',
      extendedTextMessage: 'txt',
      conversation: 'txt'
    };

    const mtype = realQuoted ? Object.keys(realQuoted).find(k => TYPE_MAP[k]) : null;
    const type = realQuoted ? (TYPE_MAP[mtype] || 'txt') : 'txt';

    let captionText = '';
    if (realQuoted) {
      captionText =
        realQuoted.conversation ||
        realQuoted.extendedTextMessage?.text ||
        (mtype && realQuoted[mtype]?.caption) ||
        '';
    } else {
      captionText = flags.remaining;
    }

    if (type === 'txt') {
      await sendTextStatus(conn, from, captionText || ' ', flags.textColor, flags.bgColor);
    } else {
      await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
      const buffer = await downloadQuotedMedia(conn, mek, m, realQuoted, mtype);
      await sendMediaStatus(conn, from, type, buffer, captionText);
    }

    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

  } catch (err) {
    console.error('[GCS ERROR]', err);
    try {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    } catch {}
    reply(`❌ ${err.message}`);
  }
});
