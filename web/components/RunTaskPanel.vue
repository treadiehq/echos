<template>
  <div class="run-task-panel">
    <!-- Collapsible Header -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full flex items-center justify-between px-4 py-3 bg-gray-500/5 border border-gray-500/10 rounded-lg hover:bg-gray-500/10 transition-all"
    >
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
          <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="text-left">
          <h3 class="text-sm font-semibold text-white">Run Agent</h3>
          <p class="text-[11px] text-gray-400">Execute this workflow with a task</p>
        </div>
      </div>
      <svg
        class="w-4 h-4 text-gray-400 transition-transform"
        :class="{ 'rotate-180': isExpanded }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Expanded Panel -->
    <transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-96"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 max-h-96"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-if="isExpanded" class="mt-3 overflow-hidden">
        <div class="bg-black border border-gray-500/20 rounded-xl p-4 space-y-4">
          <!-- Task Input -->
          <div class="relative">
            <textarea
              v-model="task"
              @keydown.enter.exact="handleEnter"
              :disabled="isRunning"
              placeholder="What would you like the agent to do? e.g. Create customer john@example.com"
              class="w-full min-h-[100px] bg-gray-500/5 border border-gray-500/15 rounded-lg p-4 pr-12 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-400/30 focus:ring-1 focus:ring-emerald-400/20 transition-all resize-none disabled:opacity-50"
            />
            <div class="absolute bottom-3 right-3 text-[10px] text-gray-500">
              ⏎ Enter to run
            </div>
          </div>

          <!-- Memory Inputs (Optional) -->
          <details class="group">
            <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors list-none flex items-center gap-2">
              <svg class="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options
            </summary>
            <div class="mt-3 space-y-3">
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">API Key (for authenticated APIs)</label>
                <input
                  v-model="apiKeyInput"
                  type="password"
                  placeholder="sk_test_... or leave empty"
                  class="w-full bg-gray-500/5 border border-gray-500/15 rounded-lg px-3 py-2 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-gray-500/30 transition-all"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1.5">Additional Memory (JSON)</label>
                <textarea
                  v-model="memoryJson"
                  placeholder='{"key": "value"}'
                  class="w-full h-20 bg-gray-500/5 border border-gray-500/15 rounded-lg px-3 py-2 text-white font-mono text-xs placeholder-gray-500 focus:outline-none focus:border-gray-500/30 transition-all resize-none"
                />
              </div>
            </div>
          </details>

          <!-- Run Button -->
          <div class="flex items-center justify-between">
            <div v-if="error" class="text-xs text-red-400 flex-1 mr-4">
              {{ error }}
            </div>
            <div v-else class="flex-1"></div>
            
            <button
              @click="runTask"
              :disabled="!task.trim() || isRunning"
              class="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :class="isRunning 
                ? 'bg-emerald-400/10 border border-emerald-400/30 text-emerald-300' 
                : 'bg-emerald-400 hover:bg-emerald-500 text-black'"
            >
              <template v-if="isRunning">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Running...
              </template>
              <template v-else>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                Run Agent
              </template>
            </button>
          </div>
        </div>

        <!-- Example Tasks -->
        <div class="mt-3 px-1">
          <p class="text-[11px] text-gray-500 mb-2">Quick examples:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="example in exampleTasks"
              :key="example"
              @click="task = example"
              class="px-2.5 py-1 bg-gray-500/5 border border-gray-500/10 rounded-md text-[11px] text-gray-400 hover:text-white hover:border-gray-500/20 transition-all"
            >
              {{ example }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  workflowId: string;
  workflowName?: string;
}>();

const emit = defineEmits<{
  taskStarted: [{ taskId: string; orgId: string }];
  error: [string];
}>();

const api = useApiBase();
const router = useRouter();
const toast = useToast();

const isExpanded = ref(true);
const task = ref('');
const apiKeyInput = ref('');
const memoryJson = ref('');
const isRunning = ref(false);
const error = ref<string | null>(null);

// Example tasks based on common use cases
const exampleTasks = computed(() => {
  const name = props.workflowName?.toLowerCase() || '';
  
  if (name.includes('stripe')) {
    return [
      'Create customer john@example.com',
      'List all customers',
      'Create a $99 product called Pro Plan',
    ];
  }
  if (name.includes('github')) {
    return [
      'List my repositories',
      'Get issues for repo owner/name',
      'Create a new issue',
    ];
  }
  return [
    'Fetch API data',
    'List all resources',
    'Create a new resource',
  ];
});

function handleEnter(e: KeyboardEvent) {
  if (!e.shiftKey && task.value.trim()) {
    e.preventDefault();
    runTask();
  }
}

async function runTask() {
  if (!task.value.trim() || isRunning.value) return;
  
  isRunning.value = true;
  error.value = null;
  
  try {
    // Parse additional memory if provided
    let memory: Record<string, unknown> = {};
    
    if (memoryJson.value.trim()) {
      try {
        memory = JSON.parse(memoryJson.value);
      } catch (e) {
        error.value = 'Invalid JSON in memory field';
        isRunning.value = false;
        return;
      }
    }
    
    // Add API key if provided
    if (apiKeyInput.value.trim()) {
      memory.apiKey = apiKeyInput.value.trim();
    }
    
    const response = await fetch(`${api}/workflows/${props.workflowId}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        task: task.value.trim(),
        memory,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to run workflow');
    }
    
    // Emit success
    emit('taskStarted', { taskId: data.taskId, orgId: data.orgId });
    
    // Show success toast
    toast.success('🚀 Agent started! Redirecting to trace...', 2000);
    
    // Redirect to the trace view
    setTimeout(() => {
      router.push(`/?trace=${data.taskId}`);
    }, 500);
    
  } catch (err: any) {
    console.error('Run task error:', err);
    error.value = err.message || 'Failed to run task';
    emit('error', error.value);
    toast.error(`Failed: ${error.value}`, 3000);
  } finally {
    isRunning.value = false;
  }
}
</script>

<style scoped>
.run-task-panel {
  @apply w-full;
}
</style>

