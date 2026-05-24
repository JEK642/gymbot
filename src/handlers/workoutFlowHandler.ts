// src/handlers/workoutFlowHandler.ts
import { Telegraf } from 'telegraf';
import {
  getFlowState,
  setFlowState,
  updateFlowState,
  clearFlowState,
} from '../state/userFlowState';
import {
  splitKeyboard,
  buildExerciseKeyboard,
  setLoggedKeyboard,
  activeSessionKeyboard,
  cancelKeyboard,
  cancelOnlyKeyboard,
} from '../keyboards/workoutFlow';
import { supabase } from '../config/supabase';
import { parseSetInput } from '../utils/parseSetInput';

// ============================================
// Helper: edit atau fallback ke reply baru
// ============================================
async function editOrReply(ctx: any, text: string, extra?: object): Promise<void> {
  try {
    await ctx.editMessageText(text, extra);
  } catch {
    const sent = await ctx.reply(text, extra);
    if (sent?.message_id && ctx.from?.id) {
      updateFlowState(ctx.from.id, { flowMessageId: sent.message_id });
    }
  }
}

// ============================================
// PHASE 2: getSessionHeader
// Satu baris ringkas — ditempel di atas prompt utama.
// Contoh: "📊 PUSH • 2 EX • 5 SETS"
// ============================================
async function getSessionHeader(
  sessionId: string,
  splitName: string
): Promise<string> {
  const [{ count: exCount }, { count: setCount }] = await Promise.all([
    supabase
      .from('session_exercises')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId),
    supabase
      .from('exercise_sets')
      .select('session_exercises!inner(session_id)', { count: 'exact', head: true })
      .eq('session_exercises.session_id', sessionId),
  ]);

  const label = splitName.replace(/_/g, ' ').toUpperCase();
  return `📊 ${label} • ${exCount ?? 0} EX • ${setCount ?? 0} SETS`;
}

// ============================================
// PHASE 2: buildSetPrompt
// Set 1  → tampilkan format hint (sekali saja)
// Set 2+ → hanya nama + nomor set, no clutter
// ============================================
function buildSetPrompt(
  exerciseName: string,
  setNumber: number,
  sessionHeader: string
): string {
  const hint = setNumber === 1 ? `\n\`80x6\`` : '';
  return `_${sessionHeader}_\n\n🏋 *${exerciseName}* • Set ${setNumber}${hint}`;
}

// ============================================
// getExercisesForSplit — tidak berubah
// ============================================
async function getExercisesForSplit(
  splitName: string,
  telegramId: number
): Promise<{ defaultExercises: any[]; customExercises: any[] }> {
  const splitDefaults: Record<string, string[]> = {
    push: [
      'Barbell Bench Press',
      'Incline Dumbbell Press',
      'Push-up',
      'Dumbbell Shoulder Press',
      'Tricep Pushdown',
    ],
    pull: [
      'Pull-up',
      'Lat Pulldown',
      'Barbell Row',
      'Dumbbell Curl',
      'Face Pull',
    ],
    legs: [
      'Barbell Squat',
      'Leg Press',
      'Romanian Deadlift',
      'Leg Curl',
      'Standing Calf Raise',
    ],
    upper: [
      'Barbell Bench Press',
      'Barbell Row',
      'Dumbbell Shoulder Press',
      'Pull-up',
      'Dumbbell Curl',
    ],
    lower: [
      'Barbell Squat',
      'Conventional Deadlift',
      'Romanian Deadlift',
      'Leg Press',
      'Hip Thrust',
    ],
    full_body: [
      'Conventional Deadlift',
      'Barbell Squat',
      'Barbell Bench Press',
      'Barbell Row',
      'Dumbbell Shoulder Press',
    ],
    general: [
      'Barbell Bench Press',
      'Barbell Squat',
      'Conventional Deadlift',
      'Pull-up',
      'Dumbbell Shoulder Press',
    ],
  };

  const names = splitDefaults[splitName] ?? splitDefaults.general;

  const { data: defaultData } = await supabase
    .from('exercises')
    .select('id, name')
    .in('name', names)
    .eq('is_active', true);

  const defaultExercises = names
    .map(name => defaultData?.find(ex => ex.name === name))
    .filter(Boolean) as any[];

  const { data: customData } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('created_by', telegramId)
    .eq('is_default', false)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return { defaultExercises, customExercises: customData ?? [] };
}

