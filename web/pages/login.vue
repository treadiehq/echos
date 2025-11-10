<script setup lang="ts">
useHead({
  title: 'Login - Echos'
});

const auth = useAuth();
const router = useRouter();
const route = useRoute();

const email = ref('');
const submitted = ref(false);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

// Check for login status from query params
onMounted(async () => {
  // If user is already logged in, redirect to home
  if (auth.user.value) {
    router.push('/');
    return;
  }

  // Try to fetch current user (silent check)
  try {
    await auth.fetchCurrentUser();
    router.push('/');
    return;
  } catch {
    // User is not logged in, continue with login flow
  }

  const loginStatus = route.query.login;
  
  if (loginStatus === 'success') {
    // User successfully logged in, check auth
    auth.fetchCurrentUser().then(() => {
      router.push('/');
    }).catch(() => {
      errorMessage.value = 'Authentication failed';
    });
  } else if (loginStatus === 'error') {
    errorMessage.value = route.query.message as string || 'Authentication failed';
  }
});

async function handleSubmit() {
  if (!email.value || !email.value.includes('@')) {
    errorMessage.value = 'Please enter a valid email address';
    return;
  }

  isLoading.value = true;
  errorMessage.value = null;

  try {
    const result = await auth.sendMagicLink(email.value);
    submitted.value = true;
  } catch (err: any) {
    errorMessage.value = err?.data?.message || 'Failed to send magic link. Please try again.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-black text-white/90 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo/Branding -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2 mb-3">
          <img src="~/assets/img/logo.png" alt="Echos" class="w-14 h-14">
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">Welcome back</h1>
        <p class="text-gray-400 text-sm">Log in to your account</p>
      </div>

      <!-- Login Card -->
      <div class="bg-gray-500/5 border border-gray-500/10 rounded-2xl p-8 backdrop-blur-sm">
        <!-- Success State -->
        <div v-if="submitted" class="text-center space-y-4">
          <div class="w-16 h-16 mx-auto rounded-lg bg-emerald-300/10 border border-emerald-300/10 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
            </svg>
          </div>
          
          <h2 class="text-xl font-semibold text-white">Check your email</h2>
          
          <div class="space-y-3">
            <p class="text-sm text-gray-400">
              We've sent a magic link to <span class="font-medium text-white">{{ email }}</span>. Click the link in the email to sign in to your account.
            </p>
          </div>
        </div>

        <!-- Login Form -->
        <div v-else class="">
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Email Input -->
            <div class="space-y-2">
              <label for="email" class="block text-sm font-medium text-gray-300">
                Email address
              </label>
              <input
                id="email"
                v-model="email"
                type="email"
                required
                autocomplete="email"
                :disabled="isLoading"
                class="w-full px-3 py-2 bg-gray-500/10 text-sm border border-gray-500/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500/50 focus:border-gray-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="you@acme.com"
              />
            </div>

            <!-- Error Message -->
            <div
              v-if="errorMessage"
              class="p-3 rounded-lg bg-red-400/10 border border-red-400/10 text-red-300 text-sm"
            >
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="flex-1 text-xs">
                  <p>{{ errorMessage }}</p>
                </div>
              </div>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full px-3 py-2 bg-blue-300 hover:bg-blue-400 text-black text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg
                v-if="isLoading"
                class="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ isLoading ? 'Sending...' : 'Send magic link' }}</span>
            </button>
          </form>
        </div>
      </div>

      <!-- Sign Up Link -->
      <div class="mt-6 text-center text-sm text-gray-400">
        Don't have an account?
        <NuxtLink to="/signup" class="text-blue-300 hover:text-blue-400 underline ml-1">
          Sign up
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

