<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue';
import Tooltip from '../components/Tooltip.vue';

definePageMeta({
  middleware: 'auth'
});

useHead({
  title: 'Traces - Echos'
});

type TraceMeta = { id: string; org_id: string; workflow_id?: string; created_at: string; size: number };
type ConnectionStatus = "idle" | "connecting" | "streaming" | "retrying" | "polling" | "disconnected";

const api = useApiBase();
const { copy, isCopied } = useCopyToClipboard();

const search = ref("");
const debouncedSearch = useDebounce(search, 300);
const sortOption = ref<"recent" | "oldest" | "size">("recent");
const workflowFilter = ref<string>("all");

const traces = ref<TraceMeta[]>([]);
const isLoadingList = ref(false);
const listError = ref<string | null>(null);

const activeId = ref<string | null>(null);
const detail = ref<any>(null);
const isLoadingDetail = ref(false);
const detailError = ref<string | null>(null);

const connection = reactive<{
  status: ConnectionStatus;
  attempts: number;
  lastError: string | null;
}>({
  status: "idle",
  attempts: 0,
  lastError: null
});

let listTimer: ReturnType<typeof setInterval> | null = null;
let detailPollTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sse: EventSource | null = null;

function fuzzyMatch(text: string, query: string) {
  if (!query) return true;
  const normalized = query.toLowerCase().replace(/\s+/g, "");
  let idx = 0;
  for (const char of normalized) {
    idx = text.indexOf(char, idx);
    if (idx === -1) return false;
    idx += 1;
  }
  return true;
}

const uniqueWorkflows = computed(() => {
  const workflows = new Set(
    traces.value
      .map(t => t.workflow_id)
      .filter((w): w is string => Boolean(w))
  );
  return Array.from(workflows);
});

