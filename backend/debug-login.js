const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function debugLogin() {
  try {
    console.log('🔍 Checking admin user...');
    
    const user = await prisma.user.findUnique({
      where: { username: 'admin' }
    });
    
    if (!user) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log('✅ Admin user found:', {
      id: user.id,
      username: user.username,
      role: user.role,
      passwordHash: user.passwordHash.substring(0, 20) + '...'
    });
    
    console.log('🔍 Testing password comparison...');
    const testPassword = 'admin123';
    const isMatch = await bcrypt.compare(testPassword, user.passwordHash);
    
    console.log('Password match:', isMatch);
    
    if (!isMatch) {
      console.log('🔍 Testing with fresh hash...');
      const freshHash = await bcrypt.hash(testPassword, 10);
      console.log('Fresh hash:', freshHash.substring(0, 20) + '...');
      
      const freshMatch = await bcrypt.compare(testPassword, freshHash);
      console.log('Fresh hash match:', freshMatch);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLogin();
