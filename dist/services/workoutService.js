"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWorkout = logWorkout;
exports.getWorkoutsThisWeek = getWorkoutsThisWeek;
exports.getTotalWorkouts = getTotalWorkouts;
exports.getLatestWorkout = getLatestWorkout;
const supabase_1 = require("../config/supabase");
// ============================================
// Simpan log workout baru
// Parameter baru: duration, intensity, notes (semua opsional)
// ============================================
async function logWorkout(telegramId, workoutType, duration, intensity, notes) {
    const { error } = await supabase_1.supabase.from('workout_logs').insert({
        telegram_id: telegramId,
        workout_type: workoutType.toLowerCase().trim(),
        duration: duration, // null kalau tidak diisi
        intensity: intensity, // null kalau tidak diisi
        notes: notes, // null kalau tidak diisi
    });
    if (error) {
        throw new Error(`logWorkout failed: ${error.message}`);
    }
}
// ============================================
// Hitung jumlah workout minggu ini
// ============================================
async function getWorkoutsThisWeek(telegramId) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    const { count, error } = await supabase_1.supabase
        .from('workout_logs')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_id', telegramId)
        .gte('logged_at', monday.toISOString());
    if (error)
        return 0;
    return count ?? 0;
}
// ============================================
// Hitung total workout sepanjang masa
// ============================================
async function getTotalWorkouts(telegramId) {
    const { count, error } = await supabase_1.supabase
        .from('workout_logs')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_id', telegramId);
    if (error)
        return 0;
    return count ?? 0;
}
// ============================================
// Ambil detail workout terbaru (untuk konfirmasi)
// ============================================
async function getLatestWorkout(telegramId) {
    const { data, error } = await supabase_1.supabase
        .from('workout_logs')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('logged_at', { ascending: false })
        .limit(1)
        .single();
    if (error)
        return null;
    return data;
}
