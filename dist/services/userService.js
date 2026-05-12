"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.getUserByTelegramId = getUserByTelegramId;
const supabase_1 = require("../config/supabase");
// ============================================
// Registers a user if they don't exist yet.
// Called every time /start is used.
// Uses "upsert" = insert OR update on conflict.
// ============================================
async function registerUser(telegramId, username) {
    const { error } = await supabase_1.supabase
        .from('users')
        .upsert({
        telegram_id: telegramId,
        username: username,
    }, {
        // If this telegram_id already exists, update the username silently
        onConflict: 'telegram_id',
        ignoreDuplicates: false,
    });
    if (error) {
        // Surface errors so they can be caught upstream
        throw new Error(`registerUser failed: ${error.message}`);
    }
}
// ============================================
// Fetches a user record by their Telegram ID.
// Useful if you need to check if a user exists.
// ============================================
async function getUserByTelegramId(telegramId) {
    const { data, error } = await supabase_1.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single(); // Returns one row or null
    if (error)
        return null;
    return data;
}
