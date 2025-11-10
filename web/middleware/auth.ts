export default defineNuxtRouteMiddleware(async (to, from) => {
  // Only run on client-side and only on initial navigation
  // This prevents the flash redirect on page refresh
  if (process.server) {
    return;
  }

  const auth = useAuth();
  const api = useApiBase();

  // Skip auth check for login, signup, and onboarding pages
  if (to.path === '/login' || to.path === '/signup' || to.path === '/onboarding') {
    return;
  }

  // If user is already loaded, just verify orgs
  if (auth.user.value && auth.organizations.value?.length > 0) {
    return;
  }

  // Try to fetch current user if not already loaded
  if (!auth.user.value) {
    try {
      await auth.fetchCurrentUser();
    } catch (error: any) {
      // Only redirect to login on 401
      if (error?.response?.status === 401 || error?.statusCode === 401) {
        return navigateTo('/login');
      }
      // For other errors, let page load
      return;
    }
  }

  // Check if user needs onboarding
  if (auth.user.value && (!auth.organizations.value || auth.organizations.value.length === 0)) {
    try {
      const response = await $fetch(`${api}/organizations`, {
        credentials: 'include'
      });
      
      const orgs = response?.organizations || [];
      auth.organizations.value = orgs;
      
      if (orgs.length === 0) {
        return navigateTo('/onboarding');
      }
      
      if (!auth.currentOrg.value) {
        auth.currentOrg.value = orgs[0];
      }
    } catch (err: any) {
      // Silently fail - let page load
      console.error('Error fetching organizations:', err);
    }
  }
});