const filteredTraces = computed(() => {
  const q = debouncedSearch.value.trim().toLowerCase();
  let items = traces.value
    .filter(t => fuzzyMatch(t.id.toLowerCase(), q));

  // Apply workflow filter
  if (workflowFilter.value !== "all") {
    items = items.filter(t => t.workflow_id === workflowFilter.value);
  }

  const sorted = [...items];
  switch (sortOption.value) {
    case "oldest":
      sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
    case "size":
      sorted.sort((a, b) => b.size - a.size);
      break;
    default:
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return sorted;
});

type ConnectionVisual = {
  label: string;
  description: string;
  badgeClass: string;
  dotClass: string;
  iconPath: string;
  iconClass: string;
};

const connectionVisuals: Record<ConnectionStatus, (ctx: { attempts: number }) => ConnectionVisual> = {
  idle: () => ({
    label: "Idle",
    description: "Waiting for a trace to be opened.",
    badgeClass: "bg-black/40 border-white/10 text-white/50",
    dotClass: "bg-white/40",
    iconPath: "M12 6v6l4 2",
    iconClass: "text-white/40"
  }),
  connecting: () => ({
    label: "Connecting…",
    description: "Negotiating a live stream with the server.",
    badgeClass: "bg-amber-300/10 border-amber-300/40 text-amber-100",
    dotClass: "bg-amber-300 animate-pulse",
    iconPath: "M12 8v4m0 4h.01",
    iconClass: "text-amber-200"
  }),
  streaming: () => ({
    label: "Live",
    description: "Receiving live updates via server-sent events.",
    badgeClass: "bg-emerald-300/10 border-emerald-300/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.12)]",
    dotClass: "bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.6)]",
    iconPath: "M5 13l4 4L19 7",
    iconClass: "text-emerald-200"
  }),
  retrying: ({ attempts }) => ({
    label: `Retrying (${attempts})`,
    description: `Stream dropped. Attempt ${attempts} to reconnect.`,
    badgeClass: "bg-amber-300/10 border-amber-300/40 text-amber-100",
    dotClass: "bg-amber-300 animate-[pulse_1.6s_ease-in-out_infinite]",
    iconPath: "M4 4v5h.582m15.356-.002A8.001 8.001 0 004.582 9M20 20v-5h-.581m-15.357.002A8.003 8.003 0 0019.418 15",
    iconClass: "text-amber-200"
  }),
  polling: () => ({
    label: "Polling",
    description: "Fallback to periodic refresh while SSE reconnects.",
    badgeClass: "bg-sky-300/10 border-sky-300/40 text-sky-100",
    dotClass: "bg-sky-300",
    iconPath: "M4 4v5h.582m0 6A8.001 8.001 0 0112 5v0a8.001 8.001 0 017.418 10m.582 5v-5h-.581m0-6a8.003 8.003 0 01-15.357 10",
    iconClass: "text-sky-200"
  }),
  disconnected: () => ({
    label: "Offline",
    description: "Cannot reach the API. We will keep retrying in the background.",
    badgeClass: "bg-red-400/10 border-red-400/40 text-red-100 shadow-[0_0_18px_rgba(248,113,113,0.15)]",
    dotClass: "bg-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
    iconPath: "M12 9v2m0 4h.01M4.93 4.93l14.14 14.14",
    iconClass: "text-red-200"
  })
};

const connectionMeta = computed<ConnectionVisual>(() => {
  const build = connectionVisuals[connection.status] ?? connectionVisuals.idle;
  const base = build({ attempts: connection.attempts });
  return {
    ...base,
    description: connection.lastError ?? base.description
  };
});

const timelineSteps = computed(() => detail.value?.steps ?? []);
const selectedStepIndex = ref<number | null>(null);
const selectedStep = computed(() => {
  if (!timelineSteps.value.length) return null;
  if (selectedStepIndex.value == null) {
    return timelineSteps.value[timelineSteps.value.length - 1];
  }
  return timelineSteps.value[selectedStepIndex.value] ?? null;
});

watch(
  () => detail.value?.taskId,
  () => {
    if (!timelineSteps.value.length) {
      selectedStepIndex.value = null;
      return;
    }
    selectedStepIndex.value = timelineSteps.value.length - 1;
  },
  { immediate: true }
);

function selectStep(index: number) {
  selectedStepIndex.value = index;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatRelativeTime(timestamp: number | string) {
  // Handle string timestamps (ISO format) or numeric timestamps
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  
  // Validate timestamp
  if (!Number.isFinite(ts) || isNaN(ts)) {
    return "Invalid date";
  }
  
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const minute = 1000 * 60;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30;
  const year = day * 365;

  if (abs < minute) {
    return rtf.format(Math.round(diff / 1000), "second");
  }
  if (abs < hour) {
    return rtf.format(Math.round(diff / minute), "minute");
  }
  if (abs < day) {
    return rtf.format(Math.round(diff / hour), "hour");
  }
  if (abs < week) {
    return rtf.format(Math.round(diff / day), "day");
  }
  if (abs < month) {
    return rtf.format(Math.round(diff / week), "week");
  }
  if (abs < year) {
    return rtf.format(Math.round(diff / month), "month");
  }
  return rtf.format(Math.round(diff / year), "year");
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

async function loadTraces({ silent = false } = {}) {
  if (!silent) isLoadingList.value = true;
  try {
    listError.value = null;
    const response = await $fetch<{ traces: TraceMeta[] }>(`${api}/traces`, {
      credentials: 'include'
    });
    traces.value = response.traces;
    connection.status = "idle";
  } catch (err: any) {
    console.error("Failed to load traces:", err);
    // Don't show errors on empty state - user might not have set up anything yet
    // Only show error if we previously had traces (meaning it was working before)
    if (traces.value.length > 0 && err?.statusCode !== 401 && err?.response?.status !== 401) {
      listError.value = `Cannot connect to API at ${api}. Make sure the server is running.`;
      connection.status = "disconnected";
      connection.lastError = err?.message ?? "Connection lost";
    } else {
      // Clear error on empty state
      listError.value = null;
      connection.status = "idle";
    }
  } finally {
    isLoadingList.value = false;
  }
}

function clearDetailTimers() {
  if (detailPollTimer) {
    clearInterval(detailPollTimer);
    detailPollTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sse) {
    sse.close();
    sse = null;
  }
}

async function fetchTraceDetail(id: string, { silent = false } = {}) {
  if (!silent) isLoadingDetail.value = true;
  try {
    detailError.value = null;
    const response = await $fetch<any>(`${api}/traces/${id}`, {
      credentials: 'include'
    });
    // Unwrap the trace data from the database structure
    detail.value = response.data || response;
  } catch (err: any) {
    console.error("Failed to load trace detail:", err);
    detailError.value = err?.message ?? "Unable to load trace";
  } finally {
    isLoadingDetail.value = false;
  }
}

function schedulePolling(id: string) {
  if (detailPollTimer) return;
  connection.status = "polling";
  detailPollTimer = setInterval(() => {
    if (activeId.value !== id) return;
    fetchTraceDetail(id, { silent: true });
  }, 4000);
}

function scheduleReconnect(id: string) {
  if (reconnectTimer) return;
  connection.status = "retrying";
  const delay = Math.min(30000, 1000 * Math.pow(2, connection.attempts));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (activeId.value === id) {
      startStream(id);
    }
  }, delay);
}

function startStream(id: string) {
  clearDetailTimers();
  connection.status = "connecting";
  if (activeId.value !== id) return;

  try {
    sse = new EventSource(`${api}/traces/${id}/stream`);
  } catch (err: any) {
    console.error("Failed to create EventSource:", err);
    connection.lastError = err?.message ?? "EventSource error";
    connection.status = "disconnected";
    schedulePolling(id);
    return;
  }

  sse.addEventListener("open", () => {
    connection.status = "streaming";
    connection.attempts = 0;
    connection.lastError = null;
    if (detailPollTimer) {
      clearInterval(detailPollTimer);
      detailPollTimer = null;
    }
  });

  sse.addEventListener("update", (event) => {
    try {
      detail.value = JSON.parse((event as MessageEvent).data);
    } catch (err) {
      console.error("Failed to parse SSE payload:", err);
    }
  });

  sse.addEventListener("error", (event) => {
    console.warn("SSE connection lost:", event);
    connection.attempts += 1;
    connection.lastError = "Stream disconnected";
    if (sse) {
      sse.close();
      sse = null;
    }
    
    // If trace is already completed, don't retry
    if (detail.value?.status && ['ok', 'error', 'stopped'].includes(detail.value.status)) {
      connection.status = "idle";
      return;
    }
    
    if (connection.attempts >= 3) {
      schedulePolling(id);
    }
    scheduleReconnect(id);
  });
}

async function openTrace(id: string) {
  if (activeId.value === id && detail.value) return;
  activeId.value = id;
  clearDetailTimers();
  connection.attempts = 0;
  await fetchTraceDetail(id);
  if (detailError.value) {
    connection.status = "disconnected";
    return;
  }
  startStream(id);
}

async function reloadDetail() {
  if (!activeId.value) return;
  await fetchTraceDetail(activeId.value);
  if (!detailError.value) {
    startStream(activeId.value);
  }
}

async function copyCommand(cmd: string) {
  await copy(cmd);
}

const traceUrl = ref('');

// Update trace URL on client side only
watch(activeId, () => {
  if (typeof window !== 'undefined' && activeId.value) {
    traceUrl.value = `${window.location.origin}/?trace=${activeId.value}`;
  } else {
    traceUrl.value = '';
  }
}, { immediate: true });

async function copyLink() {
  if (!activeId.value || !traceUrl.value) return;
  await copy(traceUrl.value);
}

function exportZip() {
  if (!activeId.value) return;
  window.open(`${api}/traces/${activeId.value}/export.zip`, "_blank");
}

function resetDetail() {
  activeId.value = null;
  detail.value = null;
  detailError.value = null;
  connection.status = "idle";
  clearDetailTimers();
}

const isInitialLoad = ref(true);

onMounted(() => {
  // support deep link ?trace=
  const t = new URLSearchParams(location.search).get('trace');
  loadTraces().then(() => { 
    isInitialLoad.value = false;
    if (t) openTrace(t); 
  });
  listTimer = setInterval(() => loadTraces({ silent: true }), 5000);
});

onBeforeUnmount(() => {
  if (listTimer) clearInterval(listTimer);
  clearDetailTimers();
});
</script>

<template>
  <div class="min-h-screen bg-black text-white/90 text-sm antialiased">
    <!-- Header -->
    <AppHeader>
      <template #status>
        <Tooltip :text="connectionMeta.description" position="bottom">
          <span 
            class="hidden lg:inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border transition-colors cursor-help"
            :class="connectionMeta.badgeClass"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="{
              'bg-emerald-300 border border-emerald-300/10': connection.status === 'streaming',
              'bg-amber-300 border border-amber-300/10': connection.status === 'connecting' || connection.status === 'retrying' || connection.status === 'polling',
              'bg-red-400 border border-red-400/10': connection.status === 'disconnected',
              'bg-gray-500 border border-gray-500/10': connection.status === 'idle'
            }"></span>
            {{ connectionMeta.label }}
          </span>
        </Tooltip>
      </template>
    </AppHeader>

    <!-- Main Layout -->
    <div class="grid grid-cols-[320px_1fr] h-[calc(100vh-73px)] overflow-hidden">
      <!-- Sidebar -->
      <aside class="border-r border-gray-500/15 bg-black/50 overflow-y-auto h-full">
        <div class="flex-1 w-full px-2 py-2">
          <div class="relative">
            <input 
              v-model="search" 
              type="text"
              placeholder="Search traces by ID.." 
              class="w-full bg-gray-500/5 border border-gray-500/10 rounded-lg px-4 py-2.5 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500/20 focus:border-gray-500/10 transition-all duration-200"
            />
            <svg class="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.35-4.15a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          </div>
        </div>
        
        <!-- Workflow Filter -->
        <div v-if="uniqueWorkflows.length > 0" class="px-2 pt-2">
          <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-1">
            <button
              @click="workflowFilter = 'all'"
              class="w-full px-2.5 py-1.5 rounded-md text-[11px] capitalize transition-colors text-left"
              :class="workflowFilter === 'all' ? 'bg-gray-500/20 text-gray-300' : 'text-gray-500 hover:text-gray-300'"
            >
              All Workflows
            </button>
            <button
              v-for="workflow in uniqueWorkflows"
              :key="workflow"
              @click="workflowFilter = workflow"
              class="w-full px-2.5 py-1.5 rounded-md text-[11px] transition-colors text-left truncate"
              :class="workflowFilter === workflow ? 'bg-gray-500/20 text-gray-300' : 'text-gray-500 hover:text-gray-300'"
            >
              {{ workflow }}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3 px-2 py-2 text-xs text-gray-500/50">
          <div class="inline-flex items-center gap-1.5 w-full bg-gray-500/5 border border-gray-500/10 rounded-lg p-1">
            <button
              v-for="option in (['recent', 'oldest', 'size'] as const)" 
              :key="option"
              @click="sortOption = option"
              class="px-2.5 py-1 rounded-md capitalize transition-colors text-[11px]"
              :class="sortOption === option ? 'bg-gray-500/20 text-gray-300' : 'text-gray-500 hover:text-gray-300'"
            >
              {{ option === 'size' ? 'Largest' : option }}
            </button>
          </div>
        </div>
        <div class="p-2 space-y-2">
          <!-- Error Message -->
          <div 
            v-if="listError" 
            class="p-4 rounded-lg bg-red-400/10 border border-red-400/20 text-red-300 text-sm space-y-2"
          >
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1 leading-snug">
                {{ listError }}
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-red-200/80">
              <div class="flex items-center gap-2">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12M8 11h12M8 15h12M4 7h.01M4 11h.01M4 15h.01" />
                </svg>
                <span>Start the server:</span>
                <code class="bg-red-400/20 border border-red-400/30 px-1.5 py-0.5 rounded text-[11px]">npm run start:ui</code>
              </div>
              <button 
                type="button"
                class="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-400/30 text-[11px] text-red-200/90 hover:border-red-300/60 transition"
                @click="copyCommand('npm run start:ui')"
              >
                <svg 
                  class="w-3.5 h-3.5"
                  :class="isCopied('npm run start:ui') ? 'text-emerald-300' : ''"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    v-if="isCopied('npm run start:ui')" 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    stroke-width="2" 
                    d="M5 13l4 4L19 7" 
                  />
                  <path 
                    v-else 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    stroke-width="2" 
                    d="M8 16h8m2 4H6a2 2 0 01-2-2V6a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V18a2 2 0 01-2 2z" 
                  />
                </svg>
                <span>{{ isCopied('npm run start:ui') ? 'Copied' : 'Copy' }}</span>
              </button>
            </div>
          </div>

          <!-- Loading Skeleton (Initial Load Only) -->
          <div v-if="isInitialLoad && isLoadingList && !traces.length" class="space-y-2" aria-hidden="true">
            <div v-for="n in 4" :key="n" class="p-4 rounded-lg border border-gray-500/10 bg-gray-500/5 animate-pulse">
              <div class="h-3 w-48 bg-gray-500/10 rounded mb-3"></div>
              <div class="flex gap-2">
                <div class="h-2 w-20 bg-gray-500/10 rounded"></div>
                <div class="h-2 w-2 bg-gray-500/5 rounded-full"></div>
                <div class="h-2 w-16 bg-gray-500/10 rounded"></div>
              </div>
            </div>
          </div>

          <!-- Trace List -->
          <div
            v-for="t in filteredTraces"
            :key="t.id"
            class="group relative p-4 rounded-lg border transition-all duration-200 cursor-pointer"
            :class="{
              'bg-gray-500/5 border-gray-500/20': activeId === t.id,
              'bg-gray-500/5 border-gray-500/10 hover:bg-gray-500/15 hover:border-gray-500/20': activeId !== t.id
            }"
            @click="openTrace(t.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="font-mono text-xs text-white/70 truncate mb-1.5">{{ t.id }}</div>
                <div class="flex items-center gap-2 text-[11px] text-white/40 uppercase">
                  <span>{{ formatBytes(t.size) }}</span>
                  <span>•</span>
                  <span :title="new Date(t.created_at).toLocaleString()">{{ formatRelativeTime(new Date(t.created_at).getTime()) }}</span>
                </div>
              </div>
              <div 
                class="flex flex-col items-end gap-2 text-[11px]"
              >
                <span 
                  v-if="activeId === t.id"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-300/10 border border-emerald-300/10 text-emerald-300 font-medium"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                  Viewing
                </span>
                <span 
                  v-else 
                  class="opacity-0 group-hover:opacity-100 transition text-white/30"
                >
                  Open ↵
                </span>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div 
            v-if="!isInitialLoad && !isLoadingList && !filteredTraces.length && !listError" 
            class="p-6 text-center space-y-6"
          >
            <div class="space-y-3">
              <div class="w-12 h-12 mx-auto rounded-full bg-gray-500/5 border border-gray-500/10 flex items-center justify-center">
                <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div class="space-y-1">
                <p class="text-white text-base font-semibold">No traces yet</p>
                <p class="text-gray-400 text-xs">Traces will appear here as your agents perform actions.</p>
              </div>
            </div>

            <!-- <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 text-left space-y-4">
              <p class="text-sm font-semibold text-white">Getting Started</p>
              
              <div class="space-y-3 text-xs">
                <div class="space-y-2">
                  <p class="text-gray-400">
                    <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-500/10 text-gray-300 font-medium mr-2">1</span>
                    Create an API key in <NuxtLink to="/settings" class="text-blue-400 hover:text-blue-300 underline">Settings</NuxtLink>
                  </p>
                  
                  <p class="text-gray-400">
                    <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-500/10 text-gray-300 font-medium mr-2">2</span>
                    Install Echos:
                  </p>
                  <div class="bg-black/40 rounded-lg p-3 font-mono text-emerald-300 relative group">
                    <code class="text-xs">npm install echos</code>
                    <button 
                      @click="copyCommand('npm install echos')"
                      class="absolute right-2 top-2 p-1.5 bg-gray-500/10 hover:bg-gray-500/20 rounded text-gray-400 hover:text-white transition opacity-0 group-hover:opacity-100"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>

                  <p class="text-gray-400 mt-3">
                    <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-500/10 text-gray-300 font-medium mr-2">3</span>
                    Use Echos in your code:
                  </p>
                  <div class="bg-black/40 rounded-lg p-3 font-mono text-xs text-gray-300 overflow-x-auto">
                    <pre class="text-emerald-300">import { EchosRuntime } from 'echos'

