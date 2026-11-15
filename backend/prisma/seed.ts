import {
  PrismaClient,
  Role,
  VehicleType,
  RepairCategory,
  RequestStatus,
  EstimateStatus,
  EstimateItemKind,
  PaymentStatus,
  ComplaintStatus,
  GarageStatus,
  MechanicStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding RepairHub database...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.mechanicInvitation.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.estimateItem.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.repairRequest.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.mechanicProfile.deleteMany();
  await prisma.garage.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();

  const masterAdminEmail = process.env.MASTER_ADMIN_EMAIL || 'mrbindastanmay@gmail.com';
  const masterAdminPass = process.env.MASTER_ADMIN_INITIAL_PASSWORD || 'MasterAdmin@2026!';
  const adminPasswordHash = await bcrypt.hash(masterAdminPass, 10);
  const generalPasswordHash = await bcrypt.hash('Password123!', 10);
  const passwordHash = generalPasswordHash;

  // 1. Exclusive Master Admin
  const admin = await prisma.user.create({
    data: {
      email: masterAdminEmail,
      passwordHash: adminPasswordHash,
      name: 'Tanmay Chaurasiya (Master Admin)',
      phone: '9807186955',
      role: Role.ADMIN,
    },
  });

  // 2. Garage Owners
  const ownerA = await prisma.user.create({
    data: {
      email: 'owner@sharmaauto.com',
      passwordHash: generalPasswordHash,
      name: 'Suresh Sharma (Garage Owner)',
      phone: '9876543230',
      role: Role.GARAGE,
    },
  });

  const ownerB = await prisma.user.create({
    data: {
      email: 'citymotors@gmail.com',
      passwordHash,
      name: 'Rajiv Malhotra (City Motors)',
      phone: '9876543240',
      role: Role.GARAGE,
    },
  });

  // 3. Garages
  const garage = await prisma.garage.create({
    data: {
      name: 'Sharma Auto Works',
      address: '124/8 GT Road, Sarvodaya Nagar',
      city: 'Kanpur',
      state: 'Uttar Pradesh',
      pinCode: '208005',
      phone: '0512-2589000',
      description: 'Premier multi-brand vehicle repair and diagnostics center in Kanpur.',
      operatingHours: '09:00 AM - 08:00 PM (Mon - Sat)',
      services: ['ENGINE', 'BRAKES', 'ELECTRICAL', 'AC', 'SUSPENSION', 'GENERAL_SERVICE', 'BODYWORK'],
      isVerified: true,
      status: GarageStatus.APPROVED,
      ownerId: ownerA.id,
    },
  });

  const garageB = await prisma.garage.create({
    data: {
      name: 'City Motors',
      address: '45 Hazratganj Main Road',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      pinCode: '226001',
      phone: '0522-2618000',
      description: 'Modern car care and fast servicing garage in Lucknow.',
      operatingHours: '08:30 AM - 07:30 PM (All days)',
      services: ['ENGINE', 'BRAKES', 'ELECTRICAL', 'GENERAL_SERVICE'],
      isVerified: false,
      status: GarageStatus.PENDING,
      ownerId: ownerB.id,
    },
  });

  // 3. Mechanics
  const mechanic1User = await prisma.user.create({
    data: {
      email: 'vikram.mechanic@repairhub.in',
      passwordHash,
      name: 'Vikram Sharma',
      phone: '9876543221',
      role: Role.MECHANIC,
      mechanicProfile: {
        create: {
          garageId: garage.id,
          skills: [RepairCategory.ENGINE, RepairCategory.BRAKES, RepairCategory.GENERAL_SERVICE],
          rating: 4.8,
          totalReviews: 12,
          available: true,
        },
      },
    },
  });

  const mechanic2User = await prisma.user.create({
    data: {
      email: 'amit.mechanic@repairhub.in',
      passwordHash,
      name: 'Amit Verma',
      phone: '9876543222',
      role: Role.MECHANIC,
      mechanicProfile: {
        create: {
          garageId: garage.id,
          skills: [RepairCategory.ELECTRICAL, RepairCategory.AC, RepairCategory.GENERAL_SERVICE],
          rating: 4.9,
          totalReviews: 18,
          available: true,
        },
      },
    },
  });

  const mechanic3User = await prisma.user.create({
    data: {
      email: 'rajesh.mechanic@repairhub.in',
      passwordHash,
      name: 'Rajesh Yadav',
      phone: '9876543223',
      role: Role.MECHANIC,
      mechanicProfile: {
        create: {
          garageId: garage.id,
          skills: [RepairCategory.SUSPENSION, RepairCategory.BODYWORK, RepairCategory.BRAKES],
          rating: 4.5,
          totalReviews: 8,
          available: true,
        },
      },
    },
  });

  // 4. Customers with Vehicles
  const customer1 = await prisma.user.create({
    data: {
      email: 'arun.customer@gmail.com',
      passwordHash,
      name: 'Arun Kumar',
      phone: '9876543231',
      role: Role.CUSTOMER,
      vehicles: {
        create: [
          {
            type: VehicleType.CAR,
            make: 'Maruti Suzuki',
            model: 'Swift Dzire VXi',
            year: 2021,
            regNo: 'UP78-AK-1024',
          },
          {
            type: VehicleType.TWO_WHEELER,
            make: 'Honda',
            model: 'Activa 6G Disc',
            year: 2022,
            regNo: 'UP78-EN-5521',
          },
        ],
      },
    },
    include: { vehicles: true },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'priya.customer@gmail.com',
      passwordHash,
      name: 'Priya Singh',
      phone: '9876543232',
      role: Role.CUSTOMER,
      vehicles: {
        create: [
          {
            type: VehicleType.CAR,
            make: 'Hyundai',
            model: 'Creta SX (O)',
            year: 2023,
            regNo: 'UP78-PZ-9900',
          },
        ],
      },
    },
    include: { vehicles: true },
  });

  const arunCar = customer1.vehicles[0];
  const arunScooter = customer1.vehicles[1];
  const priyaCar = customer2.vehicles[0];

  // Request 1: PAID & REVIEWED
  const req1 = await prisma.repairRequest.create({
    data: {
      requestNumber: 'REQ-2026-0001',
      customerId: customer1.id,
      vehicleId: arunCar.id,
      garageId: garage.id,
      mechanicId: mechanic1User.id,
      category: RepairCategory.ENGINE,
      description: 'Engine knocking sound at low RPM with noticeable drop in mileage and heavy exhaust smoke.',
      diagnosis: 'Inspected cylinders and spark plugs. Fouled spark plugs with carbon build-up and clogged fuel injector. Full synthetic oil flush needed.',
      photos: ['/uploads/sample-engine-1.jpg'],
      status: RequestStatus.PAID,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: RequestStatus.SUBMITTED, actorId: customer1.id, actorRole: Role.CUSTOMER, note: 'Request submitted online' },
          { fromStatus: RequestStatus.SUBMITTED, toStatus: RequestStatus.ASSIGNED, actorId: admin.id, actorRole: Role.ADMIN, note: 'Assigned to Senior Engine Specialist Vikram Sharma' },
          { fromStatus: RequestStatus.ASSIGNED, toStatus: RequestStatus.INSPECTING, actorId: mechanic1User.id, actorRole: Role.MECHANIC, note: 'Vehicle arrived at bay; compression test running' },
          { fromStatus: RequestStatus.INSPECTING, toStatus: RequestStatus.ESTIMATE_SENT, actorId: mechanic1User.id, actorRole: Role.MECHANIC, note: 'Initial estimate created with parts and labour breakdown' },
          { fromStatus: RequestStatus.ESTIMATE_SENT, toStatus: RequestStatus.APPROVED, actorId: customer1.id, actorRole: Role.CUSTOMER, note: 'Estimate approved by Arun Kumar via web portal' },
          { fromStatus: RequestStatus.APPROVED, toStatus: RequestStatus.IN_PROGRESS, actorId: mechanic1User.id, actorRole: Role.MECHANIC, note: 'Parts requisitioned; spark plugs and oil change initiated' },
          { fromStatus: RequestStatus.IN_PROGRESS, toStatus: RequestStatus.QC, actorId: mechanic1User.id, actorRole: Role.MECHANIC, note: 'Engine tuning complete; road test on GT road' },
          { fromStatus: RequestStatus.QC, toStatus: RequestStatus.COMPLETED, actorId: mechanic1User.id, actorRole: Role.MECHANIC, note: 'Final QC passed, clean engine idle verified' },
          { fromStatus: RequestStatus.COMPLETED, toStatus: RequestStatus.PAID, actorId: customer1.id, actorRole: Role.CUSTOMER, note: 'Paid ₹7,950.00 via Test Payment Gateway' },
        ],
      },
      estimates: {
        create: {
          version: 1,
          status: EstimateStatus.APPROVED,
          totalPaise: 795000,
          customerNote: 'Please use genuine synthetic oil.',
          items: {
            create: [
              { kind: EstimateItemKind.LABOUR, description: 'Spark Plug Replacement & Throttle Body Cleaning', quantity: 1, unitPricePaise: 150000, totalPaise: 150000 },
              { kind: EstimateItemKind.PART, description: 'NGK Laser Iridium Spark Plugs (Set of 4)', quantity: 1, unitPricePaise: 320000, totalPaise: 320000 },
              { kind: EstimateItemKind.PART, description: 'Shell Helix Ultra 5W-30 Synthetic Oil (3.5L)', quantity: 1, unitPricePaise: 280000, totalPaise: 280000 },
              { kind: EstimateItemKind.PART, description: 'OEM Engine Oil Filter (Maruti Genuine)', quantity: 1, unitPricePaise: 45000, totalPaise: 45000 },
            ],
          },
        },
      },
      invoice: {
        create: {
          invoiceNumber: 'INV-2026-0001',
          totalPaise: 795000,
        },
      },
      payment: {
        create: {
          amountPaise: 795000,
          provider: 'MOCK',
          transactionId: 'TXN-MOCK-795000-001',
          status: PaymentStatus.SUCCESS,
          invoice: {
            connect: {
              invoiceNumber: 'INV-2026-0001',
            },
          },
        },
      },
      review: {
        create: {
          customerId: customer1.id,
          rating: 5,
          comment: 'Vikram did an incredible job! The knocking is 100% eliminated, pickup is smooth, and transparent pricing was a breath of fresh air.',
        },
      },
    },
  });

  // Request 2: ESTIMATE_SENT (Ready for customer approve/reject)
  const req2 = await prisma.repairRequest.create({
    data: {
      requestNumber: 'REQ-2026-0002',
      customerId: customer2.id,
      vehicleId: priyaCar.id,
      garageId: garage.id,
      mechanicId: mechanic2User.id,
      category: RepairCategory.AC,
      description: 'Air conditioning is blowing room temperature air during afternoon heat; whistling sound from vents.',
      diagnosis: 'AC condenser O-ring deteriorated causing refrigerant leakage. Compressor clutch verified healthy.',
      photos: ['/uploads/sample-ac-1.jpg'],
      status: RequestStatus.ESTIMATE_SENT,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: RequestStatus.SUBMITTED, actorId: customer2.id, actorRole: Role.CUSTOMER, note: 'Submitted via customer portal' },
          { fromStatus: RequestStatus.SUBMITTED, toStatus: RequestStatus.ASSIGNED, actorId: admin.id, actorRole: Role.ADMIN, note: 'Smart assigned to AC Specialist Amit Verma' },
          { fromStatus: RequestStatus.ASSIGNED, toStatus: RequestStatus.INSPECTING, actorId: mechanic2User.id, actorRole: Role.MECHANIC, note: 'Pressure leak test in progress' },
          { fromStatus: RequestStatus.INSPECTING, toStatus: RequestStatus.ESTIMATE_SENT, actorId: mechanic2User.id, actorRole: Role.MECHANIC, note: 'Estimate generated and submitted for approval' },
        ],
      },
      estimates: {
        create: {
          version: 1,
          status: EstimateStatus.SENT,
          totalPaise: 540000,
          items: {
            create: [
              { kind: EstimateItemKind.LABOUR, description: 'AC System Vacuum & Leak Test Inspection', quantity: 1, unitPricePaise: 180000, totalPaise: 180000 },
              { kind: EstimateItemKind.PART, description: 'R134a Eco-Refrigerant Gas Recharge (500g)', quantity: 1, unitPricePaise: 220000, totalPaise: 220000 },
              { kind: EstimateItemKind.PART, description: 'OEM High-Pressure Condenser O-Ring Kit', quantity: 1, unitPricePaise: 60000, totalPaise: 60000 },
              { kind: EstimateItemKind.LABOUR, description: 'Cabin Filter Antibacterial Disinfection', quantity: 1, unitPricePaise: 80000, totalPaise: 80000 },
            ],
          },
        },
      },
    },
  });

  // Request 3: IN_PROGRESS (Customer approved, mechanic working)
  const req3 = await prisma.repairRequest.create({
    data: {
      requestNumber: 'REQ-2026-0003',
      customerId: customer1.id,
      vehicleId: arunScooter.id,
      garageId: garage.id,
      mechanicId: mechanic3User.id,
      category: RepairCategory.BRAKES,
      description: 'Front disc lever feels spongy and metal-on-metal grinding sound during hard braking.',
      diagnosis: 'Front ceramic pads worn to steel backing plate. Rotor needs skimming, fresh DOT4 fluid required.',
      photos: [],
      status: RequestStatus.IN_PROGRESS,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: RequestStatus.SUBMITTED, actorId: customer1.id, actorRole: Role.CUSTOMER, note: 'Created online' },
          { fromStatus: RequestStatus.SUBMITTED, toStatus: RequestStatus.ASSIGNED, actorId: admin.id, actorRole: Role.ADMIN, note: 'Assigned to Rajesh Yadav' },
          { fromStatus: RequestStatus.ASSIGNED, toStatus: RequestStatus.INSPECTING, actorId: mechanic3User.id, actorRole: Role.MECHANIC, note: 'Brake calipers disassembled' },
          { fromStatus: RequestStatus.INSPECTING, toStatus: RequestStatus.ESTIMATE_SENT, actorId: mechanic3User.id, actorRole: Role.MECHANIC, note: 'Estimate sent' },
          { fromStatus: RequestStatus.ESTIMATE_SENT, toStatus: RequestStatus.APPROVED, actorId: customer1.id, actorRole: Role.CUSTOMER, note: 'Customer accepted estimate' },
          { fromStatus: RequestStatus.APPROVED, toStatus: RequestStatus.IN_PROGRESS, actorId: mechanic3User.id, actorRole: Role.MECHANIC, note: 'Replacing pads and bleeding hydraulic lines' },
        ],
      },
      estimates: {
        create: {
          version: 1,
          status: EstimateStatus.APPROVED,
          totalPaise: 165000,
          items: {
            create: [
              { kind: EstimateItemKind.LABOUR, description: 'Caliper Overhaul & Hydraulic Bleeding', quantity: 1, unitPricePaise: 65000, totalPaise: 65000 },
              { kind: EstimateItemKind.PART, description: 'Honda Genuine Front Disc Brake Pad Set', quantity: 1, unitPricePaise: 80000, totalPaise: 80000 },
              { kind: EstimateItemKind.PART, description: 'Castrol DOT4 Synthetic Brake Fluid 250ml', quantity: 1, unitPricePaise: 20000, totalPaise: 20000 },
            ],
          },
        },
      },
    },
  });

  // Request 4: SUBMITTED (Awaiting Admin smart assignment)
  const req4 = await prisma.repairRequest.create({
    data: {
      requestNumber: 'REQ-2026-0004',
      customerId: customer2.id,
      vehicleId: priyaCar.id,
      garageId: garage.id,
      category: RepairCategory.ELECTRICAL,
      description: 'Battery warning light stays lit on dashboard. Headlights flicker and dim at traffic signals.',
      status: RequestStatus.SUBMITTED,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: RequestStatus.SUBMITTED, actorId: customer2.id, actorRole: Role.CUSTOMER, note: 'Vehicle submitted, awaiting mechanic assignment' },
        ],
      },
    },
  });

  // Complaint for demonstration
  await prisma.complaint.create({
    data: {
      requestId: req1.id,
      customerId: customer1.id,
      subject: 'Inquiry on battery terminal grease',
      description: 'Could you confirm whether the battery terminals were greased during the service? Slight white powder visible on negative terminal.',
      status: ComplaintStatus.RESOLVED,
      resolutionNote: 'Explained that the white powder was residual surface dust. Mechanics inspected and applied petroleum jelly protection coating free of charge.',
      resolvedAt: new Date(),
      resolvedById: admin.id,
    },
  });

  console.log('✅ Database seed completed successfully! Master Admin configured.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
