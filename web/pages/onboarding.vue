<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

useHead({
  title: 'Getting Started - Echos'
});

const auth = useAuth();
const api = useApiBase();
const toast = useToast();
const router = useRouter();

const apiKeyName = ref('Production');
const isCreating = ref(false);
const error = ref('');
const createdApiKey = ref<any>(null);

// Check if user already has an organization
onMounted(async () => {
  await auth.fetchOrganizations();
  if (!auth.currentOrg.value && auth.organizations.value.length > 0) {
    auth.setCurrentOrg(auth.organizations.value[0]);
  }
});

const createApiKey = async () => {
  if (!apiKeyName.value.trim()) {
    error.value = 'API key name is required';
    return;
  }

  if (!auth.currentOrg.value) {
    error.value = 'No organization found';
    return;
  }

  isCreating.value = true;
  error.value = '';

  try {
    const response = await $fetch(`${api}/organizations/${auth.currentOrg.value.id}/api-keys`, {
      method: 'POST',
      credentials: 'include',
      body: {
        name: apiKeyName.value.trim()
      }
    });

    createdApiKey.value = response;
  } catch (err: any) {
    error.value = err.data?.message || 'Failed to create API key';
  } finally {
    isCreating.value = false;
  }
};

const skipApiKey = () => {
  router.push('/');
};

const finishOnboarding = () => {
  router.push('/settings');
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('API key copied to clipboard!');
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full">

      <!-- Create API Key -->
      <div v-if="!createdApiKey" class="space-y-8">
        <!-- Header -->
        <div class="text-center">
          <div class="inline-flex items-center gap-2 mb-3">
            <img src="~/assets/img/logo.png" alt="Echos" class="w-14 h-14">
          </div>
          <h1 class="text-2xl font-bold text-white mb-2">One more thing...</h1>
          <p class="text-gray-400 text-sm">Create your first API key to start using Echos.</p>
        </div>

        <!-- Form -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-2xl p-8 backdrop-blur-sm">
          <div class="space-y-4">
            <!-- API Key Name -->
            <div>
              <label for="api-key-name" class="block text-sm font-medium text-gray-300 mb-2">
                API Key Name
              </label>
              <input
                id="api-key-name"
                v-model="apiKeyName"
                type="text"
                placeholder="Production"
                autofocus
                @keyup.enter="createApiKey"
                class="w-full px-3 py-2 text-sm bg-gray-500/10 border border-gray-500/10 rounded-lg text-white placeholder-gray-500 focus:border-gray-500/10 focus:ring-1 focus:ring-gray-500/10 outline-none transition-colors"
                :disabled="isCreating"
              />
            </div>

            <!-- Error Message -->
            <div v-if="error" class="p-3 bg-red-400/10 border border-red-400/10 rounded-lg">
              <p class="text-sm text-red-400">{{ error }}</p>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <button
                @click="skipApiKey"
                :disabled="isCreating"
                class="flex-1 px-3 py-2 bg-gray-500/10 hover:bg-gray-500/15 border border-gray-500/10 text-sm text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                Skip for now
              </button>
              <button
                @click="createApiKey"
                :disabled="isCreating || !apiKeyName.trim()"
                class="flex-1 px-3 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span v-if="!isCreating">Create API Key</span>
                <span v-else class="flex items-center justify-center space-x-2">
                  <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating...</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Success State -->
      <div v-else class="space-y-8">
        <!-- Header -->
        <div class="text-center">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-300/10 text-emerald-300 mb-3">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white mb-2">You're all set! 🎉</h1>
          <p class="text-gray-400 text-sm">Your API key is ready to use.</p>
        </div>

        <!-- API Key Display -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-2xl p-8 backdrop-blur-sm">
          <div class="space-y-4">
            <div class="bg-emerald-300/5 border border-emerald-300/10 rounded-lg p-4">
              <div class="flex items-center justify-between gap-3 mb-3">
                <span class="text-xs text-emerald-300 font-medium uppercase tracking-wide">Your API Key</span>
                <button
                  @click="copyToClipboard(createdApiKey.key)"
                  class="px-3 py-1 font-medium bg-emerald-300 hover:bg-emerald-400 text-black text-xs rounded-lg transition flex items-center gap-1.5"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy</span>
                </button>
              </div>
              <code class="block text-sm text-emerald-300 font-mono break-all">{{ createdApiKey.key }}</code>
            </div>

            <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
              <p class="text-xs text-white font-medium mb-2">
                <span class="text-emerald-300">Important:</span> Copy this API key now. You won't be able to see it again!
              </p>
              <p class="text-xs text-gray-400">
                Store it securely. You can create more API keys or revoke existing ones in your <NuxtLink to="/settings" class="text-blue-400 hover:text-blue-300 underline">Settings</NuxtLink>.
              </p>
            </div>

            <!-- Go to Dashboard Button -->
            <button
              @click="finishOnboarding"
              class="w-full px-3 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm rounded-lg font-medium transition"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