const echos = new EchosRuntime({
  apiKey: process.env.ECHOS_API_KEY
})

// Run a workflow
const result = await echos.run({
  workflow: 'main',
  input: 'Analyze sales data for Q4'
})</pre>
                  </div>
                </div>
              </div>

              <a 
                href="https://github.com/treadiehq/echos#readme" 
                target="_blank"
                class="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                View documentation
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div> -->
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="overflow-y-auto bg-black h-full p-2">
        <!-- Loading State -->
        <div v-if="isLoadingDetail && !detail" class="max-w-6xl mx-auto p-6 space-y-6 animate-pulse">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="h-36 rounded-xl border border-gray-500/5 bg-gray-500/5"></div>
            <div class="h-36 rounded-xl border border-gray-500/5 bg-gray-500/5"></div>
          </div>
          <div class="h-72 rounded-xl border border-gray-500/5 bg-gray-500/5"></div>
          <div class="h-96 rounded-xl border border-gray-500/5 bg-gray-500/5"></div>
        </div>

        <!-- Error State with Retry -->
        <div 
          v-else-if="detailError" 
          class="max-w-xl mx-auto p-8"
        >
          <div class="rounded-xl border border-red-400/10 bg-red-400/10 p-6 space-y-4">
            <div class="flex items-start gap-3">
              <svg class="w-6 h-6 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <h2 class="text-sm font-semibold text-red-400 mb-1">Failed to load trace</h2>
                <p class="text-sm text-red-300/80">{{ detailError }}</p>
                <p class="text-xs text-red-300/60 mt-2">The trace might be corrupted or the server connection was lost.</p>
              </div>
            </div>
            <div class="flex items-center justify-end gap-3 text-sm">
              <button 
                type="button"
                class="px-3 py-2 rounded-lg bg-gray-500/10 hover:bg-gray-500/15 border border-gray-500/10 text-gray-400 hover:text-white transition"
                @click="resetDetail"
              >
                Close
              </button>
              <button 
                type="button"
                class="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 transition flex items-center gap-2"
                @click="reloadDetail"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
              <!-- <button 
                type="button"
                class="px-3 py-1.5 rounded-md border border-red-400/10 text-red-400/60 hover:text-red-400/80 hover:border-red-400/20 transition"
                @click="resetDetail"
              >
                Close
              </button> -->
            </div>
          </div>
        </div>

        <!-- Loading Skeleton for Main Content (Initial Load) -->
        <div 
          v-if="isInitialLoad && isLoadingList" 
          class="flex items-center justify-center h-full px-6"
        >
          <div class="text-center space-y-4">
            <div class="w-16 h-16 mx-auto border-4 border-gray-500/20 border-t-gray-500 rounded-full animate-spin"></div>
            <p class="text-gray-400 text-sm">Loading traces...</p>
          </div>
        </div>

        <!-- Prompt to select or Getting Started -->
        <div 
          v-else-if="!detail" 
          class="flex items-center justify-center h-full px-6"
        >
          <!-- Show Getting Started if no traces exist (after initial load) -->
          <div v-if="!isInitialLoad && traces.length === 0" class="text-center max-w-lg space-y-6">
            <div class="w-16 h-16 mx-auto mb-2 rounded-2xl bg-gray-500/5 border border-gray-500/10 flex items-center justify-center">
              <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="space-y-2">
              <h2 class="text-lg font-semibold text-white">No traces yet</h2>
              <p class="text-gray-400 text-sm">Traces will appear here as your agents perform actions.</p>
            </div>
            
            <!-- Getting Started Section -->
            <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4 text-left">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-white">Getting Started</h3>
                <a 
                  href="https://github.com/treadiehq/echos#readme" 
                  target="_blank" 
                  class="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Docs
                </a>
              </div>
              <ol class="space-y-3 text-xs text-gray-300">
                <li class="flex items-center gap-3">
                  <span class="shrink-0 w-5 h-5 rounded-full bg-gray-500/10 text-gray-400 flex items-center justify-center text-[11px] font-medium">1</span>
                  <div>
                    <p class="font-medium text-white mb-1">Create an API key in <NuxtLink to="/settings" class="text-blue-400 hover:text-blue-300 underline">Settings</NuxtLink></p>
                  </div>
                </li>
                <li class="flex items-center gap-3">
                  <span class="shrink-0 w-5 h-5 rounded-full bg-gray-500/10 text-gray-400 flex items-center justify-center text-[11px] font-medium">2</span>
                  <div class="">
                    <p class="font-medium text-white mb-1">Install Echos and use in your code:</p>
                  </div>
                </li>
              </ol>
              <div class="mt-2 bg-black border border-gray-500/20 rounded p-3 font-mono text-[11px] overflow-x-auto">
