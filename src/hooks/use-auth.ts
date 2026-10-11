"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, tokens } from "@/lib/api";
import { authKeys } from "@/lib/query-keys";
import type { CurrentUser } from "@/types/org";

export function useMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => api.get<CurrentUser>("/auth/me/"),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const data = await api.post<{ access: string; refresh: string }>("/auth/login/", { email, password }, { auth: false });
      tokens.set(data.access, data.refresh);
    },
    onSuccess: () => {
      qc.clear();
      router.push("/");
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const refresh = tokens.refresh;
      tokens.clear();
      if (refresh) await api.post("/auth/logout/", { refresh }, { auth: false }).catch(() => undefined);
    },
    onSuccess: () => {
      qc.clear();
      router.push("/login");
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { full_name: string; title: string }) => api.patch<CurrentUser>("/auth/me/", patch),
    onSuccess: (user) => qc.setQueryData(authKeys.me(), user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) => api.post("/auth/change-password/", body),
  });
}
