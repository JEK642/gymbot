"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backToMenuKeyboard = exports.workoutTypeKeyboard = exports.mainMenuKeyboard = void 0;
const telegraf_1 = require("telegraf");
// ============================================
// PENJELASAN: Inline Keyboard di Telegram
//
// Ada 2 jenis keyboard di Telegraf:
// 1. ReplyKeyboard → muncul di bawah chat (kayak keyboard)
// 2. InlineKeyboard → muncul di dalam chat bubble (lebih modern)
//
// Kita pakai InlineKeyboard karena:
// - Lebih clean & modern
// - Tidak ganggu input field user
// - Bisa diedit/dihapus setelah dikirim
// - Tiap button punya "callback_data" yang dikirim ke bot
// ============================================
// Main menu — muncul setelah /start
exports.mainMenuKeyboard = telegraf_1.Markup.inlineKeyboard([
    [
        telegraf_1.Markup.button.callback('⚖️ Log Berat', 'menu_weight'),
        telegraf_1.Markup.button.callback('🏋️ Log Workout', 'menu_workout'),
    ],
    [
        telegraf_1.Markup.button.callback('📊 Lihat Stats', 'menu_stats'),
        telegraf_1.Markup.button.callback('❓ Bantuan', 'menu_help'),
    ],
]);
// Workout type selector — muncul saat klik "Log Workout"
exports.workoutTypeKeyboard = telegraf_1.Markup.inlineKeyboard([
    [
        telegraf_1.Markup.button.callback('💪 Push', 'workout_push'),
        telegraf_1.Markup.button.callback('🔙 Pull', 'workout_pull'),
        telegraf_1.Markup.button.callback('🦵 Legs', 'workout_legs'),
    ],
    [
        telegraf_1.Markup.button.callback('🏃 Cardio', 'workout_cardio'),
        telegraf_1.Markup.button.callback('⚡ HIIT', 'workout_hiit'),
        telegraf_1.Markup.button.callback('🎯 Core', 'workout_core'),
    ],
    [
        telegraf_1.Markup.button.callback('🏋️ Chest', 'workout_chest'),
        telegraf_1.Markup.button.callback('💥 Back', 'workout_back'),
        telegraf_1.Markup.button.callback('🔝 Shoulders', 'workout_shoulders'),
    ],
    [
        telegraf_1.Markup.button.callback('💤 Rest Day', 'workout_rest'),
        telegraf_1.Markup.button.callback('🧘 Mobility', 'workout_mobility'),
    ],
    [
        // Tombol kembali ke main menu
        telegraf_1.Markup.button.callback('🔙 Menu Utama', 'menu_main'),
    ],
]);
// Tombol "kembali ke menu" — dipakai di berbagai tempat
exports.backToMenuKeyboard = telegraf_1.Markup.inlineKeyboard([
    [telegraf_1.Markup.button.callback('🏠 Menu Utama', 'menu_main')],
]);
