// exerciseService.ts
// Bertanggung jawab untuk:
// - Mencari exercise berdasarkan nama (fuzzy search)
// - Mengambil atau membuat session_exercise entry
// - List exercises untuk ditampilkan ke user

import { supabase } from '../config/supabase';
import { Exercise, SessionExercise } from '../types';

// ------------------------------------------------------------
// findExerciseByName
// Cari exercise pakai ILIKE (case-insensitive partial match)
// Contoh: "bench" bisa ketemu "Bench Press", "Incline Bench"
// Return null kalau tidak ketemu → command handler bisa
// kasih pesan error yang ramah ke user
// ------------------------------------------------------------
export async function findExerciseByName(
  name: string
): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[exerciseService] findExerciseByName error:', error.message);
    throw new Error('Gagal mencari exercise');
  }

  return data;
}

// ------------------------------------------------------------
// findExerciseByNameStrict
// Cari dengan exact match (case-insensitive)
// Dipakai kalau user ketik nama exercise persis
// ------------------------------------------------------------
export async function findExerciseByNameStrict(
  name: string
): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .ilike('name', name.trim()) // tidak pakai wildcard %
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Gagal mencari exercise');
  }

  return data;
}

// ------------------------------------------------------------
// getOrCreateSessionExercise
// Cek apakah exercise sudah masuk ke session ini
// Kalau belum, insert baru dengan exercise_order berikutnya
//
// Kenapa "get or create"?
// User bisa log multiple sets untuk exercise yang sama
// misal: bench press set 1, lalu bench press set 2
// Kita tidak mau duplikat di session_exercises
// ------------------------------------------------------------
export async function getOrCreateSessionExercise(
  session_id: string,
  exercise_id: string
): Promise<SessionExercise> {
  // Cek apakah sudah ada
  const { data: existing } = await supabase
    .from('session_exercises')
    .select('*')
    .eq('session_id', session_id)
    .eq('exercise_id', exercise_id)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // Belum ada, hitung exercise_order berikutnya
  const { count } = await supabase
    .from('session_exercises')
    .select('*', { count: 'exact', head: true }) // head:true = tidak ambil data
    .eq('session_id', session_id);

  const nextOrder = (count ?? 0) + 1;

  const { data: created, error } = await supabase
    .from('session_exercises')
    .insert({
      session_id,
      exercise_id,
      exercise_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    console.error(
      '[exerciseService] getOrCreateSessionExercise error:',
      error.message
    );
    throw new Error('Gagal menambahkan exercise ke session');
  }

  return created;
}

// ------------------------------------------------------------
// listExercises
// Ambil semua exercise (untuk command /exercises)
// Bisa filter by equipment atau movement pattern
// ------------------------------------------------------------
export async function listExercises(options?: {
  equipment?: string;
  limit?: number;
}): Promise<Exercise[]> {
  let query = supabase
    .from('exercises')
    .select('*')
    .order('name', { ascending: true });

  if (options?.equipment) {
    query = query.ilike('equipment', `%${options.equipment}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Gagal mengambil daftar exercise');
  }

  return data ?? [];
}

// ------------------------------------------------------------
// getExerciseById
// Ambil satu exercise berdasarkan ID
// Dipakai setelah kita punya exercise_id dari tabel lain
// ------------------------------------------------------------
export async function getExerciseById(
  exercise_id: string
): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', exercise_id)
    .maybeSingle();

  if (error) {
    throw new Error('Gagal mengambil exercise');
  }

  return data;
}