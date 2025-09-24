const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixAdminPassword() {
  try {
    console.log('🔧 Fixing admin password...');
    
    const newPassword = 'admin123';
    const newHash = await bcrypt.hash(newPassword, 10);
    
    const updatedUser = await prisma.user.update({
      where: { username: 'admin' },
      data: { passwordHash: newHash }
    });
    
    console.log('✅ Admin password updated successfully');
    console.log('New hash:', newHash.substring(0, 20) + '...');
    
    // Test the new password
    const testMatch = await bcrypt.compare(newPassword, newHash);
    console.log('Password test match:', testMatch);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminPassword();
