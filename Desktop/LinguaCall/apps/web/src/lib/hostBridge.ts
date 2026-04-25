import type { AppsInTossBridge, HostRuntime } from "./hostRuntime";

export type HostBridgeErrorCode =
  | "host_unavailable"
  | "login_not_supported"
  | "login_failed"
  | "payment_not_supported"
  | "payment_launch_failed";

export class HostBridgeError extends Error {
  readonly code: HostBridgeErrorCode;

  constructor(code: HostBridgeErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const readLoginBridge = (bridge: AppsInTossBridge | null) => {
  return typeof bridge?.appLogin === "function" ? bridge.appLogin : null;
};

const readPaymentBridge = (bridge: AppsInTossBridge | null) => {
  return typeof bridge?.makePayment === "function" ? bridge.makePayment : null;
};

export const canLaunchAppsInTossPayment = (runtime: HostRuntime): boolean => {
  return runtime.platform === "apps-in-toss" && readPaymentBridge(runtime.bridge) !== null;
};

export const requestAppsInTossLogin = async <TResult = unknown>(runtime: HostRuntime): Promise<TResult> => {
  if (runtime.platform !== "apps-in-toss") {
    throw new HostBridgeError("host_unavailable", "Apps in Toss host is required");
  }

  const appLogin = readLoginBridge(runtime.bridge);
  if (!appLogin) {
    throw new HostBridgeError("login_not_supported", "Apps in Toss login bridge is unavailable");
  }

  try {
    return await appLogin() as TResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to verify Apps in Toss login";
    throw new HostBridgeError("login_failed", message);
  }
};

export const launchAppsInTossPayment = async <TPayload, TResult = unknown>(
  payload: TPayload,
  runtime: HostRuntime
): Promise<TResult> => {
  if (runtime.platform !== "apps-in-toss") {
    throw new HostBridgeError("host_unavailable", "Apps in Toss host is required");
  }

  const makePayment = readPaymentBridge(runtime.bridge);
  if (!makePayment) {
    throw new HostBridgeError("payment_not_supported", "Apps in Toss payment bridge is unavailable");
  }

  try {
    return await makePayment(payload) as TResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to launch Apps in Toss payment";
    throw new HostBridgeError("payment_launch_failed", message);
  }
};
