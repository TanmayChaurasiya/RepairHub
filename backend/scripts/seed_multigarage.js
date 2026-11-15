const { PrismaClient, Role, GarageStatus, MechanicStatus } = require('../node_modules/@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgres@localhost:5433/repairhub?schema=public"
    }
  }
});

async function main() {
  console.log('Seeding / updating multi-garage records safely...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Garage A: Sharma Auto Works (linked to existing Kanpur garage or created)
  let garageA = await prisma.garage.findFirst({
    where: { city: 'Kanpur' }
  });

  let ownerA = await prisma.user.findUnique({
    where: { email: 'owner@sharmaauto.com' }
  });

  if (!ownerA) {
    ownerA = await prisma.user.create({
      data: {
        email: 'owner@sharmaauto.com',
        passwordHash,
        name: 'Suresh Sharma (Garage Owner)',
        phone: '9876543230',
        role: Role.GARAGE
      }
    });
    console.log('Created Garage Owner A: owner@sharmaauto.com');
  }

  if (garageA) {
    await prisma.garage.update({
      where: { id: garageA.id },
      data: {
        name: 'Sharma Auto Works',
        ownerId: ownerA.id,
        status: GarageStatus.APPROVED,
        isVerified: true,
        state: 'Uttar Pradesh',
        pinCode: '208005',
        description: 'Premier multi-brand vehicle repair and diagnostics center in Kanpur with 15+ years experience.',
        operatingHours: '09:00 AM - 08:00 PM (Mon - Sat)',
        services: ['ENGINE', 'BRAKES', 'ELECTRICAL', 'AC', 'SUSPENSION', 'GENERAL_SERVICE', 'BODYWORK']
      }
    });
    console.log(`Updated Garage A (${garageA.id}) with owner ${ownerA.email}`);
  }

  // Ensure mechanics in garageA have status ACTIVE
  await prisma.mechanicProfile.updateMany({
    data: {
      status: MechanicStatus.ACTIVE
    }
  });

  // 2. Garage B: City Motors (PENDING approval by Master Admin)
  let ownerB = await prisma.user.findUnique({
    where: { email: 'citymotors@gmail.com' }
  });

  if (!ownerB) {
    ownerB = await prisma.user.create({
      data: {
        email: 'citymotors@gmail.com',
        passwordHash,
        name: 'Rajiv Malhotra (City Motors)',
        phone: '9876543240',
        role: Role.GARAGE
      }
    });
    console.log('Created Garage Owner B: citymotors@gmail.com');
  }

  let garageB = await prisma.garage.findFirst({
    where: { name: 'City Motors' }
  });

  if (!garageB) {
    garageB = await prisma.garage.create({
      data: {
        name: 'City Motors',
        address: '45 Hazratganj Main Road',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pinCode: '226001',
        phone: '0522-2618000',
        description: 'Modern European & Asian car care and fast servicing garage in Lucknow.',
        operatingHours: '08:30 AM - 07:30 PM (All days)',
        services: ['ENGINE', 'BRAKES', 'ELECTRICAL', 'GENERAL_SERVICE'],
        status: GarageStatus.PENDING,
        isVerified: false,
        ownerId: ownerB.id
      }
    });
    console.log('Created Garage B: City Motors (PENDING)');
  }

  // 3. Garage C: Royal Garage (APPROVED)
  let ownerC = await prisma.user.findUnique({
    where: { email: 'royalgarage@gmail.com' }
  });

  if (!ownerC) {
    ownerC = await prisma.user.create({
      data: {
        email: 'royalgarage@gmail.com',
        passwordHash,
        name: 'Vikramaditya Roy (Royal Garage)',
        phone: '9876543250',
        role: Role.GARAGE
      }
    });
    console.log('Created Garage Owner C: royalgarage@gmail.com');
  }

  let garageC = await prisma.garage.findFirst({
    where: { name: 'Royal Garage' }
  });

  if (!garageC) {
    garageC = await prisma.garage.create({
      data: {
        name: 'Royal Garage',
        address: '88 Civil Lines, Near Mall Road',
        city: 'Kanpur',
        state: 'Uttar Pradesh',
        pinCode: '208001',
        phone: '0512-2304500',
        description: 'Luxury and premium automotive restoration, tuning and body repair specialists.',
        operatingHours: '10:00 AM - 07:00 PM (Mon - Sat)',
        services: ['BODYWORK', 'AC', 'SUSPENSION', 'GENERAL_SERVICE'],
        status: GarageStatus.APPROVED,
        isVerified: true,
        ownerId: ownerC.id
      }
    });
    console.log('Created Garage C: Royal Garage (APPROVED)');
  }

  console.log('Multi-garage records successfully seeded/updated!');
}

main().catch(console.error).finally(() => prisma.$disconnect());

