<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

useHead({
  title: 'Settings - Echos'
});

const auth = useAuth();
const api = useApiBase();
const toast = useToast();
const { nextTick } = await import('vue');

const apiKeys = ref<any[]>([]);
const isLoading = ref(true);
const isCreatingKey = ref(false);
const isDeletingKey = ref(false);
const error = ref('');
const newKeyName = ref('');
const createdKey = ref<any>(null);
const showCreateModal = ref(false);
const showDeleteModal = ref(false);
const keyToDelete = ref<any>(null);

// Fetch org and API keys on mount
onMounted(async () => {
  await auth.fetchOrganizations();
  // Wait a bit to ensure currentOrg is set
  await nextTick();
  await fetchApiKeys();
  isLoading.value = false;
});

// Also watch for route changes to refresh
watch(() => auth.currentOrg.value, async (newOrg) => {
  if (newOrg) {
    await fetchApiKeys();
  }
});

const fetchApiKeys = async () => {
  if (!auth.currentOrg.value?.id) return;
  
  try {
    const response = await $fetch<{ apiKeys: any[] }>(`${api}/organizations/${auth.currentOrg.value.id}/api-keys`, {
      credentials: 'include'
    });
    apiKeys.value = response.apiKeys || [];
    console.log('Fetched API keys:', apiKeys.value);
  } catch (err: any) {
    console.error('Failed to fetch API keys:', err);
  }
};

const openCreateModal = () => {
  newKeyName.value = '';
  error.value = '';
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
  newKeyName.value = '';
  error.value = '';
};

const createApiKey = async () => {
  if (!newKeyName.value.trim()) {
    error.value = 'API key name is required';
    return;
  }

  isCreatingKey.value = true;
  error.value = '';

  try {
    const response = await $fetch(`${api}/organizations/${auth.currentOrg.value.id}/api-keys`, {
      method: 'POST',
      credentials: 'include',
      body: {
        name: newKeyName.value.trim()
      }
    });

    createdKey.value = response;
    newKeyName.value = '';
    showCreateModal.value = false;
    await fetchApiKeys();
    toast.success('API key created successfully!');
  } catch (err: any) {
    error.value = err.data?.message || 'Failed to create API key';
    toast.error(err.data?.message || 'Failed to create API key');
  } finally {
    isCreatingKey.value = false;
  }
};

const openDeleteModal = (key: any) => {
  keyToDelete.value = key;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  keyToDelete.value = null;
};

