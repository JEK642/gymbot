// start.ts
// Command /start — entry point utama bot
// Update: tambah info command session baru di welcome message

import { Context } from 'telegraf';
import { registerUser } from '../services/userService';
import { mainMenuKeyboard } from '../keyboards/mainMenu';

export async function startCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username ?? null;
  const firstName = ctx.from?.first_name ?? 'Bro';

  if (!telegramId) {
    await ctx.reply('⚠️ Tidak bisa mendeteksi akun Telegram kamu.');
    return;
  }

  try {
    await registerUser(telegramId, username);

    await ctx.reply(
      `💪 *Selamat datang di GymBot, ${firstName}!*\n\n` +
      `Tracker gym kamu — log session, exercise, dan PR dalam satu tempat.\n\n` +
      `*🏋️ Workout Session:*\n` +
      `\`/session start\` — mulai session baru\n` +
      `\`/session start push\` — dengan tag split\n` +
      `\`/session status\` — lihat progress session\n` +
      `\`/log bench press 60 8\` — log set exercise\n` +
      `\`/done\` — selesaikan session\n\n` +
      `*📋 Lainnya:*\n` +
      `\`/exercises\` — daftar exercise tersedia\n` +
      `\`/weight 72.5\` — log berat badan\n` +
      `\`/stats\` — statistik kamu\n\n` +
      `_Atau gunakan menu di bawah untuk mulai:_`,
      {
        parse_mode: 'Markdown',
        ...mainMenuKeyboard,
      }
    );
  } catch (error) {
    console.error('startCommand error:', error);
    await ctx.reply('⚠️ Ada yang salah. Coba lagi ya.');
  }
}