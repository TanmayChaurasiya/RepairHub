import { RepairCategory } from '@prisma/client';

export interface MechanicCandidate {
  id: string; // User ID
  name: string;
  rating: number; // 1.0 - 5.0
  skills: string[]; // e.g. ['ENGINE', 'BRAKES']
  available: boolean;
  garageVerified: boolean;
  garageCity: string;
  activeJobCount: number;
}

export interface RankedMechanic {
  mechanicId: string;
  name: string;
  rating: number;
  activeJobCount: number;
  score: number;
  scoreBreakdown: {
    baseRating: number;
    workloadPenalty: number;
  };
  reasons: string[];
}

/**
 * Configurable weights for smart assignment calculation.
 * Formula: score = (rating * RATING_WEIGHT) - (activeJobCount * WORKLOAD_PENALTY_WEIGHT)
 */
export const ASSIGNMENT_WEIGHTS = {
  RATING_WEIGHT: 1.0,
  WORKLOAD_PENALTY_WEIGHT: 0.5, // Each active job penalizes the score by 0.5
} as const;

/**
 * Pure, rule-based smart mechanic assignment algorithm.
 *
 * Hard Filters:
 * 1. Available: available === true
 * 2. Skill match: skills includes category
 * 3. Garage verified: garageVerified === true
 * 4. City match: if city provided, garageCity matches (case-insensitive)
 *
 * Scoring:
 * score = rating - (activeJobCount * 0.5)
 */
export function rankMechanicsForRequest(
  category: RepairCategory | string,
  candidates: MechanicCandidate[],
  city?: string
): RankedMechanic[] {
  const normalizedCategory = category.toUpperCase().trim();
  const normalizedCity = city?.trim().toLowerCase();

  // 1. Apply hard filters
  const eligible = candidates.filter((candidate) => {
    // Availability check
    if (!candidate.available) return false;

    // Verified garage check
    if (!candidate.garageVerified) return false;

    // Skill match check
    const hasSkill = candidate.skills.some(
      (skill) => skill.toUpperCase().trim() === normalizedCategory
    );
    if (!hasSkill) return false;

    // City match check (if city provided)
    if (normalizedCity && candidate.garageCity.toLowerCase().trim() !== normalizedCity) {
      return false;
    }

    return true;
  });

  // 2. Score candidates
  const scored: RankedMechanic[] = eligible.map((candidate) => {
    const baseRatingScore = candidate.rating * ASSIGNMENT_WEIGHTS.RATING_WEIGHT;
    const workloadPenalty = candidate.activeJobCount * ASSIGNMENT_WEIGHTS.WORKLOAD_PENALTY_WEIGHT;
    const rawScore = baseRatingScore - workloadPenalty;
    const score = Math.round(rawScore * 100) / 100;

    const reasons: string[] = [
      `Verified garage in ${candidate.garageCity}`,
      `Certified skill match in ${normalizedCategory}`,
      `Rating: ${candidate.rating.toFixed(1)} / 5.0`,
      `Active jobs: ${candidate.activeJobCount}`,
    ];

    return {
      mechanicId: candidate.id,
      name: candidate.name,
      rating: candidate.rating,
      activeJobCount: candidate.activeJobCount,
      score,
      scoreBreakdown: {
        baseRating: baseRatingScore,
        workloadPenalty,
      },
      reasons,
    };
  });

  // 3. Sort by score descending, then rating descending, then activeJobCount ascending
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (a.activeJobCount !== b.activeJobCount) return a.activeJobCount - b.activeJobCount;
    return a.name.localeCompare(b.name);
  });

  return scored;
}
