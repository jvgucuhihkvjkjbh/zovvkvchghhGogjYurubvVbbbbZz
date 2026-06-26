const { isJidGroup } = require('@whiskeysockets/baileys');
const { loadMessage } = require('../data');
const config = require('../config');

const messageStore = new Map();

// ✅ JID سے صرف نمبر نکالنے کا فنکشن
const extractNumber = (jid) => {
    if (!jid) return 'Unknown';
    return jid.split('@')[0].split(':')[0];
};

const storeMessage = (message) => {
    if (!message?.key?.id) return;
    messageStore.set(message.key.id, {
        message,
        jid: message.key.remoteJid
    });
    setTimeout(() => messageStore.delete(message.key.id), 30 * 60 * 1000);
};

// ✅ Text/Status message کے لیے - sender اور deleter دونوں نمبر
const DeletedText = async (conn, mek, jid, deleteInfo, isGroup, update) => {
    const messageContent =
        mek.message?.conversation ||
        mek.message?.extendedTextMessage?.text ||
        mek.message?.imageMessage?.caption ||
        mek.message?.videoMessage?.caption ||
        'Unknown content';

    deleteInfo += `\n*╰💬 Content:* ${messageContent}`;

    const mentionList = [];

    if (isGroup) {
        const senderJid = mek.key?.participant || update.key?.participant;
        const deleterJid = update.key?.participant;
        if (senderJid) mentionList.push(senderJid);
        if (deleterJid && deleterJid !== senderJid) mentionList.push(deleterJid);
    } else {
        const senderJid = mek.key?.remoteJid || update.key?.remoteJid;
        if (senderJid) mentionList.push(senderJid);
    }

    await conn.sendMessage(jid, {
        text: deleteInfo,
        contextInfo: {
            mentionedJid: mentionList.filter(Boolean),
        },
    }, { quoted: mek });
};

// ✅ Media message کے لیے - sender اور deleter نمبر کے ساتھ
const DeletedMedia = async (conn, mek, jid, deleteInfo, isGroup, update) => {
    try {
        const antideletedmek = structuredClone(mek.message);
        const messageType = Object.keys(antideletedmek)[0];

        const mentionList = [];

        if (isGroup) {
            const senderJid = mek.key?.participant || update.key?.participant;
            const deleterJid = update.key?.participant;
            if (senderJid) mentionList.push(senderJid);
            if (deleterJid && deleterJid !== senderJid) mentionList.push(deleterJid);
        } else {
            const senderJid = mek.key?.remoteJid || update.key?.remoteJid;
            if (senderJid) mentionList.push(senderJid);
        }

        if (antideletedmek[messageType]) {
            antideletedmek[messageType].contextInfo = {
                stanzaId: mek.key.id,
                participant: mek.sender,
                quotedMessage: mek.message,
                mentionedJid: mentionList.filter(Boolean),
            };
        }

        if (messageType === 'imageMessage' || messageType === 'videoMessage') {
            antideletedmek[messageType].caption = deleteInfo;
            await conn.relayMessage(jid, antideletedmek, {});

        } else if (
            messageType === 'audioMessage' ||
            messageType === 'documentMessage' ||
            messageType === 'stickerMessage'
        ) {
            // پہلے info message بھیجو
            await conn.sendMessage(jid, {
                text: `*⚠️ Deleted Message Alert 🚨*\n${deleteInfo}`,
                contextInfo: {
                    mentionedJid: mentionList.filter(Boolean),
                }
            }, { quoted: mek });

            // پھر original media بھیجو
            await conn.relayMessage(jid, antideletedmek, {});
        } else {
            await conn.relayMessage(jid, antideletedmek, {});
        }

    } catch (e) {
        await conn.sendMessage(jid, {
            text: `*⚠️ Deleted Message Alert 🚨*\n${deleteInfo}\n\n_Media could not be recovered._`
        });
    }
};

