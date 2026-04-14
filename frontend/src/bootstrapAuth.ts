import { appLogin } from '@apps-in-toss/web-framework';
import { api, setSessionToken, type LoginBootstrapResponse } from './api/client';

const LOCAL_DEV_USER_KEY = 'local-dev-user';

let bootstrapPromise: Promise<LoginBootstrapResponse> | null = null;

function isLocalDevelopmentHost() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

async function loginWithLocalDevUser(): Promise<LoginBootstrapResponse> {
  const result = await api.login(LOCAL_DEV_USER_KEY);
  setSessionToken(result.sessionToken);
  return result;
}

async function runBootstrapAuth(): Promise<LoginBootstrapResponse> {
  let authorizationCode: string;
  let referrer: 'DEFAULT' | 'SANDBOX';

  try {
    ({ authorizationCode, referrer } = await appLogin());
  } catch (error) {
    if (!isLocalDevelopmentHost()) {
      throw error;
    }

    return loginWithLocalDevUser();
  }

  const result = await api.loginWithAuthorizationCode(authorizationCode, referrer);
  setSessionToken(result.sessionToken);
  return result;
}

export function bootstrapAuth(): Promise<LoginBootstrapResponse> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrapAuth().catch((error: unknown) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}
