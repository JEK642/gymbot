import { Markup } from 'telegraf';

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
export const mainMenuKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('⚖️ Log Berat', 'menu_weight'),
    Markup.button.callback('🏋️ Log Workout', 'menu_workout'),
  ],
  [
    Markup.button.callback('📊 Lihat Stats', 'menu_stats'),
    Markup.button.callback('❓ Bantuan', 'menu_help'),
  ],
]);

// Workout type selector — muncul saat klik "Log Workout"
export const workoutTypeKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('💪 Push', 'workout_push'),
    Markup.button.callback('🔙 Pull', 'workout_pull'),
    Markup.button.callback('🦵 Legs', 'workout_legs'),
  ],
  [
    Markup.button.callback('🏃 Cardio', 'workout_cardio'),
    Markup.button.callback('⚡ HIIT', 'workout_hiit'),
    Markup.button.callback('🎯 Core', 'workout_core'),
  ],
  [
    Markup.button.callback('🏋️ Chest', 'workout_chest'),
    Markup.button.callback('💥 Back', 'workout_back'),
    Markup.button.callback('🔝 Shoulders', 'workout_shoulders'),
  ],
  [
    Markup.button.callback('💤 Rest Day', 'workout_rest'),
    Markup.button.callback('🧘 Mobility', 'workout_mobility'),
  ],
  [
    // Tombol kembali ke main menu
    Markup.button.callback('🔙 Menu Utama', 'menu_main'),
  ],
]);

// Tombol "kembali ke menu" — dipakai di berbagai tempat
export const backToMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🏠 Menu Utama', 'menu_main')],
]);