// src/handlers/textInputHandler.ts
import { Context } from 'telegraf';
import {
  getFlowState,
  updateFlowState,
  clearFlowState,
  isWaitingForInput,
} from '../state/userFlowState';
import { cancelOnlyKeyboard } from '../keyboards/workoutFlow';
import { emCancelKeyboard } from '../keyboards/exerciseManage';
import { backToMenuKeyboard } from '../keyboards/mainMenu';
import { processSetInput, showExerciseSelection } from './workoutFlowHandler';
import { parseSetInput } from '../utils/parseSetInput';
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

  // ── Case 1: BARU — Input set gabungan (weight × reps) ─
  // Menggantikan Case 'entering_weight' + Case 'entering_reps' yang lama
  if (state.step === 'entering_set') {
    const parsed = parseSetInput(input);

    if (!parsed) {
      // Error message pendek — sesuai UX requirement
      await ctx.reply(
        `❌ Format salah\nGunakan: \`80x6\``,
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    await processSetInput(ctx, parsed.weight, parsed.reps);
    return true;
  }

  // ── Case 2: Input nama exercise custom ───────
  if (state.step === 'entering_custom_exercise') {
    const exerciseName = input;

    if (exerciseName.length < 2 || exerciseName.length > 50) {
      await ctx.reply(`❌ Nama exercise 2–50 karakter. Coba lagi:`, emCancelKeyboard);
      return true;
    }

    try {
      const { data: existing } = await supabase
        .from('exercises')
        .select('id, name, is_active')
        .ilike('name', exerciseName)
        .or(`created_by.eq.${telegramId},is_default.eq.true`)
        .single();

      if (existing) {
        if (!existing.is_active) {
          await supabase
            .from('exercises')
            .update({ is_active: true })
            .eq('id', existing.id);
        }

        updateFlowState(telegramId, {
          step: state.sessionId ? 'entering_set' : 'selecting_exercise',
          exerciseId: existing.id,
          exerciseName: existing.name,
          currentSetNumber: 1,
        });

        const msg = existing.is_active
          ? `ℹ️ *${existing.name}* sudah ada — langsung dipilih!`
          : `✅ *${existing.name}* diaktifkan kembali!`;

        if (state.sessionId) {
          await ctx.reply(
            `${msg}\n\nInput set:\n\`80x6\`  → 80kg × 6 reps`,
            { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
          );
        } else {
          await ctx.reply(msg, { parse_mode: 'Markdown' });
        }
        return true;
      }

      const { data: newExercise, error } = await supabase
        .from('exercises')
        .insert({
          name: exerciseName,
          is_default: false,
          is_active: true,
          created_by: telegramId,
        })
        .select('id, name')
        .single();

      if (error || !newExercise) throw error;

      if (state.sessionId) {
        updateFlowState(telegramId, {
          step: 'entering_set',
          exerciseId: newExercise.id,
          exerciseName: newExercise.name,
          currentSetNumber: 1,
        });
        await ctx.reply(
          `✅ *${newExercise.name}* ditambahkan!\n\nInput set:\n\`80x6\`  → 80kg × 6 reps`,
          { parse_mode: 'Markdown', ...cancelOnlyKeyboard }
        );
      } else {
        updateFlowState(telegramId, { step: 'managing_exercises' });
        const { exerciseManageKeyboard } = require('../keyboards/exerciseManage');
        await ctx.reply(
          `✅ *${newExercise.name}* ditambahkan!\n\nExercise ini akan muncul di menu latihan berikutnya.`,
          { parse_mode: 'Markdown', ...exerciseManageKeyboard }
        );
      }

    } catch (error) {
      console.error('entering_custom_exercise error:', error);
      await ctx.reply('⚠️ Gagal menyimpan exercise. Coba lagi.');
    }

    return true;
  }

  // ── Case 3: Input nama split custom ──────────
  if (state.step === 'entering_custom_split') {
    const splitName = input;

    if (splitName.length < 2 || splitName.length > 30) {
      await ctx.reply(`❌ Nama split 2–30 karakter. Coba lagi:`, cancelOnlyKeyboard);
      return true;
    }

    try {
      const { data: newSplit, error } = await supabase
        .from('splits')
        .insert({
          name: splitName,
          is_default: false,
          created_by: telegramId,
        })
        .select('id, name')
        .single();

      if (error || !newSplit) throw error;

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

      updateFlowState(telegramId, {
        step: 'selecting_exercise',
        sessionId: session.id,
        splitName: newSplit.name,
      });

      await showExerciseSelection(ctx as any, telegramId, 'general', newSplit.name.toUpperCase());

    } catch (error) {
      console.error('entering_custom_split error:', error);
      await ctx.reply('⚠️ Gagal menyimpan split. Coba lagi.');
    }

    return true;
  }

  // ── Case 4: Input berat badan ────────────────
  if (state.step === 'entering_weight_log') {
    const weight = parseFloat(input);

    if (isNaN(weight) || weight < 20 || weight > 400) {
      await ctx.reply(`❌ Berat tidak valid (20–400 kg). Contoh: \`72.5\``, { parse_mode: 'Markdown' });
      return true;
    }

    try {
      const { error } = await supabase
        .from('weight_logs')
        .insert({
          telegram_id: telegramId,
          weight: weight,
          logged_at: new Date().toISOString(),
        });

      if (error) throw error;

      clearFlowState(telegramId);

      await ctx.reply(
        `✅ *Berat Tercatat!*\n\n⚖️ ${weight} kg\n📅 ${new Date().toLocaleDateString('id-ID', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })}\n\n_Konsistensi adalah kunci._ 💪`,
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