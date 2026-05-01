import { SetMetadata } from '@nestjs/common';

export const SUBSCRIPTION_ACCESS_KEY = 'subscription_access_mode';

export type SubscriptionAccessMode = 'ACTIVE_REQUIRED' | 'ALLOW_PAST_DUE' | 'ALLOW_SUSPENDED_VIEW_ONLY';

export const RequiresActiveSubscription = () =>
  SetMetadata(SUBSCRIPTION_ACCESS_KEY, 'ACTIVE_REQUIRED' satisfies SubscriptionAccessMode);

export const AllowsPastDue = () =>
  SetMetadata(SUBSCRIPTION_ACCESS_KEY, 'ALLOW_PAST_DUE' satisfies SubscriptionAccessMode);

export const AllowsSuspendedViewOnly = () =>
  SetMetadata(SUBSCRIPTION_ACCESS_KEY, 'ALLOW_SUSPENDED_VIEW_ONLY' satisfies SubscriptionAccessMode);
