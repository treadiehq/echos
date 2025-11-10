<script setup lang="ts">
const props = defineProps<{
  value: unknown;
  title?: string;
  collapsedLines?: number;
  emptyMessage?: string;
}>();

const expanded = ref(false);
const copied = ref(false);
const collapseTarget = computed(() => props.collapsedLines ?? 6);

const formatted = computed(() => {
  if (props.value === undefined) return "";
  try {
    return typeof props.value === "string"
      ? props.value
      : JSON.stringify(props.value, null, 2);
  } catch (error) {
    console.error("Failed to stringify JSON payload:", error);
    return String(props.value);
  }
});

const lines = computed(() => formatted.value.split("\n"));
const canExpand = computed(() => lines.value.length > collapseTarget.value);
const displayText = computed(() => {
  if (expanded.value || !canExpand.value) return formatted.value;
  return lines.value.slice(0, collapseTarget.value).join("\n");
});

let copyTimer: ReturnType<typeof setTimeout> | null = null;

async function copyPayload() {
  if (typeof navigator === "undefined" || !formatted.value) return;
  try {
    await navigator.clipboard.writeText(formatted.value);
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch (error) {
    console.error("Copy failed:", error);
  }
}

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer);
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
        <slot name="icon" />
        <span>{{ title || "Payload" }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button 
          v-if="canExpand" 
          type="button"
          class="text-[11px] text-gray-400 hover:text-gray-300 transition"
          @click="expanded = !expanded"
        >
          {{ expanded ? "Collapse" : "Expand" }}
        </button>
        <button 
          type="button"
          class="text-[11px] text-gray-400 hover:text-gray-300 transition"
          @click="copyPayload"
        >
          <span v-if="copied" class="inline-flex items-center gap-1">
            <svg class="w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Copied
          </span>
          <span v-else class="inline-flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16h8m2 4H6a2 2 0 01-2-2V6a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V18a2 2 0 01-2 2z" />
            </svg>
            Copy
          </span>
        </button>
      </div>
    </div>

    <div 
      class="relative bg-black/60 border border-gray-500/10 rounded-lg overflow-hidden"
    >
      <pre 
        v-if="formatted"
        class="text-[12px] leading-relaxed text-gray-300 font-mono px-4 py-3 whitespace-pre-wrap break-words"
      >{{ displayText }}</pre>
      <div 
        v-else 
        class="px-4 py-6 text-sm text-gray-400 text-center"
      >
        {{ emptyMessage || "Nothing recorded for this step" }}
      </div>
      <div 
        v-if="!expanded && canExpand" 
        class="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/90 to-transparent pointer-events-none"
      ></div>
    </div>
  </div>
</template>
