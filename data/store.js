const { isJidBroadcast, isJidGroup, isJidNewsletter } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const storeDir = path.join(process.cwd(), 'store');

if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
}

const cache = {
    contacts: null,
    messages: null,
    messageCounts: null,
    metadata: null
};

const cacheLoaded = {
    contacts: false,
    messages: false,
    messageCounts: false,
    metadata: false
};

const filePath = (file) => path.join(storeDir, file);

const readJSON = (file) => {
    try {
        const fp = filePath(file);
        if (!fs.existsSync(fp)) return [];
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch {
        return [];
    }
};

const writeJSON = (file, data) => {
    try {
        fs.writeFileSync(filePath(file), JSON.stringify(data));
    } catch (e) {
        console.error('Write error:', e.message);
    }
};

const initCache = () => {
    if (!cacheLoaded.contacts) { cache.contacts = readJSON('contact.json'); cacheLoaded.contacts = true; }
    if (!cacheLoaded.messages) { cache.messages = readJSON('message.json'); cacheLoaded.messages = true; }
    if (!cacheLoaded.messageCounts) { cache.messageCounts = readJSON('message_count.json'); cacheLoaded.messageCounts = true; }
    if (!cacheLoaded.metadata) { cache.metadata = readJSON('metadata.json'); cacheLoaded.metadata = true; }
};

initCache();

const saveTimers = {};
const debouncedWrite = (file, data, delay = 3000) => {
    if (saveTimers[file]) clearTimeout(saveTimers[file]);
    saveTimers[file] = setTimeout(() => {
        writeJSON(file, data);
    }, delay);
};

const saveContact = (jid, name) => {
    if (!jid || !name || isJidGroup(jid) || isJidBroadcast(jid) || isJidNewsletter(jid)) return;
    const index = cache.contacts.findIndex(c => c.jid === jid);
    if (index > -1) {
        if (cache.contacts[index].name === name) return;
        cache.contacts[index].name = name;
    } else {
        cache.contacts.push({ jid, name });
    }
    debouncedWrite('contact.json', cache.contacts);
};

const saveMessage = (message) => {
    const jid = message.key?.remoteJid;
    const id = message.key?.id;
    if (!id || !jid || !message) return;

    saveContact(message.sender, message.pushName);

    const timestamp = message.messageTimestamp ? message.messageTimestamp * 1000 : Date.now();
    const index = cache.messages.findIndex(m => m.id === id && m.jid === jid);

    if (index > -1) {
        cache.messages[index].message = message;
        cache.messages[index].timestamp = timestamp;
    } else {
        cache.messages.push({ id, jid, message, timestamp });
       
        if (cache.messages.length > 500) {
            cache.messages = cache.messages.slice(-500);
        }
    }

    debouncedWrite('message.json', cache.messages, 2000);

    saveMessageCount(message);
};

const loadMessage = (id) => {
    if (!id) return null;
    return cache.messages.find(m => m.id === id) || null;
};

const getName = (jid) => {
    const contact = cache.contacts.find(c => c.jid === jid);
    return contact ? contact.name : jid.split('@')[0].replace(/_/g, ' ');
};

const saveGroupMetadata = async (jid, client) => {
    if (!isJidGroup(jid)) return;
    try {
        const groupMetadata = await client.groupMetadata(jid);
        const metadata = {
            jid: groupMetadata.id,
            subject: groupMetadata.subject,
            subjectOwner: groupMetadata.subjectOwner,
            subjectTime: groupMetadata.subjectTime ? new Date(groupMetadata.subjectTime * 1000).toISOString() : null,
            size: groupMetadata.size,
            creation: groupMetadata.creation ? new Date(groupMetadata.creation * 1000).toISOString() : null,
            owner: groupMetadata.owner,
            desc: groupMetadata.desc,
            descId: groupMetadata.descId,
            restrict: groupMetadata.restrict,
            announce: groupMetadata.announce,
            ephemeralDuration: groupMetadata.ephemeralDuration,
        };

        const index = cache.metadata.findIndex(m => m.jid === jid);
        if (index > -1) {
            cache.metadata[index] = metadata;
        } else {
            cache.metadata.push(metadata);
        }
        debouncedWrite('metadata.json', cache.metadata);

        const participants = groupMetadata.participants.map(p => ({
            jid, participantId: p.id, admin: p.admin
        }));
        writeJSON(`${jid}_participants.json`, participants);
    } catch (e) {
        console.error('Group metadata error:', e.message);
    }
};

const getGroupMetadata = (jid) => {
    if (!isJidGroup(jid)) return null;
    const metadata = cache.metadata.find(m => m.jid === jid);
    if (!metadata) return null;
    const participants = readJSON(`${jid}_participants.json`);
    return { ...metadata, participants };
};

const saveMessageCount = (message) => {
    if (!message) return;
    const jid = message.key?.remoteJid;
    const sender = message.key?.participant || message.sender;
    if (!jid || !sender || !isJidGroup(jid)) return;

    const index = cache.messageCounts.findIndex(r => r.jid === jid && r.sender === sender);
    if (index > -1) {
        cache.messageCounts[index].count += 1;
    } else {
        cache.messageCounts.push({ jid, sender, count: 1 });
    }
    debouncedWrite('message_count.json', cache.messageCounts, 5000);
};

const getInactiveGroupMembers = (jid) => {
    if (!isJidGroup(jid)) return [];
    const metadata = getGroupMetadata(jid);
    if (!metadata) return [];
    return metadata.participants
        .filter(p => {
            const record = cache.messageCounts.find(m => m.jid === jid && m.sender === p.id);
            return !record || record.count === 0;
        })
        .map(m => m.id);
};

const getGroupMembersMessageCount = async (jid) => {
    if (!isJidGroup(jid)) return [];
    return cache.messageCounts
        .filter(r => r.jid === jid && r.count > 0)
        .sort((a, b) => b.count - a.count)
        .map(r => ({
            sender: r.sender,
            name: getName(r.sender),
            messageCount: r.count
        }));
};

const getChatSummary = () => {
    const distinctJids = [...new Set(cache.messages.map(m => m.jid))];
    return distinctJids.map(jid => {
        const msgs = cache.messages.filter(m => m.jid === jid);
        const last = msgs.sort((a, b) => b.timestamp - a.timestamp)[0];
        return {
            jid,
            name: isJidGroup(jid) ? jid : getName(jid),
            messageCount: msgs.length,
            lastMessageTimestamp: last ? last.timestamp : null
        };
    }).sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
};

const autoClean = () => {
    setInterval(() => {
        try {
           
            cache.contacts = [];
            cache.messages = [];
            cache.messageCounts = [];
            cache.metadata = [];

            const files = ['contact.json', 'message.json', 'message_count.json', 'metadata.json'];
            for (const file of files) {
                writeJSON(file, []);
            }

            const allFiles = fs.readdirSync(storeDir);
            allFiles.filter(f => f.endsWith('_participants.json'))
                    .forEach(f => writeJSON(f, []));

            console.log('✅ Store cleaned at:', new Date().toLocaleTimeString());
        } catch (error) {
            console.error('❌ Auto clean error:', error);
        }
    }, 60 * 60 * 1000);
};

autoClean();

module.exports = {
    saveContact,
    loadMessage,
    getName,
    getChatSummary,
    saveGroupMetadata,
    getGroupMetadata,
    saveMessageCount,
    getInactiveGroupMembers,
    getGroupMembersMessageCount,
    saveMessage,
};
