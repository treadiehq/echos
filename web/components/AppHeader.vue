<template>
    <header class="sticky top-0 z-40 backdrop-blur-xl bg-black/80 border-b border-white/5">
      <div class="max-w-full mx-auto px-2 py-1 flex items-center justify-between gap-4">
        <!-- Logo and Org Name -->
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="flex items-center gap-2">
            <img src="~/assets/img/logo.png" alt="Echos" class="w-6 h-6" />
          </NuxtLink>
          <span class="text-gray-500/60 font-medium text-xs">|</span>
          <div v-if="auth.currentOrg.value" class="flex items-center gap-2">
            <span class="text-white font-medium text-xs">{{ auth.currentOrg.value.name }}</span>
          </div>
        </div>

          <!-- Tab Navigation -->
          <nav class="flex items-center gap-1 bg-gray-500/5 rounded-full p-1 border border-gray-500/10">
            <NuxtLink
              to="/"
              class="px-2 py-1 rounded-full text-xs font-medium transition-all duration-200"
              :class="$route.path === '/'
                ? 'bg-gray-500/10 text-white border border-gray-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-500/5'"
            >
              Traces
            </NuxtLink>
            <NuxtLink
              to="/workflow"
              class="px-2 py-1 rounded-full text-xs font-medium transition-all duration-200"
              :class="$route.path === '/workflow'
                ? 'bg-gray-500/10 text-white border border-gray-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-500/5'"
            >
              Workflow
            </NuxtLink>
            <NuxtLink
              to="/settings"
              class="px-2 py-1 rounded-full text-xs font-medium transition-all duration-200"
              :class="$route.path === '/settings'
                ? 'bg-gray-500/10 text-white border border-gray-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-500/5'"
            >
              Settings
            </NuxtLink>
          </nav>

        <!-- Right Side Content -->
        <div class="flex items-center gap-3">
          <!-- Selector Slot (for workflow selector, etc.) -->
          <slot name="selector"></slot>
          
          <!-- Status Slot -->
          <slot name="status"></slot>

          <!-- User Menu (if logged in) -->
        <div v-if="auth.user.value" class="relative z-50">
          <button
            @click.stop="showUserMenu = !showUserMenu"
            class="flex items-center gap-2 px-1 py-1 hover:bg-gray-500/10 rounded-lg transition text-xs cursor-pointer"
          >
            <div class="w-6 h-6 rounded-full bg-amber-300/50 flex items-center justify-center text-white text-[10px] font-bold">
              {{ auth.user.value.email.charAt(0).toUpperCase() }}
            </div>
          </button>

          <!-- User Dropdown -->
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <div
              v-if="showUserMenu"
              v-click-outside="() => showUserMenu = false"
              class="absolute top-full right-0 mt-2 w-56 bg-black border border-gray-500/20 rounded-lg shadow-2xl overflow-hidden z-50"
            >
              <div class="px-4 py-3 border-b border-gray-500/10">
                <div class="text-sm font-medium text-white truncate">{{ auth.user.value.email }}</div>
                <div class="text-xs text-gray-400">Signed in</div>
              </div>
              <button
                @click="handleLogout"
                class="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-500/10 text-red-400 text-xs transition"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const auth = useAuth();
const router = useRouter();

const showUserMenu = ref(false);

async function handleLogout() {
  try {
    await auth.logout();
    showUserMenu.value = false;
    await router.push('/login');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Click outside directive - use setTimeout to avoid immediate closure
const vClickOutside = {
  mounted(el: any, binding: any) {
    el.clickOutsideEvent = (event: Event) => {
      // Check if click is outside the element
      if (!(el === event.target || el.contains(event.target))) {
        binding.value();
      }
    };
    // Add listener after a small delay to avoid immediate trigger
    setTimeout(() => {
      document.addEventListener('click', el.clickOutsideEvent);
    }, 100);
  },
  unmounted(el: any) {
    document.removeEventListener('click', el.clickOutsideEvent);
  },
};
</script>
