export function useCopyToClipboard() {
  const copiedItems = ref<Set<string>>(new Set());
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  async function copy(text: string) {
    if (!text || typeof navigator === 'undefined') return;
    
    try {
      await navigator.clipboard.writeText(text);
      copiedItems.value.add(text);
      
      // Clear existing timer for this text
      if (timers.has(text)) {
        clearTimeout(timers.get(text)!);
      }
      
      // Set new timer
      const timer = setTimeout(() => {
        copiedItems.value.delete(text);
        timers.delete(text);
      }, 2000);
      
      timers.set(text, timer);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function isCopied(text: string) {
    if (!text) return false;
    return copiedItems.value.has(text);
  }

  return {
    copy,
    isCopied
  };
}
