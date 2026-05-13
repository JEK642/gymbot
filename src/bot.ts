import { Telegraf } from 'telegraf';
import { startCommand } from './commands/start';
import { weightCommand } from './commands/weight';
import { workoutCommand } from './commands/workout';
import { statsCommand } from './commands/stats';
import { registerCallbackHandlers } from './handlers/callbackHandler';
import { confirmDoneKeyboard } from './keyboards/sessionMenu';

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

const bot = new Telegraf(process.env.BOT_TOKEN!);

// ============================================================
// COMMANDS
// ============================================================
bot.start(startCommand);
bot.command('weight', weightCommand);
bot.command('workout', workoutCommand); // ⚠️ Deprecated — lihat workout.ts
bot.command('stats', statsCommand);

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
// CALLBACK HANDLERS LAMA
// ============================================================
registerCallbackHandlers(bot);

// ============================================================
// CALLBACK HANDLERS BARU — Session
// ============================================================
bot.action('session_confirm_done', callbackConfirmDone);
bot.action('session_continue', callbackContinue);
bot.action('session_status', callbackSessionStatus);
bot.action('session_cancel', callbackCancelSession);

// ✅ FIX: session_done sekarang terdaftar
// Tombol "✅ Selesai" di sessionMenu.ts sekarang berfungsi
// Fungsinya: tampilkan konfirmasi sebelum finalize session
bot.action('session_done', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `⚠️ *Yakin mau selesaikan session ini?*\n\n` +
    `Semua set yang sudah di-log akan tersimpan.`,
    {
      parse_mode: 'Markdown',
      ...confirmDoneKeyboard,
    }
  );
});

// ============================================================
// CALLBACK HANDLERS BARU — Exercise
// ============================================================
bot.action('ex_filter_barbell', (ctx) => callbackExerciseFilter(ctx, 'barbell'));
bot.action('ex_filter_dumbbell', (ctx) => callbackExerciseFilter(ctx, 'dumbbell'));
bot.action('ex_filter_machine', (ctx) => callbackExerciseFilter(ctx, 'machine'));
bot.action('ex_filter_bodyweight', (ctx) => callbackExerciseFilter(ctx, 'bodyweight'));
bot.action('ex_list_all', callbackExerciseListAll);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
bot.catch((err: unknown, ctx) => {
  console.error(`❌ Global bot error - update: ${ctx.updateType}`);
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