<pre class="text-gray-300"><span class="text-gray-500">// Install Echos</span>
npm install <span class="text-amber-300">echos</span>

<span class="text-gray-500">// In your application:</span>
<span class="text-purple-400">import</span> { <span class="text-sky-300">EchosRuntime</span>, <span class="text-sky-300">loadWorkflow</span>, <span class="text-sky-300">builtInAgents</span> } <span class="text-purple-400">from</span> <span class="text-amber-300">'echos'</span>

<span class="text-purple-400">const</span> <span class="text-sky-300">runtime</span> = <span class="text-purple-400">new</span> <span class="text-sky-300">EchosRuntime</span>(
  <span class="text-sky-300">loadWorkflow</span>(<span class="text-amber-300">'./workflow.yaml'</span>),
  builtInAgents,
  {
    apiKey: <span class="text-blue-300">process</span>.<span class="text-blue-300">env</span>.<span class="text-amber-300">ECHOS_API_KEY</span>,
    apiUrl: <span class="text-amber-300">'http://localhost:4000'</span>
  }
)

<span class="text-purple-400">const</span> <span class="text-sky-300">result</span> = <span class="text-purple-400">await</span> runtime.<span class="text-sky-300">run</span>({
  task: <span class="text-amber-300">'Analyze sales data for Q4'</span>,
  memory: { year: <span class="text-emerald-300">2024</span> }
})

