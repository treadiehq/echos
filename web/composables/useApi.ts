export function useApiBase() {
  const config = useRuntimeConfig();
  return config.public.apiBase as string;
}

