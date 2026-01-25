/**
 * Debug script to verify admin authentication
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkAdminAuth() {
  console.log('🔍 Checking admin authentication setup...\n');

  // List all users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }

  console.log('👥 All users:');
  users.forEach(user => {
    console.log(`  - ${user.email} (ID: ${user.id})`);
  });

  // List all admins
  const { data: admins, error: adminsError } = await supabase
    .from('admins')
    .select('*');

  if (adminsError) {
    console.error('\n❌ Error fetching admins:', adminsError);
    return;
  }

  console.log('\n👑 Admin users:');
  if (admins && admins.length > 0) {
    for (const admin of admins) {
      const user = users.find(u => u.id === admin.user_id);
      console.log(`  - ${user?.email || 'Unknown'} (user_id: ${admin.user_id})`);
    }
  } else {
    console.log('  ⚠️  No admins found!');
  }

  // Test the isAdmin function logic
  console.log('\n🧪 Testing isAdmin function logic...');
  const armasUser = users.find(u => u.email === 'armas.cav@gmail.com');

  if (armasUser) {
    console.log(`\n✓ Found armas.cav@gmail.com (ID: ${armasUser.id})`);

    const { data: adminCheck } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', armasUser.id)
      .single();

    if (adminCheck) {
      console.log('✓ User IS in admins table');
    } else {
      console.log('✗ User NOT in admins table');
    }
  } else {
    console.log('\n✗ armas.cav@gmail.com not found');
  }
}

checkAdminAuth();
