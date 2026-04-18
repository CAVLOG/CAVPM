
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURAÇÃO DO SUPABASE (SQL)
// ------------------------------------------------------------------

const SUPABASE_URL = 'https://ryacqblnzzjwfvyqapip.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5YWNxYmxuenpqd2Z2eXFhcGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MDE1NTksImV4cCI6MjA4MDE3NzU1OX0.Q2oMzkaVvZi86Dl4OAYZmYAlQ_LzEtikrCwrYC2h83U';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
