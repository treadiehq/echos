import { ref, watch, type Ref } from 'vue';

export function useDebounce<T>(value: Ref<T>, delay: number = 300): Ref<T> {
  const debouncedValue = ref(value.value) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(value, (newValue) => {
    if (timer) clearTimeout(timer);
    
    timer = setTimeout(() => {
      debouncedValue.value = newValue;
    }, delay);
  });

  return debouncedValue;
}
