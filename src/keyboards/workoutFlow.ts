import { Markup } from 'telegraf';
import { Exercise } from '../types';

// ============================================
// Semua keyboard untuk guided workout flow
// Dipisah dari mainMenu.ts supaya tidak campur
// ============================================

// ── Screen 1: Split Selection ─────────────────
export const splitKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('🔥 Push',     'wf_split:push'),
    Markup.button.callback('💪 Pull',     'wf_split:pull'),
  ],
  [
    Markup.button.callback('🦵 Legs',     'wf_split:legs'),
    Markup.button.callback('⬆️ Upper',    'wf_split:upper'),
  ],
  [
    Markup.button.callback('⬇️ Lower',    'wf_split:lower'),
    Markup.button.callback('🔄 Full Body','wf_split:full_body'),
  ],
  [
    Markup.button.callback('📝 Tanpa Split', 'wf_split:general'),
  ],
  [
    Markup.button.callback('🏠 Home', 'menu_main'),
  ],
]);

// ── Screen 2: Exercise Selection (dinamis) ────
// Dibangun dari data Supabase
export function buildExerciseKeyboard(exercises: Exercise[], splitName: string) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  // Tampilkan max 12 exercise pertama (3 kolom × 4 baris)
  // Kalau lebih dari itu, UI jadi terlalu panjang
  const displayExercises = exercises.slice(0, 12);

  // 2 exercise per baris supaya nama tidak terpotong
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

  // Navigasi bawah
  rows.push([
    Markup.button.callback('🔙 Ganti Split', 'wf_start'),
    Markup.button.callback('🏠 Home', 'menu_main'),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ── Screen 3: Quick Reps Buttons ─────────────
// User tap angka reps — tidak perlu ketik
export function buildRepsKeyboard(exerciseName: string, weight: number) {
  return Markup.inlineKeyboard([
    // Baris 1: reps rendah (strength)
    [
      Markup.button.callback('3',  'wf_reps:3'),
      Markup.button.callback('4',  'wf_reps:4'),
      Markup.button.callback('5',  'wf_reps:5'),
      Markup.button.callback('6',  'wf_reps:6'),
    ],
    // Baris 2: reps menengah (hypertrophy)
    [
      Markup.button.callback('8',  'wf_reps:8'),
      Markup.button.callback('10', 'wf_reps:10'),
      Markup.button.callback('12', 'wf_reps:12'),
      Markup.button.callback('15', 'wf_reps:15'),
    ],
    // Baris 3: reps tinggi + custom
    [
      Markup.button.callback('20', 'wf_reps:20'),
      Markup.button.callback('25', 'wf_reps:25'),
      Markup.button.callback('✏️ Custom', 'wf_reps:custom'),
    ],
    // Navigasi
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

// ── Screen 5: In-Session Quick Actions ────────
// Muncul kalau user kirim /start saat ada session aktif
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

// ── Cancel/Back universal keyboard ───────────
export const cancelKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('🔙 Back', 'wf_start'),
    Markup.button.callback('🏠 Home', 'menu_main'),
  ],
]);

// ── Helper ────────────────────────────────────
// Potong nama exercise kalau terlalu panjang
// Telegram button max ~20 char supaya tidak overflow
function truncateName(name: string, max = 18): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}