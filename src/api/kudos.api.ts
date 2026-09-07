import { apiClient } from './client';

/**
 * A fixed set, so the leaderboard means something — free text would make this a
 * comment box with a label.
 */
export type KudosBadge =
  | 'customer-star'
  | 'perfect-attendance'
  | 'top-seller'
  | 'team-player'
  | 'fast-learner'
  | 'extra-mile';

export type Kudos = {
  id: string;
  toId: string;
  toName: string;
  toStoreCode: string;
  fromId: string | null;
  /** A snapshot taken at send time, so a departed sender still reads as a person. */
  fromName: string;
  badge: KudosBadge;
  message: string;
  createdAt: string;
};

/** Display names for the badge slugs. */
export const BADGE_LABEL: Record<KudosBadge, string> = {
  'customer-star': 'Customer Star',
  'perfect-attendance': 'Perfect Attendance',
  'top-seller': 'Top Seller',
  'team-player': 'Team Player',
  'fast-learner': 'Fast Learner',
  'extra-mile': 'Extra Mile',
};

/**
 * A field employee sees only the kudos they received — this is the mobile feed.
 * Reviewers get their scope instead, which the employee app never asks for.
 *
 * Note the envelope: `data` is the array itself and the paging lives in `meta`,
 * unlike regularisation, which nests an `items` key.
 */
export async function getMyKudos(limit = 10) {
  const res = await apiClient.get<{
    success: true;
    data: Kudos[];
    meta: { total: number; limit: number; offset: number };
  }>('/kudos', { params: { limit } });
  return { items: res.data.data, total: res.data.meta?.total ?? res.data.data.length };
}
