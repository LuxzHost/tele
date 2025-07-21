const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { TOKEN, OWNER_ID } = require('./config');
const moment = require('moment'); 
const { exec } = require('child_process');
const bot = new TelegramBot(TOKEN, { polling: true });
const logFolder = path.join(__dirname, 'logs');
if (!fs.existsSync(logFolder)) fs.mkdirSync(logFolder);
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);
// Load users.json
let users = [];
const usersFile = path.join(__dirname, 'users.json');
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile));
}
const adminsFile = path.join(__dirname, 'admins.json');
let admins = [];
if (fs.existsSync(adminsFile)) {
  admins = JSON.parse(fs.readFileSync(adminsFile));
} else {
  fs.writeFileSync(adminsFile, JSON.stringify([]));
}
function getVPSUptime() {
  return new Promise((resolve, reject) => {
    fs.readFile('/proc/uptime', 'utf8', (err, data) => {
      if (err) {
        reject('Gagal membaca /proc/uptime');
      } else {
        // Data berupa dua angka: uptime dalam detik dan idle time
        const uptimeInSeconds = parseFloat(data.split(' ')[0]);
        const days = Math.floor(uptimeInSeconds / (3600 * 24));
        const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeInSeconds % 60);
        resolve(`${days} hari, ${hours} jam, ${minutes} menit, ${seconds} detik`);
      }
    });
  });
}

const produkPath = path.join(__dirname, 'produk.json');
function loadProduk() {
  if (!fs.existsSync('produk.json')) return [];
  return JSON.parse(fs.readFileSync('produk.json'));
}
function saveProduk(data) {
  fs.writeFileSync('produk.json', JSON.stringify(data, null, 2));
}
const BOTS_FILE = path.join(__dirname, 'bots.json');
const activeBots = {}; 
// Load user database
function loadUsers() {
  const usersFile = path.join(__dirname, 'users.json');
  if (!fs.existsSync(usersFile)) return [];
  return JSON.parse(fs.readFileSync(usersFile));
}
// === FUNCTION SAVE USERS ===
function saveUsers(users) {
  const usersFile = path.join(__dirname, 'users.json');
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}
// Tambahkan user baru
function addUser(userId) {
  const users = loadUsers();
  if (!users.includes(userId)) {
    users.push(userId);
    saveUsers(users);
  }
}
function loadBots() {
  if (!fs.existsSync(BOTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(BOTS_FILE));
}
// Simpan data bot yang disewa ke file
function saveBots(bots) {
  fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2));
}
function monitorExpiredBots() {
  setInterval(() => {
    const bots = loadBots();
    const now = Date.now();
    const updatedBots = [];
    bots.forEach(({ token, ownerId, expiredAt }) => {
      if (expiredAt > now) {
        updatedBots.push({ token, ownerId, expiredAt });
      } else {
        console.log(`[!] Token expired: ${token.slice(0, 10)}...`);
        if (activeBots[token]) {
    activeBots[token].botInstance.stopPolling();
          delete activeBots[token];
        }
      }
    });

    if (updatedBots.length !== bots.length) {
      saveBots(updatedBots);
    }
  }, 60 * 1000); // tiap 1 menit cek
}
function broadcastToOwnerAndAdmins(sendFunc) {
  const recipients = [OWNER_ID, ...admins];
  for (const id of recipients) {
    sendFunc(id);
  }
}
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const from = msg.from;
  const userTag = from.username ? `@${from.username}` : from.first_name;

  if (chatId == OWNER_ID || msg.chat.type !== 'private') return;

  const logPath = path.join(logFolder, `${chatId}.txt`);
  const logEntry = `FROM ${userTag} [${chatId}]: ${msg.text || '[media]'}\n`;
  fs.appendFileSync(logPath, logEntry);
  // Forward isi pesannya ke owner
  
  try {
    if (msg.text) {
     const text = `📩 Pesan dari ${userTag} [${chatId}]:\n\n${msg.text}`;
  broadcastToOwnerAndAdmins((id) => bot.sendMessage(id, text));
} else if (msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
  const caption = `📷 Foto dari ${userTag} [${chatId}]`;
  broadcastToOwnerAndAdmins((id) => bot.sendPhoto(id, fileId, { caption }));

    } else if (msg.document) {
      const caption = `📎 Dokumen dari ${userTag} [${chatId}]`;
  broadcastToOwnerAndAdmins((id) => bot.sendDocument(id, msg.document.file_id, { caption }));
    } else if (msg.video) {
      const caption = `📹 Video dari ${userTag} [${chatId}]`;
  broadcastToOwnerAndAdmins((id) => bot.sendVideo(id, msg.video.file_id, { caption }));
    } else if (msg.audio) {
      const caption = `🎵 Audio dari ${userTag} [${chatId}]`;
  broadcastToOwnerAndAdmins((id) => bot.sendAudio(id, msg.audio.file_id, { caption }));
    } else if (msg.voice) {
      const caption = `🎤 Voice note dari ${userTag} [${chatId}]`;
  broadcastToOwnerAndAdmins((id) => bot.sendVoice(id, msg.voice.file_id, { caption }));
        
    } else if (msg.sticker) {
      broadcastToOwnerAndAdmins((id) => {
    bot.sendSticker(id, msg.sticker.file_id);
    bot.sendMessage(id, `🤖 Stiker dari ${userTag} [${chatId}]`);
  });
    } else {
      const text = `📩 Pesan dari ${userTag} [${chatId}]: [Konten tidak dikenali]`;
  broadcastToOwnerAndAdmins((id) => bot.sendMessage(id, text));
} 
      } catch (err) {
    console.error(`Gagal forward pesan dari ${chatId}:`, err.message);
    bot.sendMessage(OWNER_ID, `❌ Gagal kirim pesan dari ${chatId}.`);
  }
});