const confirmDelete = async () => {
  if (!keyToDelete.value) return;

  isDeletingKey.value = true;
  try {
    await $fetch(`${api}/organizations/${auth.currentOrg.value.id}/api-keys/${keyToDelete.value.id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    await fetchApiKeys();
    closeDeleteModal();
    toast.success('API key deleted successfully');
  } catch (err: any) {
    console.error('Failed to delete API key:', err);
    error.value = err.data?.message || 'Failed to delete API key';
    toast.error(err.data?.message || 'Failed to delete API key');
  } finally {
    isDeletingKey.value = false;
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('API key copied to clipboard!');
};

const dismissCreatedKey = () => {
  createdKey.value = null;
};
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <AppHeader />
    
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div class="space-y-8">

        <!-- API Keys Section -->
        <div class="">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-xl font-bold">API Keys</h2>
              <p class="text-sm text-gray-400 mt-1">Manage your API keys for programmatic access</p>
            </div>
            <button
              @click="openCreateModal"
              class="px-3 py-1.5 bg-blue-300 hover:bg-blue-400 text-black text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Create</span>
            </button>
          </div>

          <!-- Create New Key Form -->
          <!-- <div class="mb-6 p-4">
            <div class="flex gap-3">
              <input
                v-model="newKeyName"
                type="text"
                placeholder="API Key Name (e.g., Production, Development)"
                @keyup.enter="createApiKey"
                class="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm"
                :disabled="isCreatingKey"
              />
              <button
                @click="createApiKey"
                :disabled="isCreatingKey || !newKeyName.trim()"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <span v-if="!isCreatingKey">Create Key</span>
                <span v-else>Creating...</span>
              </button>
            </div>
            <p v-if="error" class="text-red-400 text-sm mt-2">{{ error }}</p>
          </div> -->

          <!-- API Keys List -->
          <!-- Loading State -->
           <!-- New API Key Created Alert -->
          <div v-if="createdKey" class="bg-emerald-300/5 border border-emerald-300/5 rounded-xl p-6 mb-3">
            <div class="flex items-start justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-emerald-300 mb-1">API Key Created! 🎉</h3>
                <p class="text-sm text-gray-300">Make sure to copy your API key now. You won't be able to see it again!</p>
              </div>
              <button @click="dismissCreatedKey" class="text-gray-400 hover:text-white">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="bg-black/40 rounded-lg p-4 font-mono text-sm">
              <div class="flex items-center justify-between gap-4">
                <code class="text-emerald-300 break-all">{{ createdKey.key }}</code>
                <button
                  @click="copyToClipboard(createdKey.key)"
                  class="shrink-0 px-3 py-1.5 font-medium bg-emerald-300 hover:bg-emerald-400 text-black rounded-lg text-sm transition"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
          <!-- Loading Skeleton -->
          <div v-if="isLoading" class="space-y-3">
            <div v-for="n in 3" :key="n" class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-6 animate-pulse">
              <div class="flex items-center justify-between">
                <div class="flex-1 space-y-3">
                  <div class="h-4 w-32 bg-gray-500/20 rounded"></div>
                  <div class="h-3 w-48 bg-gray-500/10 rounded"></div>
                </div>
                <div class="h-9 w-20 bg-gray-500/10 rounded-lg"></div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="apiKeys.length === 0" class="py-12 text-center space-y-5">
            <div class="w-16 h-16 mx-auto mb-2 rounded-2xl bg-gray-500/5 border border-gray-500/10 flex items-center justify-center">
              <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div class="space-y-2">
              <p class="text-white text-lg font-medium">No API keys yet</p>
              <p class="text-gray-400 text-sm">Create your first API key to access the Echos API programmatically.</p>
            </div>
            <button
              @click="openCreateModal"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-300 hover:bg-blue-400 text-black rounded-lg font-medium transition text-sm"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Key
            </button>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="key in apiKeys"
              :key="key.id"
              class="flex items-center justify-between p-4 bg-gray-500/10 rounded-lg border border-gray-500/10 transition"
            >
              <div class="flex-1">
                <div class="font-medium">{{ key.name }}</div>
                <div class="text-sm text-gray-400 font-mono mt-1">
                  {{ key.key_prefix }}••••••••••••••••
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  Created {{ new Date(key.created_at).toLocaleDateString() }}
                </div>
              </div>
              <button
                @click="openDeleteModal(key)"
                class="px-3 py-1.5 bg-red-400/10 border border-red-400/10 hover:bg-red-400/15 text-red-400 rounded-lg text-sm transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create API Key Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showCreateModal"
          class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          @click="closeCreateModal"
        >
          <Transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition ease-in duration-150"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="showCreateModal"
              @click.stop
              class="bg-black rounded-xl p-6 border border-gray-500/30 max-w-md w-full shadow-2xl"
            >
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-white">Create API Key</h3>
                <button
                  @click="closeCreateModal"
                  class="text-gray-500 hover:text-white transition"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div class="space-y-4">
                <div>
                  <label for="api-key-name" class="block text-sm font-medium text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    id="api-key-name"
                    v-model="newKeyName"
                    type="text"
                    placeholder="e.g., Production, Development"
                    autofocus
                    @keyup.enter="createApiKey"
                    class="w-full px-4 py-3 bg-gray-500/10 border text-sm border-gray-500/10 rounded-lg text-white placeholder-gray-500 focus:border-gray-500/10 focus:ring-1 focus:ring-gray-500/10 outline-none transition-colors"
                    :disabled="isCreatingKey"
                  />
                  <!-- <p class="text-xs text-gray-400 mt-2">
                    Give your API key a descriptive name to identify where it's used.
                  </p> -->
                </div>

                <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

                <div class="flex gap-3 pt-2">
                  <button
                    @click="closeCreateModal"
                    :disabled="isCreatingKey"
                    class="flex-1 px-3 py-2 bg-gray-500/10 hover:bg-gray-500/15 border border-gray-500/10 text-sm text-white rounded-lg font-medium transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    @click="createApiKey"
                    :disabled="isCreatingKey || !newKeyName.trim()"
                    class="flex-1 px-3 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span v-if="!isCreatingKey">Create</span>
                    <span v-else class="flex items-center justify-center gap-2">
                      <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showDeleteModal"
          class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          @click="closeDeleteModal"
        >
          <Transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition ease-in duration-150"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="showDeleteModal"
              @click.stop
              class="bg-black rounded-xl p-6 border border-gray-500/30 max-w-md w-full shadow-2xl"
            >
              <div class="flex items-start gap-4 mb-4">
                <div class="w-12 h-12 rounded-full bg-red-400/10 flex items-center justify-center shrink-0">
                  <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <h3 class="text-xl font-bold text-white mb-2">Delete API Key?</h3>
                  <p class="text-sm text-gray-300 mb-3">
                    Are you sure you want to delete <span class="font-semibold text-white">"{{ keyToDelete?.name }}"</span>?
                  </p>
                  <p class="text-sm text-red-400">
                    This action cannot be undone. Any applications using this key will immediately lose access.
                  </p>
                </div>
              </div>

              <div class="flex gap-3 pt-4">
                <button
                  @click="closeDeleteModal"
                  class="flex-1 px-3 py-2 bg-gray-500/10 hover:bg-gray-500/15 border border-gray-500/10 text-sm text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  @click="confirmDelete"
                  :disabled="isDeletingKey"
                  class="flex-1 px-3 py-2 bg-red-400 hover:bg-red-500 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  :class="isDeletingKey ? 'opacity-50 cursor-not-allowed' : ''"
                >
                  <svg v-if="isDeletingKey" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ isDeletingKey ? 'Deleting...' : 'Delete Key' }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

