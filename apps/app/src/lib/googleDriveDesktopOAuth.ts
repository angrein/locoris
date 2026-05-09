import { invoke, isTauri } from "@tauri-apps/api/core";

import {
  buildSyncConnectionSecretKey,
  readSecureSecret
} from "./secureSecretStore";

const GOOGLE_DRIVE_APP_DATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GOOGLE_DRIVE_ABOUT_URL = "https://www.googleapis.com/drive/v3/about";
const GOOGLE_OAUTH_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DESKTOP_LOOPBACK_PATH = "/oauth/google-drive";
const GOOGLE_DESKTOP_CALLBACK_TIMEOUT_MS = 180_000;

type GoogleDriveAboutResponse = {
  user?: {
    displayName?: string;
    emailAddress?: string;
    permissionId?: string;
  };
};

type GoogleDesktopTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleDesktopLoopbackSession = {
  redirectUri: string;
};

type GoogleDesktopLoopbackCallback = {
  url: string;
};

type GoogleDesktopCallbackPayload = {
  url: string;
  state: string;
  code: string | null;
  error: string | null;
  errorDescription: string | null;
};

type GoogleDriveDesktopAccountSession = {
  accessToken: string;
  expiresAt: number | null;
  refreshToken: string | null;
  userId: string | null;
  userName: string;
  userEmail: string;
};

let desktopOauthInFlight = false;

function now() {
  return Date.now();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isDesktopGoogleDriveRuntime() {
  return typeof window !== "undefined" && isTauri();
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createRandomString(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  let value = "";

  for (let index = 0; index < randomBytes.length; index += 1) {
    value += alphabet[randomBytes[index] % alphabet.length];
  }

  return value;
}

async function createPkceCodeChallenge(codeVerifier: string) {
  const encoded = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

function parseDesktopOAuthCallback(urlValue: string) {
  try {
    const parsedUrl = new URL(urlValue);

    if (parsedUrl.pathname !== GOOGLE_DESKTOP_LOOPBACK_PATH) {
      return null;
    }

    return {
      url: urlValue,
      state: normalizeText(parsedUrl.searchParams.get("state")),
      code: normalizeText(parsedUrl.searchParams.get("code")) || null,
      error: normalizeText(parsedUrl.searchParams.get("error")) || null,
      errorDescription:
        normalizeText(parsedUrl.searchParams.get("error_description")) || null
    } satisfies GoogleDesktopCallbackPayload;
  } catch {
    return null;
  }
}

async function openSystemBrowserForOauth(url: string) {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    throw new Error("GOOGLE_OAUTH_BROWSER_OPEN_FAILED");
  }
}

function buildDesktopAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  prompt?: string;
  loginHint?: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_APP_DATA_SCOPE,
    access_type: "offline",
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    state: input.state
  });

  const prompt = normalizeText(input.prompt) || "consent select_account";

  if (prompt) {
    params.set("prompt", prompt);
  }

  const loginHint = normalizeText(input.loginHint);

  if (loginHint) {
    params.set("login_hint", loginHint);
  }

  return `${GOOGLE_OAUTH_AUTHORIZATION_URL}?${params.toString()}`;
}

async function parseGoogleTokenResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as GoogleDesktopTokenResponse | null;

  if (!response.ok) {
    const message = normalizeText(payload?.error);

    if (
      message === "invalid_grant" ||
      message === "invalid_client" ||
      message === "unauthorized_client"
    ) {
      throw new Error("GOOGLE_DRIVE_AUTH_REQUIRED");
    }

    throw new Error(message || "GOOGLE_OAUTH_FAILED");
  }

  if (!payload?.access_token) {
    throw new Error("GOOGLE_DRIVE_AUTH_REQUIRED");
  }

  return payload;
}

async function exchangeDesktopAuthorizationCode(input: {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    client_id: input.clientId,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri
  });

  let response: Response;

  try {
    response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
  } catch {
    throw new Error("SERVER_UNAVAILABLE");
  }

  return parseGoogleTokenResponse(response);
}

async function refreshDesktopAccessToken(input: {
  clientId: string;
  refreshToken: string;
}) {
  const body = new URLSearchParams({
    client_id: input.clientId,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token"
  });

  let response: Response;

  try {
    response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
  } catch {
    throw new Error("SERVER_UNAVAILABLE");
  }

  return parseGoogleTokenResponse(response);
}

