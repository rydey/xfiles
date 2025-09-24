import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = 'admin123';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN'
    }
  });

  console.log('✅ Admin user created:', {
    username: admin.username,
    role: admin.role,
    password: adminPassword
  });

  // Create journalist user
  const journalistPassword = 'journalist123';
  const journalistPasswordHash = await bcrypt.hash(journalistPassword, 10);

  const journalist = await prisma.user.upsert({
    where: { username: 'journalist' },
    update: {},
    create: {
      username: 'journalist',
      passwordHash: journalistPasswordHash,
      role: 'JOURNALIST'
    }
  });

  console.log('✅ Journalist user created:', {
    username: journalist.username,
    role: journalist.role,
    password: journalistPassword
  });

  // Create some sample categories
  const categories = [
    'Family',
    'Friends', 
    'Work',
    'Business',
    'Emergency'
  ];

  for (const categoryName of categories) {
    await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName }
    });
  }

  console.log('✅ Sample categories created');

  console.log('\n🎉 Database seeding completed!');
  console.log('\n📋 Login Credentials:');
  console.log('👑 Admin:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('   Role: ADMIN');
  console.log('\n📰 Journalist:');
  console.log('   Username: journalist');
  console.log('   Password: journalist123');
  console.log('   Role: JOURNALIST');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
