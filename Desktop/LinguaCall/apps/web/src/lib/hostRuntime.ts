export type HostPlatform = "web" | "apps-in-toss" | "unknown";

export interface AppsInTossBridge {
  appLogin?: (...args: unknown[]) => Promise<unknown> | unknown;
  makePayment?: (...args: unknown[]) => Promise<unknown> | unknown;
}

export interface HostRuntimeProbe {
  navigator?: {
    userAgent?: string;
  };
  __LINGUACALL_HOST__?: string;
  AppsInToss?: AppsInTossBridge;
}

export interface HostRuntime {
  platform: HostPlatform;
  hasBridge: boolean;
  bridge: AppsInTossBridge | null;
}

const TOSS_HOST_HINT = /(tossandroidwebview|tossioswebview|apps[ -]?in[ -]?toss|tosspayments|tossapp)/i;

const normalizeHostOverride = (value: string | undefined): HostPlatform | null => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "apps-in-toss") {
    return "apps-in-toss";
  }
  if (normalized === "web") {
    return "web";
  }
  return "unknown";
};

const readUserAgent = (probe: HostRuntimeProbe): string => {
  return probe.navigator?.userAgent?.trim() ?? "";
};

export const detectHostRuntime = (probe: HostRuntimeProbe): HostRuntime => {
  const bridge = probe.AppsInToss ?? null;
  if (bridge) {
    return {
      platform: "apps-in-toss",
      hasBridge: true,
      bridge
    };
  }

  const override = normalizeHostOverride(probe.__LINGUACALL_HOST__);
  if (override) {
    return {
      platform: override,
      hasBridge: false,
      bridge: null
    };
  }

  if (TOSS_HOST_HINT.test(readUserAgent(probe))) {
    return {
      platform: "unknown",
      hasBridge: false,
      bridge: null
    };
  }

  return {
    platform: "web",
    hasBridge: false,
    bridge: null
  };
};

export const getHostRuntime = (): HostRuntime => {
  if (typeof window === "undefined") {
    return {
      platform: "web",
      hasBridge: false,
      bridge: null
    };
  }

  return detectHostRuntime(window as HostRuntimeProbe);
};
