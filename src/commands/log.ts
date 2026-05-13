// log.ts
// Command handler untuk /log
// Format: /log bench press 60 8
//         /log squat 100 5 rpe:8
//
// Ini adalah command PALING KRITIS di sistem baru
// Flow: parse → cari session → cari exercise → insert set → cek PR

import { Context } from 'telegraf';
import { getActiveSession } from '../services/sessionService';
import {
  findExerciseByName,
  getOrCreateSessionExercise,
} from '../services/exerciseService';
import { insertSet, markSetAsPR } from '../services/setService';
import { checkAndUpdatePR } from '../services/prService';
import { afterLogKeyboard } from '../keyboards/sessionMenu';
import { LogSetInput } from '../types';

// ============================================================
// handleLog — entry point untuk command /log
// ============================================================
export async function handleLog(ctx: Context) {
  const telegram_id = String(ctx.from?.id);
  if (!telegram_id) return;

  const text = (ctx.message as any)?.text ?? '';

  // ------------------------------------------------------------
  // PARSING INPUT
  // Format: /log [nama exercise] [berat] [reps] [opsional: rpe:N]
  // Trik: angka terakhir = reps, angka sebelumnya = weight
  // Semua kata sebelum angka pertama = nama exercise
  //
  // Contoh: "/log bench press 60 8"
  //   → exercise: "bench press", weight: 60, reps: 8
  //
  // Contoh: "/log overhead press 50 10 rpe:7"
  //   → exercise: "overhead press", weight: 50, reps: 10, rpe: 7
  // ------------------------------------------------------------
  const parsed = parseLogCommand(text);

  if (!parsed) {
    await ctx.reply(
      `❌ *Format salah!*\n\n` +
      `Cara pakai:\n` +
      `\`/log bench press 60 8\`\n` +
      `\`/log squat 100 5\`\n` +
      `\`/log deadlift 140 3 rpe:9\`\n\n` +
      `Format: \`/log [exercise] [berat kg] [reps]\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  try {
    // ------------------------------------------------------------
    // GUARD: Cek ada active session
    // ------------------------------------------------------------
    const activeSession = await getActiveSession(telegram_id);
    if (!activeSession) {
      await ctx.reply(
        `😴 *Belum ada session aktif!*\n\n` +
        `Mulai session dulu dengan:\n` +
        `\`/session start\`\n` +
        `\`/session start push\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // ------------------------------------------------------------
    // CARI EXERCISE
    // Pakai partial match — user tidak harus ketik nama persis
    // ------------------------------------------------------------
    const exercise = await findExerciseByName(parsed.exercise_name);
    if (!exercise) {
      await ctx.reply(
        `🔍 Exercise *"${parsed.exercise_name}"* tidak ditemukan.\n\n` +
        `Coba cek daftar exercise dengan /exercises\n` +
        `atau pastikan nama sudah benar.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // ------------------------------------------------------------
    // GET OR CREATE SESSION EXERCISE
    // Insert ke session_exercises kalau exercise ini baru dalam session
    // ------------------------------------------------------------
    const sessionExercise = await getOrCreateSessionExercise(
      activeSession.id,
      exercise.id
    );

    // ------------------------------------------------------------
    // INSERT SET
    // ------------------------------------------------------------
    const set = await insertSet({
      session_exercise_id: sessionExercise.id,
      weight_kg: parsed.weight_kg,
      reps: parsed.reps,
      rpe: parsed.rpe,
      is_pr: false, // akan di-update setelah PR check
    });

    // ------------------------------------------------------------
    // CEK PR
    // Kalau ini PR baru, update set.is_pr dan simpan ke personal_records
    // ------------------------------------------------------------
    const prResult = await checkAndUpdatePR({
      telegram_id,
      exercise_id: exercise.id,
      session_id: activeSession.id,
      set,
    });

    if (prResult.isPR) {
      await markSetAsPR(set.id);
    }

    // ------------------------------------------------------------
    // BUILD REPLY MESSAGE
    // ------------------------------------------------------------
    const setNumber = set.set_number;
    const rpeText = parsed.rpe ? ` | RPE ${parsed.rpe}` : '';

    let replyMsg = `✅ *${exercise.name}*\n`;
    replyMsg += `Set ${setNumber}: *${parsed.weight_kg}kg × ${parsed.reps} reps*${rpeText}\n`;

    if (prResult.isPR && prResult.newPR) {
      const new1RM = prResult.newPR.estimated_1rm;
      const oldText = prResult.previousPR
        ? ` _(sebelumnya ${prResult.previousPR.estimated_1rm}kg)_`
        : ' _(pertama kali!)_';
      replyMsg += `\n🏆 *PR BARU!* Estimated 1RM: ${new1RM}kg${oldText}`;
    }

    // Tambah info set-set sebelumnya dalam session ini (max 5 terakhir)
    const { getSetsForSessionExercise } = await import('../services/setService');
    const allSets = await getSetsForSessionExercise(sessionExercise.id);
    if (allSets.length > 1) {
      replyMsg += `\n\n📋 *${exercise.name} hari ini:*\n`;
      allSets.forEach((s) => {
        const pr = s.is_pr || (prResult.isPR && s.id === set.id) ? ' 🏆' : '';
        replyMsg += `  Set ${s.set_number}: ${s.weight_kg}kg × ${s.reps}${pr}\n`;
      });
    }

    await ctx.reply(replyMsg, {
      parse_mode: 'Markdown',
      ...afterLogKeyboard,
    });
  } catch (err) {
    console.error('[log] handleLog error:', err);
    await ctx.reply('❌ Gagal menyimpan set. Coba lagi ya!');
  }
}

// ============================================================
// parseLogCommand
// Parse raw text dari command /log menjadi structured data
//
// Strategi parsing:
// 1. Buang prefix "/log "
// 2. Cari angka-angka dari BELAKANG
//    - angka terakhir = reps
//    - angka sebelumnya = weight
// 3. Semua yang tersisa di depan = nama exercise
// 4. Cari optional "rpe:N" di mana saja
//
// Return null kalau format tidak valid
// ============================================================
function parseLogCommand(text: string): {
  exercise_name: string;
  weight_kg: number;
  reps: number;
  rpe?: number;
} | null {
  // Buang "/log " dari awal
  const raw = text.replace(/^\/log\s+/i, '').trim();
  if (!raw) return null;

  // Extract RPE kalau ada (format: rpe:8 atau rpe:7.5)
  let rpe: number | undefined;
  const cleaned = raw.replace(/\brpe:(\d+(?:\.\d+)?)\b/i, (_, val) => {
    rpe = parseFloat(val);
    return '';
  }).trim();

  // Tokenize
  const tokens = cleaned.split(/\s+/);
  if (tokens.length < 3) return null; // minimal: [exercise] [weight] [reps]

  // Dari belakang: cari 2 angka terakhir
  let reps: number | null = null;
  let weight_kg: number | null = null;
  const nameParts: string[] = [];

  // Scan dari belakang
  const reversed = [...tokens].reverse();
  let numbersFound = 0;

  for (const token of reversed) {
    if (numbersFound < 2 && /^\d+(\.\d+)?$/.test(token)) {
      if (numbersFound === 0) reps = parseFloat(token);
      else if (numbersFound === 1) weight_kg = parseFloat(token);
      numbersFound++;
    } else {
      nameParts.unshift(token); // tambah ke depan karena kita scan dari belakang
    }
  }

  if (reps === null || weight_kg === null || nameParts.length === 0) {
    return null;
  }

  const exercise_name = nameParts.join(' ').trim();
  if (!exercise_name) return null;

  return { exercise_name, weight_kg, reps, rpe };
}