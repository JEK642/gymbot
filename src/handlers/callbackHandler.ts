import { Telegraf, Markup } from 'telegraf';
import { mainMenuKeyboard, workoutTypeKeyboard, backToMenuKeyboard } from '../keyboards/mainMenu';
import { logWorkout } from '../services/workoutService';
import { getLatestWeight } from '../services/weightService';
import { getWorkoutsThisWeek, getTotalWorkouts } from '../services/workoutService';
import { getWeightProgress } from '../services/weightService';
import { handleExercises } from '../commands/exercise';
import { updateFlowState } from '../state/userFlowState';

// ============================================
// HELPER: editOrReply
//
// Ini solusi untuk error:
// "Cannot set property message of #<Context> which has only a getter"
//
// Kenapa error itu terjadi?
// ctx.editMessageText() gagal kalau:
// - Pesan asli sudah lebih dari 48 jam
// - Pesan sudah dihapus
// - Context tidak punya message yang bisa diedit
//
// Solusi: coba edit dulu, kalau gagal → kirim pesan baru
// ============================================
async function editOrReply(
  ctx: any,
  text: string,
  extra?: object
): Promise<void> {
  try {
    await ctx.editMessageText(text, extra);
  } catch {
    // Fallback ke reply biasa kalau edit gagal
    await ctx.reply(text, extra);
  }
}

