"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCommand = startCommand;
const userService_1 = require("../services/userService");
const mainMenu_1 = require("../keyboards/mainMenu");
async function startCommand(ctx) {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username ?? null;
    const firstName = ctx.from?.first_name ?? 'Bro';
    if (!telegramId) {
        await ctx.reply('⚠️ Tidak bisa mendeteksi akun Telegram kamu.');
        return;
    }
    try {
        await (0, userService_1.registerUser)(telegramId, username);
        // Kirim welcome message + inline keyboard
        // mainMenuKeyboard menggunakan spread operator (...) karena
        // Telegraf butuh format { reply_markup: ... }
        await ctx.reply(`💪 *Selamat datang di GymBot, ${firstName}!*\n\n` +
            `Mulai perjalanan gym kamu di sini.\n\n` +
            `_Pilih menu di bawah atau ketik command langsung:_`, {
            parse_mode: 'Markdown',
            ...mainMenu_1.mainMenuKeyboard,
        });
    }
    catch (error) {
        console.error('startCommand error:', error);
        await ctx.reply('⚠️ Ada yang salah. Coba lagi ya.');
    }
}
