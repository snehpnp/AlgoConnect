import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function main() {
  console.log('Seeding database with roles and users...');

  // 1. Create Roles
  const roleNames = ['System Admin', 'Growth Operator', 'Compliance Admin', 'Sales Rep'];
  const createdRoles: Record<string, number> = {};

  for (const roleName of roleNames) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    createdRoles[roleName] = role.id;
    console.log(`✅ Role ready: ${roleName}`);
  }

  // 2. Simple password for all users
  const simplePassword = 'password123';
  const hashedPassword = await bcrypt.hash(simplePassword, 10);

  // 3. User Data
  const users = [
    {
      name: 'System Admin',
      email: 'admin@algoconnect.com',
      password: hashedPassword,
      roleId: createdRoles['System Admin'],
    },
    {
      name: 'Growth Operator',
      email: 'growth@algoconnect.com',
      password: hashedPassword,
      roleId: createdRoles['Growth Operator'],
    },
    {
      name: 'Compliance Admin',
      email: 'compliance@algoconnect.com',
      password: hashedPassword,
      roleId: createdRoles['Compliance Admin'],
    },
    {
      name: 'Sales Rep',
      email: 'sales@algoconnect.com',
      password: hashedPassword,
      roleId: createdRoles['Sales Rep'],
    },
  ];

  // 4. Create Users
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: { roleId: userData.roleId },
      create: userData,
    });
    console.log(`✅ User ready: ${user.name} | Email: ${user.email} | Password: ${simplePassword}`);
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
