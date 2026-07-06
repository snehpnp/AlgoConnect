import prisma from './models/prismaClient';

async function main() {
  try {
    const roles = await prisma.role.findMany();
    console.log("Roles in DB:", roles);
    const users = await prisma.user.findMany({ 
      select: { id: true, email: true, name: true, roleId: true } 
    });
    console.log("Users in DB:", users);
  } catch (error) {
    console.error("Error querying DB:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
