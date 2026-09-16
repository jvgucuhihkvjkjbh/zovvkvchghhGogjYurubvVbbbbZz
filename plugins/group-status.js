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
    console.error('[STATUS PATCH]', e.message);
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

/*
 * Frameworks expose quoted messages in different shapes. Some expose the
 * inner message directly, while others expose { message, key, ... } or
 * { msg, ... }. Normalize those shapes before looking for imageMessage,
 * videoMessage, audioMessage, etc. This prevents silent media -> text fallback.
 */
function getQuotedContent(quoted) {
  if (!quoted || typeof quoted !== 'object') return null;

  let value = quoted;
  for (let i = 0; i < 6 && value && typeof value === 'object'; i++) {
    const directType = ['imageMessage', 'videoMessage', 'audioMessage', 'extendedTextMessage', 'conversation']
      .some((key) => Object.prototype.hasOwnProperty.call(value, key));
    if (directType) return getRealMessage(value);

    if (value.message && typeof value.message === 'object') {
      value = value.message;
      continue;
    }
    if (value.msg && typeof value.msg === 'object') {
      value = value.msg;
      continue;
    }
    break;
  }

  return getRealMessage(value);
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

function getMessageKey(message) {
  return Object.keys(message || {}).find((key) =>
    ['imageMessage', 'videoMessage', 'audioMessage'].includes(key)
  );
}

function describeMedia(message) {
  const key = getMessageKey(message);
  if (!key) return { key: null, fields: Object.keys(message || {}) };
  const media = message[key] || {};
  return {
    key,
    fields: Object.keys(media),
    hasUrl: Boolean(media.url || media.directPath),
    hasMediaKey: Boolean(media.mediaKey),
    hasFileEncSha256: Boolean(media.fileEncSha256),
    hasFileSha256: Boolean(media.fileSha256),
    mimetype: media.mimetype,
    seconds: media.seconds,
    hasJpegThumbnail: Boolean(media.jpegThumbnail)
  };
}

async function downloadQuotedMedia(conn, mek, m, realQuoted, mtype) {
  if (!realQuoted || !mtype) throw new Error(`No supported quoted media found (keys: ${Object.keys(realQuoted || {}).join(',')})`);

  // Method 1: m.quoted.download (common in many bots)
  try {
    if (m?.quoted?.download) {
      const buf = await m.quoted.download();
      if (Buffer.isBuffer(buf) && buf.length > 100) return buf;
      console.warn('[GCS] quoted.download returned an invalid buffer');
    }
  } catch (e) {
    console.warn('[GCS] download method 1 failed:', e.message);
  }

  const ctx = mek?.message?.extendedTextMessage?.contextInfo || {};
  const key = {
    remoteJid: mek?.key?.remoteJid,
    fromMe: false,
    id: ctx.stanzaId,
    participant: ctx.participant
  };
  if (!key.remoteJid || !key.id) {
    throw new Error(`Quoted media key is incomplete (remoteJid=${key.remoteJid}, stanzaId=${key.id})`);
  }

  // Method 2: complete quoted message.
  try {
    const buf = await downloadMediaMessage(
      { key, message: realQuoted },
      'buffer',
      {},
      { reuploadRequest: conn.updateMediaMessage }
    );
    if (Buffer.isBuffer(buf) && buf.length > 100) return buf;
    console.warn('[GCS] download method 2 returned an invalid buffer');
  } catch (e) {
    console.warn('[GCS] download method 2 failed:', e.message);
  }

  // Method 3: only the media node.
  try {
    const buf = await downloadMediaMessage(
      { key, message: { [mtype]: realQuoted[mtype] } },
      'buffer',
      {},
      { reuploadRequest: conn.updateMediaMessage }
    );
    if (Buffer.isBuffer(buf) && buf.length > 100) return buf;
    console.warn('[GCS] download method 3 returned an invalid buffer');
  } catch (e) {
    console.warn('[GCS] download method 3 failed:', e.message);
  }

  throw new Error('Could not download quoted media: all download methods failed');
}

async function sendGroupStatus(sock, jid, content) {
  try {
    if (typeof sock.refreshMediaConn === 'function') await sock.refreshMediaConn(true);
  } catch (e) {
    console.warn('[GCS] refreshMediaConn failed:', e.message);
  }

  const waMsgContent = await generateWAMessageContent(content, {
    upload: sock.waUploadToServer
  });
  if (!waMsgContent) throw new Error('generateWAMessageContent returned no content');

  const innerMsg = waMsgContent.message || waMsgContent;
  console.log('[GCS] generated content:', JSON.stringify(describeMedia(innerMsg)));

  const generatedMediaKey = getMessageKey(innerMsg);
  if (content.image || content.video || content.audio) {
    if (!generatedMediaKey) {
      throw new Error(`Media upload produced no media message; generated keys: ${Object.keys(innerMsg).join(',')}`);
    }
    const mediaInfo = describeMedia(innerMsg);
    const required = ['hasUrl', 'hasMediaKey', 'hasFileEncSha256', 'hasFileSha256', 'mimetype'];
    const missing = required.filter((field) => !mediaInfo[field]);
    if (missing.length) {
      throw new Error(`Uploaded ${generatedMediaKey} is incomplete; missing: ${missing.join(', ')}`);
    }
    if (generatedMediaKey === 'videoMessage' && !innerMsg.videoMessage.seconds) {
      console.warn('[GCS] videoMessage has no seconds/duration field');
    }
    if (generatedMediaKey === 'audioMessage' && !innerMsg.audioMessage.seconds) {
      console.warn('[GCS] audioMessage has no seconds/duration field');
    }
  }

  // Text status styling — intentionally unchanged.
  if (innerMsg.extendedTextMessage) {
    let textHex = content.textColor ? String(content.textColor).replace('#', '') : 'FFFFFF';
    if (textHex.length === 6) textHex = 'FF' + textHex;
    innerMsg.extendedTextMessage.textArgb = parseInt(textHex, 16);

    if (content.backgroundColor) {
      let bgHex = String(content.backgroundColor).replace('#', '');
      if (bgHex.length === 6) bgHex = 'FF' + bgHex;
      innerMsg.extendedTextMessage.backgroundArgb = parseInt(bgHex, 16);
    } else {
      innerMsg.extendedTextMessage.backgroundArgb = getRandomBg();
    }
    innerMsg.extendedTextMessage.font = 1;
  }

  const msgKey = Object.keys(innerMsg).find(k =>
    innerMsg[k] && typeof innerMsg[k] === 'object' && !['messageContextInfo', 'senderKeyDistributionMessage'].includes(k)
  );

  if (!msgKey) throw new Error('Invalid message structure: ' + Object.keys(innerMsg).join(','));

  if (!innerMsg[msgKey].contextInfo) innerMsg[msgKey].contextInfo = {};

  innerMsg[msgKey].contextInfo.isGroupStatus = true;
  innerMsg[msgKey].contextInfo.featureEligibilities = { canReceiveMultiReact: true };
  innerMsg[msgKey].contextInfo.statusAttributions = [{ type: 10 }];
  innerMsg[msgKey].contextInfo.pairedMediaType = 0;
  innerMsg[msgKey].contextInfo.statusSourceType =
    msgKey === 'imageMessage' ? 0 :
    msgKey === 'videoMessage' ? 1 :
    msgKey === 'audioMessage' ? 3 : 4;
  innerMsg[msgKey].contextInfo.statusAudienceMetadata = {
    audienceType: 2,
    customName: "ADEEL-MD",
    customEmoji: "🕷️"
  };

  const finalMsg = {
    senderKeyDistributionMessage: {
      groupId: jid,
      axolotlSenderKeyDistributionMessage: Buffer.from(
        "Mwjhu6XDBBApGiCz3ID71WBT/zyUkiLBlCAdfeVSU1hAs5tqPa+RimyiFCIhBfV5TqdCa4w9ekdTm1BAiUSQa+26MVVXXv7i45SBR3sj",
        "base64"
      )
    },
    groupStatusMessageV2: {
      message: innerMsg
    }
  };

  console.log('[GCS] relaying:', JSON.stringify({
    jid,
    msgKey,
    media: describeMedia(innerMsg),
    contextInfo: innerMsg[msgKey].contextInfo
  }));

  try {
    return await sock.relayMessage(jid, finalMsg, {
      messageId: generateMessageID(),
      additionalNodes: [
        { tag: "meta", attrs: { is_group_status: "true" } }
      ]
    });
  } catch (e) {
    console.error('[GCS] relayMessage failed:', e);
    throw new Error(`relayMessage failed: ${e.message}`);
  }
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
    if (!from.endsWith('@g.us')) return reply("⚠️ Group only command!");

    const flags = parseFlags(q || '');
    const realQuoted = quoted && Object.keys(quoted).length ? getQuotedContent(quoted) : null;
    console.log('[GCS] quoted keys:', Object.keys(quoted || {}), 'normalized keys:', Object.keys(realQuoted || {}));

    if (!realQuoted && !flags.remaining) {
      return reply(`*HOW TO USE:*
Reply to photo/video/audio/text: \.gcs\`
Text: \.gcs Hello\`
Color: \.gcs hello -color red -bg black\``);
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
    console.log('[GCS] resolved:', { mtype, type });

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

    const content = {};

    if (type === 'txt') {
      content.text = captionText || ' ';
      if (flags.textColor) content.textColor = flags.textColor;
      if (flags.bgColor) content.backgroundColor = flags.bgColor;
    } else {
      await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
      const buffer = await downloadQuotedMedia(conn, mek, m, realQuoted, mtype);
      console.log('[GCS] downloaded media:', { mtype, bytes: buffer.length, firstBytes: buffer.subarray(0, 12).toString('hex') });

      if (type === 'img') {
        content.image = buffer;
        if (captionText) content.caption = captionText;
      } else if (type === 'vid') {
        content.video = buffer;
        if (captionText) content.caption = captionText;
      } else if (type === 'vn') {
        content.audio = buffer;
        content.mimetype = realQuoted.audioMessage?.mimetype || 'audio/mp4';
        content.ptt = true;
      }
    }

    await sendGroupStatus(conn, from, content);
    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
  } catch (err) {
    console.error('[GROUP STATUS ERROR]', err);
    try { await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }); } catch {}
    reply(`❌ ${err.message}`);
  }
});
