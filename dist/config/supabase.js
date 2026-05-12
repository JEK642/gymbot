"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
// Load .env variables into process.env
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
// Validate that keys exist — fail fast if misconfigured
if (!supabaseUrl || !supabaseKey) {
    throw new Error('❌ Missing Supabase credentials. Check your .env file for SUPABASE_URL and SUPABASE_ANON_KEY.');
}
// Create and export a single Supabase client instance
// This is like your axios instance or React Query client — initialized once, used everywhere
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
