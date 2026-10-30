/**
 * ==============================================================================
 * FORMAT STUDIO — SHARED TARGET VALIDATION & GUARDRAILS
 * ==============================================================================
 * Target Supabase Project: qrntmoeoqqmnkgdsxmrv
 * Target Hostname: qrntmoeoqqmnkgdsxmrv.supabase.co
 * Expected HTTPS URL: https://qrntmoeoqqmnkgdsxmrv.supabase.co
 *
 * Provides import-safe, strict validation to prevent misdirected network
 * calls, lookalike domain attacks, credential leakage, and accidental live
 * execution across all reset, verification, and test scripts.
 * ==============================================================================
 */

export const EXPECTED_PROJECT_REF = 'qrntmoeoqqmnkgdsxmrv';
export const EXPECTED_HOSTNAME = 'qrntmoeoqqmnkgdsxmrv.supabase.co';
export const EXPECTED_AUTH_CONFIRMATION = 'YES_DELETE_ALL_AUTH_USERS_QRNTMOEOQQMNKGDSXMRV';
export const EXPECTED_SYNTHETIC_CONFIRMATION = 'YES_RUN_SYNTHETIC_ACCEPTANCE_TEST';

/**
 * Strictly validates the target Supabase URL before any client creation or network call.
 *
 * Rules:
 * 1. Must be a valid parseable URL.
 * 2. Protocol must be strictly 'https:'.
 * 3. Hostname must be strictly 'qrntmoeoqqmnkgdsxmrv.supabase.co'.
 * 4. Must not contain userinfo (username/password).
 * 5. Must use standard HTTPS port (port must be empty or '443').
 * 6. Must have root path ('/' or empty).
 * 7. Must not contain query parameters.
 * 8. Must not contain hash fragments.
 *
 * @param {string} urlString
 * @returns {{ valid: boolean, error?: string, parsed?: URL }}
 */
export function validateTargetUrl(urlString) {
  if (typeof urlString !== 'string' || !urlString.trim()) {
    return { valid: false, error: 'Target URL is missing or empty' };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { valid: false, error: 'Target URL is not a valid parseable URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: `Invalid protocol '${parsed.protocol}'; HTTPS is strictly required` };
  }

  if (parsed.hostname.toLowerCase() !== EXPECTED_HOSTNAME.toLowerCase()) {
    return { valid: false, error: `Hostname '${parsed.hostname}' does not match expected target '${EXPECTED_HOSTNAME}'` };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Target URL must not contain userinfo or embedded credentials' };
  }

  if (parsed.port && parsed.port !== '443') {
    return { valid: false, error: `Unexpected port '${parsed.port}' on target URL; only standard HTTPS port is allowed` };
  }

  if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '') {
    return { valid: false, error: `Unexpected path '${parsed.pathname}' on target URL; root path is required` };
  }

  if (parsed.search && parsed.search !== '') {
    return { valid: false, error: 'Target URL must not contain query parameters' };
  }

  if (parsed.hash && parsed.hash !== '') {
    return { valid: false, error: 'Target URL must not contain hash fragments' };
  }

  return { valid: true, parsed };
}