// ============================================
// logSetToDatabase — tidak berubah
// ============================================
async function logSetToDatabase(
  sessionId: string,
  exerciseId: string,
  weight: number,
  reps: number,
  setNumber: number
): Promise<string> {
  let { data: existingSE } = await supabase
    .from('session_exercises')
    .select('id')
    .eq('session_id', sessionId)
    .eq('exercise_id', exerciseId)
    .single();

  let sessionExerciseId: string;

  if (existingSE) {
    sessionExerciseId = existingSE.id;
  } else {
    const { count } = await supabase
      .from('session_exercises')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    const { data: newSE, error } = await supabase
      .from('session_exercises')
      .insert({
        session_id: sessionId,
        exercise_id: exerciseId,
        exercise_order: (count ?? 0) + 1,
      })
      .select('id')
      .single();

    if (error || !newSE) throw new Error('Gagal membuat session exercise');
    sessionExerciseId = newSE.id;
  }

  const { error: setError } = await supabase
    .from('exercise_sets')
    .insert({
      session_exercise_id: sessionExerciseId,
      set_number: setNumber,
      weight_kg: weight,
      reps: reps,
      set_type: 'working',
    });

  if (setError) throw new Error(`Gagal menyimpan set: ${setError.message}`);
  return sessionExerciseId;
}

// ============================================
// checkAndUpdatePR — tidak berubah
// ============================================
async function checkAndUpdatePR(
  telegramId: number,
  exerciseId: string,
  sessionId: string,
  weight: number,
  reps: number
): Promise<boolean> {
  const estimated1RM = weight * (1 + reps / 30);

  const { data: currentPR } = await supabase
    .from('personal_records')
    .select('estimated_1rm')
    .eq('telegram_id', telegramId)
    .eq('exercise_id', exerciseId)
    .order('estimated_1rm', { ascending: false })
    .limit(1)
    .single();

  const isPR = !currentPR || estimated1RM > (currentPR.estimated_1rm ?? 0);

  if (isPR) {
    await supabase.from('personal_records').insert({
      telegram_id: telegramId,
      exercise_id: exerciseId,
      session_id: sessionId,
      weight_kg: weight,
      reps: reps,
      estimated_1rm: Number(estimated1RM.toFixed(2)),
      achieved_at: new Date().toISOString(),
    });
  }

  return isPR;
}

// ============================================
// getNextSetNumber — tidak berubah
// ============================================
async function getNextSetNumber(sessionExerciseId: string): Promise<number> {
  const { count } = await supabase
    .from('exercise_sets')
    .select('*', { count: 'exact', head: true })
    .eq('session_exercise_id', sessionExerciseId);
  return (count ?? 0) + 1;
}

