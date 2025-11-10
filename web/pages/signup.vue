<script setup lang="ts">
definePageMeta({
  middleware: ['guest']
});

useHead({
  title: 'Sign Up - Echos'
});

const auth = useAuth();
const api = useApiBase();

const email = ref('');
const orgName = ref('');
const isLoading = ref(false);
const error = ref('');
const success = ref(false);
const magicLinkSent = ref(false);

async function handleSignup() {
  if (!email.value.trim() || !orgName.value.trim()) {
    error.value = 'Email and organization name are required';
    return;
  }

  if (!isValidEmail(email.value)) {
    error.value = 'Please enter a valid email address';
    return;
  }

  isLoading.value = true;
  error.value = '';

  try {
    // Send magic link with org name in the request
    await $fetch(`${api}/auth/send-magic-link`, {
      method: 'POST',
      credentials: 'include',
      body: {
        email: email.value.trim(),
        orgName: orgName.value.trim(),
        isSignup: true
      }
    });

    magicLinkSent.value = true;
    success.value = true;
  } catch (err: any) {
    error.value = err.data?.message || 'Failed to send magic link';
  } finally {
    isLoading.value = false;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      
      <!-- Success State -->
      <div v-if="magicLinkSent" class="space-y-6">
        <div class="text-center">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-emerald-300/10 border border-emerald-300/10 text-emerald-300 mb-3">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p class="text-gray-400 text-sm">We sent a magic link to</p>
          <p class="text-white font-medium mt-1">{{ email }}</p>
        </div>

        <div class="bg-gray-500/5 border border-gray-500/10 rounded-2xl p-8 backdrop-blur-sm">
          <div class="space-y-4 text-sm text-gray-400">
            <p>Click the link in the email to complete your sign up and create your organization.</p>
            <p class="text-xs">The link will expire in 15 minutes.</p>
          </div>
        </div>

        <div class="text-center text-sm text-gray-400">
          Didn't receive the email?
          <button 
            @click="magicLinkSent = false" 
            class="text-blue-300 hover:text-blue-400 underline ml-1"
          >
            Try again
          </button>
        </div>
      </div>

      <!-- Sign Up Form -->
      <div v-else class="space-y-6">
        <!-- Header -->
        <div class="text-center">
          <div class="inline-flex items-center gap-2 mb-3">
            <img src="~/assets/img/logo.png" alt="Echos" class="w-14 h-14">
          </div>
          <h1 class="text-2xl font-bold text-white mb-2">Create your account</h1>
          <p class="text-gray-400 text-sm">Get started with Echos in seconds</p>
        </div>

        <!-- Form -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-2xl p-8 backdrop-blur-sm">
          <form @submit.prevent="handleSignup" class="space-y-4">
            <!-- Email -->
            <div>
              <label for="email" class="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                v-model="email"
                type="email"
                placeholder="you@acme.com"
                autofocus
                class="w-full px-3 py-2 text-sm bg-gray-500/10 border border-gray-500/10 rounded-lg text-white placeholder-gray-500 focus:border-gray-500/10 focus:ring-1 focus:ring-gray-500/10 outline-none transition-colors"
                :disabled="isLoading"
              />
            </div>

            <!-- Organization Name -->
            <div>
              <label for="org-name" class="block text-sm font-medium text-gray-300 mb-2">
                Organization name
              </label>
              <input
                id="org-name"
                v-model="orgName"
                type="text"
                placeholder="Acme"
                class="w-full px-3 py-2 text-sm bg-gray-500/10 border border-gray-500/10 rounded-lg text-white placeholder-gray-500 focus:border-gray-500/10 focus:ring-1 focus:ring-gray-500/10 outline-none transition-colors"
                :disabled="isLoading"
              />
            </div>

            <!-- Error Message -->
            <div v-if="error" class="p-3 bg-red-400/10 border border-red-400/10 rounded-lg">
              <p class="text-sm text-red-400">{{ error }}</p>
            </div>

            <!-- Sign Up Button -->
            <button
              type="submit"
              :disabled="isLoading || !email.trim() || !orgName.trim()"
              class="w-full px-3 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span v-if="!isLoading">Create an account</span>
              <span v-else class="flex items-center justify-center space-x-2">
                <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Sending magic link...</span>
              </span>
            </button>
          </form>
        </div>

        <!-- Login Link -->
        <div class="text-center text-sm text-gray-400">
          Already have an account?
          <NuxtLink to="/login" class="text-blue-300 hover:text-blue-400 underline ml-1">
            Log in
          </NuxtLink>
        </div>
      </div>

    </div>
  </div>
</template>

