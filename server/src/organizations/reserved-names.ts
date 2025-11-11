/**
 * Reserved organization names that cannot be used by users
 * These are typically system names, common routes, or brand protection
 */
export const RESERVED_ORG_NAMES = new Set([
  // System/Platform names
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'blog',
  'cdn',
  'dashboard',
  'docs',
  'documentation',
  'download',
  'echos',
  'help',
  'home',
  'login',
  'logout',
  'mail',
  'new',
  'news',
  'official',
  'root',
  'security',
  'settings',
  'signin',
  'signout',
  'signup',
  'staff',
  'static',
  'status',
  'support',
  'system',
  'undefined',
  'unknown',
  'user',
  'users',
  'web',
  'www',
  
  // Common routes/paths
  'about',
  'account',
  'billing',
  'contact',
  'explore',
  'features',
  'organizations',
  'pricing',
  'privacy',
  'profile',
  'public',
  'register',
  'search',
  'terms',
  'tos',
  
  // Add your custom reserved names here
  'treadie',
  'treadiecorp',
]);

/**
 * Check if an organization name is reserved
 * @param name - The organization name to check
 * @returns true if the name is reserved, false otherwise
 */
export function isReservedName(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  return RESERVED_ORG_NAMES.has(normalized);
}

/**
 * Check if a name is too similar to a reserved name (optional strict checking)
 * @param name - The organization name to check
 * @returns true if the name is too similar to a reserved name
 */
export function isSimilarToReservedName(name: string): boolean {
  const normalized = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  
  // Check if removing special characters makes it match a reserved name
  return RESERVED_ORG_NAMES.has(normalized);
}

