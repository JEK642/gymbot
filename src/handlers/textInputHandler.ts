import { Context } from 'telegraf';
import {
  getFlowState,
  updateFlowState,
  isWaitingForInput,
} from '../state/userFlowState';
import { buildRepsKeyboard } from '../keyboards/workoutFlow';
import { processRepsInput } from './workoutFlowHandler';

// ============================================
// Text Input Handler
//
// Dipanggil dari bot.on('text', ...) di bot.ts
// SEBELUM handler "I only respond to commands"
//
// Fungsinya: intercept teks yang diketik user
// saat sedang dalam workout flow.
//
// Kasus yang ditangani:
// 1. entering_weight → user ketik angka kg
// 2. entering_reps → user ketik angka reps (custom)
// ============================================
export async function handleTextInput(ctx: Context): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  // Tidak dalam flow → biarkan handler lain urus
  if (!isWaitingForInput(telegramId)) return false;

  const message = ctx.message;
  if (!message || !('text' in message)) return false;

  // Abaikan kalau pesannya command (mulai dengan /)
  if (message.text.startsWith('/')) return false;

  const input = message.text.trim();
  const state = getFlowState(telegramId);

  // ── Case 1: Menunggu input berat ────────────
  if (state.step === 'entering_weight') {
    const weight = parseFloat(input);

    // Validasi
    if (isNaN(weight) || weight <= 0 || weight > 500) {
      await ctx.reply(
        `❌ *"${input}" bukan angka yang valid.*\n\n` +
        `Ketik berat dalam kg, contoh: \`80\` atau \`82.5\``,
        { parse_mode: 'Markdown' }
      );
      return true; // sudah dihandle, jangan lanjut ke handler lain
    }

    // Simpan weight ke state, minta reps
    updateFlowState(telegramId, {
      step: 'entering_reps',
      pendingWeight: weight,
    });

    await ctx.reply(
      `🏋️ *${state.exerciseName}*\n` +
      `⚖️ ${weight} kg\n\n` +
      `💪 Berapa reps?`,
      {
        parse_mode: 'Markdown',
        ...buildRepsKeyboard(state.exerciseName ?? '', weight),
      }
    );

    return true;
  }

  // ── Case 2: Menunggu input reps (custom) ────
  if (state.step === 'entering_reps') {
    const reps = parseInt(input);

    // Validasi
    if (isNaN(reps) || reps <= 0 || reps > 200) {
      await ctx.reply(
        `❌ *"${input}" bukan angka yang valid.*\n\n` +
        `Ketik jumlah reps, contoh: \`8\``,
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    // Proses set
    await processRepsInput(ctx, reps);
    return true;
  }

  return false;
}