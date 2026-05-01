export const featureFlags = {
  billingUi: process.env.NEXT_PUBLIC_ENABLE_BILLING_UI === 'true',
  softLimits: process.env.NEXT_PUBLIC_ENABLE_SOFT_LIMITS === 'true',
  channelsUi: process.env.NEXT_PUBLIC_ENABLE_CHANNELS_UI === 'true',
  googleAuth: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true',
  requireBetaAccess: process.env.NEXT_PUBLIC_REQUIRE_BETA_ACCESS === 'true',
};
