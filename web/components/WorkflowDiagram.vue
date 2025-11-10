<template>
  <div class="workflow-diagram">
    <!-- Loading State -->
    <div v-if="loading" class="grid grid-cols-[1fr_350px] gap-6 mt-20">
      <div class="bg-black border border-gray-500/10 rounded-lg p-8 flex items-center justify-center min-h-[600px]">
        <div class="text-center space-y-4">
          <div class="flex justify-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white/20"></div>
          </div>
          <p class="text-sm text-gray-400">Loading workflow configuration...</p>
        </div>
      </div>
      <div class="bg-black border border-gray-500/10 rounded-lg p-6 space-y-3">
        <div class="h-4 bg-white/5 rounded animate-pulse w-24"></div>
        <div class="space-y-2">
          <div class="h-20 bg-white/5 rounded animate-pulse"></div>
          <div class="h-20 bg-white/5 rounded animate-pulse"></div>
          <div class="h-20 bg-white/5 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="max-w-2xl mx-auto mt-20">
      <div class="bg-black border border-gray-500/20 rounded-lg p-8 text-center space-y-4">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="space-y-2">
          <h3 class="text-lg font-semibold text-white">Failed to Load Workflow</h3>
          <p class="text-sm text-gray-400">{{ error }}</p>
        </div>
        <div class="pt-4">
          <button 
            @click="loadWorkflow" 
            class="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        </div>
      </div>
    </div>
    
    <!-- Success State -->
    <div v-else class="h-screen">
      <!-- Main Content -->
      <div class="grid grid-cols-[1fr_350px] h-full">
        <!-- Mermaid Diagram - Full height, scrolls internally -->
        <div class="bg-black overflow-auto flex items-center justify-center relative" @wheel.prevent="handleWheel">
          <div ref="mermaidContainer" class="mermaid-wrapper p-8" :style="{ transform: `scale(${zoomLevel})`, transformOrigin: 'center' }">
            <!-- Mermaid renders here -->
          </div>
          
          <!-- Zoom Controls -->
          <div class="absolute top-4 right-4 flex flex-col items-center justify-center gap-2 bg-black border border-white/10 rounded-lg p-1">
            <button 
              @click="zoomIn"
              :disabled="zoomLevel >= maxZoom"
              class="w-6 h-6 flex items-center justify-center text-white hover:bg-white/10 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom In (or use mouse wheel)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <!-- <button 
              @click="resetZoom"
              class="w-8 h-8 flex items-center justify-center text-[10px] text-gray-400 hover:text-white hover:bg-white/10 rounded transition"
              title="Reset Zoom"
            >
              {{ Math.round(zoomLevel * 100) }}%
            </button> -->
            <button 
              @click="zoomOut"
              :disabled="zoomLevel <= minZoom"
              class="w-6 h-6 flex items-center justify-center text-white hover:bg-white/10 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom Out (or use mouse wheel)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Agent Details Sidebar - Full height, scrolls internally -->
        <div class="bg-black border-l border-gray-500/15 flex flex-col h-full">
          <div class="border-b border-white/5 px-4 py-3 flex-shrink-0">
            <h3 class="text-sm font-medium text-gray-400">Agents ({{ agents.length }})</h3>
          </div>
          <div class="p-4 space-y-3 overflow-y-auto flex-1">
            <div v-for="agent in agents" :key="agent.name" class="bg-white/[0.02] border border-white/5 rounded-lg p-4 hover:border-white/10 transition">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-white font-mono">{{ agent.name }}</span>
                <span 
                  class="text-xs font-medium rounded-full px-2.5 py-1" 
                  :class="agent.type === 'orchestrator' ? 'agent-badge-orchestrator' : 'agent-badge-worker'"
                >
                  {{ agent.type }}
                </span>
              </div>
              <div class="space-y-2 text-xs text-gray-400">
                <div v-if="agent.maxLoops" class="flex items-center gap-2">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Max loops: {{ agent.maxLoops }}</span>
                </div>
                <div v-if="agent.hasGuardrails" class="flex items-center gap-2">
                  <svg class="w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Guardrails enabled</span>
                </div>
                <div v-if="agent.hasRetries" class="flex items-center gap-2">
                  <svg class="w-3.5 h-3.5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Auto-retry enabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import mermaid from 'mermaid';

// Props
const props = defineProps<{
  selectedWorkflow?: string;
}>();

const loading = ref(true);
const error = ref<string | null>(null);
const mermaidCode = ref('');
const agents = ref<any[]>([]);
const mermaidContainer = ref<HTMLElement | null>(null);
const zoomLevel = ref(1);
const minZoom = 0.5;
const maxZoom = 2;

// Initialize Mermaid
onMounted(async () => {
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#8ec5ff',
        primaryTextColor: '#fff',
        primaryBorderColor: '#8ec5ff',
        lineColor: '#8ec5ff',
        secondaryColor: '#5ee9b5',
        tertiaryColor: '#1f2937',
      },
    });
    
    await nextTick();
    await loadWorkflow();
  } catch (e) {
    console.error('Initialization error:', e);
    error.value = 'Failed to initialize: ' + (e instanceof Error ? e.message : String(e));
  }
});

