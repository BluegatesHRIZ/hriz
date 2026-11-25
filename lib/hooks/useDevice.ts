"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { createDeviceKey, loadDeviceKey, signWithDeviceKey } from "@/lib/device/device-key";
import type {
  DeviceChallengeResponse,
  DeviceProof,
  DeviceRegisterCredentials,
  DeviceRegisterRequest,
  DeviceRegisterResponse,
  DeviceStatusResponse,
} from "@/lib/types/devices";

/** How often the waiting screen asks whether the device has been approved. */
const STATUS_POLL_MS = 15_000;

async function fetchChallenge(): Promise<string> {
  const { challenge } = await apiFetch<DeviceChallengeResponse>("/auth/device/challenge", {
    cache: "no-store",
  });
  return challenge;
}

/**
 * Signs a fresh challenge with this browser's device key, for a sign-in request.
 * Undefined when the browser has no key; the server then says whether it needs one.
 */
export async function getDeviceProof(): Promise<DeviceProof | undefined> {
  const key = await loadDeviceKey();
  if (!key) return undefined;
  const challenge = await fetchChallenge();
  return {
    keyId: key.keyId,
    challenge,
    signature: await signWithDeviceKey(key, "login", challenge),
  };
}

/** The key id of this browser's device key, if it has one. */
export async function getDeviceKeyId(): Promise<string | null> {
  return (await loadDeviceKey())?.keyId ?? null;
}

export interface RegisterDeviceInput {
  credentials: DeviceRegisterCredentials;
  name?: string;
}

/** Creates a new key for this browser and asks for it to be approved. */
export function useRegisterDevice() {
  return useMutation<DeviceRegisterResponse & { keyId: string }, Error, RegisterDeviceInput>({
    mutationFn: async ({ credentials, name }) => {
      const key = await createDeviceKey();
      const challenge = await fetchChallenge();
      const body: DeviceRegisterRequest = {
        credentials,
        publicKey: key.publicKey,
        challenge,
        signature: await signWithDeviceKey(key, "register", challenge),
        name: name?.trim() || undefined,
      };
      const result = await apiFetch<DeviceRegisterResponse>("/auth/device/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return { ...result, keyId: key.keyId };
    },
  });
}

export interface DeviceGateState extends DeviceStatusResponse {
  keyId: string | null;
}

/**
 * Read once when the sign-in page opens: whether devices must be approved and
 * where this browser stands, so the page can ask it to register before anyone
 * types a password.
 */
export function useDeviceGate() {
  return useQuery<DeviceGateState, ApiError>({
    queryKey: ["auth", "device-gate"],
    queryFn: async () => {
      const keyId = await getDeviceKeyId();
      const status = await apiFetch<DeviceStatusResponse>(
        `/auth/device/status?keyId=${encodeURIComponent(keyId ?? "")}`,
        { cache: "no-store" },
      );
      return { ...status, keyId };
    },
    retry: 1,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

/** Polls the approval status of this browser's device while `keyId` is set. */
export function useDeviceStatus(keyId: string | null) {
  return useQuery<DeviceStatusResponse, ApiError>({
    queryKey: ["auth", "device-status", keyId],
    queryFn: () =>
      apiFetch<DeviceStatusResponse>(
        `/auth/device/status?keyId=${encodeURIComponent(keyId ?? "")}`,
        { cache: "no-store" },
      ),
    enabled: !!keyId,
    refetchInterval: STATUS_POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    gcTime: 0,
  });
}