// Handle command balasan


// === Balesan Media dari Owner ===
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== OWNER_ID && !admins.includes(chatId)) return;
if (!msg.reply_to_message) return;


  const original = msg.reply_to_message.text || msg.reply_to_message.caption;
  const match = original?.match(/\[(\d+)\]/);
  if (!match) return bot.sendMessage(chatId, '❌ Gagal menemukan ID user dari pesan yang direply.');

  const targetId = match[1];

  try {
    if (msg.text) {
      await bot.sendMessage(targetId, `✉️ Balasan dari Owner:\n${msg.text}`);
        for (let adminId of admins) {
  if (adminId !== chatId) { // biar gak ngirimin balik ke dirinya sendiri
    bot.sendMessage(adminId, `✉️ Owner baru saja membalas user ${targetId}:\n\n${msg.text}`);
  }
}

    } else if (msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      await bot.sendPhoto(targetId, fileId, { caption: `📷 Dari Owner` });
        for (let adminId of admins) {
  if (adminId !== chatId) { // biar gak ngirimin balik ke dirinya sendiri
    bot.sendMessage(adminId, `✉️ Owner baru saja membalas user ${targetId}:\n\n${msg.photo}`);
  }
}

    } else if (msg.document) {
      await bot.sendDocument(targetId, msg.document.file_id, { caption: `📎 Dari Owner` });
        for (let adminId of admins) {
  if (adminId !== chatId) { // biar gak ngirimin balik ke dirinya sendiri
    bot.sendMessage(adminId, `✉️ Owner baru saja membalas user ${targetId}:\n\n${msg.document}`);
  }
}

    } else if (msg.video) {
      await bot.sendVideo(targetId, msg.video.file_id, { caption: `📹 Dari Owner` });
        for (let adminId of admins) {
  if (adminId !== chatId) { // biar gak ngirimin balik ke dirinya sendiri
    bot.sendMessage(adminId, `✉️ Owner baru saja membalas user ${targetId}:\n\n${msg.video}`);
  }
}
    } else if (msg.audio) {
      await bot.sendAudio(targetId, msg.audio.file_id, { caption: `🎵 Dari Owner` });
        for (let adminId of admins) {
  if (adminId !== chatId) { // biar gak ngirimin balik ke dirinya sendiri
    bot.sendMessage(adminId, `✉️ Owner baru saja membalas user ${targetId}:\n\n${msg.audio}`);
  }
}

    } else if (msg.voice) {
      await bot.sendVoice(targetId, msg.voice.file_id, { caption: `🎤 Dari Owner` });
        for (let adminId of admins) {
  if (adminId !== chatId) { // biar gak ngirimin balik ke dirinya sendiri
    bot.sendMessage(adminId, `✉️ Owner baru saja membalas user ${targetId}:\n\n${msg.voice}`);
  }
}

    } else if (msg.sticker) {
      await bot.sendSticker(targetId, msg.sticker.file_id);
        for (let adminId of admins) {
  if (adminId !== chatId) { // biar gak ngirimin balik ke dirinya sendiri
    bot.sendMessage(adminId, `✉️ Owner baru saja membalas user ${targetId}:\n\n${msg.sticker}`);
  }
}

    }
      

    // Simpan log
    const logPath = path.join(logFolder, `${targetId}.txt`);
    fs.appendFileSync(logPath, `TO [${targetId}]: [media/reply sent]\n`);

    bot.sendMessage(chatId, '✅ Pesan berhasil dikirim ke user.');
  } catch (err) {
    console.error('❌ Gagal kirim balasan:', err.message);
    bot.sendMessage(chatId, `❌ Gagal kirim ke user.\nError: ${err.message}`);
  }
});





