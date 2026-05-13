// src/keyboards/workoutFlow.ts
import { Markup } from 'telegraf';
import { Exercise } from '../types';

// ── Screen 1: Split Selection ─────────────────
export const splitKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('🔥 Push',      'wf_split:push'),
    Markup.button.callback('💪 Pull',      'wf_split:pull'),
  ],
  [
    Markup.button.callback('🦵 Legs',      'wf_split:legs'),
    Markup.button.callback('⬆️ Upper',     'wf_split:upper'),
  ],
  [
    Markup.button.callback('⬇️ Lower',     'wf_split:lower'),
    Markup.button.callback('🔄 Full Body', 'wf_split:full_body'),
  ],
  [
    Markup.button.callback('📝 Tanpa Split', 'wf_split:general'),
  ],
  // BARU: tombol tambah split custom
  [
    Markup.button.callback('➕ Tambah Split', 'wf_add_split'),
  ],
  [
    Markup.button.callback('🏠 Home', 'menu_main'),
  ],
]);

// ── Screen 2: Exercise Selection (dinamis) ────
export function buildExerciseKeyboard(exercises: Exercise[], splitName: string) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  // Max 8 exercise (2 kolom × 4 baris) — sesuai tugas
  const displayExercises = exercises.slice(0, 8);

  for (let i = 0; i < displayExercises.length; i += 2) {
    const row = [
      Markup.button.callback(
        truncateName(displayExercises[i].name),
        `wf_ex:${displayExercises[i].id}`
      ),
    ];
    if (displayExercises[i + 1]) {
      row.push(
        Markup.button.callback(
          truncateName(displayExercises[i + 1].name),
          `wf_ex:${displayExercises[i + 1].id}`
        )
      );
    }
    rows.push(row);
  }

  // BARU: tombol tambah exercise custom
  rows.push([
    Markup.button.callback('➕ Tambah Exercise', 'wf_add_exercise'),
  ]);

  // Navigasi bawah
  rows.push([
    Markup.button.callback('🔙 Ganti Split', 'wf_start'),
    Markup.button.callback('🏠 Home', 'menu_main'),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ── Screen 3: Quick Reps Buttons ─────────────
export function buildRepsKeyboard(exerciseName: string, weight: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('3',  'wf_reps:3'),
      Markup.button.callback('4',  'wf_reps:4'),
      Markup.button.callback('5',  'wf_reps:5'),
      Markup.button.callback('6',  'wf_reps:6'),
    ],
    [
      Markup.button.callback('8',  'wf_reps:8'),
      Markup.button.callback('10', 'wf_reps:10'),
      Markup.button.callback('12', 'wf_reps:12'),
      Markup.button.callback('15', 'wf_reps:15'),
    ],
    [
      Markup.button.callback('20', 'wf_reps:20'),
      Markup.button.callback('25', 'wf_reps:25'),
      Markup.button.callback('✏️ Custom', 'wf_reps:custom'),
    ],
    [
      Markup.button.callback('🔙 Ubah Berat', 'wf_back_weight'),
      Markup.button.callback('❌ Cancel', 'wf_cancel'),
    ],
  ]);
}

// ── Screen 4: Set Logged Actions ──────────────
export const setLoggedKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('➕ Set Lagi', 'wf_addset'),
  ],
  [
    Markup.button.callback('🏋️ Exercise Lain', 'wf_newex'),
  ],
  [
    Markup.button.callback('✅ Selesai Latihan', 'wf_finish'),
  ],
  [
    Markup.button.callback('🏠 Home', 'menu_main'),
  ],
]);

// ── Screen 5: Active Session Quick Actions ────
export const activeSessionKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('➕ Log Set', 'wf_newex'),
    Markup.button.callback('✅ Selesai', 'wf_finish'),
  ],
  [
    Markup.button.callback('📊 Status Sesi', 'wf_status'),
    Markup.button.callback('❌ Batalkan Sesi', 'wf_cancel_session'),
  ],
]);

// ── Cancel keyboard universal ─────────────────
export const cancelKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('🔙 Back', 'wf_start'),
    Markup.button.callback('🏠 Home', 'menu_main'),
  ],
]);

// ── Cancel keyboard dengan tombol tunggal ─────
// Dipakai saat user diminta ketik sesuatu
export const cancelOnlyKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('❌ Cancel', 'wf_cancel')],
]);

function truncateName(name: string, max = 18): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}