// src/handlers/textInputHandler.ts
import { Context } from 'telegraf';
import {
  getFlowState,
  updateFlowState,
  clearFlowState,
  isWaitingForInput,
} from '../state/userFlowState';
import { buildRepsKeyboard, cancelOnlyKeyboard } from '../keyboards/workoutFlow';
import { backToMenuKeyboard } from '../keyboards/mainMenu';
import { processRepsInput } from './workoutFlowHandler';
import { supabase } from '../config/supabase';

export async function handleTextInput(ctx: Context): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  if (!isWaitingForInput(telegramId)) return false;

  const message = ctx.message;
  if (!message || !('text' in message)) return false;
  if (message.text.startsWith('/')) return false;

  const input = message.text.trim();
  const state = getFlowState(telegramId);

  // ── Case 1: Menunggu input berat workout ────
  if (state.step === 'entering_weight') {
    const weight = parseFloat(input);

    if (isNaN(weight) || weight <= 0 || weight > 500) {
      await ctx.reply(
        `❌ *"${input}" bukan angka yang valid.*\n\nKetik berat dalam kg, contoh: \`80\` atau \`82.5\``,
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    updateFlowState(telegramId, { step: 'entering_reps', pendingWeight: weight });

    await ctx.reply(
      `🏋️ *${state.exerciseName}*\n⚖️ ${weight} kg\n\n💪 Berapa reps?`,
      { parse_mode: 'Markdown', ...buildRepsKeyboard(state.exerciseName ?? '', weight) }
    );
    return true;
  }

  // ── Case 2: Menunggu input reps custom ──────
  if (state.step === 'entering_reps') {
    const reps = parseInt(input);

    if (isNaN(reps) || reps <= 0 || reps > 200) {
      await ctx.reply(
        `❌ *"${input}" bukan angka yang valid.*\n\nKetik jumlah reps, contoh: \`8\``,
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    await processRepsInput(ctx, reps);
    return true;
  }

  // ── Case 3: BARU — Menunggu nama exercise baru ──
  if (state.step === 'entering_custom_exercise') {
    const exerciseName = input;

    // Validasi panjang nama
    if (exerciseName.length < 2 || exerciseName.length > 50) {
      await ctx.reply(
        `❌ Nama exercise harus antara 2–50 karakter.\n\nCoba lagi:`,
        { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
      );
      return true;
    }

    try {
      // Simpan ke tabel exercises dengan is_default=false
      const { data: newExercise, error } = await supabase
        .from('exercises')
        .insert({
          name: exerciseName,
          is_default: false,
          created_by: telegramId.toString(),
        })
        .select('id, name')
        .single();

      if (error) {
        // Kalau nama sudah ada, coba ambil yang existing
        if (error.code === '23505') {
          const { data: existing } = await supabase
            .from('exercises')
            .select('id, name')
            .ilike('name', exerciseName)
            .single();

          if (existing) {
            // Pakai exercise yang sudah ada
            updateFlowState(telegramId, {
              step: 'entering_weight',
              exerciseId: existing.id,
              exerciseName: existing.name,
              currentSetNumber: 1,
            });

            await ctx.reply(
              `ℹ️ *${existing.name}* sudah ada di database.\n\n⚖️ Berapa beratnya? *(kg)*\n\nKetik angka saja → contoh: \`60\``,
              { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
            );
            return true;
          }
        }
        throw error;
      }

      if (!newExercise) throw new Error('Exercise tidak tersimpan');

      // Lanjut ke entering_weight untuk exercise baru ini
      updateFlowState(telegramId, {
        step: 'entering_weight',
        exerciseId: newExercise.id,
        exerciseName: newExercise.name,
        currentSetNumber: 1,
      });

      await ctx.reply(
        `✅ *${newExercise.name}* berhasil ditambahkan!\n\n⚖️ Berapa beratnya? *(kg)*\n\nKetik angka saja → contoh: \`60\``,
        { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
      );
    } catch (error) {
      console.error('entering_custom_exercise error:', error);
      await ctx.reply('⚠️ Gagal menyimpan exercise. Coba lagi.');
    }

    return true;
  }

  // ── Case 4: BARU — Menunggu nama split baru ─
  if (state.step === 'entering_custom_split') {
    const splitName = input;

    if (splitName.length < 2 || splitName.length > 30) {
      await ctx.reply(
        `❌ Nama split harus antara 2–30 karakter.\n\nCoba lagi:`,
        { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
      );
      return true;
    }

    try {
      // Simpan ke tabel splits
      const { data: newSplit, error } = await supabase
        .from('splits')
        .insert({
          name: splitName,
          is_default: false,
          created_by: telegramId.toString(),
        })
        .select('id, name')
        .single();

      if (error) throw error;
      if (!newSplit) throw new Error('Split tidak tersimpan');

      // Buat workout session dengan split baru ini
      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({
          telegram_id: telegramId,
          split_id: newSplit.id,
          status: 'in_progress',
          name: `${newSplit.name.toUpperCase()} — ${new Date().toLocaleDateString('id-ID')}`,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (sessionError || !session) throw new Error('Gagal membuat sesi');

      // Update state: masuk ke selecting_exercise dengan split baru
      // Pakai 'general' sebagai fallback untuk exercise list
      updateFlowState(telegramId, {
        step: 'selecting_exercise',
        sessionId: session.id,
        splitName: newSplit.name,
      });

      // Tampilkan exercise general sebagai default untuk split custom
      const { buildExerciseKeyboard } = require('../keyboards/workoutFlow');
      const { data: exercises } = await supabase
        .from('exercises')
        .select('id, name')
        .in('name', [
          'Bench Press', 'Squat', 'Deadlift', 'Pull-up',
          'Shoulder Press', 'Bicep Curl', 'Tricep Pushdown', 'Leg Press',
        ]);

      await ctx.reply(
        `✅ Split *${newSplit.name}* berhasil ditambahkan!\n\n🏋️ Pilih exercise:`,
        {
          parse_mode: 'Markdown',
          ...buildExerciseKeyboard(exercises ?? [], newSplit.name),
        }
      );
    } catch (error) {
      console.error('entering_custom_split error:', error);
      await ctx.reply('⚠️ Gagal menyimpan split. Coba lagi.');
    }

    return true;
  }

  // ── Case 5: BARU — Menunggu input berat badan ──
  if (state.step === 'entering_weight_log') {
    const weight = parseFloat(input);

    // Validasi range berat badan manusia yang masuk akal
    if (isNaN(weight) || weight < 20 || weight > 400) {
      await ctx.reply(
        `❌ *"${input}" tidak valid.*\n\nMasukkan berat dalam kg (20–400).\n\nContoh: \`72.5\``,
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    try {
      // Simpan ke weight_logs
      const { error } = await supabase
        .from('weight_logs')
        .insert({
          telegram_id: telegramId,
          weight: weight,
          logged_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Bersihkan state
      clearFlowState(telegramId);

      await ctx.reply(
        `✅ *Berat Tercatat!*\n\n⚖️ ${weight} kg\n📅 ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n_Konsistensi adalah kunci._ 💪`,
        { parse_mode: 'Markdown', ...backToMenuKeyboard }
      );
    } catch (error) {
      console.error('entering_weight_log error:', error);
      await ctx.reply('⚠️ Gagal menyimpan berat. Coba lagi.');
    }

    return true;
  }

  return false;
}