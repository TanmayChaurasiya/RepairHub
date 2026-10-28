import { describe, it, expect } from 'vitest';
import { RepairCategory } from '@prisma/client';
import {
  rankMechanicsForRequest,
  MechanicCandidate,
  ASSIGNMENT_WEIGHTS,
} from '../../src/services/assignment.js';

describe('Smart Mechanic Assignment Unit Tests', () => {
  const sampleCandidates: MechanicCandidate[] = [
    {
      id: 'mech-1',
      name: 'Vikram Sharma',
      rating: 4.8,
      skills: ['ENGINE', 'BRAKES'],
      available: true,
      garageVerified: true,
      garageCity: 'Kanpur',
      activeJobCount: 1, // score = 4.8 - (1 * 0.5) = 4.3
    },
    {
      id: 'mech-2',
      name: 'Amit Verma',
      rating: 4.9,
      skills: ['ENGINE', 'ELECTRICAL'],
      available: true,
      garageVerified: true,
      garageCity: 'Kanpur',
      activeJobCount: 3, // score = 4.9 - (3 * 0.5) = 3.4
    },
    {
      id: 'mech-3',
      name: 'Rajesh Yadav',
      rating: 4.2,
      skills: ['ENGINE'],
      available: true,
      garageVerified: true,
      garageCity: 'Kanpur',
      activeJobCount: 0, // score = 4.2 - (0 * 0.5) = 4.2
    },
    {
      id: 'mech-unavailable',
      name: 'Suresh Unavail',
      rating: 5.0,
      skills: ['ENGINE'],
      available: false, // unavailable
      garageVerified: true,
      garageCity: 'Kanpur',
      activeJobCount: 0,
    },
    {
      id: 'mech-unverified-garage',
      name: 'Rohan Unverified',
      rating: 4.9,
      skills: ['ENGINE'],
      available: true,
      garageVerified: false, // unverified garage
      garageCity: 'Kanpur',
      activeJobCount: 0,
    },
    {
      id: 'mech-different-city',
      name: 'Lucknow Mechanic',
      rating: 4.9,
      skills: ['ENGINE'],
      available: true,
      garageVerified: true,
      garageCity: 'Lucknow',
      activeJobCount: 0,
    },
    {
      id: 'mech-no-skill',
      name: 'Bodywork Only',
      rating: 5.0,
      skills: ['BODYWORK'],
      available: true,
      garageVerified: true,
      garageCity: 'Kanpur',
      activeJobCount: 0,
    },
  ];

  it('filters out unavailable mechanics', () => {
    const results = rankMechanicsForRequest('ENGINE', sampleCandidates, 'Kanpur');
    const ids = results.map((r) => r.mechanicId);
    expect(ids).not.toContain('mech-unavailable');
  });

  it('filters out mechanics in unverified garages', () => {
    const results = rankMechanicsForRequest('ENGINE', sampleCandidates, 'Kanpur');
    const ids = results.map((r) => r.mechanicId);
    expect(ids).not.toContain('mech-unverified-garage');
  });

  it('filters out mechanics without matching category skill', () => {
    const results = rankMechanicsForRequest('ENGINE', sampleCandidates, 'Kanpur');
    const ids = results.map((r) => r.mechanicId);
    expect(ids).not.toContain('mech-no-skill');
  });

  it('filters out mechanics from a different city when city is specified', () => {
    const results = rankMechanicsForRequest('ENGINE', sampleCandidates, 'Kanpur');
    const ids = results.map((r) => r.mechanicId);
    expect(ids).not.toContain('mech-different-city');
  });

  it('accurately computes assignment scores using rating and workload penalty weight', () => {
    const results = rankMechanicsForRequest(RepairCategory.ENGINE, sampleCandidates, 'Kanpur');

    // Expected scores:
    // mech-1: 4.8 - (1 * 0.5) = 4.30
    // mech-3: 4.2 - (0 * 0.5) = 4.20
    // mech-2: 4.9 - (3 * 0.5) = 3.40

    expect(results).toHaveLength(3);

    expect(results[0].mechanicId).toBe('mech-1');
    expect(results[0].score).toBe(4.3);
    expect(results[0].scoreBreakdown.workloadPenalty).toBe(0.5);

    expect(results[1].mechanicId).toBe('mech-3');
    expect(results[1].score).toBe(4.2);

    expect(results[2].mechanicId).toBe('mech-2');
    expect(results[2].score).toBe(3.4);
  });

  it('tie-breaks equal scores by higher rating', () => {
    const tieCandidates: MechanicCandidate[] = [
      {
        id: 'mech-a',
        name: 'Mechanic A',
        rating: 4.5,
        skills: ['AC'],
        available: true,
        garageVerified: true,
        garageCity: 'Kanpur',
        activeJobCount: 1, // 4.5 - 0.5 = 4.0
      },
      {
        id: 'mech-b',
        name: 'Mechanic B',
        rating: 4.0,
        skills: ['AC'],
        available: true,
        garageVerified: true,
        garageCity: 'Kanpur',
        activeJobCount: 0, // 4.0 - 0 = 4.0
      },
    ];

    const results = rankMechanicsForRequest('AC', tieCandidates, 'Kanpur');
    expect(results[0].mechanicId).toBe('mech-a'); // Higher rating 4.5 vs 4.0
  });

  it('returns empty array when no candidate matches the criteria', () => {
    const results = rankMechanicsForRequest('SUSPENSION', sampleCandidates, 'Kanpur');
    expect(results).toHaveLength(0);
  });
});
