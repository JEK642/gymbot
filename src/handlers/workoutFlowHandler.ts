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
  buildRepsKeyboard,
  setLoggedKeyboard,
  activeSessionKeyboard,
  cancelKeyboard,
  cancelOnlyKeyboard,
} from '../keyboards/workoutFlow';
import { supabase } from '../config/supabase';

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
// DIUPDATE: getExercisesForSplit()
//
// Sebelumnya: filter by movement_pattern
// Sekarang: filter by nama exercise langsung
// pakai .in('name', [...]) → lebih simple & predictable
// ============================================
async function getExercisesForSplit(splitName: string) {
  // Daftar exercise per split — hanya yang orang awam kenal
  const splitExercises: Record<string, string[]> = {
    push: [
      'Bench Press', 'Incline Bench Press', 'Push-up', 'Dips',
      'Shoulder Press', 'Lateral Raise', 'Tricep Pushdown', 'Skull Crusher',
    ],
    pull: [
      'Pull-up', 'Lat Pulldown', 'Barbell Row', 'Seated Cable Row',
      'Dumbbell Row', 'Bicep Curl', 'Hammer Curl', 'Face Pull',
    ],
    legs: [
      'Squat', 'Leg Press', 'Romanian Deadlift', 'Deadlift',
      'Leg Curl', 'Leg Extension', 'Hip Thrust', 'Calf Raise',
    ],
    upper: [
      'Bench Press', 'Shoulder Press', 'Pull-up', 'Barbell Row',
      'Lateral Raise', 'Bicep Curl', 'Tricep Pushdown', 'Face Pull',
    ],
    lower: [
      'Squat', 'Deadlift', 'Romanian Deadlift', 'Leg Press',
      'Hip Thrust', 'Leg Curl', 'Leg Extension', 'Calf Raise',
    ],
    full_body: [
      'Deadlift', 'Squat', 'Bench Press', 'Pull-up',
      'Shoulder Press', 'Barbell Row', 'Dips', 'Romanian Deadlift',
    ],
    general: [
      'Bench Press', 'Squat', 'Deadlift', 'Pull-up',
      'Shoulder Press', 'Bicep Curl', 'Tricep Pushdown', 'Leg Press',
    ],
  };

  const names = splitExercises[splitName] ?? splitExercises.general;

  // Query by nama — tidak perlu join movement_patterns lagi
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name')
    .in('name', names);

  if (error) {
    console.error('getExercisesForSplit error:', error);
    return [];
  }

  // Urutkan sesuai urutan di daftar atas (bukan alphabetical)
  // supaya layout tombol konsisten
  const ordered = names
    .map(name => data?.find(ex => ex.name === name))
    .filter(Boolean);

  return ordered ?? [];
}

// ============================================
// Helper: log set ke database
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
// Helper: cek dan update PR
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
// Helper: hitung set number berikutnya
// ============================================
async function getNextSetNumber(sessionExerciseId: string): Promise<number> {
  const { count } = await supabase
    .from('exercise_sets')
    .select('*', { count: 'exact', head: true })
    .eq('session_exercise_id', sessionExerciseId);

  return (count ?? 0) + 1;
}

// ============================================
// Handler utama untuk proses reps
// ============================================
async function processRepsInput(ctx: any, reps: number): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const state = getFlowState(telegramId);

  if (
    !state.sessionId ||
    !state.exerciseId ||
    !state.exerciseName ||
    state.pendingWeight === undefined
  ) {
    await ctx.reply('⚠️ Session tidak ditemukan. Ketik /start untuk mulai.');
    clearFlowState(telegramId);
    return;
  }

  const weight = state.pendingWeight;

  try {
    const sessionExerciseId = await logSetToDatabase(
      state.sessionId,
      state.exerciseId,
      weight,
      reps,
      state.currentSetNumber ?? 1
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

    const prLine = isPR
      ? `\n\n🏆 *PR BARU! Estimated 1RM: ${(weight * (1 + reps / 30)).toFixed(1)} kg*`
      : '';

    await editOrReply(
      ctx,
      `✅ *Set Tercatat!*\n\n` +
      `🏋️ ${state.exerciseName}\n` +
      `⚖️ ${weight} kg × ${reps} reps` +
      `${prLine}\n\n` +
      `_Set ke-${state.currentSetNumber ?? 1}_`,
      { parse_mode: 'Markdown', ...setLoggedKeyboard }
    );
  } catch (error) {
    console.error('processRepsInput error:', error);
    await ctx.reply('⚠️ Gagal menyimpan set. Coba lagi.');
  }
}

