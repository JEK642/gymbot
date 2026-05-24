// src/utils/shortExerciseName.ts
// Utility untuk mempersingkat nama exercise supaya muat di tombol Telegram.
// Prioritas: tetap bisa dikenali lifter, bukan sekedar potong karakter.

/**
 * shortExerciseName
 *
 * Contoh:
 *   "Barbell Bench Press"    → "Bench Press"
 *   "Incline Dumbbell Press" → "Incline DB"
 *   "Dumbbell Shoulder Press"→ "DB Shoulder"
 *   "Romanian Deadlift"      → "RDL"
 *   "Conventional Deadlift"  → "Deadlift"
 *   "Standing Calf Raise"    → "Calf Raise"
 *   "Tricep Pushdown"        → "Tricep Push"  (15)
 *   "Dumbbell Curl"          → "DB Curl"
 */
export function shortExerciseName(name: string, maxLen = 15): string {
  let s = name.trim();

  // ── Substitusi frasa penuh dulu (urutan penting) ──
  s = s.replace(/\bRomanian Deadlift\b/gi,    'RDL');
  s = s.replace(/\bConventional Deadlift\b/gi, 'Deadlift');
  s = s.replace(/\bDeadlift\b/gi,              'Deadlift'); // normalise casing
  s = s.replace(/\bDumbbell\b/gi,              'DB');
  s = s.replace(/\bBarbell\b/gi,               '');        // BB biasanya default, cukup hapus
  s = s.replace(/\bStanding\b/gi,              '');        // "Standing Calf Raise" → "Calf Raise"
  s = s.replace(/\bPull-[Uu]p\b/gi,           'Pull-up'); // normalise
  s = s.replace(/\bPush-[Uu]p\b/gi,           'Push-up');

  // Bersihkan spasi ganda hasil penghapusan kata
  s = s.replace(/\s{2,}/g, ' ').trim();

  // ── Kalau masih terlalu panjang: buang kata terakhir satu per satu ──
  if (s.length > maxLen) {
    const words = s.split(' ');
    while (words.length > 1 && s.length > maxLen) {
      words.pop();
      s = words.join(' ');
    }
  }

  // Hard-cap terakhir dengan ellipsis (safety net, jarang tercapai)
  if (s.length > maxLen) {
    s = s.slice(0, maxLen - 1) + '…';
  }

  return s;
}