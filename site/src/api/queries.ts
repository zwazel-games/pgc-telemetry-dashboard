import { useQuery } from "@tanstack/react-query";
import type {
  MatchesRequest, MatchesResponse,
  MatchDetail,
  MatchRounds,
  PlayerHistory,
  Pickrate,
  PickDetail,
  MapsResponse, VersionsResponse,
} from "@pgc/shared";
import { apiEnvelope } from "./client.js";

const STALE_MS = 60_000;

export const useMaps = () =>
  useQuery({
    queryKey: ["maps"],
    queryFn: () => apiEnvelope<MapsResponse>("/maps"),
    staleTime: STALE_MS,
  });

export const useVersions = () =>
  useQuery({
    queryKey: ["versions"],
    queryFn: () => apiEnvelope<VersionsResponse>("/versions"),
    staleTime: STALE_MS,
  });

export const useMatches = (filters: MatchesRequest) =>
  useQuery({
    queryKey: ["matches", filters],
    queryFn: () => apiEnvelope<MatchesResponse>("/matches", { ...filters }),
    staleTime: STALE_MS,
  });

export const useMatch = (id: string) =>
  useQuery({
    queryKey: ["match", id],
    queryFn: () => apiEnvelope<MatchDetail>("/match", { id }),
    staleTime: STALE_MS,
    enabled: id.length > 0,
  });

export const useMatchRounds = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["match-rounds", id],
    queryFn: () => apiEnvelope<MatchRounds>("/match-rounds", { id }),
    staleTime: STALE_MS,
    enabled: enabled && id.length > 0,
  });

export const usePlayer = (id: string) =>
  useQuery({
    queryKey: ["player", id],
    queryFn: () => apiEnvelope<PlayerHistory>("/player", { id }),
    staleTime: STALE_MS,
    enabled: id.length > 0,
  });

// Pick-analytics family: `entity` is the URL base ("powerup"/"class"/"weapon").
// One hook pair serves all three; the endpoint paths are /<entity>-pickrate
// and /<entity>.
export const usePickrate = (entity: string, range: { since?: string; until?: string }) =>
  useQuery({
    queryKey: ["pickrate", entity, range],
    queryFn: () => apiEnvelope<Pickrate>(`/${entity}-pickrate`, { ...range }),
    staleTime: STALE_MS,
  });

export const usePickDetail = (entity: string, id: string, range: { since?: string; until?: string }) =>
  useQuery({
    queryKey: ["pick-detail", entity, id, range],
    queryFn: () => apiEnvelope<PickDetail>(`/${entity}`, { id, ...range }),
    staleTime: STALE_MS,
    enabled: id.length > 0,
  });
