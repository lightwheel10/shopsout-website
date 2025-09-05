(function(){
  const url = window.APP_ENV?.SUPABASE_URL;
  const key = window.APP_ENV?.SUPABASE_ANON_KEY;
  if (!url || !key) {
    // console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY. Set window.APP_ENV.SUPABASE_URL and window.APP_ENV.SUPABASE_ANON_KEY.');
    return;
  }
  window.supabaseClient = window.supabase.createClient(url, key, {
    auth: { persistSession: false }
  });
})();

