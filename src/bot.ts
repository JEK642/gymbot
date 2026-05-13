// bot.ts
// File ini hanya di-UPDATE — tambahkan import & registrasi baru
// Jangan hapus command lama (/weight, /workout, /stats)

import { Telegraf } from 'telegraf';
import { startCommand } from './commands/start';
import { weightCommand } from './commands/weight';
import { workoutCommand } from './commands/workout';    // sistem lama, tetap
import { statsCommand } from './commands/stats';
import { registerCallbackHandlers } from './handlers/callbackHandler';

// ── IMPORT BARU ──────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────

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

// /session start [split] — mulai session baru
// /session status — lihat session aktif
bot.command('session', async (ctx) => {
  const text = (ctx.message as any)?.text ?? '';
  const subcommand = text.trim().split(/\s+/)[1]?.toLowerCase();

  if (subcommand === 'start') {
    await handleSessionStart(ctx);
  } else if (subcommand === 'status') {
    await handleSessionStatus(ctx);
  } else {
    // Default: tampilkan status kalau tidak ada subcommand
    await handleSessionStatus(ctx);
  }
});

// /log bench press 60 8 — log set exercise
bot.command('log', handleLog);

// /done — selesaikan session
bot.command('done', handleDone);

// /exercises — browse daftar exercise
bot.command('exercises', handleExercises);

// ============================================================
// CALLBACK HANDLERS LAMA
// ============================================================
registerCallbackHandlers(bot);

// ============================================================
// CALLBACK HANDLERS BARU
// Kenapa pakai bot.action() bukan digabung ke handleCallbacks?
// Lebih eksplisit dan mudah di-debug per fitur
// ============================================================

// Session lifecycle callbacks
bot.action('session_confirm_done', callbackConfirmDone);
bot.action('session_continue', callbackContinue);
bot.action('session_status', callbackSessionStatus);
bot.action('session_cancel', callbackCancelSession);

// Exercise filter callbacks
bot.action('ex_filter_barbell', (ctx) => callbackExerciseFilter(ctx, 'barbell'));
bot.action('ex_filter_dumbbell', (ctx) => callbackExerciseFilter(ctx, 'dumbbell'));
bot.action('ex_filter_machine', (ctx) => callbackExerciseFilter(ctx, 'machine'));
bot.action('ex_filter_bodyweight', (ctx) => callbackExerciseFilter(ctx, 'bodyweight'));
bot.action('ex_list_all', callbackExerciseListAll);

// Tambahkan SEBELUM bot.launch()
bot.catch((err, ctx) => {
  console.error(`❌ Error pada update ${ctx.updateType}:`, err);
});
// ============================================================
// LAUNCH
// ============================================================
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;