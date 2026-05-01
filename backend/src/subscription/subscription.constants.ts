export const PLAN_PROPERTY_LIMITS: Record<string, number> = {
  starter: 3,
  pro: 20,
  enterprise: 999999, // unlimited
};

export const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/** Monthly price per plan (for commission calculation). */
export const PLAN_MONTHLY_PRICES: Record<string, number> = {
  starter: 29,
  pro: 79,
  enterprise: 199,
};
