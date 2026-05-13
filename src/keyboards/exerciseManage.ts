// src/keyboards/exerciseManage.ts
import { Markup } from 'telegraf';
import { Exercise } from '../types';

// ── Menu utama kelola exercise ────────────────
export const exerciseManageKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('➕ Tambah Exercise', 'em_add'),
  ],
  [
    Markup.button.callback('🗑 Hapus Exercise',  'em_delete'),
  ],
  [
    Markup.button.callback('📋 Exercise Saya',   'em_list'),
  ],
  [
    Markup.button.callback('🔙 Kembali',         'em_back'),
  ],
]);

// ── Keyboard daftar exercise custom untuk dihapus ──
// Dibangun dinamis dari custom exercise milik user
export function buildDeleteExerciseKeyboard(exercises: Exercise[]) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  // Tampilkan satu per baris supaya nama tidak terpotong
  for (const ex of exercises) {
    rows.push([
      Markup.button.callback(
        `🗑 ${ex.name}`,
        `em_del:${ex.id}`
      ),
    ]);
  }

  rows.push([
    Markup.button.callback('🔙 Kembali', 'em_back_manage'),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ── Keyboard konfirmasi hapus ─────────────────
export function buildConfirmDeleteKeyboard(exerciseId: string, exerciseName: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Ya, hapus',  `em_confirm_del:${exerciseId}`),
      Markup.button.callback('❌ Batal',      'em_back_manage'),
    ],
  ]);
}

// ── Cancel keyboard simple ────────────────────
export const emCancelKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('❌ Batal', 'em_back_manage')],
]);