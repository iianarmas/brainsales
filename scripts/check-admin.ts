import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkAdmin() {
  // Get all users
  const { data: users } = await supabase.auth.admin.listUsers();
  console.log('\n📋 Users in auth.users:');
  users?.users.forEach(u => console.log(`  - ${u.email} (${u.id})`));

  // Get all admins
  const { data: admins } = await supabase.from('admins').select('*');
  console.log('\n👑 Admin records:');
  if (admins && admins.length > 0) {
    admins.forEach(a => console.log(`  - user_id: ${a.user_id}`));
  } else {
    console.log('  ⚠️  No admins found!');
  }
}

checkAdmin();
