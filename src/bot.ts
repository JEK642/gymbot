import { Telegraf } from 'telegraf';
import { startCommand } from './commands/start';
import { weightCommand } from './commands/weight';
import { workoutCommand } from './commands/workout';
import { statsCommand } from './commands/stats';
import { registerCallbackHandlers } from './handlers/callbackHandler';
import { confirmDoneKeyboard } from './keyboards/sessionMenu';
import { registerExerciseManageHandlers } from './handlers/exerciseManageHandler';


// ── Session commands (sistem lama) ───────────
import {
  handleSessionStart,
  handleSessionStatus,
  handleDone,
  callbackConfirmDone,
  callbackContinue,
  callbackSessionStatus,
  callbackCancelSession,
} from './commands/session';

import { handleLog } from './commands/log';

import {
  handleExercises,
  callbackExerciseFilter,
  callbackExerciseListAll,
} from './commands/exercise';

// ── NEW: Tap-based workout flow ───────────────
import { registerWorkoutFlowHandlers } from './handlers/workoutFlowHandler';
import { handleTextInput } from './handlers/textInputHandler';

const bot = new Telegraf(process.env.BOT_TOKEN!);

// ============================================================
// COMMANDS
// ============================================================
bot.start(startCommand);
bot.command('weight', weightCommand);
bot.command('workout', workoutCommand);     // ⚠️ sistem lama, tetap aktif
bot.command('stats', statsCommand);

// /session start | /session status
bot.command('session', async (ctx) => {
  const text = (ctx.message as any)?.text ?? '';
  const subcommand = text.trim().split(/\s+/)[1]?.toLowerCase();

  if (subcommand === 'start') {
    await handleSessionStart(ctx);
  } else {
    await handleSessionStatus(ctx);
  }
});

bot.command('log', handleLog);
bot.command('done', handleDone);
bot.command('exercises', handleExercises);

// ============================================================
// CALLBACK HANDLERS
// Urutan penting: spesifik dulu, baru general
// ============================================================

// ── 1. Sistem lama (workout_logs) ────────────
registerCallbackHandlers(bot);

// ── 2. Session callbacks (sistem lama) ───────
bot.action('session_confirm_done', callbackConfirmDone);
bot.action('session_continue', callbackContinue);
bot.action('session_status', callbackSessionStatus);
bot.action('session_cancel', callbackCancelSession);

// Tombol "✅ Selesai" di sessionMenu — tampilkan konfirmasi dulu
bot.action('session_done', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(
      `⚠️ *Yakin mau selesaikan session ini?*\n\n` +
      `Semua set yang sudah di-log akan tersimpan.`,
      {
        parse_mode: 'Markdown',
        ...confirmDoneKeyboard,
      }
    );
  } catch {
    await ctx.reply(
      `⚠️ *Yakin mau selesaikan session ini?*\n\n` +
      `Semua set yang sudah di-log akan tersimpan.`,
      {
        parse_mode: 'Markdown',
        ...confirmDoneKeyboard,
      }
    );
  }
});

// ── 3. Exercise callbacks ─────────────────────
bot.action('ex_filter_barbell',    (ctx) => callbackExerciseFilter(ctx, 'barbell'));
bot.action('ex_filter_dumbbell',   (ctx) => callbackExerciseFilter(ctx, 'dumbbell'));
bot.action('ex_filter_machine',    (ctx) => callbackExerciseFilter(ctx, 'machine'));
bot.action('ex_filter_bodyweight', (ctx) => callbackExerciseFilter(ctx, 'bodyweight'));
bot.action('ex_list_all', callbackExerciseListAll);

// ── 4. NEW: Tap-based workout flow ────────────
// Didaftarkan SETELAH callbacks lama supaya tidak konflik
registerWorkoutFlowHandlers(bot);
registerExerciseManageHandlers(bot);

// ============================================================
// TEXT HANDLER
// ============================================================
// URUTAN SANGAT PENTING:
// 1. Cek dulu apakah user sedang dalam workout flow
//    (menunggu input berat atau reps)
// 2. Kalau iya → proses angka yang diketik
// 3. Kalau tidak → tampilkan pesan default
bot.on('text', async (ctx) => {
  // Skip kalau ini adalah command
  const text = (ctx.message as any)?.text ?? '';
  if (text.startsWith('/')) return;

  // Coba handle sebagai workout flow input (berat/reps)
  const handled = await handleTextInput(ctx);
  if (handled) return;

  // Default: user kirim teks sembarangan
  await ctx.reply(`🤖 Ketik /start untuk lihat menu.`);
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
bot.catch((err: unknown, ctx) => {
  console.error(`❌ Global bot error — update: ${ctx.updateType}`);
  console.error(err);
});

// ============================================================
// LAUNCH
// ============================================================
async function startBot() {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('✅ Webhook cleared, starting bot...');
    bot.launch();
    console.log('🚀 Bot launched successfully!');
  } catch (err) {
    console.error('❌ Failed to start bot:', err);
    process.exit(1);
  }
}

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;