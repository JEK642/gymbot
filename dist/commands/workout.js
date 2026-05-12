"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workoutCommand = workoutCommand;
const workoutService_1 = require("../services/workoutService");
const mainMenu_1 = require("../keyboards/mainMenu");
// Daftar tipe workout yang valid
const VALID_WORKOUT_TYPES = [
    'push', 'pull', 'legs', 'upper', 'lower',
    'full body', 'cardio', 'hiit', 'rest',
    'chest', 'back', 'shoulders', 'arms',
    'core', 'mobility'
];
// Daftar intensitas yang valid
const VALID_INTENSITIES = ['low', 'medium', 'high'];
const workoutHype = {
    push: '🔥 Push day kelar! Dada, bahu, trisep — semua udah dihajar!',
    pull: '💪 Pull day beres! Punggung dan bisep makin solid!',
    legs: '🦵 Leg day selesai! Yang paling berat, yang paling dihormati.',
    cardio: '🏃 Cardio udah dicatat. Jantung juga otot, jangan dilupain!',
    hiit: '⚡ HIIT kelar! Kalori terbakar habis hari ini!',
    core: '🎯 Core selesai! Abs dibentuk di gym, dikeluarin di dapur.',
    chest: '💥 Chest day beres! Dada makin mantap!',
    back: '🏋️ Back day selesai! Punggung makin lebar dan kuat!',
    shoulders: '🔝 Shoulder day kelar! Bahu makin lebar!',
    rest: '😴 Rest day dicatat. Pemulihan itu bagian dari program!',
    mobility: '🧘 Mobility selesai! Fleksibilitas itu investasi jangka panjang!',
    upper: '⬆️ Upper body selesai! Bagian atas makin solid!',
    lower: '⬇️ Lower body kelar! Kaki dan glutes makin kuat!',
    arms: '💪 Arm day beres! Bisep dan trisep udah dibakar!',
};
// ============================================
// /workout <type> [duration] [intensity] [notes]
//
// Contoh penggunaan:
// /workout push                        → minimal
// /workout push 60                     → + durasi
// /workout push 60 high                → + intensitas
// /workout push 60 high latihan_bagus  → + catatan
// ============================================
async function workoutCommand(ctx) {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
        await ctx.reply('⚠️ Tidak bisa mendeteksi akun Telegram kamu.');
        return;
    }
    const message = ctx.message;
    if (!message || !('text' in message)) {
        await ctx.reply('⚠️ Kirim pesan teks seperti: /workout push');
        return;
    }
    // Parse: "/workout push 60 high felt_strong"
    // → parts = ["push", "60", "high", "felt_strong"]
    const parts = message.text.trim().split(/\s+/);
    parts.shift(); // hapus "/workout"
    // ==========================================
    // PRIORITY 1: Kasus kosong — tampilkan keyboard
    // ==========================================
    if (parts.length === 0 || !parts[0]) {
        await ctx.reply(`🏋️ *Hari ini latihan apa?*\n\n` +
            `Pilih dari tombol di bawah, atau ketik lengkap:\n` +
            `\`/workout push 60 high catatan_kamu\`\n\n` +
            `_Format: tipe • menit • intensitas • catatan_`, {
            parse_mode: 'Markdown',
            ...mainMenu_1.workoutTypeKeyboard,
        });
        return;
    }
    // Parse workout type
    const workoutType = parts[0].toLowerCase();
    // ==========================================
    // PRIORITY 1: Validasi tipe workout
    // ==========================================
    if (!VALID_WORKOUT_TYPES.includes(workoutType)) {
        await ctx.reply(`❌ *"${workoutType}" bukan tipe workout yang dikenal.*\n\n` +
            `*Tipe yang tersedia:*\n` +
            `${VALID_WORKOUT_TYPES.join(' • ')}\n\n` +
            `Contoh: \`/workout push\``, {
            parse_mode: 'Markdown',
            ...mainMenu_1.workoutTypeKeyboard,
        });
        return;
    }
    // ==========================================
    // PRIORITY 3: Parse optional fields
    // ==========================================
    // Parse duration (parts[1]) — harus berupa angka
    let duration = null;
    if (parts[1]) {
        const parsedDuration = parseInt(parts[1]);
        if (!isNaN(parsedDuration) && parsedDuration > 0 && parsedDuration <= 600) {
            duration = parsedDuration;
        }
        else if (parts[1] && isNaN(parseInt(parts[1]))) {
            // User skip durasi dan langsung isi intensitas? Tangani gracefully
            // Contoh: /workout push high → "high" bukan angka, skip duration
        }
    }
    // Parse intensity (parts[2]) — harus 'low', 'medium', atau 'high'
    let intensity = null;
    if (parts[2] && VALID_INTENSITIES.includes(parts[2].toLowerCase())) {
        intensity = parts[2].toLowerCase();
    }
    // Parse notes (parts[3+]) — gabungkan jadi satu string
    // Ganti underscore dengan spasi: "felt_strong" → "felt strong"
    let notes = null;
    if (parts[3]) {
        notes = parts.slice(3).join(' ').replace(/_/g, ' ');
    }
    try {
        await (0, workoutService_1.logWorkout)(telegramId, workoutType, duration, intensity, notes);
        const hype = workoutHype[workoutType] ?? `🏋️ Sesi *${workoutType.toUpperCase()}* berhasil dicatat!`;
        // Buat detail summary kalau ada extra info
        let detailLines = '';
        if (duration)
            detailLines += `\n⏱️ Durasi: *${duration} menit*`;
        if (intensity) {
            const intensityEmoji = intensity === 'high' ? '🔴' : intensity === 'medium' ? '🟡' : '🟢';
            detailLines += `\n${intensityEmoji} Intensitas: *${intensity.charAt(0).toUpperCase() + intensity.slice(1)}*`;
        }
        if (notes)
            detailLines += `\n📝 Catatan: _${notes}_`;
        await ctx.reply(`✅ *Workout Tercatat!*\n\n` +
            `${hype}` +
            `${detailLines ? '\n' + detailLines : ''}\n\n` +
            `_Gunakan /stats untuk lihat progress mingguan._`, {
            parse_mode: 'Markdown',
            ...mainMenu_1.backToMenuKeyboard,
        });
    }
    catch (error) {
        console.error('workoutCommand error:', error);
        await ctx.reply(`⚠️ *Gagal menyimpan workout.*\n\nCoba lagi dalam beberapa detik.`, { parse_mode: 'Markdown' });
    }
}
