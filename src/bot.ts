// bot.ts — FIX: anti konflik 409 (double instance)
import { Telegraf } from 'telegraf';
import { startCommand } from './commands/start';
import { weightCommand } from './commands/weight';
import { workoutCommand } from './commands/workout';
import { statsCommand } from './commands/stats';
import { registerCallbackHandlers } from './handlers/callbackHandler';

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
// COMMANDS LAMA — jangan diubah
// ============================================================
bot.start(startCommand);
bot.command('weight', weightCommand);
bot.command('workout', workoutCommand);
bot.command('stats', statsCommand);

// ============================================================
// COMMANDS BARU
// ============================================================
bot.command('session', async (ctx) => {
  const text = (ctx.message as any)?.text ?? '';
  const subcommand = text.trim().split(/\s+/)[1]?.toLowerCase();

  if (subcommand === 'start') {
    await handleSessionStart(ctx);
  } else if (subcommand === 'status') {
    await handleSessionStatus(ctx);
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
// CALLBACK HANDLERS BARU
// ============================================================
bot.action('session_confirm_done', callbackConfirmDone);
bot.action('session_continue', callbackContinue);
bot.action('session_status', callbackSessionStatus);
bot.action('session_cancel', callbackCancelSession);

bot.action('ex_filter_barbell', (ctx) => callbackExerciseFilter(ctx, 'barbell'));
bot.action('ex_filter_dumbbell', (ctx) => callbackExerciseFilter(ctx, 'dumbbell'));
bot.action('ex_filter_machine', (ctx) => callbackExerciseFilter(ctx, 'machine'));
bot.action('ex_filter_bodyweight', (ctx) => callbackExerciseFilter(ctx, 'bodyweight'));
bot.action('ex_list_all', callbackExerciseListAll);

// ============================================================
// ✅ FIX: Global error handler — tangkap silent error
// Tambahkan SEBELUM bot.launch()
// ============================================================
bot.catch((err: unknown, ctx) => {
  console.error(`❌ Global bot error - update: ${ctx.updateType}`);
  console.error(err);
});

// ============================================================
// LAUNCH — dengan proteksi anti konflik 409
// ✅ FIX: deleteWebhook dulu sebelum polling dimulai
//         drop_pending_updates: true → buang update dari instance lama
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