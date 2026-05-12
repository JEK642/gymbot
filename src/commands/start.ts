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

    // Kirim welcome message + inline keyboard
    // mainMenuKeyboard menggunakan spread operator (...) karena
    // Telegraf butuh format { reply_markup: ... }
    await ctx.reply(
      `💪 *Selamat datang di GymBot, ${firstName}!*\n\n` +
      `Mulai perjalanan gym kamu di sini.\n\n` +
      `_Pilih menu di bawah atau ketik command langsung:_`,
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