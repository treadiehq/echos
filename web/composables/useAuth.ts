export function useAuth() {
  const user = useState<any>('user', () => null);
  const organizations = useState<any[]>('organizations', () => []);
  const currentOrg = useState<any>('currentOrg', () => null);
  const loading = useState('authLoading', () => false);
  const error = useState<string | null>('authError', () => null);

  const api = useApiBase();

  async function fetchCurrentUser() {
    // Prevent concurrent requests
    if (loading.value) {
      return user.value;
    }
    
    try {
      loading.value = true;
      error.value = null;
      
      const response = await $fetch(`${api}/auth/me`, {
        credentials: 'include',
      });
      
      user.value = response.user;
      await fetchOrganizations();
      
      return response.user;
    } catch (err: any) {
      console.error('Failed to fetch current user:', err);
      user.value = null;
      organizations.value = [];
      currentOrg.value = null;
      error.value = err?.message || 'Not authenticated';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function sendMagicLink(email: string) {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await $fetch(`${api}/auth/send-magic-link`, {
        method: 'POST',
        body: { email },
      });
      
      return response;
    } catch (err: any) {
      error.value = err?.message || 'Failed to send magic link';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      await $fetch(`${api}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      
      user.value = null;
      organizations.value = [];
      currentOrg.value = null;
    } catch (err: any) {
      console.error('Logout failed:', err);
    }
  }

  async function fetchOrganizations() {
    try {
      const response = await $fetch(`${api}/organizations`, {
        credentials: 'include',
      });
      
      organizations.value = response.organizations || [];
      
      // Set current org to first if not set
      if (organizations.value.length > 0 && !currentOrg.value) {
        currentOrg.value = organizations.value[0];
      }
      
      return organizations.value;
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
      organizations.value = [];
      throw err;
    }
  }

  async function createOrganization(name: string) {
    try {
      const response = await $fetch(`${api}/organizations`, {
        method: 'POST',
        credentials: 'include',
        body: { name },
      });
      
      await fetchOrganizations();
      return response.organization;
    } catch (err: any) {
      throw err;
    }
  }

  function setCurrentOrg(org: any) {
    currentOrg.value = org;
  }

  return {
    user,
    organizations,
    currentOrg,
    loading,
    error,
    fetchCurrentUser,
    sendMagicLink,
    logout,
    fetchOrganizations,
    createOrganization,
    setCurrentOrg,
  };
}

