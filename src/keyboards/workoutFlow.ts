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
  [
    Markup.button.callback('➕ Tambah Split', 'wf_add_split'),
  ],
  [
    Markup.button.callback('🏠 Home', 'menu_main'),
  ],
]);

// ── Screen 2: Exercise Selection ──────────────
export function buildExerciseKeyboard(
  defaultExercises: Exercise[],
  customExercises: Exercise[],
  splitName: string
) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  const defaults = defaultExercises.slice(0, 5);
  for (let i = 0; i < defaults.length; i += 2) {
    const row = [
      Markup.button.callback(
        truncateName(defaults[i].name),
        `wf_ex:${defaults[i].id}`
      ),
    ];
    if (defaults[i + 1]) {
      row.push(
        Markup.button.callback(
          truncateName(defaults[i + 1].name),
          `wf_ex:${defaults[i + 1].id}`
        )
      );
    }
    rows.push(row);
  }

  if (customExercises.length > 0) {
    for (let i = 0; i < customExercises.length; i += 2) {
      const row = [
        Markup.button.callback(
          `⭐ ${truncateName(customExercises[i].name)}`,
          `wf_ex:${customExercises[i].id}`
        ),
      ];
      if (customExercises[i + 1]) {
        row.push(
          Markup.button.callback(
            `⭐ ${truncateName(customExercises[i + 1].name)}`,
            `wf_ex:${customExercises[i + 1].id}`
          )
        );
      }
      rows.push(row);
    }
  }

  rows.push([
    Markup.button.callback('⚙️ Kelola Exercise', 'em_open'),
  ]);

  rows.push([
    Markup.button.callback('🔙 Ganti Split', 'wf_start'),
    Markup.button.callback('🏠 Home',        'menu_main'),
  ]);

  return Markup.inlineKeyboard(rows);
}

// ── Screen 3: Set Logged — GRID 2×2 ──────────
// CHANGED: dari 4 baris vertikal → grid 2×2 kompak
export const setLoggedKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('➕ Set Lagi',  'wf_addset'),
    Markup.button.callback('🔁 Exercise', 'wf_newex'),
  ],
  [
    Markup.button.callback('✅ Finish',   'wf_finish'),
    Markup.button.callback('🏠 Home',     'menu_main'),
  ],
]);

// ── Screen 4: Active Session ──────────────────
export const activeSessionKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('➕ Log Set',  'wf_newex'),
    Markup.button.callback('✅ Selesai', 'wf_finish'),
  ],
  [
    Markup.button.callback('📊 Status',        'wf_status'),
    Markup.button.callback('❌ Batalkan Sesi', 'wf_cancel_session'),
  ],
]);

// ── Cancel keyboards ──────────────────────────
export const cancelKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('🔙 Back', 'wf_start'),
    Markup.button.callback('🏠 Home', 'menu_main'),
  ],
]);

export const cancelOnlyKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('❌ Cancel', 'wf_cancel')],
]);

// ── Helper ────────────────────────────────────
function truncateName(name: string, max = 16): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

// buildRepsKeyboard DIHAPUS — tidak dipakai lagi setelah UX merge