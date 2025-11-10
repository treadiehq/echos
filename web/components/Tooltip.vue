<script setup lang="ts">
const props = defineProps<{
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}>();

const position = props.position || 'top';
const showTooltip = ref(false);
</script>

<template>
  <div 
    class="relative inline-flex"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <slot />
    
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showTooltip && text"
        class="absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded-lg shadow-lg whitespace-nowrap pointer-events-none"
        :class="{
          'bottom-full left-1/2 -translate-x-1/2 mb-2': position === 'top',
          'top-full left-1/2 -translate-x-1/2 mt-2': position === 'bottom',
          'right-full top-1/2 -translate-y-1/2 mr-2': position === 'left',
          'left-full top-1/2 -translate-y-1/2 ml-2': position === 'right'
        }"
      >
        {{ text }}
        
        <!-- Arrow -->
        <div
          class="absolute w-2 h-2 bg-gray-900 border-gray-700 rotate-45"
          :class="{
            'bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r': position === 'top',
            'top-[-4px] left-1/2 -translate-x-1/2 border-t border-l': position === 'bottom',
            'right-[-4px] top-1/2 -translate-y-1/2 border-r border-t': position === 'left',
            'left-[-4px] top-1/2 -translate-y-1/2 border-l border-b': position === 'right'
          }"
        />
      </div>
    </Transition>
  </div>
</template>
