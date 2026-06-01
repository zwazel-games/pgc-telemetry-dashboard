import { useQuery } from "@tanstack/react-query";
import type {
  MatchesRequest, MatchesResponse,
  MatchDetail,
  PlayerHistory,
  PowerupPickrate,
  PowerupDetail,
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

export const usePlayer = (id: string) =>
  useQuery({
    queryKey: ["player", id],
    queryFn: () => apiEnvelope<PlayerHistory>("/player", { id }),
    staleTime: STALE_MS,
    enabled: id.length > 0,
  });

export const usePowerupPickrate = (range: { since?: string; until?: string }) =>
  useQuery({
    queryKey: ["powerup-pickrate", range],
    queryFn: () => apiEnvelope<PowerupPickrate>("/powerup-pickrate", { ...range }),
    staleTime: STALE_MS,
  });

export const usePowerupDetail = (id: string, range: { since?: string; until?: string }) =>
  useQuery({
    queryKey: ["powerup", id, range],
    queryFn: () => apiEnvelope<PowerupDetail>("/powerup", { id, ...range }),
    staleTime: STALE_MS,
    enabled: id.length > 0,
  });
