<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import YAML from 'yaml';

const props = defineProps<{
  trace: any;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  deploy: [config: any];
}>();

const api = useApiBase();
const { copy, isCopied } = useCopyToClipboard();

// State
const originalConfigYaml = ref('');
const modifiedConfigYaml = ref('');
const isReplaying = ref(false);
const replayResult = ref<any>(null);
const replayError = ref<string | null>(null);
const activeTab = ref<'config' | 'result'>('config');
const yamlError = ref<string | null>(null);

// Helper to get trace data (handles both direct and nested structure)
const traceData = computed(() => props.trace?.data || props.trace);

// Parse the workflow config from the trace
watch(() => props.trace, () => {
  if (traceData.value?.workflowConfig) {
    try {
      originalConfigYaml.value = YAML.stringify(traceData.value.workflowConfig);
      modifiedConfigYaml.value = originalConfigYaml.value;
      yamlError.value = null;
    } catch (err: any) {
      yamlError.value = `Failed to parse config: ${err.message}`;
    }
  }
}, { immediate: true });

// Validate YAML as user types
const isValidYaml = computed(() => {
  if (!modifiedConfigYaml.value) return false;
  try {
    YAML.parse(modifiedConfigYaml.value);
    yamlError.value = null;
    return true;
  } catch (err: any) {
    yamlError.value = err.message;
    return false;
  }
});

const hasChanges = computed(() => {
  return originalConfigYaml.value !== modifiedConfigYaml.value;
});

async function testFix() {
  if (!isValidYaml.value) {
    replayError.value = 'Please fix YAML syntax errors before testing';
    return;
  }

  isReplaying.value = true;
  replayError.value = null;
  replayResult.value = null;

  try {
    const modifiedConfig = YAML.parse(modifiedConfigYaml.value);
    
    // Get trace ID - use database ID (props.trace.id), not taskId from data
    const traceId = props.trace?.id;
    
    console.log('Replaying trace:', {
      traceId,
      hasTrace: !!props.trace,
      traceKeys: props.trace ? Object.keys(props.trace) : []
    });
    
    if (!traceId) {
      console.error('Trace object:', props.trace);
      console.error('Trace data:', traceData.value);
      throw new Error('No trace ID found');
    }
    
    const url = `${api}/traces/${traceId}/replay`;
    console.log('Replay URL:', url);
    
    const response = await $fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: {
        workflowConfig: modifiedConfig
      }
    });

    replayResult.value = response.result;
    activeTab.value = 'result';
  } catch (err: any) {
    console.error('Replay error:', err);
    replayError.value = err.message || 'Failed to replay trace';
  } finally {
    isReplaying.value = false;
  }
}

function deployFix() {
  if (!isValidYaml.value) return;
  const modifiedConfig = YAML.parse(modifiedConfigYaml.value);
  emit('deploy', modifiedConfig);
}

function resetChanges() {
  modifiedConfigYaml.value = originalConfigYaml.value;
  replayResult.value = null;
  replayError.value = null;
  yamlError.value = null;
  activeTab.value = 'config';
}

function closeModal() {
  resetChanges();
  emit('close');
}

