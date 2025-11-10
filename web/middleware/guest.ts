// Middleware for pages that should only be accessible to guests (not logged in)
export default defineNuxtRouteMiddleware(async (to, from) => {
  const auth = useAuth();

  // If user is already loaded and logged in, redirect to home
  if (auth.user.value) {
    return navigateTo('/');
  }

  // Don't try to fetch user on guest pages - just allow access
  // The auth will be handled by the login/signup flow
  return;
});

