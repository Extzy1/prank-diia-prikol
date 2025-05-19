// Telegram Bot for Fake Diya Passport
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const PASSWORD = process.env.SECRET_PASSWORD;
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.use(express.json());

let usersData = {};
const DATA_FILE = 'data.json';

if (fs.existsSync(DATA_FILE)) {
  usersData = JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '👋 Привіт! Надішли мені такі дані у форматі:\n\n🔐 Пароль\n👤 ПІБ\n📅 Дата народження (у форматі РРРР-ММ-ДД)\n🖼 Фото (відправ окремим повідомленням)\n✍️ Підпис\n\nНадсилай по черзі.');
});

const sessions = {};

bot.on('message', (msg) => {
  const id = msg.from.id;
  const text = msg.text;

  if (!sessions[id]) sessions[id] = {};

  if (text && text.startsWith('/start')) return;

  if (!sessions[id].verified) {
    if (text === PASSWORD) {
      sessions[id].verified = true;
      bot.sendMessage(id, '✅ Пароль вірний. Тепер надішли ПІБ.');
    } else {
      bot.sendMessage(id, '❌ Невірний пароль.');
    }
    return;
  }

  const step = sessions[id].step || 'name';

  switch (step) {
    case 'name':
      sessions[id].data = { name: text };
      sessions[id].step = 'dob';
      bot.sendMessage(id, '📅 Тепер надішли дату народження (РРРР-ММ-ДД).');
      break;
    case 'dob':
      sessions[id].data.dob = text;
      sessions[id].step = 'signature';
      bot.sendMessage(id, '✍️ Тепер надішли підпис.');
      break;
    case 'signature':
      sessions[id].data.signature = text;
      sessions[id].step = 'photo';
      bot.sendMessage(id, '🖼 Тепер надішли фото як з паспорта.');
      break;
  }
});

bot.on('photo', async (msg) => {
  const id = msg.from.id;
  if (!sessions[id] || sessions[id].step !== 'photo') return;

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const file = await bot.getFileLink(fileId);

  usersData[id] = {
    ...sessions[id].data,
    photo: file,
    timestamp: new Date().toISOString(),
  };
  saveData();

  bot.sendMessage(id, '✅ Дані збережено! Перевірити паспорт можна тут: https://твій-сайт.github.io?id=' + id);
  delete sessions[id];
});

app.get('/', (req, res) => {
  const id = req.query.id;
  if (usersData[id]) {
    res.json(usersData[id]);
  } else {
    res.status(404).json({ error: 'Користувача не знайдено' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
