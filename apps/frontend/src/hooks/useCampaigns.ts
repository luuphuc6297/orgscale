import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Campaign,
  CampaignDetail,
  CampaignListResponse,
  CreateCampaignDto,
  ScheduleCampaignDto,
  UpdateCampaignDto,
} from '@mcm/shared-types';

interface CampaignWrap {
  campaign: Campaign;
}

export function useCampaignsList(params: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const res = await api.get<CampaignListResponse>('/campaigns', { params });
      return res.data;
    },
  });
}

export function useCampaignDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['campaign', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<CampaignDetail>(`/campaigns/${id}`);
      return res.data;
    },
    refetchInterval: (q) => (q.state.data?.status === 'sending' ? 1000 : false),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCampaignDto) => {
      const res = await api.post<CampaignWrap>('/campaigns', data);
      return res.data.campaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useUpdateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateCampaignDto) => {
      const res = await api.patch<CampaignWrap>(`/campaigns/${id}`, data);
      return res.data.campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useScheduleCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ScheduleCampaignDto) => {
      const res = await api.post<CampaignWrap>(`/campaigns/${id}/schedule`, data);
      return res.data.campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useSendCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<CampaignWrap>(`/campaigns/${id}/send`);
      return res.data.campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/campaigns/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}