export function registerCallbackHandlers(bot: Telegraf): void {

  // ==========================================
  // MENU NAVIGATION CALLBACKS
  // ==========================================

  bot.action('menu_main', async (ctx) => {
    const firstName = ctx.from?.first_name ?? 'Bro';
    await ctx.answerCbQuery();
    await editOrReply(
      ctx,
      `🏠 *Menu Utama — ${firstName}*\n\n` +
      `Mau ngapain sekarang?`,
      {
        parse_mode: 'Markdown',
        ...mainMenuKeyboard,
      }
    );
  });

  // Di callbackHandler.ts, ganti handler menu_weight yang lama:

  bot.action('menu_weight', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    // DIUPDATE: tidak lagi tampilkan instruksi command
    // Sekarang langsung tanya angka → user ketik → simpan
    updateFlowState(telegramId, { step: 'entering_weight_log' });

    await editOrReply(
      ctx,
      `⚖️ *Log Berat Badan*\n\nBerapa berat kamu sekarang?\n\nKetik angka saja, contoh: \`72.5\``,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'menu_main')],
        ]),
      }
    );
  });

  bot.action('menu_workout', async (ctx) => {
    await ctx.answerCbQuery();
    await editOrReply(
      ctx,
      `🏋️ *Pilih Tipe Workout Hari Ini*\n\n` +
      `Tap salah satu untuk langsung mencatat!\n\n` +
      `_Atau ketik \`/workout push 60 high\` untuk data lebih lengkap._`,
      {
        parse_mode: 'Markdown',
        ...workoutTypeKeyboard,
      }
    );
  });

  bot.action('menu_stats', async (ctx) => {
    await ctx.answerCbQuery('Mengambil data stats...');
    const telegramId = ctx.from?.id;
    const firstName = ctx.from?.first_name ?? 'Bro';

    if (!telegramId) return;

    try {
      const [latestWeightLog, weeklyWorkouts, totalWorkouts, weightProgress] = await Promise.all([
        getLatestWeight(telegramId),
        getWorkoutsThisWeek(telegramId),
        getTotalWorkouts(telegramId),
        getWeightProgress(telegramId),
      ]);

      const weightDisplay = latestWeightLog
        ? `⚖️ *Berat Terakhir:* ${latestWeightLog.weight} kg`
        : `⚖️ *Berat Terakhir:* Belum dicatat`;

      let progressLine = '';
      if (weightProgress.diff !== null) {
        if (weightProgress.trend === 'up') {
          progressLine = `   📈 Naik ${Math.abs(weightProgress.diff)} kg dari log sebelumnya`;
        } else if (weightProgress.trend === 'down') {
          progressLine = `   📉 Turun ${Math.abs(weightProgress.diff)} kg dari log sebelumnya`;
        } else {
          progressLine = `   ➡️ Berat stabil`;
        }
      }

      const weeklyRating =
        weeklyWorkouts === 0 ? '😴 Belum ada latihan minggu ini!'
        : weeklyWorkouts <= 2 ? '👣 Baru pemanasan nih...'
        : weeklyWorkouts <= 4 ? '💪 Minggu yang solid!'
        : weeklyWorkouts <= 6 ? '🔥 Lagi on fire!'
        : '🏆 MINGGU ELITE. Respect!';

      await editOrReply(
        ctx,
        `📊 *Statistik ${firstName}*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `${weightDisplay}\n` +
        `${progressLine}\n\n` +
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
      console.error('menu_stats callback error:', error);
      await editOrReply(
        ctx,
        '⚠️ Gagal memuat stats. Coba lagi.',
        backToMenuKeyboard
      );
    }
  });

  bot.action('menu_help', async (ctx) => {
  await ctx.answerCbQuery();
  await editOrReply(
    ctx,
    `❓ *Cara Pakai GymBot*\n\n` +

    `*🏋 Mulai Latihan*\n` +
    `Tap *Mulai Latihan* → pilih split (Push/Pull/Legs/dll)\n` +
    `→ pilih exercise → ketik set, contoh: \`80x6\`\n\n` +

    `*➕ Log Set*\n` +
    `Format input: \`[berat]x[reps]\`\n` +
    `Contoh: \`80x6\` • \`100x3\` • \`0x12\` _(bodyweight)_\n\n` +

    `*🔁 Repeat Set*\n` +
    `Tekan *Repeat* untuk simpan set yang sama lagi — tanpa ketik ulang.\n\n` +

    `*⚖️ Log Berat Badan*\n` +
    `Tap *Log Berat* → ketik angka, contoh: \`72.5\`\n\n` +

    `*📊 Stats*\n` +
    `Lihat berat badan, latihan minggu ini, dan total all-time.\n\n` +

    `*✅ Selesai Latihan*\n` +
    `Tap *Finish* saat latihan selesai → summary otomatis muncul.`,
    {
      parse_mode: 'Markdown',
      ...backToMenuKeyboard,
    }
  );
});

  // ==========================================
  // SESSION MENU CALLBACKS
  // ==========================================

  bot.action('session_start_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await editOrReply(
      ctx,
      `🏋️ *Mulai Session Baru*\n\n` +
      `Pilih split untuk hari ini:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🔥 Push', 'quick_session_push'),
            Markup.button.callback('💪 Pull', 'quick_session_pull'),
            Markup.button.callback('🦵 Legs', 'quick_session_legs'),
          ],
          [
            Markup.button.callback('📝 Tanpa Tag', 'quick_session_notag'),
          ],
          [
            Markup.button.callback('🏠 Menu Utama', 'menu_main'),
          ],
        ]),
      }
    );
  });

  // ============================================
  // FIX UTAMA: Hapus (ctx as any).message = ...
  //
  // Sebelumnya kode ini mencoba SET ctx.message
  // yang merupakan getter-only → langsung crash!
  //
  // Solusi: import sessionService langsung dan
  // panggil logic-nya tanpa fake message context
  // ============================================
  const quickSessions = ['push', 'pull', 'legs'];
  quickSessions.forEach((split) => {
    bot.action(`quick_session_${split}`, async (ctx) => {
      const telegramId = ctx.from?.id;
      const firstName = ctx.from?.first_name ?? 'Bro';

      if (!telegramId) {
        await ctx.answerCbQuery('❌ Tidak bisa mendeteksi akun kamu.');
        return;
      }

      await ctx.answerCbQuery(`Memulai sesi ${split}...`);

      try {
        // Import sessionService langsung — tidak perlu fake ctx.message
        const { startSession } = await import('../services/sessionService');
        const session = await startSession({ telegram_id: telegramId.toString(), split_name: split });

        await editOrReply(
          ctx,
          `🏋️ *Sesi ${split.toUpperCase()} Dimulai!*\n\n` +
          `Sekarang log exercise kamu:\n` +
          `\`/log bench press 60 8\`\n\n` +
          `Format: \`/log [nama exercise] [kg] [reps]\`\n\n` +
          `Ketik \`/done\` kalau sudah selesai. 💪`,
          {
            parse_mode: 'Markdown',
            ...backToMenuKeyboard,
          }
        );

        console.log(`✅ Quick session started: ${split} for user ${telegramId}, session ID: ${session.id}`);
      } catch (error) {
        console.error(`quick_session_${split} error:`, error);

        // Cek kalau error-nya karena sudah ada active session
        const errMsg = (error as Error).message ?? '';
        if (errMsg.includes('active session')) {
          await editOrReply(
            ctx,
            `⚠️ *Kamu masih punya sesi aktif!*\n\n` +
            `Selesaikan dulu dengan \`/done\`\n` +
            `atau cek status dengan \`/session status\``,
            {
              parse_mode: 'Markdown',
              ...backToMenuKeyboard,
            }
          );
        } else {
          await editOrReply(
            ctx,
            `⚠️ Gagal memulai sesi. Coba lagi.`,
            backToMenuKeyboard
          );
        }
      }
    });
  });

  bot.action('quick_session_notag', async (ctx) => {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCbQuery('❌ Tidak bisa mendeteksi akun kamu.');
      return;
    }

    await ctx.answerCbQuery('Memulai sesi...');

    try {
      const { startSession } = await import('../services/sessionService');
      await startSession({ telegram_id: telegramId.toString() });

      await editOrReply(
        ctx,
        `🏋️ *Sesi Latihan Dimulai!*\n\n` +
        `Sekarang log exercise kamu:\n` +
        `\`/log bench press 60 8\`\n\n` +
        `Format: \`/log [nama exercise] [kg] [reps]\`\n\n` +
        `Ketik \`/done\` kalau sudah selesai. 💪`,
        {
          parse_mode: 'Markdown',
          ...backToMenuKeyboard,
        }
      );
    } catch (error) {
      console.error('quick_session_notag error:', error);
      const errMsg = (error as Error).message ?? '';
      if (errMsg.includes('active session')) {
        await editOrReply(
          ctx,
          `⚠️ *Kamu masih punya sesi aktif!*\n\n` +
          `Selesaikan dulu dengan \`/done\``,
          {
            parse_mode: 'Markdown',
            ...backToMenuKeyboard,
          }
        );
      } else {
        await editOrReply(ctx, `⚠️ Gagal memulai sesi. Coba lagi.`, backToMenuKeyboard);
      }
    }
  });

  bot.action('exercises_menu', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await handleExercises(ctx);
    } catch (error) {
      console.error('exercises_menu error:', error);
      await editOrReply(ctx, '⚠️ Gagal memuat daftar exercise.', backToMenuKeyboard);
    }
  });

  // ==========================================
  // WORKOUT QUICK-LOG (sistem lama)
  // Tetap aktif untuk backward compatibility
  // ==========================================

  const workoutTypes = [
    'push', 'pull', 'legs', 'cardio',
    'hiit', 'core', 'chest', 'back',
    'shoulders', 'rest', 'mobility'
  ];

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
  };

  workoutTypes.forEach((type) => {
    bot.action(`workout_${type}`, async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) return;

      await ctx.answerCbQuery('Mencatat workout...');

      try {
        await logWorkout(telegramId, type, null, null, null);

        const hype = workoutHype[type] ?? `🏋️ Sesi ${type.toUpperCase()} berhasil dicatat!`;

        await editOrReply(
          ctx,
          `✅ *Workout Tercatat!*\n\n` +
          `${hype}\n\n` +
          `_Mulai pakai sistem baru: /session start_`,
          {
            parse_mode: 'Markdown',
            ...backToMenuKeyboard,
          }
        );
      } catch (error) {
        console.error(`workout_${type} callback error:`, error);
        // answerCbQuery kedua tidak bisa, pakai reply biasa
        await ctx.reply('❌ Gagal mencatat workout. Coba lagi.');
      }
    });
  });
}