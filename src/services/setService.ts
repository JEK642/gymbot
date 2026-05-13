// setService.ts
// Bertanggung jawab untuk menyimpan exercise_sets
// dan menghitung nomor set secara otomatis

import { supabase } from '../config/supabase';
import { ExerciseSet, SetType } from '../types';

// ------------------------------------------------------------
// getNextSetNumber
// Hitung set ke berapa untuk exercise ini dalam session
// Contoh: sudah ada 2 set bench press → return 3
// ------------------------------------------------------------
export async function getNextSetNumber(
  session_exercise_id: string
): Promise<number> {
  const { count, error } = await supabase
    .from('exercise_sets')
    .select('*', { count: 'exact', head: true })
    .eq('session_exercise_id', session_exercise_id);

  if (error) {
    throw new Error('Gagal menghitung set');
  }

  return (count ?? 0) + 1;
}

// ------------------------------------------------------------
// insertSet
// Simpan satu set ke database
// is_pr akan di-update nanti oleh prService setelah PR check
// ------------------------------------------------------------
export async function insertSet(params: {
  session_exercise_id: string;
  weight_kg: number;
  reps: number;
  set_type?: SetType;
  rpe?: number;
  is_pr?: boolean;
}): Promise<ExerciseSet> {
  const set_number = await getNextSetNumber(params.session_exercise_id);

  const { data, error } = await supabase
    .from('exercise_sets')
    .insert({
      session_exercise_id: params.session_exercise_id,
      set_number,
      weight_kg: params.weight_kg,
      reps: params.reps,
      set_type: params.set_type ?? 'working',
      rpe: params.rpe ?? null,
      is_pr: params.is_pr ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error('[setService] insertSet error:', error.message);
    throw new Error('Gagal menyimpan set');
  }

  return data;
}

// ------------------------------------------------------------
// markSetAsPR
// Update set yang baru disimpan kalau ternyata ini PR
// Dipisah dari insertSet karena PR check butuh waktu
// (harus query PR lama dulu sebelum bisa tahu ini PR atau bukan)
// ------------------------------------------------------------
export async function markSetAsPR(set_id: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_sets')
    .update({ is_pr: true })
    .eq('id', set_id);

  if (error) {
    console.error('[setService] markSetAsPR error:', error.message);
    throw new Error('Gagal update PR status');
  }
}

// ------------------------------------------------------------
// getSetsForSessionExercise
// Ambil semua set untuk satu exercise dalam session
// Dipakai untuk tampilkan progress dalam satu session
// ------------------------------------------------------------
export async function getSetsForSessionExercise(
  session_exercise_id: string
): Promise<ExerciseSet[]> {
  const { data, error } = await supabase
    .from('exercise_sets')
    .select('*')
    .eq('session_exercise_id', session_exercise_id)
    .order('set_number', { ascending: true });

  if (error) {
    throw new Error('Gagal mengambil sets');
  }

  return data ?? [];
}