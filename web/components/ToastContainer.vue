<script setup lang="ts">
const toast = useToast();

const icons = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  warning: 'M12 9v2m0 4h.01',
  info: 'M13 16h-1v-4h-1m1-4h.01'
};

const styles = {
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  error: 'bg-red-500/10 border-red-500/20 text-red-300',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-300'
};
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      <TransitionGroup
        name="toast"
        tag="div"
        class="space-y-2"
      >
        <div
          v-for="item in toast.toasts.value"
          :key="item.id"
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg max-w-sm"
          :class="styles[item.type]"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="icons[item.type]" />
          </svg>
          <p class="text-sm font-medium flex-1">{{ item.message }}</p>
          <button
            @click="toast.remove(item.id)"
            class="text-current opacity-50 hover:opacity-100 transition"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(2rem);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(2rem) scale(0.95);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>