// ============================================
// PHASE 2: processSetInput
// Success card jauh lebih kompak dari Phase 1.
//   ✅ *Bench Press*
//   80 × 6 • Set 1 🏆
// ============================================
export async function processSetInput(
  ctx: any,
  weight: number,
  reps: number
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const state = getFlowState(telegramId);

  if (!state.sessionId || !state.exerciseId || !state.exerciseName) {
    await ctx.reply('⚠️ Session tidak ditemukan. Ketik /start untuk mulai.');
    clearFlowState(telegramId);
    return;
  }

  try {
    const setNumber = state.currentSetNumber ?? 1;

    const sessionExerciseId = await logSetToDatabase(
      state.sessionId,
      state.exerciseId,
      weight,
      reps,
      setNumber
    );

    const isPR = await checkAndUpdatePR(
      telegramId,
      state.exerciseId,
      state.sessionId,
      weight,
      reps
    );

    const nextSetNumber = await getNextSetNumber(sessionExerciseId);

    updateFlowState(telegramId, {
      step: 'set_logged',
      sessionExerciseId,
      currentSetNumber: nextSetNumber,
    });

    // PHASE 2: compact success card — 2 baris, tidak ada kalimat panjang
    const prBadge = isPR ? ` 🏆` : '';
    await editOrReply(
      ctx,
      `✅ *${state.exerciseName}*\n${weight} × ${reps} • Set ${setNumber}${prBadge}`,
      { parse_mode: 'Markdown', ...setLoggedKeyboard }
    );

  } catch (error) {
    console.error('processSetInput error:', error);
    await ctx.reply('⚠️ Gagal menyimpan set. Coba lagi.');
  }
}

// ============================================
// showExerciseSelection
// PHASE 2: sertakan session header di atas daftar exercise
// ============================================
async function showExerciseSelection(
  ctx: any,
  telegramId: number,
  splitName: string,
  label: string,
  sessionId?: string
) {
  const { defaultExercises, customExercises } = await getExercisesForSplit(
    splitName,
    telegramId
  );

  if (defaultExercises.length === 0 && customExercises.length === 0) {
    await editOrReply(
      ctx,
      `⚠️ Belum ada exercise.\n\nTap ⚙️ Kelola untuk tambah.`,
      cancelKeyboard
    );
    return;
  }

  // Session header kalau sudah ada sesi aktif
  let headerLine = '';
  if (sessionId) {
    const h = await getSessionHeader(sessionId, splitName);
    headerLine = `_${h}_\n\n`;
  }

  await editOrReply(
    ctx,
    `${headerLine}🏋 *${label}*\n_⭐ = exercise kamu_`,
    {
      parse_mode: 'Markdown',
      ...buildExerciseKeyboard(defaultExercises, customExercises, splitName),
    }
  );
}

