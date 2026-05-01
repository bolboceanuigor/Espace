import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route or controller as public (no JWT required).
 * Used for auth routes: login, register.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
