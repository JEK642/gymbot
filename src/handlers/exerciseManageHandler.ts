// src/handlers/exerciseManageHandler.ts
import { Telegraf } from 'telegraf';
import { getFlowState, updateFlowState } from '../state/userFlowState';
import {
  exerciseManageKeyboard,
  buildDeleteExerciseKeyboard,
  buildConfirmDeleteKeyboard,
  emCancelKeyboard,
} from '../keyboards/exerciseManage';
import { showExerciseSelection } from './workoutFlowHandler';
import { supabase } from '../config/supabase';

async function editOrReply(ctx: any, text: string, extra?: object): Promise<void> {
  try {
    await ctx.editMessageText(text, extra);
  } catch {
    await ctx.reply(text, extra);
  }
}

export function registerExerciseManageHandlers(bot: Telegraf): void {

  // ── em_open: Buka menu kelola exercise ──────
  // Dipanggil dari tombol ⚙️ di exercise keyboard
  bot.action('em_open', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    updateFlowState(telegramId, { step: 'managing_exercises' });

    await editOrReply(
      ctx,
      `⚙️ *Kelola Exercise*\n\nAtur daftar exercise personalmu:`,
      { parse_mode: 'Markdown', ...exerciseManageKeyboard }
    );
  });

  // ── em_add: Tambah exercise custom ──────────
  bot.action('em_add', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    updateFlowState(telegramId, { step: 'entering_custom_exercise' });

    await editOrReply(
      ctx,
      `➕ *Tambah Exercise*\n\nKetik nama exercise baru:\n\n_Contoh: Cable Fly, Nordic Curl_`,
      {
        parse_mode: 'Markdown',
        ...emCancelKeyboard,
      }
    );
  });

  // ── em_delete: Tampilkan list untuk dihapus ─
  bot.action('em_delete', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    // Ambil semua custom exercise aktif milik user
    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name')
      .eq('created_by', telegramId)
      .eq('is_default', false)
      .eq('is_active', true)
      .order('name');

    if (!exercises || exercises.length === 0) {
      await editOrReply(
        ctx,
        `🗑 *Hapus Exercise*\n\nKamu belum punya custom exercise.\n\nTambah dulu via ➕ Tambah Exercise.`,
        { parse_mode: 'Markdown', ...exerciseManageKeyboard }
      );
      return;
    }

    updateFlowState(telegramId, { step: 'deleting_exercise' });

    await editOrReply(
      ctx,
      `🗑 *Pilih exercise yang ingin dihapus:*\n\n_History workout tetap tersimpan._`,
      {
        parse_mode: 'Markdown',
        ...buildDeleteExerciseKeyboard(exercises as any[]),
      }
    );
  });

  // ── em_del:{id}: User pilih exercise yang dihapus ──
  bot.action(/^em_del:/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const exerciseId = ((ctx.callbackQuery as any).data as string).replace('em_del:', '');

    // Ambil nama exercise untuk konfirmasi
    const { data: exercise } = await supabase
      .from('exercises')
      .select('id, name')
      .eq('id', exerciseId)
      .eq('created_by', telegramId) // pastikan milik user ini
      .single();

    if (!exercise) {
      await editOrReply(ctx, '⚠️ Exercise tidak ditemukan.', exerciseManageKeyboard);
      return;
    }

    await editOrReply(
      ctx,
      `🗑 Hapus *${exercise.name}*?\n\n_History workout tetap tersimpan._`,
      {
        parse_mode: 'Markdown',
        ...buildConfirmDeleteKeyboard(exercise.id, exercise.name),
      }
    );
  });

  // ── em_confirm_del:{id}: Konfirmasi hapus ───
  bot.action(/^em_confirm_del:/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const exerciseId = ((ctx.callbackQuery as any).data as string).replace('em_confirm_del:', '');

    // SAFE DELETE: set is_active = false, BUKAN DELETE
    // History workout tetap utuh karena exercise_id di
    // session_exercises masih valid
    const { error } = await supabase
      .from('exercises')
      .update({ is_active: false })
      .eq('id', exerciseId)
      .eq('created_by', telegramId); // double check kepemilikan

    if (error) {
      console.error('em_confirm_del error:', error);
      await ctx.reply('⚠️ Gagal menghapus exercise. Coba lagi.');
      return;
    }

    await editOrReply(
      ctx,
      `✅ Exercise dihapus dari menu.\n\n_History workout tetap tersimpan._`,
      { parse_mode: 'Markdown', ...exerciseManageKeyboard }
    );
  });

  // ── em_list: Tampilkan semua custom exercise ─
  bot.action('em_list', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const { data: exercises } = await supabase
      .from('exercises')
      .select('name, created_at')
      .eq('created_by', telegramId)
      .eq('is_default', false)
      .eq('is_active', true)
      .order('name');

    if (!exercises || exercises.length === 0) {
      await editOrReply(
        ctx,
        `📋 *Exercise Saya*\n\nBelum ada custom exercise.\n\nTambah via ➕ Tambah Exercise.`,
        { parse_mode: 'Markdown', ...exerciseManageKeyboard }
      );
      return;
    }

    const list = exercises.map(ex => `• ${ex.name}`).join('\n');

    await editOrReply(
      ctx,
      `📋 *Exercise Saya (${exercises.length})*\n\n${list}`,
      { parse_mode: 'Markdown', ...exerciseManageKeyboard }
    );
  });

  // ── em_back: Kembali ke exercise selection ──
  bot.action('em_back', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    const state = getFlowState(telegramId);

    // Kalau masih ada session aktif → balik ke exercise list
    if (state.sessionId && state.splitName) {
      updateFlowState(telegramId, { step: 'selecting_exercise' });
      const splitLabel = state.splitName.replace('_', ' ').toUpperCase();
      await showExerciseSelection(ctx, telegramId, state.splitName, splitLabel);
    } else {
      // Tidak ada session → balik ke menu utama
      await editOrReply(
        ctx,
        `🏠 Menu Utama`,
        require('../keyboards/mainMenu').mainMenuKeyboard
      );
    }
  });

  // ── em_back_manage: Kembali ke manage menu ──
  bot.action('em_back_manage', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await ctx.answerCbQuery();

    updateFlowState(telegramId, { step: 'managing_exercises' });

    await editOrReply(
      ctx,
      `⚙️ *Kelola Exercise*\n\nAtur daftar exercise personalmu:`,
      { parse_mode: 'Markdown', ...exerciseManageKeyboard }
    );
  });
}