// Compute status comparison
const statusComparison = computed(() => {
  if (!replayResult.value) return null;
  
  const originalStatus = traceData.value?.status;
  const newStatus = replayResult.value.status;
  
  return {
    original: originalStatus,
    new: newStatus,
    improved: (originalStatus === 'error' || originalStatus === 'stopped') && newStatus === 'ok',
    worsened: originalStatus === 'ok' && (newStatus === 'error' || newStatus === 'stopped'),
    unchanged: originalStatus === newStatus
  };
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        @click.self="closeModal"
      >
        <div
          class="bg-black border border-gray-500/20 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-500/20">
            <div class="flex items-center gap-3">
              <div>
                <h2 class="text-lg font-semibold text-white">Time Travel Debug</h2>
                <p class="text-xs text-gray-400 mt-0.5">
                  Edit config → Test with original data → Deploy fix
                </p>
              </div>
            </div>
            <button
              @click="closeModal"
              class="p-2 rounded-lg hover:bg-gray-500/10 transition text-gray-400 hover:text-white"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="flex items-center gap-2 px-4 border-b border-gray-500/20">
            <button
              @click="activeTab = 'config'"
              class="px-4 py-2 text-sm font-medium transition-colors"
              :class="activeTab === 'config' 
                ? 'text-white border-b-2 border-blue-300' 
                : 'text-gray-400 hover:text-white hover:bg-gray-500/5'"
            >
              Workflow
            </button>
            <button
              @click="activeTab = 'result'"
              class="px-4 py-2 text-sm font-medium transition-colors relative"
              :class="activeTab === 'result' 
                ? 'text-white border-b-2 border-blue-300' 
                : 'text-gray-400 hover:text-white hover:bg-gray-500/5'"
            >
              Result
              <!-- <span
                v-if="replayResult"
                class="absolute -top-1 -right-1 w-2 h-2 bg-emerald-300 rounded-full"
              ></span> -->
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Config Editor Tab -->
            <div v-if="activeTab === 'config'" class="space-y-4">
              <!-- Original Context Info -->
              <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
                <h3 class="text-sm font-medium text-white mb-2">Original Context</h3>
                <div class="space-y-2 text-xs text-gray-300">
                  <div><span class="text-gray-500">Task:</span> <span class="font-mono">{{ traceData?.initialTask }}</span></div>
                  <div v-if="traceData?.initialMemory && Object.keys(traceData.initialMemory).length > 0">
                    <span class="text-gray-500">Memory:</span>
                    <pre class="mt-1 bg-black/40 border border-gray-500/10 rounded p-2 text-[10px] overflow-x-auto">{{ JSON.stringify(traceData.initialMemory, null, 2) }}</pre>
                  </div>
                </div>
              </div>

              <!-- YAML Editor -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium text-gray-300">Config (YAML)</label>
                  <div class="flex items-center gap-2">
                    <span
                      v-if="hasChanges"
                      class="text-xs text-amber-300 flex items-center gap-1"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Modified
                    </span>
                    <button
                      v-if="hasChanges"
                      @click="resetChanges"
                      class="text-xs text-gray-400 hover:text-white transition"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <textarea
                  v-model="modifiedConfigYaml"
                  class="w-full h-96 bg-black border rounded-lg p-4 text-xs font-mono text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300/50 resize-none"
                  :class="yamlError ? 'border-red-400/20' : 'border-gray-500/20'"
                  spellcheck="false"
                ></textarea>
                <div v-if="yamlError" class="text-xs text-red-400 flex items-start gap-2">
                  <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ yamlError }}</span>
                </div>
              </div>

              <!-- Error Display -->
              <div v-if="replayError" class="bg-red-400/10 border border-red-400/10 rounded-lg p-4">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="flex-1">
                    <h4 class="text-sm font-semibold text-red-400 mb-1">Replay Failed</h4>
                    <p class="text-xs text-red-300">{{ replayError }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Test Result Tab -->
            <div v-else-if="activeTab === 'result'" class="space-y-4">
              <div v-if="!replayResult" class="text-center py-12 text-gray-400 max-w-md mx-auto space-y-5">
                <div class="w-16 h-16 mx-auto mb-2 rounded-2xl bg-gray-500/5 border border-gray-500/10 flex items-center justify-center">
                  <svg class="w-8 h-8 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div class="space-y-2">
                  <h2 class="text-lg font-semibold text-white">No test result yet</h2>
                  <p class="text-gray-400 text-sm max-w-xs mx-auto">Click "Test This Fix" to replay with your changes.</p>
                </div>
              </div>

              <div v-else class="space-y-4">
                <!-- Status Comparison -->
                <div class="grid grid-cols-2 gap-4">
                  <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                    <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Original</div>
                    <div
                      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                      :class="{
                        'bg-emerald-300/10 text-emerald-300 border border-emerald-300/10': trace.status === 'ok',
                        'bg-red-400/10 text-red-400 border border-red-400/10': trace.status === 'error',
                        'bg-amber-400/10 text-amber-300 border border-amber-400/10': trace.status === 'stopped'
                      }"
                    >
                      <span class="w-2 h-2 rounded-full" :class="{
                        'bg-emerald-300': trace.status === 'ok',
                        'bg-red-400': trace.status === 'error',
                        'bg-amber-300': trace.status === 'stopped'
                      }"></span>
                      {{ trace.status }}
                    </div>
                    <div v-if="trace.error" class="mt-2 text-xs text-red-400 font-mono">{{ trace.error }}</div>
                  </div>

                  <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4 relative">
                    <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">With Your Fix</div>
                    <div
                      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                      :class="{
                        'bg-emerald-300/10 text-emerald-300 border border-emerald-300/10': replayResult.status === 'ok',
                        'bg-red-400/10 text-red-400 border border-red-400/10': replayResult.status === 'error',
                        'bg-amber-400/10 text-amber-300 border border-amber-300/10': replayResult.status === 'stopped'
                      }"
                    >
                      <span class="w-2 h-2 rounded-full" :class="{
                        'bg-emerald-300': replayResult.status === 'ok',
                        'bg-red-400': replayResult.status === 'error',
                        'bg-amber-300': replayResult.status === 'stopped'
                      }"></span>
                      {{ replayResult.status }}
                    </div>
                    <div v-if="replayResult.error" class="mt-2 text-xs text-red-400 font-mono">{{ replayResult.error }}</div>
                    
                    <!-- Improvement Badge -->
                    <div
                      v-if="statusComparison?.improved"
                      class="absolute top-2 right-2 px-2 py-1 bg-emerald-300/20 border border-emerald-300/30 rounded-md text-[10px] font-medium text-emerald-300 flex items-center gap-1"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Fixed!
                    </div>
                  </div>
                </div>

                <!-- Cost & Duration Comparison -->
                <div class="grid grid-cols-2 gap-4">
                  <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                    <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Cost</div>
                    <div class="flex items-baseline gap-3">
                      <span class="text-2xl font-semibold text-white">${{ (trace.totals?.cost || 0).toFixed(4) }}</span>
                      <span class="text-xs text-gray-400">→</span>
                      <span class="text-xl font-semibold" :class="
                        (replayResult.totals?.cost || 0) < (trace.totals?.cost || 0) 
                          ? 'text-emerald-300' 
                          : (replayResult.totals?.cost || 0) > (trace.totals?.cost || 0)
                          ? 'text-red-400'
                          : 'text-white'
                      ">${{ (replayResult.totals?.cost || 0).toFixed(4) }}</span>
                    </div>
                  </div>

                  <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                    <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Duration</div>
                    <div class="flex items-baseline gap-3">
                      <span class="text-2xl font-semibold text-white">{{ trace.totals?.durationMs || 0 }}ms</span>
                      <span class="text-xs text-gray-400">→</span>
                      <span class="text-xl font-semibold text-white">{{ replayResult.totals?.durationMs || 0 }}ms</span>
                    </div>
                  </div>
                </div>

                <!-- Result Details -->
                <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                  <div class="text-xs text-gray-500 uppercase tracking-wider mb-3">Result Details</div>
                  <JsonPreview :value="replayResult.result" empty-message="No result data">
                    <template #icon>
                      <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </template>
                  </JsonPreview>
                </div>

                <!-- View New Trace -->
                <div class="bg-blue-300/5 border border-blue-300/20 rounded-lg p-4 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <svg class="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div>
                      <div class="text-sm font-medium text-blue-300">New trace created</div>
                      <div class="text-xs text-gray-400 font-mono">{{ replayResult.taskId }}</div>
                    </div>
                  </div>
                  <a
                    :href="`/?trace=${replayResult.taskId}`"
                    target="_blank"
                    class="px-3 py-1.5 bg-blue-300/10 hover:bg-blue-300/20 border border-blue-300/20 rounded-lg text-xs text-blue-300 transition"
                  >
                    View Trace →
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-between gap-4 p-6 border-t border-gray-500/20">        
            <div class="flex items-center justify-end gap-3 w-full">
              <button
                @click="testFix"
                :disabled="!isValidYaml || isReplaying"
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
                :class="!isValidYaml || isReplaying
                  ? 'bg-gray-500/10 border border-gray-500/10 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-300 hover:bg-blue-400 border border-transparent text-black hover:text-black'"
              >
                {{ isReplaying ? 'Testing...' : 'Test Fix' }}
              </button>

              <button
                v-if="statusComparison?.improved"
                @click="deployFix"
                :disabled="!isValidYaml"
                class="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Deploy Fix
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95);
  opacity: 0;
}
</style>