// Expose loadWorkflow so parent can call it
defineExpose({
  loadWorkflow
});

async function loadWorkflow(workflowId?: string) {
  const id = workflowId || props.selectedWorkflow || 'main';
  try {
    loading.value = true;
    error.value = null;
    
    // Fetch actual workflow.yaml from API
    const response = await fetch(`/api/workflows/${id}`);
    const data = await response.json();
    
    if (!data.success || !data.workflow) {
      throw new Error(data.error || 'Failed to load workflow configuration');
    }
    
    const workflow = data.workflow;
    
    // Parse agents from workflow
    agents.value = workflow.agents.map((agent: any) => ({
      name: agent.name,
      type: agent.type,
      maxLoops: agent.maxLoops,
      hasGuardrails: !!agent.policy?.guardrails,
      hasRetries: !!agent.policy?.retries,
    }));
    
    // Generate Mermaid diagram from actual workflow
    const orchestrator = workflow.agents.find((a: any) => a.type === 'orchestrator');
    const workers = workflow.agents.filter((a: any) => a.type === 'worker');
    
    let diagramCode = `graph TD\n`;
    diagramCode += `  Start((Start)) --> Orchestrator\n`;
    
    if (orchestrator) {
      diagramCode += `  Orchestrator[${orchestrator.name}]:::orchestrator\n`;
      
      // Add routes from orchestrator
      const orchRoutes = workflow.routes?.[orchestrator.name]?.canCall || [];
      orchRoutes.forEach((target: string) => {
        diagramCode += `  Orchestrator --> ${target}[${target}]:::worker\n`;
      });
    }
    
    // Add routes between workers
    workers.forEach((worker: any) => {
      const workerRoutes = workflow.routes?.[worker.name]?.canCall || [];
      if (workerRoutes.length > 0) {
        workerRoutes.forEach((target: string) => {
          diagramCode += `  ${worker.name} --> ${target}[${target}]:::worker\n`;
        });
      } else {
        // If no routes, go to End
        diagramCode += `  ${worker.name} --> End((End))\n`;
      }
    });
    
    diagramCode += `\n  classDef orchestrator fill:#8ec5ff,stroke:#333,stroke-width:2px,color:#000\n`;
    diagramCode += `  classDef worker fill:#5ee9b5,stroke:#333,stroke-width:2px,color:#000`;
    
    mermaidCode.value = diagramCode;
    
    // Set loading to false FIRST to show the container
    loading.value = false;
    
    // Wait for DOM update
    await nextTick();
    
    // Small delay to ensure DOM is fully ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now render
    await renderDiagram();
  } catch (e) {
    console.error('loadWorkflow error:', e);
    error.value = e instanceof Error ? e.message : 'Failed to load workflow';
    loading.value = false;
  }
}

async function renderDiagram() {
  // Wait for DOM to be ready
  await nextTick();
  
  const container = mermaidContainer.value;
  console.log('Container check:', container);
  
  if (!container) {
    console.error('Mermaid container not found after nextTick');
    error.value = 'Mermaid container element not found';
    return;
  }
  
  if (!mermaidCode.value) {
    console.error('Mermaid code is empty');
    return;
  }
  
  console.log('Rendering mermaid diagram...');
  console.log('Mermaid code:', mermaidCode.value);
  
  try {
    const { svg } = await mermaid.render('mermaid-diagram-' + Date.now(), mermaidCode.value);
    console.log('Mermaid rendered successfully, SVG length:', svg.length);
    container.innerHTML = svg;
  } catch (e) {
    console.error('Mermaid render error:', e);
    error.value = 'Failed to render diagram: ' + (e instanceof Error ? e.message : String(e));
  }
}

// Zoom functions
function zoomIn() {
  if (zoomLevel.value < maxZoom) {
    zoomLevel.value = Math.min(maxZoom, zoomLevel.value + 0.1);
  }
}

function zoomOut() {
  if (zoomLevel.value > minZoom) {
    zoomLevel.value = Math.max(minZoom, zoomLevel.value - 0.1);
  }
}

function resetZoom() {
  zoomLevel.value = 1;
}

function handleWheel(event: WheelEvent) {
  const delta = -event.deltaY / 1000;
  const newZoom = zoomLevel.value + delta;
  zoomLevel.value = Math.max(minZoom, Math.min(maxZoom, newZoom));
}
</script>

<style scoped>
/* .mermaid-wrapper {
  background: rgb(0 0 0 / 0.3);
} */

.mermaid-wrapper :deep(svg) {
  max-width: 100%;
  height: auto;
}

.agent-badge-orchestrator {
  background: rgb(99 102 241 / 0.15);
  border: 1px solid rgb(99 102 241 / 0.3);
  color: rgb(129 140 248);
}

.agent-badge-worker {
  background: rgb(16 185 129 / 0.15);
  border: 1px solid rgb(16 185 129 / 0.3);
  color: rgb(52 211 153);
}

@media (max-width: 1024px) {
  .workflow-diagram > div {
    grid-template-columns: 1fr !important;
  }
}
</style>

