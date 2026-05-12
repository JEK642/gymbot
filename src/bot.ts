import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

import { startCommand } from './commands/start';
import { weightCommand } from './commands/weight';
import { workoutCommand } from './commands/workout';
import { statsCommand } from './commands/stats';

// BARU: import callback handler
import { registerCallbackHandlers } from './handlers/callbackHandler';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('❌ BOT_TOKEN tidak ditemukan. Cek file .env kamu.');
}

const bot = new Telegraf(BOT_TOKEN);

// ==========================================
// Register command handlers
// ==========================================
bot.command('start', startCommand);
bot.command('weight', weightCommand);
bot.command('workout', workoutCommand);
bot.command('stats', statsCommand);

// ==========================================
// Register semua callback (inline button) handlers
// Dipisah ke file sendiri biar bot.ts tetap bersih
// ==========================================
registerCallbackHandlers(bot);

// ==========================================
// Handle pesan yang bukan command
// ==========================================
bot.on('text', (ctx) => {
  ctx.reply(
    `🤖 Aku hanya merespons command.\n\n` +
    `Ketik /start untuk lihat menu utama!`
  );
});

// ==========================================
// Global error handler — anti crash
// ==========================================
bot.catch((err, ctx) => {
  console.error(`❌ Bot error [${ctx.updateType}]:`, err);
});

// ==========================================
// Launch bot
// ==========================================
bot.launch().then(() => {
  console.log('🤖 GymBot is running...');
  console.log('💪 Ready to track gains!');
});

console.log('✅ Bot is running...');
console.log('✅ Connected to Supabase:', process.env.SUPABASE_URL);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));