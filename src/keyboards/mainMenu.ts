// src/keyboards/mainMenu.ts
import { Markup } from 'telegraf';

export const mainMenuKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('🏋️ Mulai Latihan', 'wf_start'),
  ],
  [
    Markup.button.callback('⚖️ Log Berat', 'menu_weight'),
    Markup.button.callback('📈 Stats', 'menu_stats'),
  ],
  // Tombol "📋 Exercise List" dihapus.
  // Masih bisa diakses via command /exercises kalau perlu.
  [
    Markup.button.callback('❓ Bantuan', 'menu_help'),
  ],
]);

export const workoutTypeKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('💪 Push',      'workout_push'),
    Markup.button.callback('🔙 Pull',      'workout_pull'),
    Markup.button.callback('🦵 Legs',      'workout_legs'),
  ],
  [
    Markup.button.callback('🏃 Cardio',    'workout_cardio'),
    Markup.button.callback('⚡ HIIT',      'workout_hiit'),
    Markup.button.callback('🎯 Core',      'workout_core'),
  ],
  [
    Markup.button.callback('🏋️ Chest',    'workout_chest'),
    Markup.button.callback('💥 Back',      'workout_back'),
    Markup.button.callback('🔝 Shoulders', 'workout_shoulders'),
  ],
  [
    Markup.button.callback('💤 Rest Day',  'workout_rest'),
    Markup.button.callback('🧘 Mobility',  'workout_mobility'),
  ],
  [
    Markup.button.callback('🔙 Menu Utama', 'menu_main'),
  ],
]);

export const backToMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🏠 Menu Utama', 'menu_main')],
]);