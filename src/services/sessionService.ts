// sessionService.ts
// Bertanggung jawab untuk lifecycle workout session:
// buat session baru, ambil active session, finalisasi session

import { supabase } from '../config/supabase';
import {
  WorkoutSession,
  WorkoutSessionWithDetails,
  StartSessionInput,
  SessionStatus,
} from '../types';

// ------------------------------------------------------------
// getActiveSession
// Cek apakah user sedang punya session yang in_progress
// Dipanggil oleh hampir semua command baru sebagai guard check
// ------------------------------------------------------------
export async function getActiveSession(
  telegram_id: string
): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('telegram_id', telegram_id)
    .eq('status', 'in_progress')
    .limit(1)
    .maybeSingle(); // maybeSingle: tidak throw error kalau null

  if (error) {
    console.error('[sessionService] getActiveSession error:', error.message);
    throw new Error('Gagal mengambil session aktif');
  }

  return data;
}

// ------------------------------------------------------------
// startSession
// Buat workout session baru
// Sebelum dipanggil, pastikan tidak ada active session
// (validasi dilakukan di command handler, bukan di sini)
// ------------------------------------------------------------
export async function startSession(
  input: StartSessionInput
): Promise<WorkoutSession> {
  // Cari split_id kalau user kasih nama split
  let split_id: string | undefined;

  if (input.split_name) {
    const { data: split } = await supabase
      .from('splits')
      .select('id')
      .ilike('name', `%${input.split_name}%`) // ilike = case-insensitive LIKE
      .limit(1)
      .maybeSingle();

    if (split) {
      split_id = split.id;
    }
    // Kalau split tidak ketemu, tetap lanjut tanpa split_id
    // Jangan block user hanya karena nama split salah ketik
  }

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      telegram_id: input.telegram_id,
      split_id: split_id ?? null,
      name: input.session_name ?? null,
      started_at: new Date().toISOString(),
      status: 'in_progress',
    })
    .select()
    .single();

  if (error) {
    console.error('[sessionService] startSession error:', error.message);
    throw new Error('Gagal membuat session baru');
  }

  return data;
}

// ------------------------------------------------------------
// finishSession
// Finalisasi session: ubah status ke completed, hitung durasi
// Dipanggil oleh command /done
// ------------------------------------------------------------
export async function finishSession(
  session_id: string
): Promise<WorkoutSession> {
  const finished_at = new Date().toISOString();

  // Ambil dulu session-nya untuk hitung durasi
  const { data: session, error: fetchError } = await supabase
    .from('workout_sessions')
    .select('started_at')
    .eq('id', session_id)
    .single();

  if (fetchError || !session) {
    throw new Error('Session tidak ditemukan');
  }

  // Hitung durasi dalam menit
  const startTime = new Date(session.started_at).getTime();
  const endTime = new Date(finished_at).getTime();
  const duration_minutes = Math.round((endTime - startTime) / 1000 / 60);

  const { data, error } = await supabase
    .from('workout_sessions')
    .update({
      status: 'completed' as SessionStatus,
      finished_at,
      duration_minutes,
    })
    .eq('id', session_id)
    .select()
    .single();

  if (error) {
    console.error('[sessionService] finishSession error:', error.message);
    throw new Error('Gagal menyelesaikan session');
  }

  return data;
}

// ------------------------------------------------------------
// getSessionWithDetails
// Ambil session beserta semua exercise dan sets-nya
// Dipakai untuk /session status dan summary setelah /done
// ------------------------------------------------------------
export async function getSessionWithDetails(
  session_id: string
): Promise<WorkoutSessionWithDetails | null> {
  // Query session utama
  const { data: session, error: sessionError } = await supabase
    .from('workout_sessions')
    .select('*, splits(name, description)')
    .eq('id', session_id)
    .maybeSingle();

  if (sessionError) {
    throw new Error('Gagal mengambil detail session');
  }

  if (!session) return null;

  // Query session_exercises beserta sets-nya
  // Kenapa tidak pakai satu query besar? Lebih mudah di-debug
  // dan Supabase nested select kadang tricky untuk array of arrays
  const { data: sessionExercises, error: exError } = await supabase
    .from('session_exercises')
    .select('*, exercises(id, name, equipment)')
    .eq('session_id', session_id)
    .order('exercise_order', { ascending: true });

  if (exError) {
    throw new Error('Gagal mengambil exercise session');
  }

  // Untuk setiap session_exercise, ambil sets-nya
  const exercisesWithSets = await Promise.all(
    (sessionExercises ?? []).map(async (se) => {
      const { data: sets } = await supabase
        .from('exercise_sets')
        .select('*')
        .eq('session_exercise_id', se.id)
        .order('set_number', { ascending: true });

      return {
        ...se,
        exercise: se.exercises,
        sets: sets ?? [],
      };
    })
  );

  return {
    ...session,
    split: session.splits,
    exercises: exercisesWithSets,
  };
}

// ------------------------------------------------------------
// getRecentSessions
// Ambil riwayat session terakhir milik user
// Dipakai untuk statistik dan history
// ------------------------------------------------------------
export async function getRecentSessions(
  telegram_id: string,
  limit: number = 10
): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('telegram_id', telegram_id)
    .eq('status', 'completed')
    .order('finished_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error('Gagal mengambil riwayat session');
  }

  return data ?? [];
}