// sessionMenu.ts
// Keyboard inline untuk interaksi session
// Dipisah dari mainMenu.ts agar tetap modular

import { Markup } from 'telegraf';

// ------------------------------------------------------------
// sessionActionKeyboard
// Muncul setelah /session start atau /session status
// Tombol shortcut untuk aksi yang paling sering dipakai
// ------------------------------------------------------------
export const sessionActionKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('📊 Status', 'session_status'),
    Markup.button.callback('✅ Selesai', 'session_done'),
  ],
  [
    Markup.button.callback('❌ Cancel Session', 'session_cancel'),
  ],
]);

// ------------------------------------------------------------
// afterLogKeyboard
// Muncul setelah user berhasil /log set
// Tombol cepat untuk log lagi atau lihat status
// ------------------------------------------------------------
export const afterLogKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('📊 Status Session', 'session_status'),
    Markup.button.callback('✅ Selesai', 'session_done'),
  ],
]);

// ------------------------------------------------------------
// confirmDoneKeyboard
// Konfirmasi sebelum finalisasi session
// Hindari user tidak sengaja ketuk /done
// ------------------------------------------------------------
export const confirmDoneKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('✅ Ya, Selesaikan!', 'session_confirm_done'),
    Markup.button.callback('🔙 Lanjut Latihan', 'session_continue'),
  ],
]);