const { generateWAMessageContent, generateMessageID, downloadMediaMessage } = require('@whiskeysockets/baileys');
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
  } catch (e) {
    console.error('[STATUS PATCH ERROR]', e.message);
  }
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
  const key = val.toLowerCase();
  if (COLORS[key]) return COLORS[key];
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
  let leftover = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i].replace(/^"|"$/g, '');
    const lower = tok.toLowerCase();

    if ((lower === '-color' || lower === 'color') && tokens[i + 1]) {
      const color = resolveColor(tokens[++i].replace(/^"|"$/g, ''));
      if (color) result.textColor = color;
      continue;
    }

    if ((lower === '-bg' || lower === 'bg') && tokens[i + 1]) {
      const color = resolveColor(tokens[++i].replace(/^"|"$/g, ''));
      if (color) result.bgColor = color;
      continue;
    }

    leftover.push(tok);
  }

  result.remaining = leftover.join(' ').trim();
  return result;
}

async function sendGroupStatus(sock, jid, content) {
  const opts = { upload: sock.waUploadToServer };
  const waMsgContent = await generateWAMessageContent(content, opts);
  if (!waMsgContent) throw new Error('Failed to generate content');

  const innerMsg = waMsgContent.message || waMsgContent;

  // Text colors only
  if (innerMsg.extendedTextMessage) {
    if (content.textColor) {
      let hex = String(content.textColor).replace('#', '');
      if (hex.length === 6) hex = 'FF' + hex;
      innerMsg.extendedTextMessage.textArgb = parseInt(hex, 16);
    } else {
      innerMsg.extendedTextMessage.textArgb = 0xFFFFFFFF;
    }

    if (content.backgroundColor) {
      let hex = String(content.backgroundColor).replace('#', '');
      if (hex.length === 6) hex = 'FF' + hex;
      innerMsg.extendedTextMessage.backgroundArgb = parseInt(hex, 16);
    } else {
      innerMsg.extendedTextMessage.backgroundArgb = getRandomBg();
    }
    innerMsg.extendedTextMessage.font = 1;
  }

  const msgKey = Object.keys(innerMsg).find(k =>
    innerMsg[k] && typeof innerMsg[k] === 'object' && k !== 'messageContextInfo'
  );

  if (!msgKey) throw new Error('No valid message type found');

  innerMsg[msgKey] = { ...innerMsg[msgKey] };
  innerMsg[msgKey].contextInfo = {
    ...(innerMsg[msgKey].contextInfo || {}),
    isGroupStatus: true,
    featureEligibilities: { canReceiveMultiReact: true },
    statusAttributions: [{ type: 10 }],
    pairedMediaType: 0,
    statusSourceType: innerMsg.imageMessage ? 0 : innerMsg.videoMessage ? 1 : innerMsg.audioMessage ? 3 : 4,
    statusAudienceMetadata: {
      audienceType: 2,
      customName: "ADEEL-MD",
      customEmoji: "🕷️"
    }
  };

  const finalMsg = {
    senderKeyDistributionMessage: {
      groupId: jid,
      axolotlSenderKeyDistributionMessage: Buffer.from(
        "Mwjhu6XDBBApGiCz3ID71WBT/zyUkiLBlCAdfeVSU1hAs5tqPa+RimyiFCIhBfV5TqdCa4w9ekdTm1BAiUSQa+26MVVXXv7i45SBR3sj",
        "base64"
      )
    },
    groupStatusMessageV2: { message: innerMsg }
  };

  await sock.relayMessage(jid, finalMsg, {
    messageId: generateMessageID(),
    additionalNodes: [{ tag: "meta", attrs: { is_group_status: "true" } }]
  });
}

cmd({
  pattern: "groupstatus",
  alias: ["group-status", "gcstatus", "gc-status", "gcs"],
  desc: "Send group status (reply to media/text)",
  category: "group",
  react: "📢",
  filename: __filename
}, async (conn, mek, m, { from, quoted, q, reply }) => {
  try {
    if (!from.endsWith('@g.us')) {
      return reply("⚠️ This command only works in groups!");
    }

    const flags = parseFlags(q || '');
    const realQuoted = quoted && Object.keys(quoted).length ? getRealMessage(quoted) : null;

    if (!realQuoted && !flags.remaining) {
      return reply(`*📝 HOW TO USE:*

1. Reply to photo/video/audio/text:
\`.gcs\`

2. Text:
\`.gcs Hello\`

3. Colors:
\`.gcs hello -color red\`
\`.gcs color white bg black Hello\``);
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
        realQuoted[mtype]?.caption ||
        '';
    } else {
      captionText = flags.remaining;
    }

    const doc = {};

    // ===== TEXT =====
    if (type === 'txt') {
      doc.text = captionText || '(empty)';
      if (flags.textColor) doc.textColor = flags.textColor;
      if (flags.bgColor) doc.backgroundColor = flags.bgColor;
    }
    // ===== MEDIA =====
    else {
      await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

      // Proper quoted message for download
      const ctx = mek?.message?.extendedTextMessage?.contextInfo ||
                  mek?.message?.imageMessage?.contextInfo ||
                  mek?.message?.videoMessage?.contextInfo || {};

      const mediaMsg = {
        key: {
          remoteJid: from,
          fromMe: false,
          id: ctx.stanzaId || quoted?.id || mek?.key?.id,
          participant: ctx.participant || mek?.key?.participant || undefined
        },
        message: realQuoted
      };

      let buffer;
      try {
        buffer = await downloadMediaMessage(
          mediaMsg,
          'buffer',
          {},
          {
            logger: console,
            reuploadRequest: conn.updateMediaMessage
          }
        );
      } catch (dlErr) {
        // Fallback: try with m directly if quoted object shape differs
        buffer = await downloadMediaMessage(
          {
            key: mek.key,
            message: { [mtype]: realQuoted[mtype] }
          },
          'buffer',
          {},
          { reuploadRequest: conn.updateMediaMessage }
        );
      }

      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 100) {
        throw new Error('Media download failed or file too small');
      }

      if (type === 'img') {
        doc.image = buffer;
        if (captionText) doc.caption = captionText;
      } else if (type === 'vid') {
        doc.video = buffer;
        if (captionText) doc.caption = captionText;
      } else if (type === 'vn') {
        doc.audio = buffer;
        doc.mimetype = 'audio/mp4';
        doc.ptt = true;
      }
    }

    await sendGroupStatus(conn, from, doc);
    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

  } catch (err) {
    console.error('[GROUP STATUS ERROR]', err);
    try {
      await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    } catch {}
    reply(`❌ Failed: ${err.message}`);
  }
});
