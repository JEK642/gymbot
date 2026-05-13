import { Markup } from 'telegraf';

// ============================================
// UPDATE: Tombol utama sekarang pakai 'wf_start'
// untuk masuk ke guided tap-based workout flow
// ============================================

export const mainMenuKeyboard = Markup.inlineKeyboard([
  // Baris 1: tombol utama — paling penting
  [
    Markup.button.callback('🏋️ Mulai Latihan', 'wf_start'),
  ],
  // Baris 2: log cepat
  [
    Markup.button.callback('⚖️ Log Berat', 'menu_weight'),
    Markup.button.callback('📈 Stats', 'menu_stats'),
  ],
  // Baris 3: tools
  [
    Markup.button.callback('📋 Exercise List', 'exercises_menu'),
    Markup.button.callback('❓ Bantuan', 'menu_help'),
  ],
]);

// Workout type selector (sistem lama — tetap dipertahankan)
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

// Tombol kembali ke menu — dipakai di berbagai tempat
export const backToMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🏠 Menu Utama', 'menu_main')],
]);