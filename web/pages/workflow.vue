<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import AppHeader from '../components/AppHeader.vue';
import WorkflowDiagram from '../components/WorkflowDiagram.vue';

definePageMeta({
  middleware: 'auth'
});

useHead({
  title: 'Workflow - Echos'
});

const api = useApiBase();
const auth = useAuth();
const toast = useToast();

const availableWorkflows = ref<any[]>([]);
const selectedWorkflow = ref<string | null>(null);
const diagramRef = ref<InstanceType<typeof WorkflowDiagram> | null>(null);
const isDropdownOpen = ref(false);
const isLoading = ref(true);
const searchQuery = ref('');

// Load available workflows from both file-based and database
onMounted(async () => {
  try {
    isLoading.value = true;
    const orgId = auth.currentOrg.value?.id || auth.user.value?.orgId;
    
    if (!orgId) {
      console.error('No organization ID found');
      return;
    }

    // Load file-based workflows (examples and templates)
    // IDs must match the mapping in web/server/api/workflows/[id].get.ts
    const fileWorkflows = [
      { id: 'main', name: 'Main', source: 'file' },
      { id: 'api', name: 'API Integration', source: 'file' },
      { id: 'database', name: 'Database Query', source: 'file' },
      { id: 'research', name: 'Web Research', source: 'file' },
      { id: 'code', name: 'Code Generation', source: 'file' },
    ];

    // Load database workflows
    const response = await fetch(`${api}/workflows?orgId=${orgId}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    const dbWorkflows = (data.workflows || []).map((w: any) => ({
      ...w,
      source: 'database'
    }));

    // Combine both types
    availableWorkflows.value = [
      ...fileWorkflows,
      ...dbWorkflows
    ];
    
    // Auto-select first workflow if available
    if (availableWorkflows.value.length > 0) {
      selectedWorkflow.value = availableWorkflows.value[0].id;
      handleWorkflowChange();
    }
  } catch (e) {
    console.error('Failed to load workflow list:', e);
  } finally {
    isLoading.value = false;
  }
});

const selectedWorkflowName = computed(() => {
  if (!selectedWorkflow.value) {
    return availableWorkflows.value.length > 0 ? 'Select Workflow' : 'No Workflows';
  }
  const workflow = availableWorkflows.value.find(w => w.id === selectedWorkflow.value);
  return workflow?.name || 'Select Workflow';
});

// Filter workflows by search query
const filteredWorkflows = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return availableWorkflows.value;
  
  return availableWorkflows.value.filter(w => 
    w.name.toLowerCase().includes(query)
  );
});

// Group workflows by source
const fileWorkflows = computed(() => 
  filteredWorkflows.value.filter(w => w.source === 'file')
);

const databaseWorkflows = computed(() => 
  filteredWorkflows.value.filter(w => w.source === 'database')
);

// Reset search when dropdown closes
watch(isDropdownOpen, (isOpen) => {
  if (!isOpen) {
    searchQuery.value = '';
  }
});

function selectWorkflow(workflowId: string) {
  selectedWorkflow.value = workflowId;
  isDropdownOpen.value = false;
  searchQuery.value = ''; // Reset search when selecting
  handleWorkflowChange();
}

function handleWorkflowChange() {
  // Trigger reload in diagram component
  if (diagramRef.value && selectedWorkflow.value) {
    const workflow = availableWorkflows.value.find(w => w.id === selectedWorkflow.value);
    const source = workflow?.source || 'file';
    (diagramRef.value as any).loadWorkflow(selectedWorkflow.value, source);
  }
}

async function deleteWorkflow(workflowId: string, workflowName: string) {
  if (!confirm(`Are you sure you want to delete "${workflowName}"? This cannot be undone.`)) {
    return;
  }

  try {
    const orgId = auth.currentOrg.value?.id || auth.user.value?.orgId;
    
    const response = await fetch(`${api}/workflows/${workflowId}?orgId=${orgId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to delete workflow');
    }

    // Remove from local list
    availableWorkflows.value = availableWorkflows.value.filter(w => w.id !== workflowId);

    // If deleted workflow was selected, clear selection
    if (selectedWorkflow.value === workflowId) {
      selectedWorkflow.value = null;
    }

    toast.success(`Deleted "${workflowName}"`, 2000);
  } catch (error) {
    console.error('Delete error:', error);
    toast.error('Failed to delete workflow', 3000);
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
        <div v-if="availableWorkflows.length > 0" class="relative">
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
              class="absolute right-0 top-full mt-2 w-72 bg-black border border-gray-500/20 rounded-lg shadow-2xl overflow-hidden z-50"
            >
              <!-- Search Input -->
              <div class="p-2 border-b border-gray-500/10">
                <div class="relative">
                  <svg 
                    class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search workflows..."
                    class="w-full pl-8 pr-3 py-1.5 bg-gray-500/5 border border-gray-500/10 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-gray-500/20 focus:bg-gray-500/10"
                    @click.stop
                  />
                </div>
              </div>

              <!-- Scrollable Content -->
              <div class="max-h-[400px] overflow-y-auto">
                <!-- Templates Section -->
                <div v-if="fileWorkflows.length > 0" class="py-1">
                  <div class="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Templates
                  </div>
                  <button
                    v-for="workflow in fileWorkflows"
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

                <!-- Custom Workflows Section -->
                <div v-if="databaseWorkflows.length > 0" class="py-1 border-t border-gray-500/10">
                  <div class="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Custom Workflows
                  </div>
                  <div
                    v-for="workflow in databaseWorkflows"
                    :key="workflow.id"
                    class="group flex items-center hover:bg-gray-500/10 transition"
                    :class="{
                      'bg-gray-500/5': selectedWorkflow === workflow.id,
                    }"
                  >
                    <button
                      @click="selectWorkflow(workflow.id)"
                      type="button"
                      class="flex-1 flex items-center justify-between px-3 py-2 text-xs text-left"
                      :class="{
                        'text-white': selectedWorkflow === workflow.id,
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
                    <button
                      @click.stop="deleteWorkflow(workflow.id, workflow.name)"
                      type="button"
                      class="px-2 py-2 text-gray-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                      title="Delete workflow"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- No Results -->
                <div v-if="filteredWorkflows.length === 0" class="px-3 py-8 text-center text-xs text-gray-500">
                  No workflows found
                </div>
              </div>
            </div>
          </transition>
        </div>
      </template>
    </AppHeader>

    <!-- Main Content -->
    <main class="flex-1 overflow-hidden">
      <WorkflowDiagram ref="diagramRef" :selected-workflow="selectedWorkflow || undefined" />
    </main>
  </div>
</template>
