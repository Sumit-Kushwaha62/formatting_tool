export function parseFeatureFlag(value) {
  return value === 'true';
}

export const MONETIZATION_ENABLED = parseFeatureFlag(
  import.meta.env?.VITE_MONETIZATION_ENABLED,
);

export function resolveAppPage(page, monetizationEnabled = MONETIZATION_ENABLED) {
  return !monetizationEnabled && page === 'pricing' ? 'tool' : page;
}

export function resolveDashboardTab(tab, monetizationEnabled = MONETIZATION_ENABLED) {
  return !monetizationEnabled && tab === 'subscription' ? 'overview' : tab;
}