<span class="text-blue-300">console</span>.<span class="text-sky-300">log</span>(<span class="text-amber-300">'Trace:'</span>, result.<span class="text-blue-300">taskId</span>)</pre>
                    </div>
            </div>
          </div>

          <!-- Show Select prompt if traces exist -->
          <div v-else class="text-center max-w-md space-y-5">
            <div class="w-16 h-16 mx-auto mb-2 rounded-2xl bg-gray-500/5 border border-gray-500/10 flex items-center justify-center">
              <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div class="space-y-2">
              <h2 class="text-lg font-semibold text-white">Select a trace</h2>
              <p class="text-gray-400 text-sm max-w-xs mx-auto">Select a trace from the left to view execution details.</p>
            </div>
          </div>
        </div>

        <!-- Trace Detail -->
        <div v-else class="max-w-7xl mx-auto p-2 space-y-6">
          <!-- Action Buttons -->
          <div class="flex items-center justify-between gap-3">
            <div class="text-xs text-gray-400">
              <span class="font-mono">{{ detail.taskId }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-500/5 border border-gray-500/10 text-xs text-gray-300 hover:bg-gray-500/10 hover:border-gray-500/20 transition"
                @click="copyLink"
              >
                <svg class="w-3.5 h-3.5" :class="isCopied(traceUrl) ? 'text-emerald-300' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path v-if="isCopied(traceUrl)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {{ isCopied(traceUrl) ? 'Copied!' : 'Copy Link' }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-500/5 border border-gray-500/10 text-xs text-gray-300 hover:bg-gray-500/10 hover:border-gray-500/20 transition"
                @click="exportZip"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>
          
          <!-- Header Cards -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Task Info Card -->
            <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 backdrop-blur-sm">
              <div class="flex items-start justify-between gap-4 mb-4">
                <div class="flex-1 min-w-0 space-y-1.5">
                  <div class="text-xs text-gray-500 uppercase tracking-wider">Started</div>
                  <div class="text-sm text-gray-300">{{ new Date(detail.startedAt).toLocaleString() }}</div>
                </div>
                <div class="flex flex-col items-end text-right gap-2">
                  <button 
                    type="button"
                    class="text-[11px] text-gray-400 hover:text-gray-300 transition"
                    @click="reloadDetail"
                  >
                    Refresh now
                  </button>
                </div>
              </div>
              
              <div class="space-y-3 pt-4 border-t border-gray-500/10">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500 uppercase">Status</span>
                    <span 
                      class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                      :class="{
                        'bg-emerald-300/10 text-emerald-300 border border-emerald-300/10': detail.status === 'ok',
                        'bg-red-400/10 text-red-400 border border-red-400/10': detail.status === 'error',
                        'bg-amber-400/10 text-amber-400 border border-amber-400/10': detail.status === 'stopped'
                      }"
                    >
                      <span 
                        class="w-1.5 h-1.5 rounded-full"
                        :class="{
                          'bg-emerald-300': detail.status === 'ok',
                          'bg-red-400': detail.status === 'error',
                          'bg-amber-300': detail.status === 'stopped'
                        }"
                      ></span>
                      {{ detail.status }}
                    </span>
                  </div>
                <div v-if="detail.error" class="text-xs text-red-400 font-mono">{{ detail.error }}</div>
                <div class="flex items-center gap-4 text-xs text-gray-400">
                  <div>
                    <span class="text-gray-500">Duration:</span>
                    <span class="font-mono ml-1">{{ detail.totals?.durationMs || 0 }}ms</span>
                  </div>
                  <div>
                    <span class="text-gray-500">Cost:</span>
                    <span class="font-mono ml-1">{{ (detail.totals?.cost || 0).toFixed(2) }}</span>
                  </div>
                </div>
                <div v-if="detail.ceilings" class="pt-2 border-t border-gray-500/10 space-y-1">
                  <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Ceilings</div>
                  <div class="flex flex-wrap gap-2 text-xs">
                    <span class="px-2 py-0.5 rounded bg-gray-500/10 border border-gray-500/10 text-gray-400">
                      Max Duration: {{ detail.ceilings.maxDurationMs ?? '—' }}ms
                    </span>
                    <span class="px-2 py-0.5 rounded bg-gray-500/10 border border-gray-500/10 text-gray-400">
                      Max Cost: {{ detail.ceilings.maxCost ?? '—' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Agents Card -->
            <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 backdrop-blur-sm lg:col-span-2">
              <div class="flex items-center justify-between mb-4">
                <div class="text-xs text-gray-500 uppercase tracking-wider">Agent Loop Counts</div>
                <span class="text-[11px] text-gray-400">Total steps: {{ detail.steps?.length || 0 }}</span>
              </div>
              <div class="flex flex-wrap gap-2 mb-4">
                <div
                  v-for="(loops, agent) in loopCounts(detail)"
                  :key="agent"
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-500/10 border border-gray-500/10 text-xs"
                >
                  <span class="text-gray-300 font-medium">{{ agent }}</span>
                  <span class="text-gray-400">×</span>
                  <span class="text-gray-500 font-mono">{{ loops }}</span>
                </div>
              </div>
              <div v-if="detail.memoryNamespaces?.length" class="pt-3 border-t border-gray-500/10">
                <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Memory Namespaces</div>
                <div class="flex flex-wrap gap-2">
                  <span 
                    v-for="ns in detail.memoryNamespaces" 
                    :key="ns"
                    class="px-2 py-0.5 rounded bg-gray-500/10 border border-gray-500/10 text-xs text-gray-400 font-mono"
                  >
                    {{ ns }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Execution Graph -->
          <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-5 backdrop-blur-sm">
            <div class="flex items-center justify-between mb-4">
              <div class="text-xs text-gray-500 uppercase tracking-wider">Execution Flow</div>
              <span class="text-[11px] text-gray-400" v-if="selectedStep">
                Highlighting: {{ selectedStep.agent }}
              </span>
            </div>
            <LazyGraph :steps="detail.steps || []" :active-agent="selectedStep?.agent" />
          </div>

          <!-- Timeline & Payload -->
          <div class="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="text-xs text-gray-500 uppercase tracking-wider">Timeline</div>
                <span class="text-[11px] text-gray-400">{{ timelineSteps.length }} steps</span>
              </div>
              <div class="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                <button
                  v-for="(s, index) in timelineSteps"
                  :key="s.at + index"
                  type="button"
                  @click="selectStep(index)"
                  class="w-full text-left px-3 py-3 rounded-lg border transition-all duration-200"
                  :class="selectedStepIndex === index ? 'bg-gray-500/5 border-gray-500/30 text-gray-300' : 'bg-gray-500/5 border-gray-500/5 hover:bg-gray-500/10 hover:border-gray-500/20 text-gray-400'"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded bg-black/40 border border-gray-500/10 text-[11px] font-mono">#{{ s.loop }}</span>
                      <span class="text-sm font-semibold tracking-wide">{{ s.agent }}</span>
                    </div>
                    <span 
                      class="text-[11px] text-gray-400 font-mono"
                      :title="new Date(s.at).toLocaleString()"
                    >
                      {{ formatRelativeTime(s.at) }}
                    </span>
                  </div>
                  <p 
                    class="mt-2 text-[11px] text-gray-400 overflow-hidden"
                    style="line-clamp: 2; -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical;"
                  >
                    {{ typeof s.output === 'string' ? s.output : JSON.stringify(s.output) }}
                  </p>
                  <div v-if="s.attempt > 1" class="px-1.5 w-fit flex py-0.5 mt-2 flex-1 shrink-0 rounded bg-amber-300/10 border border-amber-300/20 text-[10px] font-mono text-amber-300">try {{ s.attempt }}</div>
                </button>
              </div>
            </div>

            <div class="bg-gray-500/5 border border-gray-500/10 rounded-xl p-4 space-y-5">
              <div v-if="selectedStep" class="space-y-1">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 flex-wrap">
                    <span class="px-2.5 py-1 rounded-lg bg-gray-500/10 border border-gray-500/10 text-[11px] font-mono">Loop {{ selectedStep.loop }}</span>
                    <span v-if="selectedStep.attempt" class="px-2 py-0.5 rounded bg-amber-300/10 border border-amber-300/20 text-[11px] font-mono text-amber-300">Attempt {{ selectedStep.attempt }}</span>
                    <h3 class="text-sm font-semibold text-white">{{ selectedStep.agent }}</h3>
                  </div>
                  <span class="text-[11px] text-gray-400 font-mono">
                    {{ new Date(selectedStep.at).toLocaleString() }}
                  </span>
                </div>
                <p class="text-xs text-gray-400">
                  Step {{ (selectedStepIndex ?? timelineSteps.length - 1) + 1 }} of {{ timelineSteps.length }}
                </p>
              </div>

              <div class="grid gap-5">
                <JsonPreview 
                  :value="selectedStep?.input" 
                  title="Input"
                  empty-message="No input recorded for this step."
                >
                  <template #icon>
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12M8 11h12M8 15h12M4 7h.01M4 11h.01M4 15h.01" />
                    </svg>
                  </template>
                </JsonPreview>

                <JsonPreview 
                  :value="selectedStep?.output" 
                  title="Output"
                  empty-message="No output returned by this step."
                >
                  <template #icon>
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v2a2 2 0 002 2h2a2 2 0 002-2v-2m-6 0h6m-6 0a4 4 0 01-4-4v-3a4 4 0 014-4h6a4 4 0 014 4v3a4 4 0 01-4 4m-6-8v-1a2 2 0 012-2h2a2 2 0 012 2v1" />
                    </svg>
                  </template>
                </JsonPreview>

                <!-- Metadata Section -->
                <div 
                  v-if="selectedStep?.output?.metadata" 
                  class="border border-gray-500/10 rounded-lg p-4 bg-black/60 backdrop-blur-sm space-y-3"
                >
                  <div class="flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <h4 class="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Performance Metrics</h4>
                  </div>
                  
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <!-- Duration -->
                    <div 
                      v-if="selectedStep.output.metadata.duration !== undefined"
                      class="px-3 py-2 rounded-lg border border-blue-300/10 bg-blue-400/5"
                    >
                      <div class="text-[10px] uppercase tracking-wide text-blue-300/60 mb-1">Duration</div>
                      <div class="text-sm font-semibold text-blue-300">{{ selectedStep.output.metadata.duration }}ms</div>
                    </div>

                    <!-- Tokens -->
                    <div 
                      v-if="selectedStep.output.metadata.tokens"
                      class="px-3 py-2 rounded-lg border border-purple-300/10 bg-purple-300/5"
                    >
                      <div class="text-[10px] uppercase tracking-wide text-purple-300/60 mb-1">Tokens</div>
                      <div class="text-sm font-semibold text-purple-300">{{ selectedStep.output.metadata.tokens.total }}</div>
                      <div class="text-[10px] text-purple-300/50">
                        {{ selectedStep.output.metadata.tokens.prompt }}↑ {{ selectedStep.output.metadata.tokens.completion }}↓
                      </div>
                    </div>

                    <!-- Cost -->
                    <div 
                      v-if="selectedStep.output.metadata.cost !== undefined"
                      class="px-3 py-2 rounded-lg border border-emerald-300/10 bg-emerald-300/5"
                    >
                      <div class="text-[10px] uppercase tracking-wide text-emerald-300/60 mb-1">Cost</div>
                      <div class="text-sm font-semibold text-emerald-300">${{ selectedStep.output.metadata.cost.toFixed(5) }}</div>
                    </div>

                    <!-- Model/Provider -->
                    <div 
                      v-if="selectedStep.output.metadata.model || selectedStep.output.metadata.provider"
                      class="px-3 py-2 rounded-lg border border-orange-300/10 bg-orange-300/5"
                    >
                      <div class="text-[10px] uppercase tracking-wide text-orange-300/60 mb-1">Provider</div>
                      <div class="text-sm font-semibold text-orange-300">{{ selectedStep.output.metadata.model || selectedStep.output.metadata.provider }}</div>
                      <div v-if="selectedStep.output.metadata.model && selectedStep.output.metadata.provider" class="text-[10px] text-orange-300/50">
                        {{ selectedStep.output.metadata.provider }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  methods: {
    loopCounts(trace: any) {
      const counts: Record<string, number> = {};
      (trace.steps || []).forEach((s: any) => { counts[s.agent] = (counts[s.agent] || 0) + 1; });
      return counts;
    }
  }
}
</script>
