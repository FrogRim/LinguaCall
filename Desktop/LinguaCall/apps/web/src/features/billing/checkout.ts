import type { AppsInTossPaymentLaunchSession, BillingCheckoutSession, UserSubscription } from '@lingua/shared';
import { canLaunchAppsInTossPayment, HostBridgeError, launchAppsInTossPayment, requestAppsInTossLogin } from '../../lib/hostBridge';
import type { HostRuntime } from '../../lib/hostRuntime';

export type BillingCheckoutResult = "success" | "cancel";

export interface BillingCheckoutPayload {
  planCode: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface TossRedirectParams {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface TossCheckoutRequest {
  method: "CARD";
  amount: {
    currency: "KRW";
    value: number;
  };
  orderId: string;
  orderName: string;
  successUrl: string;
  failUrl: string;
  customerEmail?: string;
  customerName?: string;
  metadata?: {
    planCode: string;
  };
}

export interface BillingReturnState {
  checkoutResult: BillingCheckoutResult | null;
  checkoutPlan: string | null;
  tossRedirect: TossRedirectParams | null;
  shouldConfirm: boolean;
  hasLegacyReturn: boolean;
  channel: 'web' | 'appintoss' | null;
}

export interface WebBillingLaunchResolution {
  shouldStartCheckout: boolean;
  errorMessage: string;
}

export const buildBillingReturnUrl = (
  originUrl: string,
  result: BillingCheckoutResult,
  planCode: string
) => {
  const base = originUrl.split("#")[0];
  return `${base}#/billing?checkout=${encodeURIComponent(result)}&plan=${encodeURIComponent(planCode)}`;
};

export const createCheckoutPayload = (
  originUrl: string,
  planCode: string
): BillingCheckoutPayload => {
  return {
    planCode,
    returnUrl: buildBillingReturnUrl(originUrl, "success", planCode),
    cancelUrl: buildBillingReturnUrl(originUrl, "cancel", planCode)
  };
};

export const readTossRedirectParams = (
  currentUrl: string
): TossRedirectParams | null => {
  const url = new URL(currentUrl);
  const paymentKey = url.searchParams.get("paymentKey");
  const orderId = url.searchParams.get("orderId");
  const amount = url.searchParams.get("amount");

  if (!paymentKey || !orderId || !amount) {
    return null;
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) {
    return null;
  }

  return {
    paymentKey,
    orderId,
    amount: parsedAmount
  };
};

export const readBillingReturnState = (
  currentUrl: string
): BillingReturnState => {
  const url = new URL(currentUrl);
  const hashQuery = url.hash.split("?")[1] ?? "";
  const hashParams = new URLSearchParams(hashQuery);
  const checkout = hashParams.get("checkout");
  const checkoutResult = checkout === "success" || checkout === "cancel" ? checkout : null;
  const checkoutPlan = hashParams.get("plan");
  const tossRedirect = readTossRedirectParams(currentUrl);

  return {
    checkoutResult,
    checkoutPlan,
    tossRedirect,
    shouldConfirm: checkoutResult === "success" && tossRedirect !== null,
    hasLegacyReturn: checkoutResult !== null || tossRedirect !== null,
    channel: tossRedirect !== null ? 'web' : checkoutResult !== null ? 'appintoss' : null
  };
};

export const createTossPaymentRequest = (checkout: {
  planCode: string;
  orderId: string;
  orderName: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  customerEmail?: string;
  customerName?: string;
}): TossCheckoutRequest => {
  return {
    method: "CARD",
    amount: {
      currency: "KRW",
      value: checkout.amount
    },
    orderId: checkout.orderId,
    orderName: checkout.orderName,
    successUrl: checkout.successUrl,
    failUrl: checkout.failUrl,
    ...(checkout.customerEmail ? { customerEmail: checkout.customerEmail } : {}),
    ...(checkout.customerName ? { customerName: checkout.customerName } : {}),
    metadata: {
      planCode: checkout.planCode
    }
  };
};

type AppsInTossLoginResult = {
  authorizationCode?: string;
  authorization_code?: string;
  referrer?: string;
};

type AppsInTossVerifySessionPayload = {
  authorizationCode: string;
  referrer: string;
};

const readAppsInTossLoginBridge = (runtime: HostRuntime) => {
  return typeof runtime.bridge?.appLogin === 'function';
};

const readAppsInTossLoginResult = (
  value: unknown
): AppsInTossVerifySessionPayload => {
  if (!value || typeof value !== 'object') {
    throw new HostBridgeError('login_failed', 'Apps in Toss login verification payload is missing');
  }

  const payload = value as AppsInTossLoginResult;
  const authorizationCode = typeof payload.authorizationCode === 'string'
    ? payload.authorizationCode.trim()
    : typeof payload.authorization_code === 'string'
      ? payload.authorization_code.trim()
      : '';
  const referrer = typeof payload.referrer === 'string' ? payload.referrer.trim() : '';

  if (!authorizationCode || !referrer) {
    throw new HostBridgeError('login_failed', 'Apps in Toss login verification payload is incomplete');
  }

  return { authorizationCode, referrer };
};

export async function startAppsInTossBillingLaunch(
  options: {
    apiPost: <TResponse>(url: string, body: object) => Promise<TResponse>;
    runtime: HostRuntime;
    originUrl: string;
    planCode: string;
  }
): Promise<void> {
  if (!canLaunchAppsInTossPayment(options.runtime)) {
    throw new HostBridgeError("payment_not_supported", "Apps in Toss payment bridge is unavailable");
  }

  const loginResult = await requestAppsInTossLogin(options.runtime);
  const verifyPayload = readAppsInTossLoginResult(loginResult);
  await options.apiPost<{ verified: true }>("/billing/apps-in-toss/verify-session", verifyPayload);

  const payload = createCheckoutPayload(options.originUrl, options.planCode);
  const session = await options.apiPost<AppsInTossPaymentLaunchSession>("/billing/apps-in-toss/payment-launch", payload);
  await launchAppsInTossPayment(session, options.runtime);
}

export function resolveWebBillingLaunch(planActionWebNote: string): WebBillingLaunchResolution {
  return {
    shouldStartCheckout: false,
    errorMessage: planActionWebNote
  };
}

export function resolveBillingLaunch(
  runtime: HostRuntime,
  notices: {
    webNote: string;
    appsInTossUnavailableNote: string;
    hostUnavailableNotice: string;
  }
): WebBillingLaunchResolution {
  if (canLaunchAppsInTossPayment(runtime) && readAppsInTossLoginBridge(runtime)) {
    return {
      shouldStartCheckout: true,
      errorMessage: ""
    };
  }

  if (runtime.platform === 'web') {
    return resolveWebBillingLaunch(notices.webNote);
  }

  if (runtime.platform === 'apps-in-toss') {
    return {
      shouldStartCheckout: false,
      errorMessage: notices.appsInTossUnavailableNote
    };
  }

  return {
    shouldStartCheckout: false,
    errorMessage: notices.hostUnavailableNotice
  };
}

export async function startWebBillingCheckout(options: {
  apiPost: <TResponse>(url: string, body: object) => Promise<TResponse>;
  originUrl: string;
  planCode: string;
}): Promise<BillingCheckoutSession> {
  const payload = createCheckoutPayload(options.originUrl, options.planCode);
  return options.apiPost<BillingCheckoutSession>('/billing/checkout', payload);
}

export async function confirmWebBillingCheckout(options: {
  apiPost: <TResponse>(url: string, body: object) => Promise<TResponse>;
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<UserSubscription> {
  return options.apiPost<UserSubscription>('/billing/toss/confirm', {
    paymentKey: options.paymentKey,
    orderId: options.orderId,
    amount: options.amount
  });
}
