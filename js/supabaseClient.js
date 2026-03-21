/**
 * Supabase client initialization.
 *
 * Uses the v2 schema — all product/store data lives in v2, not public.
 * The v2 schema was introduced with the multi-tenant SaaS migration.
 */
(function(){
  const url = window.APP_ENV?.SUPABASE_URL;
  const key = window.APP_ENV?.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return;
  }
  window.supabaseClient = window.supabase.createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'v2' }
  });
})();