// Fitur /start untuk memberikan dashboard awal kepada pengguna
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userTag = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
  const teks = `👋 Halo ${userTag}!\n\nSelamat datang di Customer Service Bot.\nGunakan /help untuk melihat tutorial`;

  bot.sendMessage(chatId, teks, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📖 Sosmed', url: 'https://www.luxzoffc.web.id' }],
        [{ text: '👑 Owner', url: 'https://t.me/luxzopicial' }] // GANTI URL OWNER LU DI SINI
      ]
    }
  });
});

bot.onText(/^\/help$/, async (msg) => {
  const chatId = msg.chat.id;
  const fitur = `Bot Limit Luxz, Langsung Chat Saja Otomatis Terhubung Dengan Owner 👌🏻😁
`;
  bot.sendMessage(chatId, fitur, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '👑 Owner', url: 'https://t.me/luxzopicial' }] // GANTI URL OWNER LU DI SINI
      ]
    }
  });
});

  bot.onText(/^\/listproduk$/, async (msg) => {
  const chatId = msg.chat.id;
  const produkList = loadProduk();

  if (produkList.length === 0) return bot.sendMessage(chatId, '❌ Belum ada produk.');

  produkList.forEach((p) => {
    bot.sendMessage(chatId, `🛒 *${p.name}*\n💸 Harga: Rp${p.price.toLocaleString()}\n📝 ${p.description}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🛒 Order Sekarang', callback_data: `order_${p.id}` }]]
      }
    });
  });
});
const pendingOrders = {}; // Taruh global paling atas

bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
const QRIS_LINK = 'https://files.catbox.moe/6sqyst.jpeg';
  if (data.startsWith('order_')) {
    const produkId = data.replace('order_', '');
    const produkList = loadProduk();
    const produk = produkList.find(p => p.id === produkId);
    if (!produk) return bot.answerCallbackQuery(query.id, { text: '❌ Produk tidak ditemukan.' });

    pendingOrders[chatId] = produkId;
      
    await bot.sendPhoto(chatId, QRIS_LINK, {
      caption: `🛒 Anda ingin membeli *${produk.name}* seharga *Rp${produk.price.toLocaleString()}*.\n\n📸 Silakan *reply* bukti pembayaran ke pesan ini.`,
      parse_mode: 'Markdown'
    });
  }
});
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.reply_to_message && pendingOrders[chatId] && (msg.photo || msg.document)) {
    const produkId = pendingOrders[chatId];
    const produkList = loadProduk();
    const produk = produkList.find(p => p.id === produkId);
    if (!produk) return;

    await bot.sendDocument(chatId, produk.file_id, {
      caption: `✅ Terima kasih! Berikut file produk *${produk.name}*.`,
      parse_mode: 'Markdown'
    });

    delete pendingOrders[chatId]; // Clear pending
  }
});
  // Command untuk set produk baru
bot.onText(/^\/setproduk$/, async (msg) => {
  const chatId = msg.chat.id;
  if (chatId !== OWNER_ID) return;

  bot.sendMessage(chatId, '🛒 Silakan kirim detail produk dalam format:\n\nNama Produk | Harga | Deskripsi');

  bot.once('message', async (res) => {
    if (res.chat.id !== OWNER_ID) return;
    if (!res.text.includes('|')) return bot.sendMessage(chatId, '❌ Format salah. Pakai `Nama | Harga | Deskripsi`');

    const [name, price, description] = res.text.split('|').map(x => x.trim());

    const produkList = loadProduk();
    const id = `produk_${Date.now()}`;
    produkList.push({ id, name, price: parseInt(price), description, file_id: null });
    saveProduk(produkList);

    bot.sendMessage(chatId, `✅ Produk "${name}" disimpan!\n\nSekarang *reply* file produk ke pesan ini untuk mengupload file nya.`, { parse_mode: 'Markdown' });

    // Tunggu file di-reply
    bot.on('message', async (msg) => {
      if (msg.chat.id === OWNER_ID && msg.reply_to_message && msg.document) {
        const produkList = loadProduk();
        const lastProduk = produkList[produkList.length - 1]; // ambil produk terakhir diinput
        if (!lastProduk) return;

        lastProduk.file_id = msg.document.file_id;
        saveProduk(produkList);

        bot.sendMessage(chatId, '✅ File produk berhasil disimpan ke database.');
      }
    });
  });
});
bot.onText(/^\/delproduk (\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId !== OWNER_ID) return;

  const produkId = match[1];
  const produkList = loadProduk();

  const index = produkList.findIndex((p) => p.id === produkId);
  if (index === -1) {
    return bot.sendMessage(chatId, `❌ Produk dengan ID ${produkId} tidak ditemukan.`);
  }

  produkList.splice(index, 1); // Hapus produk dari array
  saveProduk(produkList);

  bot.sendMessage(chatId, `✅ Produk dengan ID ${produkId} berhasil dihapus.`);
});


// === /menu ===
bot.onText(/^\/listmenu$/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId !== OWNER_ID && !admins.includes(chatId)) return;

  const isOwner = chatId === OWNER_ID;

  const ownerMenu = [
    [{ text: "📢 Broadcast", callback_data: 'broadcast' }],
    [{ text: "👥 List User", callback_data: 'listuser' }],
    [{ text: "➕ Add Admin", callback_data: 'addadmin' }],
    [{ text: "➖ Delete Admin", callback_data: 'deladmin' }],
    [{ text: "➕ Add Token", callback_data: 'addtoken' }],
  ];

  const adminMenu = [
    [{ text: "📢 Broadcast", callback_data: 'broadcast' }],
    [{ text: "👥 List User", callback_data: 'listuser' }],
  ];

  bot.sendMessage(chatId, "📋 *Menu Bot*", {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: isOwner ? ownerMenu : adminMenu
    }
  });
});
// Handle pilihan tombol menu
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (chatId !== OWNER_ID && !admins.includes(chatId)) return;

  if (data === 'broadcast') {
    bot.sendMessage(chatId, '✍️ Silakan kirim pesan broadcast yang mau dikirim ke semua user.');
    // Nanti broadcast diketik manual
  }

  if (data === 'listuser') {
    const users = JSON.parse(fs.readFileSync('users.json'));
    let text = `👥 *Daftar User:*\n\n`;
    for (let id of users) {
      text += `• ID: ${id}\n`;
    }
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  if (data === 'addadmin') {
    bot.sendMessage(chatId, '✏️ Kirim ID user yang mau dijadikan admin.\nFormat: /addadmin <id>');
  }

  if (data === 'deladmin') {
    bot.sendMessage(chatId, '🗑️ Kirim ID admin yang mau dihapus.\nFormat: /deladmin <id>');
  }

  if (data === 'addtoken') {
    bot.sendMessage(chatId, '➕ Kirim token, owner id, dan durasi.\nFormat: /addtoken <token> <owner_id> <durasi>');
  }

  // Hapus loading di tombol
  bot.answerCallbackQuery(query.id);
});

// === /addadmin ===
bot.onText(/^\/addadmin (\d+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId !== OWNER_ID) return bot.sendMessage(chatId, '❌ Hanya owner yang bisa tambah admin.');

  const newAdminId = parseInt(match[1]);
  if (!admins.includes(newAdminId)) {
    admins.push(newAdminId);
    fs.writeFileSync(adminsFile, JSON.stringify(admins, null, 2));
    bot.sendMessage(chatId, `✅ Admin baru berhasil ditambahkan: ${newAdminId}`);
  } else {
    bot.sendMessage(chatId, '⚠️ ID ini sudah jadi admin.');
  }
});

// === /deladmin ===
bot.onText(/^\/deladmin (\d+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId !== OWNER_ID) return bot.sendMessage(chatId, '❌ Hanya owner yang bisa hapus admin.');

  const targetAdminId = parseInt(match[1]);
  if (admins.includes(targetAdminId)) {
    admins = admins.filter(id => id !== targetAdminId);
    fs.writeFileSync(adminsFile, JSON.stringify(admins, null, 2));
    bot.sendMessage(chatId, `✅ Admin ${targetAdminId} berhasil dihapus.`);
  } else {
    bot.sendMessage(chatId, '⚠️ ID ini bukan admin.');
  }
});

bot.onText(/^\/bc(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1] || null;

  if (chatId !== OWNER_ID) return;

  const users = loadUsers();
  let success = 0, failed = 0;

  if (msg.reply_to_message) {
    // Broadcast file (reply ke foto/video/dokumen)
    const reply = msg.reply_to_message;

    let sendFunction = null;
    let fileId = null;
    let options = { caption: text || '' };

    if (reply.photo) {
      fileId = reply.photo[reply.photo.length - 1].file_id;
      sendFunction = (userId) => bot.sendPhoto(userId, fileId, options);
    } else if (reply.video) {
      fileId = reply.video.file_id;
      sendFunction = (userId) => bot.sendVideo(userId, fileId, options);
    } else if (reply.document) {
      fileId = reply.document.file_id;
      sendFunction = (userId) => bot.sendDocument(userId, fileId, options);
    } else if (reply.audio) {
      fileId = reply.audio.file_id;
      sendFunction = (userId) => bot.sendAudio(userId, fileId, options);
    } else if (reply.voice) {
      fileId = reply.voice.file_id;
      sendFunction = (userId) => bot.sendVoice(userId, fileId, options);
    } else if (reply.sticker) {
      fileId = reply.sticker.file_id;
      sendFunction = (userId) => bot.sendSticker(userId, fileId);
    } else {
      return bot.sendMessage(chatId, "❌ File ini belum support untuk broadcast.");
    }

    for (const userId of users) {
      try {
        await sendFunction(userId);
        success++;
      } catch (err) {
        failed++;
        console.error(`Gagal kirim ke ${userId}:`, err.message);
      }
    }
  } else if (text) {
    // Broadcast text
    for (const userId of users) {
      try {
        await bot.sendMessage(userId, `📢 Broadcast:\n\n${text}`);
        success++;
      } catch (err) {
        failed++;
        console.error(`Gagal kirim ke ${userId}:`, err.message);
      }
    }
  } else {
    return bot.sendMessage(chatId, "❌ Format salah. Ketik `/bc teks` atau reply file + /bc", { parse_mode: 'Markdown' });
  }

  bot.sendMessage(chatId, `✅ Broadcast selesai!\nSukses: ${success}\nGagal: ${failed}`);
});
bot.onText(/^\/listuser$/, async (msg) => {
  if (msg.from.id !== OWNER_ID) return;

  const users = loadUsers();
  if (users.length === 0) {
    return bot.sendMessage(msg.chat.id, '❌ Belum ada user.');
  }

  let userListText = '📋 List User:\n\n';
  let buttons = [];

  for (const id of users) {
    try {
      const user = await bot.getChat(id);
      const tag = user.username ? `@${user.username}` : (user.first_name || 'Tanpa Nama');
      userListText += `${tag} [${id}]\n`;

      buttons.push([{
        text: `❌ Hapus ${id}`,
        callback_data: `delete_${id}`
      }]);
    } catch (err) {
      console.log(`Gagal ambil data user ${id}: ${err.message}`);
      userListText += `[Tidak dapat info user] [${id}]\n`;

      buttons.push([{
        text: `❌ Hapus ${id}`,
        callback_data: `delete_${id}`
      }]);
    }
  }

  bot.sendMessage(msg.chat.id, userListText, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
});

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith('delete_')) {
    const userIdToDelete = Number(data.split('_')[1]);
    const usersFile = path.join(__dirname, 'users.json');

    if (!fs.existsSync(usersFile)) return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ File users.json tidak ditemukan.', show_alert: true });

    let users = JSON.parse(fs.readFileSync(usersFile));
    if (!users.includes(userIdToDelete)) {
      return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ User tidak ditemukan.', show_alert: true });
    }

    users = users.filter(id => id !== userIdToDelete);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    await bot.sendMessage(userIdToDelete, '🚫 Kamu telah dihapus dari daftar pengguna bot ini.');
    await bot.editMessageText(`✅ User ${userIdToDelete} berhasil dihapus.`, {
      chat_id: msg.chat.id,
      message_id: msg.message_id
    });

    bot.answerCallbackQuery(callbackQuery.id, { text: '✅ User dihapus!', show_alert: false });
  }
});

bot.onText(/^\/addtoken (\S+) (\d+) (\d+[dhm])$/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId !== OWNER_ID) return;

  const [, token, ownerIdStr, durationStr] = match;
  const ownerId = parseInt(ownerIdStr);
  let durationMs = 0;

  if (durationStr.endsWith('d')) durationMs = parseInt(durationStr) * 24 * 60 * 60 * 1000;
  else if (durationStr.endsWith('h')) durationMs = parseInt(durationStr) * 60 * 60 * 1000;
  else if (durationStr.endsWith('m')) durationMs = parseInt(durationStr) * 60 * 1000;
  else return bot.sendMessage(chatId, '❌ Format durasi salah. Gunakan d/h/m.');

  const bots = loadBots();
  bots.push({
    token,
    ownerId,
    expiredAt: Date.now() + durationMs
  });

  saveBots(bots);

  try {
    runBot(token, ownerId);
    bot.sendMessage(chatId, `✅ Bot sewaan berhasil ditambahkan!\nOwner ID: ${ownerId}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal run bot: ${err.message}`);
  }
});

// Daftar bot yang aktif
bot.onText(/^\/tokenlist$/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId !== OWNER_ID) return;

  const bots = loadBots();
  
  if (bots.length === 0) {
    return bot.sendMessage(chatId, "🔴 Tidak ada bot yang aktif.");
  }

  let list = "🟢 Daftar Bot Aktif:\n\n";
  bots.forEach((botData, index) => {
    const tokenStatus = botData.expiredAt > Date.now() ? "Aktif" : "Expired";
    const expirationDate = new Date(botData.expiredAt);
    list += `Bot ${index + 1}:\n`;
    list += `Token: ${botData.token}\n`;
    list += `Owner ID: ${botData.ownerId}\n`;
    list += `Status: ${tokenStatus}\n`;
    list += `Expired At: ${expirationDate.toLocaleString()}\n\n`;
  });

  bot.sendMessage(chatId, list);
});
bot.onText(/^\/deletebot (\S+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId !== OWNER_ID) return;

  const token = match[1];
  const bots = loadBots();
  const filteredBots = bots.filter(b => b.token !== token);

  if (filteredBots.length === bots.length) {
    return bot.sendMessage(chatId, '❌ Token tidak ditemukan.');
  }

  // Stop polling juga
  if (activeBots[token]) {
    activeBots[token].botInstance.stopPolling();
    delete activeBots[token];
  }

  saveBots(filteredBots);
  bot.sendMessage(chatId, '✅ Bot berhasil dihapus.');
});
let botStartTime = Date.now();  // Menyimpan waktu bot dimulai

// Fitur untuk memeriksa ID pengguna
bot.onText(/^\/checkid$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendMessage(chatId, `ID Pengguna Anda adalah: ${userId}`);
});

// Fitur untuk menampilkan runtime atau status panel bot
bot.onText(/^\/panel$/, async (msg) => {
  const chatId = msg.chat.id;

  // Mendapatkan usia panel bot
  const uptime = moment.duration(Date.now() - botStartTime);
  const uptimeString = `${uptime.days()} hari, ${uptime.hours()} jam, ${uptime.minutes()} menit, ${uptime.seconds()} detik`;

  // Mendapatkan usia VPS
  try {
    const vpsUptime = await getVPSUptime();

    bot.sendMessage(chatId, `⚙️ **Panel Bot**\n` +
      `• **Usia Panel Bot**: ${uptimeString}\n` +
      `• **Usia VPS**: ${vpsUptime}\n` +  // Menampilkan usia VPS
      `• **Status**: Online`
    );
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal mendapatkan informasi usia VPS. Error: ${err}`);
  }
});

// Fitur untuk melakukan ping ke bot
bot.onText(/^\/ping$/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Pong! Bot aktif dan merespon.');
});

