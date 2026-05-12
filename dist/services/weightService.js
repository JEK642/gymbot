"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWeight = logWeight;
exports.getLatestWeight = getLatestWeight;
exports.getWeightProgress = getWeightProgress;
exports.getAllWeightLogs = getAllWeightLogs;
const supabase_1 = require("../config/supabase");
// ============================================
// Simpan log berat badan baru
// ============================================
async function logWeight(telegramId, weight) {
    const { error } = await supabase_1.supabase.from('weight_logs').insert({
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
async function getLatestWeight(telegramId) {
    const { data, error } = await supabase_1.supabase
        .from('weight_logs')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('logged_at', { ascending: false })
        .limit(1)
        .single();
    if (error)
        return null;
    return data;
}
// ============================================
// BARU: Ambil 2 log terakhir dan hitung progress
//
// Kenapa 2 log terakhir?
// - Log ke-1 (latest) = berat sekarang
// - Log ke-2 (previous) = berat sebelumnya
// - diff = selisih keduanya
// ============================================
async function getWeightProgress(telegramId) {
    const { data, error } = await supabase_1.supabase
        .from('weight_logs')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('logged_at', { ascending: false })
        .limit(2); // ambil 2 log terbaru
    // Kalau error atau belum ada log sama sekali
    if (error || !data || data.length === 0) {
        return { latest: null, previous: null, diff: null, trend: 'none' };
    }
    const latest = data[0];
    const previous = data.length > 1 ? data[1] : null;
    // Hitung selisih berat (dibulatkan 1 desimal)
    let diff = null;
    let trend = 'none';
    if (previous) {
        diff = Number((latest.weight - previous.weight).toFixed(1));
        if (diff > 0)
            trend = 'up';
        else if (diff < 0)
            trend = 'down';
        else
            trend = 'same';
    }
    return { latest, previous, diff, trend };
}
// ============================================
// Ambil semua log berat (untuk history/chart nanti)
// ============================================
async function getAllWeightLogs(telegramId) {
    const { data, error } = await supabase_1.supabase
        .from('weight_logs')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('logged_at', { ascending: true });
    if (error)
        return [];
    return data;
}
