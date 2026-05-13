import { Telegraf, Markup } from 'telegraf';
import { mainMenuKeyboard, workoutTypeKeyboard, backToMenuKeyboard } from '../keyboards/mainMenu';
import { logWorkout } from '../services/workoutService';
import { getLatestWeight } from '../services/weightService';
import { getWorkoutsThisWeek, getTotalWorkouts } from '../services/workoutService';
import { getWeightProgress } from '../services/weightService';

// ============================================
// PENJELASAN: Callback Handler
//
// Setiap kali user klik inline button, Telegram
// kirim "callback_query" ke bot dengan data string
// yang kita set di Markup.button.callback('label', 'DATA_INI')
//
// Di sini kita handle semua kemungkinan data tersebut.
// Struktur: bot.action('callback_data', handler)
// ============================================

export function registerCallbackHandlers(bot: Telegraf): void {

  // ==========================================
  // MENU NAVIGATION CALLBACKS
  // ==========================================

  // Klik tombol "Menu Utama" — tampilkan kembali main menu
  bot.action('menu_main', async (ctx) => {
    const firstName = ctx.from?.first_name ?? 'Bro';
    // answerCbQuery() = wajib dipanggil untuk hilangkan loading state button
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `🏠 *Menu Utama — ${firstName}*\n\n` +
      `Mau ngapain sekarang?`,
      {
        parse_mode: 'Markdown',
        ...mainMenuKeyboard,
      }
    );
  });

  // Klik tombol "Log Berat"
  bot.action('menu_weight', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `⚖️ *Log Berat Badan*\n\n` +
      `Kirim perintah ini di chat:\n\n` +
      `\`/weight 72.5\`\n\n` +
      `_Ganti 72.5 dengan berat kamu sekarang._`,
      {
        parse_mode: 'Markdown',
        ...backToMenuKeyboard,
      }
    );
  });

  // Klik tombol "Log Workout" — tampilkan pilihan tipe workout
  bot.action('menu_workout', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `🏋️ *Pilih Tipe Workout Hari Ini*\n\n` +
      `Tap salah satu untuk langsung mencatat!\n\n` +
      `_Atau ketik \`/workout push 60 high\` untuk data lebih lengkap._`,
      {
        parse_mode: 'Markdown',
        ...workoutTypeKeyboard,
      }
    );
  });

  // Klik tombol "Lihat Stats"
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

      // Weight progress indicator
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

      await ctx.editMessageText(
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
      await ctx.editMessageText(
        '⚠️ Gagal memuat stats. Coba lagi.',
        backToMenuKeyboard
      );
    }
  });

  // Klik tombol "Bantuan"
  bot.action('menu_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `❓ *Cara Pakai GymBot*\n\n` +
      `*Perintah dasar:*\n` +
      `⚖️ \`/weight 72.5\` — Log berat badan\n` +
      `🏋️ \`/workout push\` — Log workout\n` +
      `📊 \`/stats\` — Lihat statistik\n\n` +
      `*Workout lengkap:*\n` +
      `\`/workout push 60 high latihan_bagus\`\n` +
      `Format: tipe • durasi(menit) • intensitas • catatan\n\n` +
      `*Level intensitas:*\n` +
      `• \`low\` — Ringan\n` +
      `• \`medium\` — Sedang\n` +
      `• \`high\` — Berat\n\n` +
      `_Semua field setelah tipe workout opsional!_`,
      {
        parse_mode: 'Markdown',
        ...backToMenuKeyboard,
      }
    );
  });

  // ============================================================
// TAMBAHKAN INI di dalam registerCallbackHandlers(bot) 
// di file src/handlers/callbackHandler.ts
// Taruh setelah handler 'menu_help' yang sudah ada
// ============================================================

  // Tombol "🏋️ Mulai Session" di main menu
  // Tampilkan pilihan split atau langsung start
  bot.action('session_start_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `🏋️ *Mulai Session Baru*\n\n` +
      `Pilih cara mulai:`,
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

  // Quick session start dari tombol split
  const quickSessions = ['push', 'pull', 'legs'];
  quickSessions.forEach((split) => {
    bot.action(`quick_session_${split}`, async (ctx) => {
      await ctx.answerCbQuery();
      // Simulasikan /session start [split] via handler langsung
      const { handleSessionStart } = await import('../commands/session');
      // Override ctx.message.text supaya handler bisa parse split_name
      (ctx as any).message = { text: `/session start ${split}` };
      await handleSessionStart(ctx);
    });
  });

  bot.action('quick_session_notag', async (ctx) => {
    await ctx.answerCbQuery();
    const { handleSessionStart } = await import('../commands/session');
    (ctx as any).message = { text: '/session start' };
    await handleSessionStart(ctx);
  });

  // Tombol "📋 Daftar Exercise" di main menu
  bot.action('exercises_menu', async (ctx) => {
    await ctx.answerCbQuery();
    const { handleExercises } = await import('../commands/exercise');
    await handleExercises(ctx);
  });

  // ==========================================
  // WORKOUT QUICK-LOG CALLBACKS
  // User klik tipe workout → langsung tercatat
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

  // Loop untuk register semua workout button callbacks
  // Daripada tulis satu-satu, kita loop workoutTypes array
  workoutTypes.forEach((type) => {
    bot.action(`workout_${type}`, async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) return;

      await ctx.answerCbQuery('Mencatat workout...');

      try {
        // Log workout tanpa duration/intensity/notes (dari button)
        await logWorkout(telegramId, type, null, null, null);

        const hype = workoutHype[type] ?? `🏋️ Sesi ${type.toUpperCase()} berhasil dicatat!`;

        await ctx.editMessageText(
          `✅ *Workout Tercatat!*\n\n` +
          `${hype}\n\n` +
          `_Gunakan \`/workout ${type} 60 high\` untuk tambah detail._`,
          {
            parse_mode: 'Markdown',
            ...backToMenuKeyboard,
          }
        );
      } catch (error) {
        console.error(`workout_${type} callback error:`, error);
        await ctx.answerCbQuery('❌ Gagal mencatat. Coba lagi.');
      }
    });
  });
}