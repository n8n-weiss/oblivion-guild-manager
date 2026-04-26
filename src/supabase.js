import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ngmgxqahznycnzuaraez.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nbWd4cWFoem55Y256dWFyYWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDkwNDUsImV4cCI6MjA5MjY4NTA0NX0.YgdGYHa0bgGqKCFQ7-NaNLH7PTodBTNMk2JGRN07J4Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
