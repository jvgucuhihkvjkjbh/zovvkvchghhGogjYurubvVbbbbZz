const { cmd } = require('../command');
const { generateWAMessageContent, generateMessageID } = require('@whiskeysockets/baileys');

// ─────────────────────────────────────────────────────────────────────────────
// 🔐 PROTOBUF PATCH: Preserve StatusAudienceMetadata (needed for real status)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Real group status sender (invisible in chat — posts to status tray only)
// ─────────────────────────────────────────────────────────────────────────────
async function sendGroupStatus(sock, jid, content) {
  try {
    if (typeof sock.refreshMediaConn === 'function') {
      await sock.refreshMediaConn(true);
    }
  } catch {}

  const waMsgContent = await generateWAMessageContent(content, {
    upload: sock.waUploadToServer
  });

  if (!waMsgContent) throw new Error('generateWAMessageContent failed');

  const innerMsg = waMsgContent.message || waMsgContent;

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

  const result = await sock.relayMessage(jid, finalMsg, {
    messageId: generateMessageID(),
    additionalNodes: [
      { tag: "meta", attrs: { is_group_status: "true" } }
    ]
  });

  return result;
}

cmd({
    pattern: "gstatus",
    alias: ["statusgc", "broadcastgc", "gsall"],
    desc: "Post a status (text or media) to THIS group only",
    category: "group",
    react: "📡",
    filename: __filename
}, async (conn, mek, m, { from, text, reply, isCreator }) => {

    if (!isCreator) {
        return reply("❌ This command is only for the *bot owner*!");
    }

    try {
        if (!from.endsWith('@g.us')) {
            return reply("⚠️ This command only works inside a group!");
        }

        const flags = parseFlags(text || '');
        const caption = flags.remaining;
        const quotedMsg = m.quoted;
        const mimeType = quotedMsg
            ? (quotedMsg.msg || quotedMsg).mimetype || ""
            : "";

        if (!quotedMsg && !caption) {
            return reply(
                `📡 *Group Status — Usage:*\n\n` +
                `*Text only:*\n` +
                `  \`.gstatus Hello everyone! 🎉\`\n\n` +
                `*Text with color:*\n` +
                `  \`.gstatus Hello -color red -bg black\`\n\n` +
                `*Media + caption:*\n` +
                `  Reply to an image/video with \`.gstatus Your caption here\`\n\n` +
                `*Media without caption:*\n` +
                `  Reply to any media with \`.gstatus\`\n\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `~ *ADEEL-MD*`
            );
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const getMsgType = () => {
            if (mimeType.startsWith("image/")) return "img";
            if (mimeType.startsWith("video/")) return "vid";
            if (mimeType.startsWith("audio/")) return "vn";
            const msgType = Object.keys(quotedMsg?.message || {})[0] || "";
            if (msgType === "imageMessage") return "img";
            if (msgType === "videoMessage") return "vid";
            if (msgType === "audioMessage" || msgType === "pttMessage") return "vn";
            return null;
        };

        const isPTT =
            quotedMsg?.message?.audioMessage?.ptt ||
            Object.keys(quotedMsg?.message || {})[0] === "pttMessage" ||
            false;

        const content = {};
        let isMedia = false;

        if (quotedMsg) {
            isMedia = true;
            const buffer = await quotedMsg.download();
            if (!buffer) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Failed to download the media. Please try again.");
            }

            const msgType = getMsgType();
            const mentionedJid = [];
            try {
                const meta = await conn.groupMetadata(from);
                if (meta?.participants) mentionedJid.push(...meta.participants.map(p => p.id));
            } catch {}

            const contextInfo = { isGroupStatus: true, mentionedJid };

            if (msgType === "img") {
                content.image = buffer;
                if (caption) content.caption = caption;
                content.mimetype = mimeType || 'image/jpeg';
                content.contextInfo = contextInfo;
            } else if (msgType === "vid") {
                content.video = buffer;
                if (caption) content.caption = caption;
                content.mimetype = mimeType || 'video/mp4';
                content.contextInfo = contextInfo;
            } else if (msgType === "vn") {
                content.audio = buffer;
                content.mimetype = isPTT ? 'audio/ogg; codecs=opus' : (mimeType || 'audio/mp4');
                content.ptt = isPTT;
                content.contextInfo = contextInfo;
            } else {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Unsupported media type.");
            }
        } else {
            content.text = caption || ' ';
            if (flags.textColor) content.textColor = flags.textColor;
            if (flags.bgColor) content.backgroundColor = flags.bgColor;
        }

        // Media: use the proven working plain sendMessage path (real relay path
        // never posts media reliably on this account). Text: real invisible status.
        if (isMedia) {
            await conn.sendMessage(from, content);
        } else {
            await sendGroupStatus(conn, from, content);
        }

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        reply(`✅ *Status posted to this group!*\n\n━━━━━━━━━━━━━━━━━━\n~ *ADEEL-MD*`);

    } catch (error) {
        console.error("GroupStatus Error:", error);
        try { await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }); } catch {}
        reply(`❌ *Error:* ${error.message}`);
    }
});
