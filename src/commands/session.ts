// session.ts
// Command handler untuk lifecycle workout session:
// /session start [nama_split]
// /session status
// /done
//
// Plus callback handler untuk inline keyboard buttons

import { Context } from 'telegraf';
import {
  getActiveSession,
  startSession,
  finishSession,
  getSessionWithDetails,
} from '../services/sessionService';
import {
  sessionActionKeyboard,
  confirmDoneKeyboard,
} from '../keyboards/sessionMenu';
import { WorkoutSessionWithDetails } from '../types';

// ✅ FIX: Import supabase di atas, bukan dynamic import di dalam fungsi
import { supabase } from '../config/supabase';

// ============================================================
// /session start [split_name]
// ============================================================
export async function handleSessionStart(ctx: Context) {
  const telegram_id = String(ctx.from?.id);
  if (!telegram_id) return;

  // Parse argumen: "/session start push" → split_name = "push"
  const text = (ctx.message as any)?.text ?? '';
  const parts = text.trim().split(/\s+/); // split by whitespace
  // parts[0] = "/session", parts[1] = "start", parts[2...] = split_name
  const split_name = parts.slice(2).join(' ') || undefined;

  try {
    // Guard: cek kalau sudah ada session aktif
    const activeSession = await getActiveSession(telegram_id);
    if (activeSession) {
      const startedAt = new Date(activeSession.started_at);
      const diffMinutes = Math.round(
        (Date.now() - startedAt.getTime()) / 1000 / 60
      );

      await ctx.reply(
        `⚠️ *Kamu masih punya session aktif!*\n\n` +
        `Session dimulai ${diffMinutes} menit lalu.\n\n` +
        `Ketik /done untuk menyelesaikannya dulu, ` +
        `atau gunakan /session status untuk melihat progressmu.`,
        {
          parse_mode: 'Markdown',
          ...sessionActionKeyboard,
        }
      );
      return;
    }

    // Buat session baru
    const session = await startSession({
      telegram_id,
      split_name,
    });

    const splitInfo = split_name
      ? `\n🏷️ Split: *${split_name}*`
      : '\n💡 _Tip: ketik `/session start push` untuk tag split-mu_';

    await ctx.reply(
      `🏋️ *Session dimulai!*${splitInfo}\n\n` +
      `Sekarang mulai log exercise-mu:\n` +
      `\`/log bench press 60 8\`\n` +
      `\`/log squat 100 5\`\n\n` +
      `Format: \`/log [nama exercise] [berat kg] [reps]\`\n\n` +
      `Ketik /done kalau sudah selesai 💪`,
      {
        parse_mode: 'Markdown',
        ...sessionActionKeyboard,
      }
    );
  } catch (err) {
    console.error('[session] handleSessionStart error:', err);
    await ctx.reply('❌ Gagal memulai session. Coba lagi ya!');
  }
}

