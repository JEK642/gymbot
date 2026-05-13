import { Context } from 'telegraf';
import { registerUser } from '../services/userService';
import { mainMenuKeyboard } from '../keyboards/mainMenu';
import { supabase } from '../config/supabase';

export async function startCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username ?? null;
  const firstName = ctx.from?.first_name ?? 'Bro';

  if (!telegramId) return;

  try {
    await registerUser(telegramId, username);

    // Cek apakah ada sesi aktif
    const { data: activeSession } = await supabase
      .from('workout_sessions')
      .select('id, splits(name), started_at')
      .eq('telegram_id', telegramId)
      .eq('status', 'in_progress')
      .single();

    // ============================================
    // Kalau ada sesi aktif → tampilkan resume menu
    // ============================================
    if (activeSession) {
      const split = (activeSession.splits as any)?.name ?? 'Workout';
      const startedAt = new Date(activeSession.started_at);
      const elapsed = Math.round((Date.now() - startedAt.getTime()) / 60000);

      await ctx.reply(
        `⚡ *Sesi Aktif — ${split.toUpperCase()}*\n` +
        `🕐 ${elapsed} menit berjalan`,
        {
          parse_mode: 'Markdown',
          ...require('../keyboards/workoutFlow').activeSessionKeyboard,
        }
      );
      return;
    }

    // ============================================
    // User baru → welcome singkat
    // User lama → langsung menu
    // ============================================
    const { count } = await supabase
      .from('workout_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_id', telegramId);

    const isNewUser = !count || count === 0;

    if (isNewUser) {
      // Pesan singkat untuk user baru — tidak ada wall of text
      await ctx.reply(
        `💪 *Yo ${firstName}!*\n\n` +
        `GymBot siap track latihan kamu.\n` +
        `Tap tombol di bawah untuk mulai! 👇`,
        {
          parse_mode: 'Markdown',
          ...mainMenuKeyboard,
        }
      );
    } else {
      // User lama → langsung ke menu tanpa basa-basi
      await ctx.reply(
        `👋 *${firstName}*\n\nMau ngapain hari ini?`,
        {
          parse_mode: 'Markdown',
          ...mainMenuKeyboard,
        }
      );
    }

  } catch (error) {
    console.error('startCommand error:', error);
    await ctx.reply('⚠️ Ada yang salah. Coba lagi.', mainMenuKeyboard);
  }
}