// ============================================
// REGISTER SEMUA HANDLERS
// ============================================
export function registerWorkoutFlowHandlers(bot: Telegraf): void {

  // ── wf_start ────────────────────────────────
  bot.action('wf_start', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const { data: activeSession } = await supabase
      .from('workout_sessions')
      .select('id, split_id, splits(name)')
      .eq('telegram_id', telegramId)
      .eq('status', 'in_progress')
      .single();

    if (activeSession) {
      await editOrReply(
        ctx,
        `⚡ *Sesi Aktif Ditemukan!*\n\nKamu masih punya sesi yang berjalan.\nMau lanjut atau selesaikan dulu?`,
        { parse_mode: 'Markdown', ...activeSessionKeyboard }
      );
      return;
    }

    setFlowState(telegramId, { step: 'selecting_split' });
    await editOrReply(
      ctx,
      `🏋️ *Pilih Split*\n\nHari ini latihan apa?`,
      { parse_mode: 'Markdown', ...splitKeyboard }
    );
  });

  // ── wf_split:{name} ─────────────────────────
  bot.action(/^wf_split:/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const callbackData = (ctx.callbackQuery as any).data as string;
    const splitName = callbackData.replace('wf_split:', '');

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

      const exercises = await getExercisesForSplit(splitName);

      if (exercises.length === 0) {
        await editOrReply(
          ctx,
          `⚠️ Belum ada exercise untuk split ini.\n\nKetik /exercises untuk tambah.`,
          cancelKeyboard
        );
        return;
      }

      const splitLabel = splitName.replace('_', ' ').toUpperCase();
      await editOrReply(
        ctx,
        `🏋️ *${splitLabel}*\n\nPilih exercise:`,
        { parse_mode: 'Markdown', ...buildExerciseKeyboard(exercises as any[], splitName) }
      );
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

    const callbackData = (ctx.callbackQuery as any).data as string;
    const exerciseId = callbackData.replace('wf_ex:', '');

    const { data: exercise } = await supabase
      .from('exercises')
      .select('id, name')
      .eq('id', exerciseId)
      .single();

    if (!exercise) {
      await ctx.reply('⚠️ Exercise tidak ditemukan.');
      return;
    }

    updateFlowState(telegramId, {
      step: 'entering_weight',
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      currentSetNumber: 1,
    });

    await editOrReply(
      ctx,
      `🏋️ *${exercise.name}*\n\n⚖️ Berapa beratnya? *(kg)*\n\nKetik angka saja → contoh: \`60\``,
      { parse_mode: 'Markdown', ...cancelKeyboard }
    );
  });

  // ── wf_reps:{n} ─────────────────────────────
  bot.action(/^wf_reps:/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const callbackData = (ctx.callbackQuery as any).data as string;
    const repsStr = callbackData.replace('wf_reps:', '');

    if (repsStr === 'custom') {
      await ctx.answerCbQuery();
      updateFlowState(telegramId, { step: 'entering_reps' });
      await editOrReply(
        ctx,
        `✏️ *Ketik jumlah reps:*\n\nContoh: \`8\``,
        { parse_mode: 'Markdown', ...cancelKeyboard }
      );
      return;
    }

    const reps = parseInt(repsStr);
    if (isNaN(reps)) return;

    await ctx.answerCbQuery(`${reps} reps dicatat!`);
    await processRepsInput(ctx, reps);
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

    updateFlowState(telegramId, { step: 'entering_weight' });

    await editOrReply(
      ctx,
      `🏋️ *${state.exerciseName}*\n_Set ke-${state.currentSetNumber ?? 2}_\n\n⚖️ Berapa beratnya? *(kg)*\n\nKetik angka saja → contoh: \`60\``,
      { parse_mode: 'Markdown', ...cancelKeyboard }
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
      pendingWeight: undefined,
      currentSetNumber: 1,
    });

    const exercises = await getExercisesForSplit(state.splitName);
    const splitLabel = state.splitName.replace('_', ' ').toUpperCase();

    await editOrReply(
      ctx,
      `🏋️ *${splitLabel}*\n\nPilih exercise berikutnya:`,
      { parse_mode: 'Markdown', ...buildExerciseKeyboard(exercises as any[], state.splitName) }
    );
  });

  // ── wf_finish ───────────────────────────────
  bot.action('wf_finish', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery('Menyelesaikan sesi...');

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
        durationText = `⏱️ Durasi: *${durationMin} menit*\n`;
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

      const splitLabel = state.splitName
        ? state.splitName.replace('_', ' ').toUpperCase()
        : 'WORKOUT';

      await editOrReply(
        ctx,
        `🏁 *${splitLabel} Selesai!*\n\n${durationText}` +
        `🏋️ Exercise: *${totalExercises ?? 0}*\n` +
        `💪 Total Sets: *${totalSets ?? 0}*\n\n` +
        `_Istirahat. Recover. Kembali lebih kuat._ 🔥`,
        { parse_mode: 'Markdown', ...require('../keyboards/mainMenu').mainMenuKeyboard }
      );
    } catch (error) {
      console.error('wf_finish error:', error);
      await ctx.reply('⚠️ Gagal menyelesaikan sesi. Coba lagi.');
    }
  });

  // ── wf_back_weight ──────────────────────────
  bot.action('wf_back_weight', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const state = getFlowState(telegramId);
    updateFlowState(telegramId, { step: 'entering_weight', pendingWeight: undefined });

    await editOrReply(
      ctx,
      `🏋️ *${state.exerciseName ?? 'Exercise'}*\n\n⚖️ Berapa beratnya? *(kg)*\n\nKetik angka saja → contoh: \`60\``,
      { parse_mode: 'Markdown', ...cancelKeyboard }
    );
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
        pendingWeight: undefined,
      });

      const exercises = await getExercisesForSplit(state.splitName);
      await editOrReply(
        ctx,
        `🏋️ Pilih exercise:`,
        { parse_mode: 'Markdown', ...buildExerciseKeyboard(exercises as any[], state.splitName) }
      );
    } else {
      clearFlowState(telegramId);
      await editOrReply(ctx, `🏠 Kembali ke menu.`, require('../keyboards/mainMenu').mainMenuKeyboard);
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
        id, started_at, split_id,
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

    let statusText = `📊 *Sesi Aktif — ${splitName.toUpperCase()}*\n⏱️ ${elapsed} menit berjalan\n\n`;

    const exercises = (session.session_exercises as any[]) ?? [];
    if (exercises.length === 0) {
      statusText += `_Belum ada exercise dilog._`;
    } else {
      exercises
        .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
        .forEach((se: any) => {
          statusText += `🏋️ *${se.exercises?.name ?? 'Unknown'}*\n`;
          (se.exercise_sets as any[]).forEach((s: any) => {
            statusText += `  └ Set ${s.set_number}: ${s.weight_kg}kg × ${s.reps}\n`;
          });
        });
    }

    await editOrReply(ctx, statusText, { parse_mode: 'Markdown', ...activeSessionKeyboard });
  });

  // ── wf_cancel_session ───────────────────────
  bot.action('wf_cancel_session', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const { Markup } = require('telegraf');
    await editOrReply(
      ctx,
      `⚠️ *Yakin mau batalkan sesi?*\n\nData yang sudah dilog akan dihapus.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Ya, batalkan', 'wf_confirm_cancel'),
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
    await editOrReply(ctx, `🗑️ Sesi dibatalkan.\n\nKetik /start untuk mulai latihan baru.`, require('../keyboards/mainMenu').mainMenuKeyboard);
  });

  // ============================================
  // BARU: wf_add_exercise
  // User tap "➕ Tambah Exercise" dari exercise list
  // ============================================
  bot.action('wf_add_exercise', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    updateFlowState(telegramId, { step: 'entering_custom_exercise' });

    await editOrReply(
      ctx,
      `➕ *Tambah Exercise Baru*\n\nKetik nama exercise yang ingin ditambahkan:\n\n_Contoh: Cable Fly, Preacher Curl, Nordic Curl_`,
      { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
    );
  });

  // ============================================
  // BARU: wf_add_split
  // User tap "➕ Tambah Split" dari split selection
  // ============================================
  bot.action('wf_add_split', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    updateFlowState(telegramId, { step: 'entering_custom_split' });

    await editOrReply(
      ctx,
      `➕ *Tambah Split Baru*\n\nKetik nama split yang ingin ditambahkan:\n\n_Contoh: PPL, Bro Split, Arnold Split_`,
      { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
    );
  });
}

export { processRepsInput };