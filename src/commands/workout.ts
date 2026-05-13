import { Context } from 'telegraf';
import { logWorkout } from '../services/workoutService';
import { workoutTypeKeyboard, backToMenuKeyboard } from '../keyboards/mainMenu';

// ⚠️ DEPRECATED — sistem lama
// Data disimpan ke tabel workout_logs
// Sistem baru: /session → workout_sessions + session_exercises + exercise_sets

const VALID_WORKOUT_TYPES = [
  'push', 'pull', 'legs', 'upper', 'lower',
  'full body', 'cardio', 'hiit', 'rest',
  'chest', 'back', 'shoulders', 'arms',
  'core', 'mobility'
];

const VALID_INTENSITIES = ['low', 'medium', 'high'];

const workoutHype: Record<string, string> = {
  push: '🔥 Push day kelar! Dada, bahu, trisep — semua udah dihajar!',
  pull: '💪 Pull day beres! Punggung dan bisep makin solid!',
  legs: '🦵 Leg day selesai! Yang paling berat, yang paling dihormati.',
  cardio: '🏃 Cardio udah dicatat. Jantung juga otot, jangan dilupain!',
  hiit: '⚡ HIIT kelar! Kalori terbakar habis hari ini!',
  core: '🎯 Core selesai! Abs dibentuk di gym, dikeluarin di dapur.',
  chest: '💥 Chest day beres! Dada makin mantap!',
  back: '🏋️ Back day selesai! Punggung makin lebar dan kuat!',
  shoulders: '🔝 Shoulder day kelar! Bahu makin lebar!',
  rest: '😴 Rest day dicatat. Pemulihan itu bagian dari program!',
  mobility: '🧘 Mobility selesai! Fleksibilitas itu investasi jangka panjang!',
  upper: '⬆️ Upper body selesai! Bagian atas makin solid!',
  lower: '⬇️ Lower body kelar! Kaki dan glutes makin kuat!',
  arms: '💪 Arm day beres! Bisep dan trisep udah dibakar!',
};

export async function workoutCommand(ctx: Context): Promise<void> {
  // ✅ DEPRECATION NOTICE
  // Sistem lama dinonaktifkan — data baru harus masuk ke sistem baru
  // Kode di bawah return sengaja dibiarkan untuk referensi & kemungkinan restore
  await ctx.reply(
    `⚠️ *Perintah /workout sudah tidak aktif.*\n\n` +
    `Gunakan sistem baru yang lebih lengkap:\n\n` +
    `🏋️ \`/session start\` — mulai sesi latihan\n` +
    `📝 \`/log bench press 60 8\` — log set\n` +
    `✅ \`/done\` — selesaikan sesi\n\n` +
    `_Data lama kamu tetap tersimpan dengan aman._`,
    { parse_mode: 'Markdown' }
  );
  return;

  // ============================================================
  // KODE LAMA — DIPERTAHANKAN, TIDAK DIEKSEKUSI
  // Hapus setelah masa transisi selesai
  // ============================================================

  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('⚠️ Tidak bisa mendeteksi akun Telegram kamu.');
    return;
  }

  const telId: number = telegramId!;
  const message = ctx.message!;
  if (!message) {
    await ctx.reply('⚠️ Kirim pesan teks seperti: /workout push');
    return;
  }
  
  if (!('text' in message) || typeof (message as any).text !== 'string') {
    await ctx.reply('⚠️ Kirim pesan teks seperti: /workout push');
    return;
  }

  const text = (message as any).text as string;
  const parts = text.trim().split(/\s+/);
  parts.shift();

  if (parts.length === 0 || !parts[0]) {
    await ctx.reply(
      `🏋️ *Hari ini latihan apa?*\n\n` +
      `Pilih dari tombol di bawah, atau ketik lengkap:\n` +
      `\`/workout push 60 high catatan_kamu\`\n\n` +
      `_Format: tipe • menit • intensitas • catatan_`,
      {
        parse_mode: 'Markdown',
        ...workoutTypeKeyboard,
      }
    );
    return;
  }

  const workoutType = parts[0].toLowerCase();

  if (!VALID_WORKOUT_TYPES.includes(workoutType)) {
    await ctx.reply(
      `❌ *"${workoutType}" bukan tipe workout yang dikenal.*\n\n` +
      `*Tipe yang tersedia:*\n` +
      `${VALID_WORKOUT_TYPES.join(' • ')}\n\n` +
      `Contoh: \`/workout push\``,
      {
        parse_mode: 'Markdown',
        ...workoutTypeKeyboard,
      }
    );
    return;
  }

  let duration: number | null = null;
  const durationStr = parts[1];
  if (durationStr) {
    const parsedDuration = parseInt(durationStr, 10);
    if (!isNaN(parsedDuration) && parsedDuration > 0 && parsedDuration <= 600) {
      duration = parsedDuration;
    }
  }

  let intensity: string | null = null;
  const intensityStr = parts[2];
  if (intensityStr && VALID_INTENSITIES.includes(intensityStr.toLowerCase())) {
    intensity = intensityStr.toLowerCase();
  }

  let notes: string | null = null;
  if (parts[3]) {
    notes = parts.slice(3).join(' ').replace(/_/g, ' ');
  }

  try {
    await logWorkout(
      telId, 
      workoutType, 
      duration as number | null, 
      intensity as string | null, 
      notes as string | null
    );

    const hype = workoutHype[workoutType] ?? `🏋️ Sesi *${workoutType.toUpperCase()}* berhasil dicatat!`;

    let detailLines = '';
    if (duration) detailLines += `\n⏱️ Durasi: *${duration} menit*`;
    if (intensity) {
      const intensityEmoji = (intensity as string) === 'high' ? '🔴' : (intensity as string) === 'medium' ? '🟡' : '🟢';
      detailLines += `\n${intensityEmoji} Intensitas: *${(intensity as string).charAt(0).toUpperCase() + (intensity as string).slice(1)}*`;
    }
    if (notes) detailLines += `\n📝 Catatan: _${notes}_`;

    await ctx.reply(
      `✅ *Workout Tercatat!*\n\n` +
      `${hype}` +
      `${detailLines ? '\n' + detailLines : ''}\n\n` +
      `_Gunakan /stats untuk lihat progress mingguan._`,
      {
        parse_mode: 'Markdown',
        ...backToMenuKeyboard,
      }
    );
  } catch (error) {
    console.error('workoutCommand error:', error);
    await ctx.reply(
      `⚠️ *Gagal menyimpan workout.*\n\nCoba lagi dalam beberapa detik.`,
      { parse_mode: 'Markdown' }
    );
  }
}