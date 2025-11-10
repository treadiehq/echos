<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        @click="onCancel"
      >
        <transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="show"
            @click.stop
            class="bg-black rounded-lg p-6 border border-gray-500/20 max-w-md w-full shadow-2xl"
          >
            <div class="flex items-start gap-4 mb-4">
              <div 
                class="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                :class="iconBgClass"
              >
                <svg class="w-6 h-6" :class="iconColorClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPath" />
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-white mb-2">{{ title }}</h3>
                <p class="text-sm text-gray-300">{{ message }}</p>
                <p v-if="warningMessage" class="text-sm text-red-400 mt-2">{{ warningMessage }}</p>
              </div>
            </div>

            <div class="flex gap-3 pt-4">
              <button
                @click="onCancel"
                class="flex-1 px-3 py-2 bg-gray-500/10 hover:bg-gray-500/15 border border-gray-500/10 text-sm text-white rounded-lg font-medium transition"
              >
                {{ cancelText }}
              </button>
              <button
                @click="onConfirm"
                :disabled="loading"
                class="flex-1 px-3 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                :class="confirmButtonClass"
              >
                <span v-if="!loading">{{ confirmText }}</span>
                <span v-else class="flex items-center justify-center gap-2">
                  <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ loadingText }}</span>
                </span>
              </button>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    show: boolean;
    title: string;
    message: string;
    warningMessage?: string;
    confirmText?: string;
    cancelText?: string;
    loadingText?: string;
    loading?: boolean;
    variant?: 'danger' | 'warning' | 'info';
  }>(),
  {
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    loadingText: 'Processing...',
    loading: false,
    variant: 'danger',
  }
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const iconPath = computed(() => {
  switch (props.variant) {
    case 'danger':
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
    case 'warning':
      return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    case 'info':
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    default:
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
  }
});

const iconBgClass = computed(() => {
  switch (props.variant) {
    case 'danger':
      return 'bg-red-400/10';
    case 'warning':
      return 'bg-amber-400/10';
    case 'info':
      return 'bg-blue-400/10';
    default:
      return 'bg-red-400/10';
  }
});

const iconColorClass = computed(() => {
  switch (props.variant) {
    case 'danger':
      return 'text-red-400';
    case 'warning':
      return 'text-amber-400';
    case 'info':
      return 'text-blue-400';
    default:
      return 'text-red-400';
  }
});

const confirmButtonClass = computed(() => {
  switch (props.variant) {
    case 'danger':
      return 'bg-red-400 hover:bg-red-500 text-white';
    case 'warning':
      return 'bg-amber-400 hover:bg-amber-500 text-black';
    case 'info':
      return 'bg-blue-400 hover:bg-blue-500 text-black';
    default:
      return 'bg-red-400 hover:bg-red-500 text-white';
  }
});

function onConfirm() {
  emit('confirm');
}

function onCancel() {
  if (!props.loading) {
    emit('cancel');
  }
}
</script>

