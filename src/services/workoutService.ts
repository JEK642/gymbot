import { supabase } from '../config/supabase';
import { WorkoutLog } from '../types';

// ============================================
// Simpan log workout baru
// Parameter baru: duration, intensity, notes (semua opsional)
// ============================================
export async function logWorkout(
  telegramId: number,
  workoutType: string,
  duration: number | null,
  intensity: string | null,
  notes: string | null
): Promise<void> {
  const { error } = await supabase.from('workout_logs').insert({
    telegram_id: telegramId,
    workout_type: workoutType.toLowerCase().trim(),
    duration: duration,       // null kalau tidak diisi
    intensity: intensity,     // null kalau tidak diisi
    notes: notes,             // null kalau tidak diisi
  });

  if (error) {
    throw new Error(`logWorkout failed: ${error.message}`);
  }
}

// ============================================
// Hitung jumlah workout minggu ini
// ============================================
export async function getWorkoutsThisWeek(telegramId: number): Promise<number> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)
    .gte('logged_at', monday.toISOString());

  if (error) return 0;
  return count ?? 0;
}

// ============================================
// Hitung total workout sepanjang masa
// ============================================
export async function getTotalWorkouts(telegramId: number): Promise<number> {
  const { count, error } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .eq('telegram_id', telegramId);

  if (error) return 0;
  return count ?? 0;
}

// ============================================
// Ambil detail workout terbaru (untuk konfirmasi)
// ============================================
export async function getLatestWorkout(telegramId: number): Promise<WorkoutLog | null> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('telegram_id', telegramId)
    .order('logged_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as WorkoutLog;
}