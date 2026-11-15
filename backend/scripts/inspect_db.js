const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgres@localhost:5433/repairhub?schema=public"
    }
  }
});

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, name: true }
  });
  console.log('=== USERS ===');
  console.log(JSON.stringify(users, null, 2));

  const garages = await prisma.garage.findMany();
  console.log('=== GARAGES ===');
  console.log(JSON.stringify(garages, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
