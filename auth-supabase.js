const SUPABASE_URL = 'https://ggpjinhvxvieaeulhdyw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncGppbmh2eHZpZWFldWxoZHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzOTg1MzUsImV4cCI6MjA3Njk3NDUzNX0.2TsTZEQaJ8Dq7BRLm7SVjjA8SH9JWphQ6kF7OFztiug';

let _supabaseClient = null;

function isConfigured() {
    return !SUPABASE_URL.includes('YOUR_PROJECT_ID');
}

function initSupabase() {
    if (_supabaseClient) return _supabaseClient;
    if (!isConfigured()) return null;
    if (typeof window.supabase?.createClient === 'undefined') {
        console.error('❌ Supabase library not loaded');
        return null;
    }
    _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase initialized');
    return _supabaseClient;
}

window.supabaseConfig = {
    init: initSupabase,
    getClient: () => _supabaseClient,
    isConfigured
};