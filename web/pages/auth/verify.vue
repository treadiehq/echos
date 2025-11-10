<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] px-4">
    <div class="max-w-md w-full">
      <div class="bg-white rounded-lg shadow-xl p-8 text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-[#667eea] mx-auto mb-4"></div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Verifying your email...</h2>
        <p class="text-gray-600">Please wait while we sign you in.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';

definePageMeta({
  middleware: 'guest'
});

const route = useRoute();
const config = useRuntimeConfig();

onMounted(() => {
  const token = route.query.token as string;
  
  if (!token) {
    // No token, redirect to login with error
    window.location.href = '/login?error=No verification token provided';
    return;
  }

  // Redirect to backend verification endpoint which will handle the verification
  // and redirect back to the appropriate page
  window.location.href = `${config.public.apiBase}/auth/verify?token=${token}`;
});
</script>
