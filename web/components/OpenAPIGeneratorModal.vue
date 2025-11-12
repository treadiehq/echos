<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="close">
    <div class="bg-black border border-gray-500/30 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
      <!-- Header -->
      <div class="p-4 border-b border-gray-500/30">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-white flex items-center gap-2">
              Generate Agent from OpenAPI Spec
            </h2>
            <p class="text-gray-400 text-sm mt-1">Paste a Stripe, GitHub, or any OpenAPI spec to instantly create an agent</p>
          </div>
          <button @click="close" class="text-gray-400 hover:text-white transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Step 1: Input -->
        <div v-if="step === 'input'" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              OpenAPI Spec (JSON/YAML URL or paste content)
            </label>
            <textarea
              v-model="specInput"
              placeholder="Paste OpenAPI spec JSON or enter URL like https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json"
              class="w-full h-64 bg-gray-500/5 border border-gray-500/20 rounded-lg p-4 text-white font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none"
              :disabled="isLoading"
            />
          </div>

          <!-- Quick examples -->
          <div class="bg-gray-500/5 border border-gray-500/20 rounded-lg p-4">
            <p class="text-sm text-gray-300 mb-3 font-medium">Quick examples</p>
            <div class="flex flex-wrap gap-2">
              <button
                @click="loadExample('stripe')"
                class="px-3 py-1.5 bg-gray-500/5 border border-gray-500/10 text-white rounded-lg hover:bg-gray-500/15 text-sm font-medium transition-colors"
                :disabled="isLoading"
              >
                Stripe API
              </button>
              <button
                @click="loadExample('github')"
                class="px-3 py-1.5 bg-gray-500/5 border border-gray-500/10 text-white rounded-lg hover:bg-gray-500/15 text-sm font-medium transition-colors"
                :disabled="isLoading"
              >
                GitHub API
              </button>
              <button
                @click="loadExample('petstore')"
                class="px-3 py-1.5 bg-gray-500/5 border border-gray-500/10 text-white rounded-lg hover:bg-gray-500/15 text-sm font-medium transition-colors"
                :disabled="isLoading"
              >
                Petstore (Demo)
              </button>
            </div>
          </div>

          <!-- Options -->
          <div class="bg-gray-500/5 border border-gray-500/20 rounded-xl p-6">
            <div class="flex items-center gap-2 mb-4">
              <h3 class="text-base font-semibold text-white">Configuration Options</h3>
            </div>
            
            <div class="space-y-4">
              <!-- Include Data Agent -->
              <label class="relative flex items-start gap-3 cursor-pointer group">
                <div class="flex items-center h-6">
                  <input 
                    type="checkbox" 
                    v-model="options.includeDataAgent" 
                    class="w-4 h-4 rounded border-gray-500/30 bg-gray-500/10 text-blue-300 focus:ring-2 focus:ring-blue-300/20 focus:ring-offset-0 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isLoading"
                  />
                </div>
                <div class="flex-1">
                  <span class="block text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                    Include data analysis agent
                  </span>
                  <span class="block text-xs text-gray-400 mt-0.5">
                    Adds an agent for processing and analyzing API responses
                  </span>
                </div>
              </label>
              
              <!-- Max Cost -->
              <div>
                <label class="block text-sm font-medium text-gray-200 mb-2">
                  Maximum Cost Limit
                </label>
                <div class="relative flex items-center gap-2">
                  <input
                    type="number"
                    v-model.number="options.maxCost"
                    class="w-full sm:w-40 bg-black/20 border border-gray-500/20 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-300/20 focus:border-blue-300/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="5.0"
                    step="0.5"
                    min="1"
                    max="100"
                    :disabled="isLoading"
                  />
                  <div class="text-xs text-gray-500 pointer-events-none">
                    units
                  </div>
                </div>
                <p class="mt-1.5 text-xs text-gray-400">
                  Sets the maximum cost for workflow execution (abstract units)
                </p>
              </div>
            </div>
          </div>

          <div class="flex gap-3 justify-end">
            <button
              @click="parseSpec"
              :disabled="!specInput || isLoading"
              class="px-4 py-2 bg-blue-300 text-sm hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-all"
            >
              <span v-if="isLoading" class="flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Parsing...
              </span>
              <span v-else>Generate</span>
            </button>
          </div>

          <div v-if="error" class="bg-red-400/10 border border-red-400/20 rounded-lg p-4 text-red-400 text-sm">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
              <div>
                <div class="font-medium">Error</div>
                <div>{{ error }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Preview -->
        <div v-if="step === 'preview'" class="space-y-4">
          <!-- API Info -->
          <div class="bg-gray-500/10 border border-gray-500/20 rounded-lg p-5">
            <h3 class="text-xl font-bold text-white mb-2">{{ apiInfo?.title }}</h3>
            <p class="text-gray-300 text-sm mb-3">{{ apiInfo?.description || 'No description provided' }}</p>
            <div class="flex flex-wrap gap-4 text-sm">
              <div class="flex items-center gap-1.5">
                <span class="text-gray-400">Version:</span>
                <span class="text-white font-medium">{{ apiInfo?.version }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-gray-400">Endpoints:</span>
                <span class="text-purple-300 font-medium">{{ apiInfo?.endpointCount }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-gray-400">Domains:</span>
                <span class="text-blue-300 font-medium">{{ apiInfo?.domains?.join(', ') }}</span>
              </div>
              <div v-if="apiInfo?.authTypes?.length" class="flex items-center gap-1.5">
                <span class="text-gray-400">Auth:</span>
                <span class="text-green-300 font-medium">{{ apiInfo.authTypes.join(', ') }}</span>
              </div>
            </div>
          </div>

          <!-- Generated Workflow -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Generated Workflow (editable)</label>
            <textarea
              v-model="generatedWorkflow"
              class="w-full h-96 bg-gray-500/10 border border-gray-500/20 rounded-lg p-4 text-white font-mono text-sm focus:outline-none focus:border-gray-500/10 transition-colors resize-none"
              :disabled="isLoading"
            />
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <button
              @click="step = 'input'"
              class="px-4 py-2 text-sm bg-gray-500/10 border border-gray-500/10 text-gray-300 rounded-lg font-medium transition-colors hover:bg-gray-500/15"
              :disabled="isLoading"
            >
              Back
            </button>
            <button
              @click="saveWorkflow"
              :disabled="isLoading"
              class="px-4 py-2 bg-blue-300 text-sm hover:bg-blue-400 disabled:bg-gray-500 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-all"
            >
              <span v-if="isLoading" class="flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
              <span v-else>Save Workflow</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  orgId: string;
}>();

const emit = defineEmits<{
  close: [];
  saved: [workflowId: string];
}>();

const api = useApiBase();
const auth = useAuth();
const toast = useToast();

const step = ref<'input' | 'preview'>('input');
const specInput = ref('');
const generatedWorkflow = ref('');
const apiInfo = ref<any>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

const options = reactive({
  includeDataAgent: true,
  maxCost: 5.0,
});

const EXAMPLES = {
  stripe: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
  github: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
  petstore: 'https://petstore3.swagger.io/api/v3/openapi.json',
};

function loadExample(type: keyof typeof EXAMPLES) {
  specInput.value = EXAMPLES[type];
  error.value = null;
}

async function parseSpec() {
  isLoading.value = true;
  error.value = null;

  try {
    // Use native fetch with proper error handling
    const fetchResponse = await fetch(`${api}/openapi/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        spec: specInput.value,
        options: options,
      }),
    });

    const response = await fetchResponse.json();

    if (!response.success) {
      throw new Error(response.error || 'Failed to parse spec');
    }

    generatedWorkflow.value = response.workflow;
    apiInfo.value = response.api;
    step.value = 'preview';
  } catch (err: any) {
    console.error('[OpenAPI] Full error object:', err);
    console.error('[OpenAPI] Error data:', err.data);
    console.error('[OpenAPI] Error message:', err.message);
    
    // Better error handling
    const errorMessage = err.data?.message || err.data?.error || err.message || 'Failed to parse OpenAPI spec';
    error.value = errorMessage;
    toast.error(`❌ ${errorMessage}`, 5000);
  } finally {
    isLoading.value = false;
  }
}

async function saveWorkflow() {
  isLoading.value = true;
  error.value = null;

  try {
    const fetchResponse = await fetch(`${api}/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        orgId: props.orgId,
        name: apiInfo.value?.title || 'Generated API Agent',
        description: `Auto-generated from OpenAPI spec: ${apiInfo.value?.title} (${apiInfo.value?.version})`,
        yamlConfig: generatedWorkflow.value,
      }),
    });

    const response = await fetchResponse.json();

    if (!fetchResponse.ok) {
      throw new Error(response.message || response.error || `Server returned ${fetchResponse.status}`);
    }

    if (response.workflow) {
      emit('saved', response.workflow.id);
      close();
    } else {
      throw new Error('No workflow returned from server');
    }
  } catch (err: any) {
    console.error('[OpenAPI] Save error full:', err);
    const errorMessage = err.message || 'Failed to save workflow';
    error.value = errorMessage;
    
    // Show user-friendly toast notification
    if (errorMessage.includes('duplicate key') || errorMessage.includes('already exists')) {
      toast.error('⚠️ A workflow with this name already exists. Please delete it first or rename this one.', 5000);
    } else {
      toast.error(`❌ ${errorMessage}`, 5000);
    }
  } finally {
    isLoading.value = false;
  }
}

function close() {
  emit('close');
  // Reset state
  setTimeout(() => {
    step.value = 'input';
    specInput.value = '';
    generatedWorkflow.value = '';
    apiInfo.value = null;
    error.value = null;
  }, 300);
}
</script>

