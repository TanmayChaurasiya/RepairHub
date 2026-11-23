import { RepairCategory, PowertrainType } from '@prisma/client';
import { prisma } from '../../config/db.js';

export async function seedIssueSkillMappingsAndReviewFlags() {
  console.log('🔧 [SEED] Checking & populating IssueSkillMapping and SkillsPendingReview flags...');

  // 1. Flag existing mechanics with empty skills as skillsPendingReview
  const emptySkillMechanics = await prisma.mechanicProfile.findMany({
    where: {
      OR: [
        { skills: { isEmpty: true } },
        { skills: { equals: [] } },
      ],
      skillsPendingReview: false,
    },
  });

  if (emptySkillMechanics.length > 0) {
    console.log(`[SEED] Flagging ${emptySkillMechanics.length} mechanics as 'skillsPendingReview'...`);
    await prisma.mechanicProfile.updateMany({
      where: {
        id: { in: emptySkillMechanics.map((m) => m.id) },
      },
      data: {
        skillsPendingReview: true,
      },
    });
  }

  // 2. Identify and update existing EV vehicles (e.g. Nexon EV)
  const evVehicles = await prisma.vehicle.findMany({
    where: {
      OR: [
        { model: { contains: 'EV', mode: 'insensitive' } },
        { model: { contains: 'Electric', mode: 'insensitive' } },
      ],
      powertrain: { not: PowertrainType.ELECTRIC },
    },
  });

  if (evVehicles.length > 0) {
    console.log(`[SEED] Updating ${evVehicles.length} vehicles to PowertrainType.ELECTRIC...`);
    await prisma.vehicle.updateMany({
      where: { id: { in: evVehicles.map((v) => v.id) } },
      data: {
        powertrain: PowertrainType.ELECTRIC,
        fuelType: 'ELECTRIC',
      },
    });
  }

  // 3. Populate default IssueSkillMappings
  const defaultMappings = [
    // EV Specific Mappings
    {
      category: RepairCategory.ELECTRICAL,
      powertrain: PowertrainType.ELECTRIC,
      issuePattern: 'battery',
      requiredSkills: ['EV_BATTERY'],
      priority: 100,
      description: 'Electric Vehicle high-voltage battery diagnostic, cell balancing & BMS repair',
    },
    {
      category: RepairCategory.ELECTRICAL,
      powertrain: PowertrainType.ELECTRIC,
      issuePattern: 'motor',
      requiredSkills: ['EV_MOTOR', 'ELECTRIC_POWERTRAIN'],
      priority: 95,
      description: 'EV traction motor & inverter diagnostic',
    },
    {
      category: RepairCategory.ELECTRICAL,
      powertrain: PowertrainType.ELECTRIC,
      issuePattern: null,
      requiredSkills: ['ELECTRIC_POWERTRAIN'],
      priority: 50,
      description: 'General EV electrical & wiring harness repair',
    },
    {
      category: RepairCategory.ENGINE,
      powertrain: PowertrainType.ELECTRIC,
      issuePattern: null,
      requiredSkills: ['ELECTRIC_POWERTRAIN'],
      priority: 80,
      description: 'Electric motor and drive unit servicing',
    },

    // Hybrid Specific Mappings
    {
      category: RepairCategory.ELECTRICAL,
      powertrain: PowertrainType.HYBRID,
      issuePattern: 'battery',
      requiredSkills: ['HYBRID_SYSTEM', 'EV_BATTERY'],
      priority: 90,
      description: 'Hybrid vehicle battery pack and regenerative braking service',
    },
    {
      category: RepairCategory.ENGINE,
      powertrain: PowertrainType.HYBRID,
      issuePattern: null,
      requiredSkills: ['HYBRID_SYSTEM', 'ENGINE'],
      priority: 70,
      description: 'Hybrid dual-powertrain engine service',
    },

    // Petrol Specific Mappings
    {
      category: RepairCategory.ENGINE,
      powertrain: PowertrainType.PETROL,
      issuePattern: null,
      requiredSkills: ['ENGINE'],
      priority: 40,
      description: 'Internal combustion petrol engine tuning & overhaul',
    },

    // Diesel Specific Mappings
    {
      category: RepairCategory.ENGINE,
      powertrain: PowertrainType.DIESEL,
      issuePattern: null,
      requiredSkills: ['ENGINE'],
      priority: 40,
      description: 'Diesel CRDI fuel injection and turbocharger service',
    },

    // General Component Mappings
    {
      category: RepairCategory.BRAKES,
      powertrain: null,
      issuePattern: null,
      requiredSkills: ['BRAKES'],
      priority: 20,
      description: 'Hydraulic and regenerative brake pad, disc and ABS repair',
    },
    {
      category: RepairCategory.SUSPENSION,
      powertrain: null,
      issuePattern: null,
      requiredSkills: ['SUSPENSION'],
      priority: 20,
      description: 'Struts, dampers, ball joints and steering rack alignment',
    },
    {
      category: RepairCategory.AC,
      powertrain: null,
      issuePattern: null,
      requiredSkills: ['AC'],
      priority: 20,
      description: 'HVAC compressor, condenser and refrigerant recharge',
    },
    {
      category: RepairCategory.BODYWORK,
      powertrain: null,
      issuePattern: null,
      requiredSkills: ['BODYWORK'],
      priority: 20,
      description: 'Chassis repair, denting, painting and panel alignment',
    },
    {
      category: RepairCategory.GENERAL_SERVICE,
      powertrain: null,
      issuePattern: null,
      requiredSkills: ['GENERAL_SERVICE'],
      priority: 10,
      description: 'Multi-point inspection, fluid changes and periodic maintenance',
    },
  ];

  for (const m of defaultMappings) {
    const existing = await prisma.issueSkillMapping.findFirst({
      where: {
        category: m.category,
        powertrain: m.powertrain,
        issuePattern: m.issuePattern,
      },
    });

    if (!existing) {
      await prisma.issueSkillMapping.create({
        data: m,
      });
    }
  }

  console.log('✅ [SEED] IssueSkillMappings and Review Flags successfully verified.');
}
