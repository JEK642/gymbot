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
    // Simpan message ID untuk bisa di-edit nanti
    if (sent?.message_id && ctx.from?.id) {
      updateFlowState(ctx.from.id, { flowMessageId: sent.message_id });
    }
  }
}

// ============================================
// Helper: fetch exercises berdasarkan split
// Query ke Supabase: split → movement_patterns → exercises
// ============================================
async function getExercisesForSplit(splitName: string) {
  // Map split name ke movement pattern names
  const splitToPatterns: Record<string, string[]> = {
    push:       ['Horizontal Push', 'Vertical Push', 'Isolation Push'],
    pull:       ['Horizontal Pull', 'Vertical Pull', 'Isolation Pull'],
    legs:       ['Knee Dominant', 'Hip Hinge', 'Calf'],
    upper:      ['Horizontal Push', 'Vertical Push', 'Horizontal Pull', 'Vertical Pull'],
    lower:      ['Knee Dominant', 'Hip Hinge', 'Calf'],
    full_body:  ['Horizontal Push', 'Vertical Pull', 'Knee Dominant', 'Hip Hinge'],
    general:    [], // semua exercise
  };

  const patterns = splitToPatterns[splitName] ?? [];

  // Kalau general atau tidak ada pattern, ambil semua exercise default
  if (patterns.length === 0) {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('is_default', true)
      .order('name')
      .limit(12);
    return data ?? [];
  }

  // Ambil exercises yang punya movement_pattern sesuai split
  const { data } = await supabase
    .from('exercises')
    .select('*, movement_patterns!inner(name)')
    .in('movement_patterns.name', patterns)
    .eq('is_default', true)
    .order('name');

  return data ?? [];
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
  // 1. Cari atau buat session_exercise
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
    // Hitung urutan exercise dalam session
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

  // 2. Simpan set
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
// Epley Formula: 1RM = weight × (1 + reps/30)
// ============================================
async function checkAndUpdatePR(
  telegramId: number,
  exerciseId: string,
  sessionId: string,
  weight: number,
  reps: number
): Promise<boolean> {
  const estimated1RM = weight * (1 + reps / 30);

  // Ambil PR saat ini
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
// (dipakai oleh button tap DAN manual input)
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
    // 1. Log set ke DB
    const sessionExerciseId = await logSetToDatabase(
      state.sessionId,
      state.exerciseId,
      weight,
      reps,
      state.currentSetNumber ?? 1
    );

    // 2. Cek PR
    const isPR = await checkAndUpdatePR(
      telegramId,
      state.exerciseId,
      state.sessionId,
      weight,
      reps
    );

    // 3. Hitung set number berikutnya
    const nextSetNumber = await getNextSetNumber(sessionExerciseId);

    // 4. Update state
    updateFlowState(telegramId, {
      step: 'set_logged',
      sessionExerciseId,
      currentSetNumber: nextSetNumber,
    });

    // 5. Balas dengan konfirmasi
    const prLine = isPR ? `\n\n🏆 *PR BARU! Estimated 1RM: ${(weight * (1 + reps / 30)).toFixed(1)} kg*` : '';

    await editOrReply(
      ctx,
      `✅ *Set Tercatat!*\n\n` +
      `🏋️ ${state.exerciseName}\n` +
      `⚖️ ${weight} kg × ${reps} reps` +
      `${prLine}\n\n` +
      `_Set ke-${(state.currentSetNumber ?? 1)}_`,
      {
        parse_mode: 'Markdown',
        ...setLoggedKeyboard,
      }
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

  // ── wf_start: Mulai flow (tampilkan split) ──
  bot.action('wf_start', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    // Cek kalau ada session aktif
    const { data: activeSession } = await supabase
      .from('workout_sessions')
      .select('id, split_id, splits(name)')
      .eq('telegram_id', telegramId)
      .eq('status', 'in_progress')
      .single();

    if (activeSession) {
      // Ada session aktif → tawarin lanjut atau mulai baru
      await editOrReply(
        ctx,
        `⚡ *Sesi Aktif Ditemukan!*\n\n` +
        `Kamu masih punya sesi yang berjalan.\n` +
        `Mau lanjut atau selesaikan dulu?`,
        {
          parse_mode: 'Markdown',
          ...activeSessionKeyboard,
        }
      );
      return;
    }

    // Tidak ada session aktif → tampilkan split selection
    setFlowState(telegramId, { step: 'selecting_split' });

    await editOrReply(
      ctx,
      `🏋️ *Pilih Split*\n\n` +
      `Hari ini latihan apa?`,
      {
        parse_mode: 'Markdown',
        ...splitKeyboard,
      }
    );
  });

  // ── wf_split:{name}: Split dipilih ──────────
  bot.action(/^wf_split:/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    // Extract split name dari callback data
    const callbackData = (ctx.callbackQuery as any).data as string;
    const splitName = callbackData.replace('wf_split:', '');

    try {
      // 1. Buat workout session baru
      // Cari split_id kalau bukan 'general'
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

      // 2. Update state
      setFlowState(telegramId, {
        step: 'selecting_exercise',
        sessionId: session.id,
        splitName,
      });

      // 3. Fetch exercises
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
        {
          parse_mode: 'Markdown',
          ...buildExerciseKeyboard(exercises as any[], splitName),
        }
      );

    } catch (error) {
      console.error('wf_split error:', error);
      await ctx.reply('⚠️ Gagal memulai sesi. Coba lagi.');
    }
  });

  // ── wf_ex:{id}: Exercise dipilih ────────────
  bot.action(/^wf_ex:/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const callbackData = (ctx.callbackQuery as any).data as string;
    const exerciseId = callbackData.replace('wf_ex:', '');

    // Fetch nama exercise
    const { data: exercise } = await supabase
      .from('exercises')
      .select('id, name')
      .eq('id', exerciseId)
      .single();

    if (!exercise) {
      await ctx.reply('⚠️ Exercise tidak ditemukan.');
      return;
    }

    // Update state
    updateFlowState(telegramId, {
      step: 'entering_weight',
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      currentSetNumber: 1,
    });

    // Minta input berat
    await editOrReply(
      ctx,
      `🏋️ *${exercise.name}*\n\n` +
      `⚖️ Berapa beratnya? *(kg)*\n\n` +
      `Ketik angka saja → contoh: \`60\``,
      {
        parse_mode: 'Markdown',
        ...require('../keyboards/workoutFlow').cancelKeyboard,
      }
    );
  });

  // ── wf_reps:{n}: Reps dipilih via button ────
  bot.action(/^wf_reps:/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const callbackData = (ctx.callbackQuery as any).data as string;
    const repsStr = callbackData.replace('wf_reps:', '');

    if (repsStr === 'custom') {
      // User pilih custom → suruh ketik manual
      await ctx.answerCbQuery();
      updateFlowState(telegramId, { step: 'entering_reps' });
      await editOrReply(
        ctx,
        `✏️ *Ketik jumlah reps:*\n\n` +
        `Contoh: \`8\``,
        {
          parse_mode: 'Markdown',
          ...require('../keyboards/workoutFlow').cancelKeyboard,
        }
      );
      return;
    }

    const reps = parseInt(repsStr);
    if (isNaN(reps)) return;

    await ctx.answerCbQuery(`${reps} reps dicatat!`);
    await processRepsInput(ctx, reps);
  });

  // ── wf_addset: Tambah set untuk exercise sama ──
  bot.action('wf_addset', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const state = getFlowState(telegramId);

    if (!state.exerciseName) {
      await ctx.reply('⚠️ Session tidak ditemukan. Ketik /start.');
      return;
    }

    // Kembali ke step entering_weight untuk exercise yang sama
    updateFlowState(telegramId, { step: 'entering_weight' });

    await editOrReply(
      ctx,
      `🏋️ *${state.exerciseName}*\n` +
      `_Set ke-${state.currentSetNumber ?? 2}_\n\n` +
      `⚖️ Berapa beratnya? *(kg)*\n\n` +
      `Ketik angka saja → contoh: \`60\``,
      {
        parse_mode: 'Markdown',
        ...require('../keyboards/workoutFlow').cancelKeyboard,
      }
    );
  });

  // ── wf_newex: Pilih exercise baru ───────────
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
      {
        parse_mode: 'Markdown',
        ...buildExerciseKeyboard(exercises as any[], state.splitName),
      }
    );
  });

  // ── wf_finish: Selesaikan sesi ───────────────
  bot.action('wf_finish', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery('Menyelesaikan sesi...');

    const state = getFlowState(telegramId);

    try {
      // Cari active session
      const sessionId = state.sessionId;

      if (!sessionId) {
        await ctx.reply('⚠️ Tidak ada sesi aktif.');
        return;
      }

      const finishedAt = new Date();

      // Update session jadi completed
      const { data: session } = await supabase
        .from('workout_sessions')
        .update({
          status: 'completed',
          finished_at: finishedAt.toISOString(),
        })
        .eq('id', sessionId)
        .select('started_at')
        .single();

      // Hitung durasi
      let durationText = '';
      if (session?.started_at) {
        const startedAt = new Date(session.started_at);
        const durationMin = Math.round(
          (finishedAt.getTime() - startedAt.getTime()) / 60000
        );
        durationText = `⏱️ Durasi: *${durationMin} menit*\n`;

        // Update duration di DB
        await supabase
          .from('workout_sessions')
          .update({ duration_minutes: durationMin })
          .eq('id', sessionId);
      }

      // Hitung total sets
      const { count: totalSets } = await supabase
        .from('exercise_sets')
        .select('session_exercises!inner(session_id)', { count: 'exact', head: true })
        .eq('session_exercises.session_id', sessionId);

      // Hitung total exercise
      const { count: totalExercises } = await supabase
        .from('session_exercises')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      // Clear state
      clearFlowState(telegramId);

      const splitLabel = state.splitName
        ? state.splitName.replace('_', ' ').toUpperCase()
        : 'WORKOUT';

      await editOrReply(
        ctx,
        `🏁 *${splitLabel} Selesai!*\n\n` +
        `${durationText}` +
        `🏋️ Exercise: *${totalExercises ?? 0}*\n` +
        `💪 Total Sets: *${totalSets ?? 0}*\n\n` +
        `_Istirahat. Recover. Kembali lebih kuat._ 🔥`,
        {
          parse_mode: 'Markdown',
          ...require('../keyboards/mainMenu').mainMenuKeyboard,
        }
      );

    } catch (error) {
      console.error('wf_finish error:', error);
      await ctx.reply('⚠️ Gagal menyelesaikan sesi. Coba lagi.');
    }
  });

  // ── wf_back_weight: Kembali input berat ─────
  bot.action('wf_back_weight', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const state = getFlowState(telegramId);
    updateFlowState(telegramId, {
      step: 'entering_weight',
      pendingWeight: undefined,
    });

    await editOrReply(
      ctx,
      `🏋️ *${state.exerciseName ?? 'Exercise'}*\n\n` +
      `⚖️ Berapa beratnya? *(kg)*\n\n` +
      `Ketik angka saja → contoh: \`60\``,
      {
        parse_mode: 'Markdown',
        ...require('../keyboards/workoutFlow').cancelKeyboard,
      }
    );
  });

  // ── wf_cancel: Batalkan input saat ini ──────
  bot.action('wf_cancel', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const state = getFlowState(telegramId);

    // Balik ke exercise selection kalau masih ada session
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
        {
          parse_mode: 'Markdown',
          ...buildExerciseKeyboard(exercises as any[], state.splitName),
        }
      );
    } else {
      clearFlowState(telegramId);
      await editOrReply(
        ctx,
        `🏠 Kembali ke menu.`,
        require('../keyboards/mainMenu').mainMenuKeyboard
      );
    }
  });

  // ── wf_status: Lihat status sesi aktif ──────
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

    // Build status text
    const startTime = new Date(session.started_at);
    const elapsed = Math.round((Date.now() - startTime.getTime()) / 60000);
    const splitName = (session.splits as any)?.name ?? 'General';

    let statusText = `📊 *Sesi Aktif — ${splitName.toUpperCase()}*\n`;
    statusText += `⏱️ ${elapsed} menit berjalan\n\n`;

    const exercises = (session.session_exercises as any[]) ?? [];
    if (exercises.length === 0) {
      statusText += `_Belum ada exercise dilog._`;
    } else {
      exercises
        .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
        .forEach((se: any) => {
          const exName = se.exercises?.name ?? 'Unknown';
          const sets = (se.exercise_sets as any[]) ?? [];
          statusText += `🏋️ *${exName}*\n`;
          sets.forEach((s: any) => {
            statusText += `  └ Set ${s.set_number}: ${s.weight_kg}kg × ${s.reps}\n`;
          });
        });
    }

    await editOrReply(
      ctx,
      statusText,
      {
        parse_mode: 'Markdown',
        ...require('../keyboards/workoutFlow').activeSessionKeyboard,
      }
    );
  });

  // ── wf_cancel_session: Batalkan sesi ────────
  bot.action('wf_cancel_session', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    // Konfirmasi dulu sebelum cancel
    await editOrReply(
      ctx,
      `⚠️ *Yakin mau batalkan sesi?*\n\n` +
      `Data yang sudah dilog akan dihapus.`,
      {
        parse_mode: 'Markdown',
        ...require('telegraf').Markup.inlineKeyboard([
          [
            require('telegraf').Markup.button.callback('✅ Ya, batalkan', 'wf_confirm_cancel'),
            require('telegraf').Markup.button.callback('❌ Tidak', 'wf_status'),
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

    await editOrReply(
      ctx,
      `🗑️ Sesi dibatalkan.\n\nKetik /start untuk mulai latihan baru.`,
      require('../keyboards/mainMenu').mainMenuKeyboard
    );
  });
}

// Export processRepsInput untuk dipakai oleh textInputHandler
export { processRepsInput };