// Fungsikan bot

function runBot(token, ownerId, expiredAt) {
  const subBot = new TelegramBot(token, { polling: true });

  subBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const from = msg.from;
  const userTag = from.username ? `@${from.username}` : from.first_name;

  if (msg.chat.type !== 'private') return;
  if (chatId == ownerId) return;

  // 3. Sambutan
  if (msg.text === '/start') {
    subBot.sendMessage(chatId, `Halo ${userTag}! Selamat datang di layanan CS kami!`);
    return;
  }

  // 4. Log dan kirim ke owner
  const logPath = path.join(logFolder, `${chatId}.txt`);
  const logEntry = `FROM ${userTag} [${chatId}]: ${msg.text || '[media]'}\n`;
  fs.appendFileSync(logPath, logEntry);

    // --- Cek expired
    if (Date.now() > expiredAt) {
      try {
        await subBot.sendMessage(chatId, '❌ Maaf, masa sewa bot sudah habis.');
        subBot.stopPolling();
        console.log(`Bot ${token} expired dan berhenti.`);
      } catch (e) {
        console.error('Gagal send expired message:', e.message);
      }
      return;
    }

    // --- Cek kalau owner balas user
    subBot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== ownerId || !msg.reply_to_message) return;

  const original = msg.reply_to_message.text || msg.reply_to_message.caption;
  const match = original?.match(/\[(\d+)\]/);
  if (!match) return bot.sendMessage(chatId, '❌ Gagal menemukan ID user dari pesan yang direply.');

  const targetId = match[1];

  try {
    if (msg.text) {
      await subBot.sendMessage(targetId, `✉️ Balasan dari Owner:\n${msg.text}`);
    } else if (msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      await subBot.sendPhoto(targetId, fileId, { caption: `📷 Dari Owner` });
    } else if (msg.document) {
      await subBot.sendDocument(targetId, msg.document.file_id, { caption: `📎 Dari Owner` });
    } else if (msg.video) {
      await subBot.sendVideo(targetId, msg.video.file_id, { caption: `📹 Dari Owner` });
    } else if (msg.audio) {
      await subBot.sendAudio(targetId, msg.audio.file_id, { caption: `🎵 Dari Owner` });
    } else if (msg.voice) {
      await subBot.sendVoice(targetId, msg.voice.file_id, { caption: `🎤 Dari Owner` });
    } else if (msg.sticker) {
      await subBot.sendSticker(targetId, msg.sticker.file_id);
    }


        subBot.sendMessage(chatId, '✅ Pesan berhasil dikirim ke user.');
      } catch (err) {
        console.error('❌ Gagal kirim balasan:', err.message);
        subBot.sendMessage(chatId, `❌ Gagal kirim ke user.\nError: ${err.message}`);
      }

      return;
    })

    // --- User kirim pesan ke Owner
    if (msg.chat.type === 'private' && chatId !== ownerId) {
      const logPath = path.join(LOGS_DIR, `${chatId}.txt`);
      const logEntry = `FROM ${userTag} [${chatId}]: ${msg.text || '[media]'}\n`;
      fs.appendFileSync(logPath, logEntry);

      try {
        if (msg.text) {
          await subBot.sendMessage(ownerId, `📩 Pesan dari ${userTag} [${chatId}]:\n\n${msg.text}`);
        } else if (msg.photo) {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          await subBot.sendPhoto(ownerId, fileId, { caption: `📷 Foto dari ${userTag} [${chatId}]` });
        } else if (msg.document) {
          await subBot.sendDocument(ownerId, msg.document.file_id, { caption: `📎 Dokumen dari ${userTag} [${chatId}]` });
        } else if (msg.video) {
          await subBot.sendVideo(ownerId, msg.video.file_id, { caption: `📹 Video dari ${userTag} [${chatId}]` });
        } else if (msg.audio) {
          await subBot.sendAudio(ownerId, msg.audio.file_id, { caption: `🎵 Audio dari ${userTag} [${chatId}]` });
        } else if (msg.voice) {
          await subBot.sendVoice(ownerId, msg.voice.file_id, { caption: `🎤 Voice note dari ${userTag} [${chatId}]` });
        } else if (msg.sticker) {
          await subBot.sendSticker(ownerId, msg.sticker.file_id);
          await subBot.sendMessage(ownerId, `🤖 Stiker dari ${userTag} [${chatId}]`);
        } else {
          await subBot.sendMessage(ownerId, `📩 Pesan dari ${userTag} [${chatId}]: [Konten tidak dikenali]`);
        }
      } catch (err) {
        console.error(`Gagal forward pesan dari ${chatId}:`, err.message);
      }
    }
  });

  console.log(`Bot ${token} untuk Owner ${ownerId} aktif!`);
}

module.exports = { runBot };


  // Save ke activeBots
  
function initAllBots() {
  const bots = loadBots();
  bots.forEach(({ token, ownerId, expiredAt }) => {
    if (expiredAt > Date.now()) {
      try {
        runBot(token, ownerId);
      } catch (err) {
        console.error('Gagal jalanin bot:', err.message);
      }
    }
  });
}

   initAllBots();
monitorExpiredBots();



