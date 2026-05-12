import { supabase } from '../config/supabase';
import { WeightLog, WeightProgress } from '../types';

// ============================================
// Simpan log berat badan baru
// ============================================
export async function logWeight(telegramId: number, weight: number): Promise<void> {
  const { error } = await supabase.from('weight_logs').insert({
    telegram_id: telegramId,
    weight: weight,
  });

  if (error) {
    throw new Error(`logWeight failed: ${error.message}`);
  }
}

// ============================================
// Ambil log berat terbaru
// ============================================
export async function getLatestWeight(telegramId: number): Promise<WeightLog | null> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('telegram_id', telegramId)
    .order('logged_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as WeightLog;
}

// ============================================
// BARU: Ambil 2 log terakhir dan hitung progress
//
// Kenapa 2 log terakhir?
// - Log ke-1 (latest) = berat sekarang
// - Log ke-2 (previous) = berat sebelumnya
// - diff = selisih keduanya
// ============================================
export async function getWeightProgress(telegramId: number): Promise<WeightProgress> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('telegram_id', telegramId)
    .order('logged_at', { ascending: false })
    .limit(2); // ambil 2 log terbaru

  // Kalau error atau belum ada log sama sekali
  if (error || !data || data.length === 0) {
    return { latest: null, previous: null, diff: null, trend: 'none' };
  }

  const latest = data[0] as WeightLog;
  const previous = data.length > 1 ? (data[1] as WeightLog) : null;

  // Hitung selisih berat (dibulatkan 1 desimal)
  let diff: number | null = null;
  let trend: WeightProgress['trend'] = 'none';

  if (previous) {
    diff = Number((latest.weight - previous.weight).toFixed(1));

    if (diff > 0) trend = 'up';
    else if (diff < 0) trend = 'down';
    else trend = 'same';
  }

  return { latest, previous, diff, trend };
}

// ============================================
// Ambil semua log berat (untuk history/chart nanti)
// ============================================
export async function getAllWeightLogs(telegramId: number): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('telegram_id', telegramId)
    .order('logged_at', { ascending: true });

  if (error) return [];
  return data as WeightLog[];
}