async function loadGoogleDriveAccountProfile(accessToken: string) {
  let response: Response;

  try {
    response = await fetch(
      `${GOOGLE_DRIVE_ABOUT_URL}?fields=user(displayName,emailAddress,permissionId)`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
  } catch {
    throw new Error("SERVER_UNAVAILABLE");
  }

  if (response.status === 401) {
    throw new Error("GOOGLE_DRIVE_AUTH_REQUIRED");
  }

  const payload = (await response.json().catch(() => null)) as GoogleDriveAboutResponse | null;

  if (!response.ok) {
    throw new Error("GOOGLE_OAUTH_FAILED");
  }

  return payload;
}

async function buildDesktopGoogleDriveSession(payload: GoogleDesktopTokenResponse) {
  const accessToken = normalizeText(payload.access_token);

  if (!accessToken) {
    throw new Error("GOOGLE_DRIVE_AUTH_REQUIRED");
  }

  const about = await loadGoogleDriveAccountProfile(accessToken);

  return {
    accessToken,
    expiresAt:
      typeof payload.expires_in === "number"
        ? now() + Math.max(30, payload.expires_in) * 1000
        : null,
    refreshToken: normalizeText(payload.refresh_token) || null,
    userId: normalizeText(about?.user?.permissionId) || null,
    userName: normalizeText(about?.user?.displayName),
    userEmail: normalizeText(about?.user?.emailAddress)
  } satisfies GoogleDriveDesktopAccountSession;
}

async function prepareDesktopLoopbackSession() {
  return invoke<GoogleDesktopLoopbackSession>("desktop_google_oauth_prepare_loopback");
}

async function waitForDesktopLoopbackCallback() {
  const payload = await invoke<GoogleDesktopLoopbackCallback>(
    "desktop_google_oauth_wait_for_callback",
    {
      timeoutMs: GOOGLE_DESKTOP_CALLBACK_TIMEOUT_MS
    }
  );
  const callback = parseDesktopOAuthCallback(payload.url);

  if (!callback?.state) {
    throw new Error("GOOGLE_OAUTH_CALLBACK_FAILED");
  }

  return callback;
}

export function isDesktopGoogleDriveOauthRuntime() {
  return isDesktopGoogleDriveRuntime();
}

export function desktopGoogleDriveOAuthReady(clientId: string) {
  return isDesktopGoogleDriveRuntime() && Boolean(clientId.trim());
}

export async function prepareGoogleDriveDesktopOAuth() {
  if (!isDesktopGoogleDriveRuntime()) {
    throw new Error("GOOGLE_OAUTH_UNAVAILABLE");
  }
}

export async function connectGoogleDriveDesktopAccount(options: {
  clientId: string;
  loginHint?: string;
  prompt?: string;
}) {
  const clientId = normalizeText(options.clientId);

  if (!clientId) {
    throw new Error("GOOGLE_DRIVE_CLIENT_ID_REQUIRED");
  }

  await prepareGoogleDriveDesktopOAuth();

  if (desktopOauthInFlight) {
    throw new Error("GOOGLE_OAUTH_IN_PROGRESS");
  }

  desktopOauthInFlight = true;

  try {
    const loopbackSession = await prepareDesktopLoopbackSession();
    const state = createRandomString(48);
    const codeVerifier = createRandomString(96);
    const codeChallenge = await createPkceCodeChallenge(codeVerifier);
    const authorizationUrl = buildDesktopAuthorizationUrl({
      clientId,
      redirectUri: loopbackSession.redirectUri,
      state,
      codeChallenge,
      prompt: options.prompt,
      loginHint: options.loginHint
    });

    await openSystemBrowserForOauth(authorizationUrl);

    const callbackPayload = await waitForDesktopLoopbackCallback();

    if (callbackPayload.error === "access_denied") {
      throw new Error("GOOGLE_OAUTH_ACCESS_DENIED");
    }

    if (callbackPayload.error) {
      throw new Error("GOOGLE_OAUTH_FAILED");
    }

    if (!callbackPayload.code || callbackPayload.state !== state) {
      throw new Error("GOOGLE_OAUTH_CALLBACK_FAILED");
    }

    const tokenPayload = await exchangeDesktopAuthorizationCode({
      clientId,
      code: callbackPayload.code,
      codeVerifier,
      redirectUri: loopbackSession.redirectUri
    });

    return await buildDesktopGoogleDriveSession(tokenPayload);
  } finally {
    desktopOauthInFlight = false;
  }
}

export async function refreshGoogleDriveDesktopAccountSession(options: {
  clientId: string;
  connectionId: string;
}) {
  const clientId = normalizeText(options.clientId);

  if (!clientId) {
    throw new Error("GOOGLE_DRIVE_CLIENT_ID_REQUIRED");
  }

  if (!isDesktopGoogleDriveRuntime()) {
    throw new Error("GOOGLE_OAUTH_UNAVAILABLE");
  }

  const refreshToken = normalizeText(
    await readSecureSecret(buildSyncConnectionSecretKey(options.connectionId, "refreshToken"))
  );

  if (!refreshToken) {
    throw new Error("GOOGLE_DRIVE_AUTH_REQUIRED");
  }

  const tokenPayload = await refreshDesktopAccessToken({
    clientId,
    refreshToken
  });

  return buildDesktopGoogleDriveSession({
    ...tokenPayload,
    refresh_token: normalizeText(tokenPayload.refresh_token) || refreshToken
  });
}
