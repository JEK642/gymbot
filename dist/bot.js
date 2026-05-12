"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const dotenv_1 = __importDefault(require("dotenv"));
const start_1 = require("./commands/start");
const weight_1 = require("./commands/weight");
const workout_1 = require("./commands/workout");
const stats_1 = require("./commands/stats");
// BARU: import callback handler
const callbackHandler_1 = require("./handlers/callbackHandler");
dotenv_1.default.config();
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error('❌ BOT_TOKEN tidak ditemukan. Cek file .env kamu.');
}
const bot = new telegraf_1.Telegraf(BOT_TOKEN);
// ==========================================
// Register command handlers
// ==========================================
bot.command('start', start_1.startCommand);
bot.command('weight', weight_1.weightCommand);
bot.command('workout', workout_1.workoutCommand);
bot.command('stats', stats_1.statsCommand);
// ==========================================
// Register semua callback (inline button) handlers
// Dipisah ke file sendiri biar bot.ts tetap bersih
// ==========================================
(0, callbackHandler_1.registerCallbackHandlers)(bot);
// ==========================================
// Handle pesan yang bukan command
// ==========================================
bot.on('text', (ctx) => {
    ctx.reply(`🤖 Aku hanya merespons command.\n\n` +
        `Ketik /start untuk lihat menu utama!`);
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
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
