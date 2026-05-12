import { Context } from 'telegraf';
import { getLatestWeight, getWeightProgress } from '../services/weightService';
import { getWorkoutsThisWeek, getTotalWorkouts } from '../services/workoutService';
import { backToMenuKeyboard } from '../keyboards/mainMenu';

export async function statsCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const firstName = ctx.from?.first_name ?? 'Bro';

  if (!telegramId) {
    await ctx.reply('⚠️ Tidak bisa mendeteksi akun Telegram kamu.');
    return;
  }

  try {
    // Fetch semua data secara paralel (lebih cepat)
    const [latestWeightLog, weeklyWorkouts, totalWorkouts, weightProgress] = await Promise.all([
      getLatestWeight(telegramId),
      getWorkoutsThisWeek(telegramId),
      getTotalWorkouts(telegramId),
      getWeightProgress(telegramId),      // BARU: progress tracking
    ]);

    // ==========================================
    // PRIORITY 4: Weight progress display
    // ==========================================
    const weightDisplay = latestWeightLog
      ? `⚖️ *Berat Terakhir:* ${latestWeightLog.weight} kg`
      : `⚖️ *Berat Terakhir:* Belum dicatat — pakai /weight`;

    // Tampilkan trend berat badan
    let progressLine = '';
    if (weightProgress.diff !== null && weightProgress.previous) {
      const absDiff = Math.abs(weightProgress.diff);

      if (weightProgress.trend === 'up') {
        progressLine = `   📈 Naik *${absDiff} kg* dari log sebelumnya`;
      } else if (weightProgress.trend === 'down') {
        progressLine = `   📉 Turun *${absDiff} kg* dari log sebelumnya`;
      } else {
        progressLine = `   ➡️ Berat stabil dari log sebelumnya`;
      }
    }

    // Motivational summary berdasarkan trend
    let weightMotivation = '';
    if (weightProgress.trend === 'up') {
      weightMotivation = `_💪 Terus pantau asupan kalori dan latihan!_`;
    } else if (weightProgress.trend === 'down') {
      weightMotivation = `_🔥 Progress nyata. Terus pertahankan!_`;
    } else if (weightProgress.trend === 'same') {
      weightMotivation = `_⚡ Berat stabil. Fokus ke performa latihan!_`;
    }

    // Weekly workout rating
    const weeklyRating =
      weeklyWorkouts === 0 ? '😴 Belum ada latihan minggu ini!'
      : weeklyWorkouts <= 2 ? '👣 Baru pemanasan nih...'
      : weeklyWorkouts <= 4 ? '💪 Minggu yang solid!'
      : weeklyWorkouts <= 6 ? '🔥 Lagi on fire!'
      : '🏆 MINGGU ELITE. Respect bro!';

    await ctx.reply(
      `📊 *Statistik ${firstName}*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `${weightDisplay}\n` +
      `${progressLine}\n` +
      `${weightMotivation}\n\n` +
      `🗓️ *Latihan Minggu Ini:* ${weeklyWorkouts} sesi\n` +
      `   ${weeklyRating}\n\n` +
      `🏋️ *Total Latihan (All Time):* ${totalWorkouts}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `_Terus konsisten. Progress selalu terjadi._ 🚀`,
      {
        parse_mode: 'Markdown',
        ...backToMenuKeyboard,
      }
    );
  } catch (error) {
    console.error('statsCommand error:', error);
    await ctx.reply(
      `⚠️ *Gagal memuat statistik.*\n\nCoba lagi dalam beberapa detik.`,
      { parse_mode: 'Markdown' }
    );
  }
}