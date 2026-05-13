// exercises.ts
// Command /exercises — tampilkan daftar exercise yang tersedia
// User perlu tahu nama exercise yang benar untuk /log

import { Context } from 'telegraf';
import { listExercises, findExerciseByName } from '../services/exerciseService';
import { Markup } from 'telegraf';

// ============================================================
// handleExercises
// /exercises              → list semua (max 20)
// /exercises barbell      → filter by equipment
// /exercises bench        → search by name
// ============================================================
export async function handleExercises(ctx: Context) {
  const text = (ctx.message as any)?.text ?? '';
  const query = text.replace(/^\/exercises\s*/i, '').trim();

  try {
    if (!query) {
      // Tidak ada query → tampilkan menu filter
      await ctx.reply(
        `📚 *Daftar Exercise*\n\n` +
        `Pilih cara mencari:`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('🏋️ Barbell', 'ex_filter_barbell'),
              Markup.button.callback('💪 Dumbbell', 'ex_filter_dumbbell'),
            ],
            [
              Markup.button.callback('🔧 Machine', 'ex_filter_machine'),
              Markup.button.callback('🤸 Bodyweight', 'ex_filter_bodyweight'),
            ],
            [
              Markup.button.callback('📋 Semua Exercise', 'ex_list_all'),
            ],
          ]),
        }
      );
      return;
    }

    // Ada query → cari by name dulu
    const byName = await findExerciseByName(query);
    if (byName) {
      await ctx.reply(
        `🔍 *Ditemukan: ${byName.name}*\n\n` +
        `🏷️ Equipment: ${byName.equipment ?? 'Bodyweight'}\n` +
        `↔️ Bilateral: ${byName.is_bilateral ? 'Ya' : 'Tidak'}\n\n` +
        `Cara log:\n\`/log ${byName.name.toLowerCase()} [berat] [reps]\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Tidak ketemu by name → coba filter by equipment
    const byEquipment = await listExercises({ equipment: query, limit: 15 });
    if (byEquipment.length > 0) {
      let msg = `🔍 *Exercise dengan "${query}":*\n\n`;
      byEquipment.forEach((ex, i) => {
        msg += `${i + 1}. *${ex.name}*`;
        if (ex.equipment) msg += ` _(${ex.equipment})_`;
        msg += '\n';
      });
      msg += `\nCara log: \`/log [nama exercise] [berat] [reps]\``;

      await ctx.reply(msg, { parse_mode: 'Markdown' });
      return;
    }

    await ctx.reply(
      `🔍 Tidak ada exercise dengan kata kunci *"${query}"*.\n\n` +
      `Coba:\n/exercises barbell\n/exercises dumbbell\n/exercises`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[exercises] handleExercises error:', err);
    await ctx.reply('❌ Gagal mengambil daftar exercise.');
  }
}

// ============================================================
// CALLBACK HANDLERS untuk filter buttons
// ============================================================
export async function callbackExerciseFilter(ctx: Context, equipment: string) {
  await ctx.answerCbQuery();

  try {
    const exercises = await listExercises({ equipment, limit: 20 });

    if (exercises.length === 0) {
      await ctx.editMessageText(`Tidak ada exercise untuk equipment: ${equipment}`);
      return;
    }

    let msg = `🏋️ *Exercise - ${equipment.charAt(0).toUpperCase() + equipment.slice(1)}:*\n\n`;
    exercises.forEach((ex, i) => {
      msg += `${i + 1}. *${ex.name}*\n`;
    });
    msg += `\nCara log: \`/log [nama exercise] [berat] [reps]\``;

    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.editMessageText('❌ Gagal mengambil daftar exercise.');
  }
}

export async function callbackExerciseListAll(ctx: Context) {
  await ctx.answerCbQuery();

  try {
    const exercises = await listExercises({ limit: 25 });

    let msg = `📋 *Semua Exercise (${exercises.length}):*\n\n`;
    exercises.forEach((ex, i) => {
      const eq = ex.equipment ? ` _(${ex.equipment})_` : '';
      msg += `${i + 1}. *${ex.name}*${eq}\n`;
    });
    msg += `\n🔍 Cari spesifik: \`/exercises bench\``;

    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.editMessageText('❌ Gagal mengambil daftar exercise.');
  }
}