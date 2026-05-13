// prService.ts
// Bertanggung jawab untuk:
// - Menghitung estimated 1RM pakai Epley Formula
// - Mengecek apakah set baru merupakan PR baru
// - Menyimpan PR ke tabel personal_records

import { supabase } from '../config/supabase';
import { PersonalRecord, ExerciseSet } from '../types';

// ------------------------------------------------------------
// calculateEpley1RM
// Rumus Epley: 1RM = weight × (1 + reps/30)
// Estimasi berat maksimal yang bisa diangkat untuk 1 repetisi
// Contoh: 60kg × 8 reps → 1RM ≈ 76kg
//
// Kenapa Epley? Paling umum dipakai, cocok untuk 1-10 reps
// Untuk reps > 15 hasilnya kurang akurat, tapi cukup untuk kita
// ------------------------------------------------------------
export function calculateEpley1RM(weight_kg: number, reps: number): number {
  const raw = weight_kg * (1 + reps / 30);
  return Math.round(raw * 10) / 10; // bulatkan ke 1 desimal
}

// ------------------------------------------------------------
// getCurrentPR
// Ambil PR terbaik user untuk exercise tertentu
// Diurutkan by estimated_1rm descending → ambil yang tertinggi
// ------------------------------------------------------------
export async function getCurrentPR(
  telegram_id: string,
  exercise_id: string
): Promise<PersonalRecord | null> {
  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('telegram_id', telegram_id)
    .eq('exercise_id', exercise_id)
    .order('estimated_1rm', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[prService] getCurrentPR error:', error.message);
    throw new Error('Gagal mengambil PR');
  }

  return data;
}

// ------------------------------------------------------------
// checkAndUpdatePR
// Fungsi utama: cek apakah set ini PR baru, kalau iya simpan
//
// Flow:
// 1. Hitung 1RM dari set ini
// 2. Ambil PR saat ini
// 3. Bandingkan: kalau lebih tinggi → ini PR baru
// 4. Upsert ke personal_records
// 5. Return hasil (isPR + data PR baru/lama)
// ------------------------------------------------------------
export async function checkAndUpdatePR(params: {
  telegram_id: string;
  exercise_id: string;
  session_id: string;
  set: ExerciseSet;
}): Promise<{
  isPR: boolean;
  newPR?: PersonalRecord;
  previousPR?: PersonalRecord;
}> {
  const { telegram_id, exercise_id, session_id, set } = params;

  // Guard: kalau tidak ada weight atau reps, skip PR check
  // (bisa terjadi untuk exercise bodyweight atau time-based)
  if (!set.weight_kg || !set.reps) {
    return { isPR: false };
  }

  const new1RM = calculateEpley1RM(set.weight_kg, set.reps);
  const currentPR = await getCurrentPR(telegram_id, exercise_id);

  const isPR = !currentPR || new1RM > currentPR.estimated_1rm;

  if (!isPR) {
    return { isPR: false, previousPR: currentPR ?? undefined };
  }

  // Ini PR baru! Simpan ke database
  const { data: newPR, error } = await supabase
    .from('personal_records')
    .insert({
      telegram_id,
      exercise_id,
      session_id,
      weight_kg: set.weight_kg,
      reps: set.reps,
      estimated_1rm: new1RM,
      achieved_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[prService] checkAndUpdatePR error:', error.message);
    throw new Error('Gagal menyimpan PR baru');
  }

  return {
    isPR: true,
    newPR,
    previousPR: currentPR ?? undefined,
  };
}

// ------------------------------------------------------------
// getUserPRs
// Ambil semua PR terbaik user, satu per exercise
// Dipakai untuk halaman stats / dashboard
// ------------------------------------------------------------
export async function getUserPRs(
  telegram_id: string
): Promise<PersonalRecord[]> {
  // Supabase tidak support DISTINCT ON langsung,
  // jadi kita ambil semua lalu filter di aplikasi
  // Kalau data sudah besar, pertimbangkan pakai view di DB
  const { data, error } = await supabase
    .from('personal_records')
    .select('*, exercises(id, name, equipment)')
    .eq('telegram_id', telegram_id)
    .order('achieved_at', { ascending: false });

  if (error) {
    throw new Error('Gagal mengambil PR');
  }

  // Ambil 1 PR terbaik per exercise berdasarkan estimated_1rm
  const prMap = new Map<string, PersonalRecord>();
  for (const pr of data ?? []) {
    const existing = prMap.get(pr.exercise_id);
    if (!existing || pr.estimated_1rm > existing.estimated_1rm) {
      prMap.set(pr.exercise_id, { ...pr, exercise: pr.exercises });
    }
  }

  return Array.from(prMap.values());
}