"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weightCommand = weightCommand;
const weightService_1 = require("../services/weightService");
const mainMenu_1 = require("../keyboards/mainMenu");
async function weightCommand(ctx) {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
        await ctx.reply('⚠️ Tidak bisa mendeteksi akun Telegram kamu.');
        return;
    }
    const message = ctx.message;
    if (!message || !('text' in message)) {
        await ctx.reply('⚠️ Kirim pesan teks seperti: /weight 72.5');
        return;
    }
    const parts = message.text.trim().split(/\s+/);
    const weightStr = parts[1];
    // ==========================================
    // PRIORITY 1: Validasi input yang lebih baik
    // ==========================================
    // Kasus 1: User ketik "/weight" tanpa angka
    if (!weightStr) {
        await ctx.reply(`📏 *Masukkan berat badan kamu!*\n\n` +
            `Format: \`/weight [angka]\`\n\n` +
            `Contoh:\n` +
            `• \`/weight 72\`\n` +
            `• \`/weight 72.5\`\n` +
            `• \`/weight 68.75\``, { parse_mode: 'Markdown' });
        return;
    }
    // Kasus 2: User ketik "/weight abc" — bukan angka
    const weight = parseFloat(weightStr);
    if (isNaN(weight)) {
        await ctx.reply(`❌ *"${weightStr}" bukan angka yang valid!*\n\n` +
            `Masukkan angka dalam kg.\n\n` +
            `Contoh: \`/weight 72.5\``, { parse_mode: 'Markdown' });
        return;
    }
    // Kasus 3: Angka terlalu kecil atau terlalu besar
    if (weight < 20 || weight > 400) {
        await ctx.reply(`❌ *Berat tidak masuk akal: ${weight} kg*\n\n` +
            `Masukkan berat antara *20 - 400 kg*.\n\n` +
            `Contoh: \`/weight 72.5\``, { parse_mode: 'Markdown' });
        return;
    }
    try {
        await (0, weightService_1.logWeight)(telegramId, weight);
        await ctx.reply(`✅ *${weight} kg berhasil dicatat!*\n\n` +
            `Itulah konsistensi yang sesungguhnya. ` +
            `Terus hadir setiap hari — hasilnya pasti kelihatan. 💪\n\n` +
            `_Gunakan /stats untuk lihat progress kamu._`, {
            parse_mode: 'Markdown',
            ...mainMenu_1.backToMenuKeyboard,
        });
    }
    catch (error) {
        console.error('weightCommand error:', error);
        await ctx.reply(`⚠️ *Gagal menyimpan berat badan.*\n\nCoba lagi dalam beberapa detik.`, { parse_mode: 'Markdown' });
    }
}
