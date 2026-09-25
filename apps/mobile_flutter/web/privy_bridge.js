// Bridge between the Flutter web build and @privy-io/js-sdk-core.
//
// Loaded as an ES module by web/index.html. Exposes a single global,
// `window.proximPrivy`, with a stable mini-API consumed by
// lib/src/features/auth/data/privy_auth_service_web.dart via JS interop.
// Keeping this seam in JavaScript means the Dart side never depends on
// Privy's exact module shape.
import * as PrivyModule from 'https://cdn.jsdelivr.net/npm/@privy-io/js-sdk-core@0.71.1/+esm';

const Privy = PrivyModule.default ?? PrivyModule.Privy;
const LocalStorage = PrivyModule.LocalStorage;

let privy = null;

window.proximPrivy = {
  async init(appId, clientId) {
    if (!appId) throw new Error('Privy app ID is not configured.');
    const config = { appId };
    if (clientId) config.clientId = clientId;
    if (LocalStorage) config.storage = new LocalStorage();
    privy = new Privy(config);
    await privy.initialize();
  },

  async restore() {
    const { user } = await privy.user.get();
    if (!user) return null;
    return { userId: user.id, accessToken: await privy.getAccessToken() };
  },

  async sendCode(email) {
    await privy.auth.email.sendCode(email);
  },

  // The login screen is only reachable when the stored Privy session was not
  // usable (restore found none or the backend rejected it). If a stale
  // session for a *different* user lingers in storage, Privy treats an OTP /
  // OAuth login as an account-link attempt and rejects it with "already
  // linked to another account". Clearing the session first makes every login
  // a fresh login into whichever account owns the credential.
  async _logoutIfSession() {
    try {
      const { user } = await privy.user.get();
      if (user) await privy.auth.logout({ userId: user.id });
    } catch (_) {}
  },

  async loginWithCode(email, code) {
    await window.proximPrivy._logoutIfSession();
    const session = await privy.auth.email.loginWithCode(email, code);
    const user = session.user ?? session;
    return { userId: user.id, accessToken: await privy.getAccessToken() };
  },

  async loginWithGoogle() {
    await window.proximPrivy._logoutIfSession();
    const oauth = privy.auth.oauth;
    if (!oauth || typeof oauth.loginWithPopup !== 'function') {
      throw new Error('Google sign-in is not available in this browser.');
    }
    const result = await oauth.loginWithPopup({ provider: 'google' });
    const user = result.user ?? result;
    return { userId: user.id, accessToken: await privy.getAccessToken() };
  },

  async logout() {
    const { user } = await privy.user.get();
    if (user) await privy.auth.logout({ userId: user.id });
  },
};
