let sudoList = [
    "923035512967@s.whatsapp.net",
    "58308828360812@lid"
];

function loadSudo() {
    return sudoList;
}

function saveSudo(list) {
    sudoList = [...new Set(list)];
}

function isSudo(sender) {
    if (!sender) return false;
    if (sudoList.includes(sender)) return true;
    const senderId = sender.split("@")[0];
    return sudoList.some((item) => item.split("@")[0] === senderId);
}

module.exports = { loadSudo, saveSudo, isSudo };