const AntiDelete = async (conn, updates) => {
    for (const update of updates) {

        const antiDeleteStatus = config.ANTI_DELETE === "true" || config.ANTI_DELETE === true;
        if (!antiDeleteStatus) continue;

        if (update.update.message === null) {
            try {

                let storedData = messageStore.get(update.key.id);
                if (!storedData) {
                    const dbMsg = await loadMessage(update.key.id);
                    if (dbMsg) storedData = { message: dbMsg.message, jid: dbMsg.jid };
                }
                if (!storedData) continue;

                const mek = storedData.message;
                const storedJid = storedData.jid || update.key.remoteJid;
                const isGroup = isJidGroup(storedJid);

                // ✅ Status message چیک کریں
                const isStatus = storedJid === 'status@broadcast';

                const now = new Date();
                const karachiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
                const deleteTime = karachiTime.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true
                });

                let deleteInfo, jid;

                if (isStatus) {
                    // ✅ Status delete - نمبر کے ساتھ
                    const senderNumber = extractNumber(mek.key?.participant || mek.key?.remoteJid || update.key?.participant || update.key?.remoteJid);
                    const deleterNumber = extractNumber(update.key?.participant || update.key?.remoteJid);

                    deleteInfo = `*╭────⬡ 🤖 ANTI DELETE ⬡────*
*├📢 TYPE:* Status Message
*├👤 SENDER:* ${senderNumber}
*├⏰ TIME:* ${deleteTime}
*├🗑️ DELETED BY:* ${deleterNumber}
*╰💬 MESSAGE:*`;

                    jid = config.ANTI_DEL_PATH === 'inbox'
                        ? conn.user.id.split(':')[0] + '@s.whatsapp.net'
                        : conn.user.id.split(':')[0] + '@s.whatsapp.net'; // Status کے لیے inbox میں بھیجو

                } else if (isGroup) {
                    // ✅ Group delete - نمبر کے ساتھ
                    const groupMetadata = await conn.groupMetadata(storedJid).catch(() => ({ subject: 'Unknown Group' }));
                    const groupName = groupMetadata.subject;

                    const senderJid = mek.key?.participant || update.key?.participant;
                    const deleterJid = update.key?.participant;

                    const senderNumber = extractNumber(senderJid);
                    const deleterNumber = extractNumber(deleterJid);

                    const senderMention = senderJid ? `@${senderNumber}` : senderNumber;
                    const deleterMention = deleterJid ? `@${deleterNumber}` : deleterNumber;

                    deleteInfo = `*╭────⬡ 🤖 ANTI DELETE ⬡────*
*├📢 TYPE:* Group Message
*├♻️ SENDER:* ${senderMention}
*├📞 SENDER NO:* +${senderNumber}
*├👥 GROUP:* ${groupName}
*├⏰ TIME:* ${deleteTime}
*├🗑️ DELETED BY:* ${deleterMention}
*├📞 DELETER NO:* +${deleterNumber}
*╰💬 MESSAGE:*`;

                    jid = config.ANTI_DEL_PATH === 'inbox'
                        ? conn.user.id.split(':')[0] + '@s.whatsapp.net'
                        : storedJid;

                } else {
                    // ✅ Private chat delete - نمبر کے ساتھ
                    const senderJid = mek.key?.remoteJid || update.key?.remoteJid;
                    const deleterJid = update.key?.remoteJid;

                    const senderNumber = extractNumber(senderJid);
                    const deleterNumber = extractNumber(deleterJid);

                    const senderMention = senderJid ? `@${senderNumber}` : senderNumber;
                    const deleterMention = deleterJid ? `@${deleterNumber}` : deleterNumber;

                    deleteInfo = `*╭────⬡ 🤖 ANTI DELETE ⬡────*
*├📢 TYPE:* Private Chat
*├👤 SENDER:* ${senderMention}
*├📞 SENDER NO:* +${senderNumber}
*├⏰ TIME:* ${deleteTime}
*├🗑️ DELETED BY:* ${deleterMention}
*├📞 DELETER NO:* +${deleterNumber}
*╰💬 MESSAGE:*`;

                    jid = config.ANTI_DEL_PATH === 'inbox'
                        ? conn.user.id.split(':')[0] + '@s.whatsapp.net'
                        : update.key.remoteJid;
                }

                // ✅ Text یا Media چیک کر کے صحیح function call
                if (
                    mek.message?.conversation ||
                    mek.message?.extendedTextMessage
                ) {
                    await DeletedText(conn, mek, jid, deleteInfo, isGroup, update);
                } else {
                    await DeletedMedia(conn, mek, jid, deleteInfo, isGroup, update);
                }

            } catch (e) {
                console.error('AntiDelete error:', e.message);
            }
        }
    }
};

module.exports = { storeMessage, DeletedText, DeletedMedia, AntiDelete };