// ============================================================
// /session status
// ============================================================
export async function handleSessionStatus(ctx: Context) {
  const telegram_id = String(ctx.from?.id);
  if (!telegram_id) return;

  try {
    const activeSession = await getActiveSession(telegram_id);

    if (!activeSession) {
      await ctx.reply(
        `😴 *Tidak ada session aktif.*\n\n` +
        `Mulai latihan dengan:\n` +
        `\`/session start\` — session biasa\n` +
        `\`/session start push\` — dengan tag split`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const details = await getSessionWithDetails(activeSession.id);
    if (!details) {
      await ctx.reply('❌ Gagal mengambil detail session.');
      return;
    }

    await ctx.reply(buildStatusMessage(details), {
      parse_mode: 'Markdown',
      ...sessionActionKeyboard,
    });
  } catch (err) {
    console.error('[session] handleSessionStatus error:', err);
    await ctx.reply('❌ Gagal mengambil status session.');
  }
}

// ============================================================
// /done — minta konfirmasi dulu
// ============================================================
export async function handleDone(ctx: Context) {
  const telegram_id = String(ctx.from?.id);
  if (!telegram_id) return;

  try {
    const activeSession = await getActiveSession(telegram_id);

    if (!activeSession) {
      await ctx.reply(
        `😴 Tidak ada session aktif yang bisa diselesaikan.\n\n` +
        `Mulai dengan /session start`
      );
      return;
    }

    // Tampilkan preview session sebelum konfirmasi
    const details = await getSessionWithDetails(activeSession.id);
    const totalSets = details?.exercises?.reduce(
      (acc, ex) => acc + (ex.sets?.length ?? 0),
      0
    ) ?? 0;
    const totalExercises = details?.exercises?.length ?? 0;

    const startedAt = new Date(activeSession.started_at);
    const durationNow = Math.round((Date.now() - startedAt.getTime()) / 1000 / 60);

    await ctx.reply(
      `✅ *Selesaikan session ini?*\n\n` +
      `⏱️ Durasi: *${durationNow} menit*\n` +
      `🏋️ Exercise: *${totalExercises}*\n` +
      `📝 Total Set: *${totalSets}*\n\n` +
      `Yakin mau selesai?`,
      {
        parse_mode: 'Markdown',
        ...confirmDoneKeyboard,
      }
    );
  } catch (err) {
    console.error('[session] handleDone error:', err);
    await ctx.reply('❌ Gagal. Coba lagi ya!');
  }
}

// ============================================================
// CALLBACK HANDLERS — untuk inline keyboard buttons
// Didaftarkan di bot.ts via bot.action(...)
// ============================================================

// Tombol "✅ Ya, Selesaikan!"
export async function callbackConfirmDone(ctx: Context) {
  const telegram_id = String(ctx.from?.id);
  await ctx.answerCbQuery(); // wajib dipanggil untuk hapus loading

  try {
    const activeSession = await getActiveSession(telegram_id);
    if (!activeSession) {
      await ctx.editMessageText('😴 Session sudah tidak aktif.');
      return;
    }

    const finished = await finishSession(activeSession.id);
    const details = await getSessionWithDetails(finished.id);

    // Edit pesan konfirmasi dengan summary
    await ctx.editMessageText(
      buildSummaryMessage(details),
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[session] callbackConfirmDone error:', err);
    await ctx.editMessageText('❌ Gagal menyelesaikan session.');
  }
}

// Tombol "🔙 Lanjut Latihan"
export async function callbackContinue(ctx: Context) {
  await ctx.answerCbQuery('Lanjut gaskeun! 💪');
  await ctx.editMessageText(
    '💪 Oke, lanjut latihan! Ketik /done kalau sudah beneran selesai.',
    { parse_mode: 'Markdown' }
  );
}

// Tombol "📊 Status"
export async function callbackSessionStatus(ctx: Context) {
  const telegram_id = String(ctx.from?.id);
  await ctx.answerCbQuery();

  try {
    const activeSession = await getActiveSession(telegram_id);
    if (!activeSession) {
      await ctx.editMessageText('😴 Tidak ada session aktif.');
      return;
    }

    const details = await getSessionWithDetails(activeSession.id);
    if (!details) {
      await ctx.editMessageText('❌ Gagal mengambil status.');
      return;
    }

    await ctx.editMessageText(buildStatusMessage(details), {
      parse_mode: 'Markdown',
      ...sessionActionKeyboard,
    });
  } catch (err) {
    await ctx.editMessageText('❌ Gagal mengambil status.');
  }
}

// Tombol "❌ Cancel Session"
export async function callbackCancelSession(ctx: Context) {
  const telegram_id = String(ctx.from?.id);
  await ctx.answerCbQuery();

  try {
    const activeSession = await getActiveSession(telegram_id);
    if (!activeSession) {
      await ctx.editMessageText('😴 Tidak ada session aktif.');
      return;
    }

    // ✅ FIX: Pakai supabase yang sudah di-import di atas
    // Hapus dynamic import yang lama:
    // ❌ const { createClient } = await import('@supabase/supabase-js'); // tidak dipakai!
    // ❌ const { supabase } = await import('../config/supabase');
    await supabase
      .from('workout_sessions')
      .update({ status: 'cancelled' })
      .eq('id', activeSession.id);

    await ctx.editMessageText(
      '❌ Session dibatalkan.\n\nMulai lagi kapanpun dengan /session start 💪',
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    await ctx.editMessageText('❌ Gagal membatalkan session.');
  }
}

// ============================================================
// HELPER — Builder untuk pesan status & summary
// Dipisah ke fungsi agar reusable dan mudah diubah formatnya
// ============================================================

function buildStatusMessage(session: WorkoutSessionWithDetails): string {
  const startedAt = new Date(session.started_at);
  const durationNow = Math.round((Date.now() - startedAt.getTime()) / 1000 / 60);

  let msg = `📊 *Session Aktif*\n`;
  if (session.split?.name) {
    msg += `🏷️ ${session.split.name}\n`;
  }
  msg += `⏱️ Durasi: *${durationNow} menit*\n\n`;

  if (!session.exercises || session.exercises.length === 0) {
    msg += `_Belum ada exercise. Mulai dengan /log_\n\n`;
    msg += `Contoh: \`/log bench press 60 8\``;
    return msg;
  }

  msg += `*Exercise:*\n`;
  for (const ex of session.exercises) {
    const exName = ex.exercise?.name ?? 'Unknown';
    const setCount = ex.sets?.length ?? 0;
    msg += `\n🏋️ *${exName}* (${setCount} set)\n`;

    for (const set of ex.sets ?? []) {
      const prBadge = set.is_pr ? ' 🏆 PR!' : '';
      msg += `  Set ${set.set_number}: ${set.weight_kg}kg × ${set.reps} reps${prBadge}\n`;
    }
  }

  return msg;
}

function buildSummaryMessage(session: WorkoutSessionWithDetails | null): string {
  if (!session) return '✅ Session selesai!';

  const duration = session.duration_minutes ?? 0;
  const totalExercises = session.exercises?.length ?? 0;
  const totalSets = session.exercises?.reduce(
    (acc, ex) => acc + (ex.sets?.length ?? 0), 0
  ) ?? 0;
  const totalVolume = session.exercises?.reduce((acc, ex) => {
    return acc + (ex.sets?.reduce((s, set) => {
      return s + ((set.weight_kg ?? 0) * (set.reps ?? 0));
    }, 0) ?? 0);
  }, 0) ?? 0;
  const prCount = session.exercises?.reduce((acc, ex) => {
    return acc + (ex.sets?.filter(s => s.is_pr).length ?? 0);
  }, 0) ?? 0;

  let msg = `🎉 *Session Selesai!*\n\n`;
  msg += `⏱️ Durasi: *${duration} menit*\n`;
  msg += `🏋️ Exercise: *${totalExercises}*\n`;
  msg += `📝 Total Set: *${totalSets}*\n`;
  msg += `📦 Total Volume: *${totalVolume.toLocaleString('id')} kg*\n`;
  if (prCount > 0) {
    msg += `🏆 PR Baru: *${prCount}*\n`;
  }

  msg += `\n*Ringkasan:*\n`;
  for (const ex of session.exercises ?? []) {
    const exName = ex.exercise?.name ?? 'Unknown';
    msg += `\n🏋️ *${exName}*\n`;
    for (const set of ex.sets ?? []) {
      const prBadge = set.is_pr ? ' 🏆' : '';
      msg += `  Set ${set.set_number}: ${set.weight_kg}kg × ${set.reps}${prBadge}\n`;
    }
  }

  const motivations = [
    'Kerja keras hari ini, hasil luar biasa esok hari! 💪',
    'Konsistensi adalah kunci. Sampai jumpa di sesi berikutnya! 🔥',
    'Tubuhmu berterima kasih atas kerja kerasmu! 🙌',
    'Satu sesi lebih baik dari nol. Bangga sama kamu! ⭐',
  ];
  const randomMotivation = motivations[Math.floor(Math.random() * motivations.length)];
  msg += `\n_${randomMotivation}_`;

  return msg;
}