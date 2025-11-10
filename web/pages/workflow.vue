<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AppHeader from '../components/AppHeader.vue';
import WorkflowDiagram from '../components/WorkflowDiagram.vue';

definePageMeta({
  middleware: 'auth'
});

useHead({
  title: 'Workflow - Echos'
});

const availableWorkflows = ref<any[]>([]);
const selectedWorkflow = ref('main');
const diagramRef = ref<InstanceType<typeof WorkflowDiagram> | null>(null);
const isDropdownOpen = ref(false);

// Load available workflows
onMounted(async () => {
  try {
    const response = await fetch('/api/workflows/list');
    const data = await response.json();
    if (data.success && data.workflows) {
      availableWorkflows.value = data.workflows;
    }
  } catch (e) {
    console.error('Failed to load workflow list:', e);
  }
});

const selectedWorkflowName = computed(() => {
  const workflow = availableWorkflows.value.find(w => w.id === selectedWorkflow.value);
  return workflow?.name || 'Select Workflow';
});

function selectWorkflow(workflowId: string) {
  selectedWorkflow.value = workflowId;
  isDropdownOpen.value = false;
  handleWorkflowChange();
}

function handleWorkflowChange() {
  // Trigger reload in diagram component
  if (diagramRef.value) {
    (diagramRef.value as any).loadWorkflow(selectedWorkflow.value);
  }
}

// Click outside directive
const vClickOutside = {
  mounted(el: any, binding: any) {
    el.clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value();
      }
    };
    setTimeout(() => {
      document.addEventListener('click', el.clickOutsideEvent);
    }, 100);
  },
  unmounted(el: any) {
    document.removeEventListener('click', el.clickOutsideEvent);
  },
};
</script>

<template>
  <div class="h-screen bg-black text-gray-400 antialiased flex flex-col overflow-hidden">
    <!-- Header -->
    <AppHeader>
      <template #selector>
        <div class="relative">
          <button
            @click.stop="isDropdownOpen = !isDropdownOpen"
            type="button"
            class="flex items-center justify-between gap-2 min-w-[160px] px-3 py-1.5 bg-gray-500/5 border border-gray-500/10 rounded-lg text-xs font-medium text-white hover:bg-gray-500/10 hover:border-gray-500/20 transition focus:outline-none focus:ring-1 focus:ring-gray-500/20"
          >
            <span class="truncate">{{ selectedWorkflowName }}</span>
            <svg 
              class="w-3.5 h-3.5 text-gray-400 transition-transform"
              :class="{ 'rotate-180': isDropdownOpen }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Dropdown Menu -->
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <div
              v-if="isDropdownOpen"
              v-click-outside="() => isDropdownOpen = false"
              class="absolute left-0 top-full mt-2 w-44 bg-black border border-gray-500/20 rounded-lg shadow-2xl overflow-hidden z-50"
            >
              <div class="py-1">
                <button
                  v-for="workflow in availableWorkflows"
                  :key="workflow.id"
                  @click="selectWorkflow(workflow.id)"
                  type="button"
                  class="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-gray-500/10 transition"
                  :class="{
                    'bg-gray-500/5 text-white': selectedWorkflow === workflow.id,
                    'text-gray-300': selectedWorkflow !== workflow.id
                  }"
                >
                  <span class="truncate">{{ workflow.name }}</span>
                  <svg
                    v-if="selectedWorkflow === workflow.id"
                    class="w-4 h-4 text-blue-300 shrink-0 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </div>
          </transition>
        </div>
      </template>
    </AppHeader>

    <!-- Main Content -->
    <main class="flex-1 overflow-hidden">
      <WorkflowDiagram ref="diagramRef" :selected-workflow="selectedWorkflow" />
    </main>
  </div>
</template>