// ============================================
// REGISTER HANDLERS
// ============================================
export function registerWorkoutFlowHandlers(bot: Telegraf): void {

  // ── wf_start ────────────────────────────────
  bot.action('wf_start', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const { data: activeSession } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('telegram_id', telegramId)
      .eq('status', 'in_progress')
      .single();

    if (activeSession) {
      await editOrReply(
        ctx,
        `⚡ *Sesi Aktif*\n\nLanjut atau selesaikan dulu?`,
        { parse_mode: 'Markdown', ...activeSessionKeyboard }
      );
      return;
    }

    setFlowState(telegramId, { step: 'selecting_split' });
    await editOrReply(
      ctx,
      `🏋 *Pilih Split*`,
      { parse_mode: 'Markdown', ...splitKeyboard }
    );
  });

  // ── wf_split:{name} ─────────────────────────
  bot.action(/^wf_split:/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const splitName = ((ctx.callbackQuery as any).data as string).replace('wf_split:', '');

    try {
      let splitId: string | null = null;
      if (splitName !== 'general') {
        const { data: split } = await supabase
          .from('splits')
          .select('id')
          .ilike('name', splitName.replace('_', ' '))
          .single();
        splitId = split?.id ?? null;
      }

      const { data: session, error } = await supabase
        .from('workout_sessions')
        .insert({
          telegram_id: telegramId,
          split_id: splitId,
          status: 'in_progress',
          name: `${splitName.toUpperCase()} — ${new Date().toLocaleDateString('id-ID')}`,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error || !session) throw new Error('Gagal membuat sesi');

      setFlowState(telegramId, {
        step: 'selecting_exercise',
        sessionId: session.id,
        splitName,
      });

      const splitLabel = splitName.replace('_', ' ').toUpperCase();
      // session baru → 0 EX, 0 SETS, header tetap ditampilkan
      await showExerciseSelection(ctx, telegramId, splitName, splitLabel, session.id);

    } catch (error) {
      console.error('wf_split error:', error);
      await ctx.reply('⚠️ Gagal memulai sesi. Coba lagi.');
    }
  });

  // ── wf_ex:{id} ──────────────────────────────
  bot.action(/^wf_ex:/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const exerciseId = ((ctx.callbackQuery as any).data as string).replace('wf_ex:', '');

    const { data: exercise } = await supabase
      .from('exercises')
      .select('id, name')
      .eq('id', exerciseId)
      .single();

    if (!exercise) {
      await ctx.reply('⚠️ Exercise tidak ditemukan.');
      return;
    }

    const state = getFlowState(telegramId);

    updateFlowState(telegramId, {
      step: 'entering_set',
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      currentSetNumber: 1,
    });

    // Session header untuk konteks
    const header = state.sessionId
      ? await getSessionHeader(state.sessionId, state.splitName ?? 'general')
      : '';

    await editOrReply(
      ctx,
      buildSetPrompt(exercise.name, 1, header),
      { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
    );
  });

  // ── wf_addset ───────────────────────────────
  bot.action('wf_addset', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const state = getFlowState(telegramId);
    if (!state.exerciseName) {
      await ctx.reply('⚠️ Session tidak ditemukan. Ketik /start.');
      return;
    }

    updateFlowState(telegramId, { step: 'entering_set' });

    const header = state.sessionId
      ? await getSessionHeader(state.sessionId, state.splitName ?? 'general')
      : '';

    await editOrReply(
      ctx,
      // Set 2+ tidak perlu hint format lagi
      buildSetPrompt(state.exerciseName, state.currentSetNumber ?? 2, header),
      { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
    );
  });

  // ── wf_newex ────────────────────────────────
  bot.action('wf_newex', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const state = getFlowState(telegramId);
    if (!state.sessionId || !state.splitName) {
      await ctx.reply('⚠️ Session tidak aktif. Ketik /start.');
      return;
    }

    updateFlowState(telegramId, {
      step: 'selecting_exercise',
      exerciseId: undefined,
      exerciseName: undefined,
      sessionExerciseId: undefined,
      currentSetNumber: 1,
    });

    const splitLabel = state.splitName.replace('_', ' ').toUpperCase();
    await showExerciseSelection(ctx, telegramId, state.splitName, splitLabel, state.sessionId);
  });

  // ── wf_finish ───────────────────────────────
  bot.action('wf_finish', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const state = getFlowState(telegramId);
    if (!state.sessionId) {
      await ctx.reply('⚠️ Tidak ada sesi aktif.');
      return;
    }

    try {
      const finishedAt = new Date();

      const { data: session } = await supabase
        .from('workout_sessions')
        .update({ status: 'completed', finished_at: finishedAt.toISOString() })
        .eq('id', state.sessionId)
        .select('started_at')
        .single();

      let durationText = '';
      if (session?.started_at) {
        const durationMin = Math.round(
          (finishedAt.getTime() - new Date(session.started_at).getTime()) / 60000
        );
        durationText = `⏱ ${durationMin} mnt  `;
        await supabase
          .from('workout_sessions')
          .update({ duration_minutes: durationMin })
          .eq('id', state.sessionId);
      }

      const { count: totalSets } = await supabase
        .from('exercise_sets')
        .select('session_exercises!inner(session_id)', { count: 'exact', head: true })
        .eq('session_exercises.session_id', state.sessionId);

      const { count: totalExercises } = await supabase
        .from('session_exercises')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', state.sessionId);

      clearFlowState(telegramId);

      const splitLabel = state.splitName?.replace('_', ' ').toUpperCase() ?? 'WORKOUT';

      // PHASE 2: ringkas — tidak ada kalimat panjang, satu baris per data
      await editOrReply(
        ctx,
        `🏁 *${splitLabel} Selesai!*\n\n` +
        `${durationText}🏋 ${totalExercises ?? 0} EX  💪 ${totalSets ?? 0} SETS\n\n` +
        `_Recover. Comeback stronger._ 🔥`,
        { parse_mode: 'Markdown', ...require('../keyboards/mainMenu').mainMenuKeyboard }
      );
    } catch (error) {
      console.error('wf_finish error:', error);
      await ctx.reply('⚠️ Gagal menyelesaikan sesi. Coba lagi.');
    }
  });

  // ── wf_cancel ───────────────────────────────
  bot.action('wf_cancel', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const state = getFlowState(telegramId);

    if (state.sessionId && state.splitName) {
      updateFlowState(telegramId, {
        step: 'selecting_exercise',
        exerciseId: undefined,
        exerciseName: undefined,
      });
      const splitLabel = state.splitName.replace('_', ' ').toUpperCase();
      await showExerciseSelection(ctx, telegramId, state.splitName, splitLabel, state.sessionId);
    } else {
      clearFlowState(telegramId);
      await editOrReply(ctx, `🏠`, require('../keyboards/mainMenu').mainMenuKeyboard);
    }
  });

  // ── wf_status ───────────────────────────────
  bot.action('wf_status', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const { data: session } = await supabase
      .from('workout_sessions')
      .select(`
        id, started_at,
        splits(name),
        session_exercises(
          id, exercise_order,
          exercises(name),
          exercise_sets(set_number, weight_kg, reps)
        )
      `)
      .eq('telegram_id', telegramId)
      .eq('status', 'in_progress')
      .single();

    if (!session) {
      await editOrReply(ctx, '⚠️ Tidak ada sesi aktif.', require('../keyboards/mainMenu').mainMenuKeyboard);
      return;
    }

    const elapsed = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);
    const splitName = (session.splits as any)?.name ?? 'General';

    // PHASE 2: compact status — tidak ada header panjang
    let text = `📊 *${splitName.toUpperCase()}* • ${elapsed} mnt\n\n`;

    const exercises = (session.session_exercises as any[]) ?? [];
    if (exercises.length === 0) {
      text += `_Belum ada set._`;
    } else {
      exercises
        .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
        .forEach((se: any) => {
          text += `🏋 *${se.exercises?.name}*\n`;
          (se.exercise_sets as any[]).forEach((s: any) => {
            text += `  ${s.set_number}. ${s.weight_kg} × ${s.reps}\n`;
          });
        });
    }

    await editOrReply(ctx, text, { parse_mode: 'Markdown', ...activeSessionKeyboard });
  });

  // ── wf_cancel_session & confirm ─────────────
  bot.action('wf_cancel_session', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const { Markup } = require('telegraf');
    await editOrReply(
      ctx,
      `⚠️ *Batalkan sesi?*\n_Data yang dilog akan dihapus._`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Ya', 'wf_confirm_cancel'),
            Markup.button.callback('❌ Tidak', 'wf_status'),
          ],
        ]),
      }
    );
  });

  bot.action('wf_confirm_cancel', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    await supabase
      .from('workout_sessions')
      .update({ status: 'cancelled' })
      .eq('telegram_id', telegramId)
      .eq('status', 'in_progress');

    clearFlowState(telegramId);
    await editOrReply(ctx, `🗑 Sesi dibatalkan.`, require('../keyboards/mainMenu').mainMenuKeyboard);
  });

  // ── wf_add_split ────────────────────────────
  bot.action('wf_add_split', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    updateFlowState(telegramId, { step: 'entering_custom_split' });
    await editOrReply(
      ctx,
      `➕ *Split Baru*\n\n_Ketik nama split:_`,
      { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
    );
  });
}

export { showExerciseSelection, getExercisesForSplit };