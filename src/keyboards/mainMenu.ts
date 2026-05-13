// mainMenu.ts
// Update: tambah tombol Session dan Exercises untuk fitur baru

import { Markup } from 'telegraf';

// Main menu — muncul setelah /start
export const mainMenuKeyboard = Markup.inlineKeyboard([
  // Baris 1: fitur session baru
  [
    Markup.button.callback('🏋️ Mulai Session', 'session_start_menu'),
    Markup.button.callback('📊 Status Session', 'session_status'),
  ],
  // Baris 2: log cepat & exercises
  [
    Markup.button.callback('📋 Daftar Exercise', 'exercises_menu'),
    Markup.button.callback('⚖️ Log Berat', 'menu_weight'),
  ],
  // Baris 3: stats & bantuan
  [
    Markup.button.callback('📈 Stats', 'menu_stats'),
    Markup.button.callback('❓ Bantuan', 'menu_help'),
  ],
]);

// Workout type selector — muncul saat klik "Log Workout" (sistem lama, tetap dipertahankan)
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
    Markup.button.callback('🔙 Menu Utama', 'menu_main'),
  ],
]);

// Tombol kembali ke menu — dipakai di berbagai tempat
export const backToMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🏠 Menu Utama', 'menu_main')],
]);