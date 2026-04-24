import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { AuthResponse } from '@mcm/shared-types';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await api.post<AuthResponse>('/auth/login', data);
      return res.data;
    },
    onSuccess: (data) => setAuth(data.token, data.user),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string; name: string }) => {
      const res = await api.post('/auth/register', data);
      return res.data;
    },
  });
}
