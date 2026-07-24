import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jtzazvkshizmuhezuxwl.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0emF6dmtzaGl6bXVoZXp1eHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MTE3NDQsImV4cCI6MjEwMDE4Nzc0NH0._j5oYUljKdZ08njGCnbMpbTrYJRAU6H_VdIaMlk7XWQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
