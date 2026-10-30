import { MONETIZATION_ENABLED } from '../config/features.js';

export function shouldBlockDocumentFormatting({
  user,
  userPlan,
  docsCount,
  paywallOpen = false,
  monetizationEnabled = MONETIZATION_ENABLED,
}) {
  if (!monetizationEnabled) return false;

  return Boolean(
    user && userPlan === 'free' && (docsCount >= 3 || paywallOpen),
  );
}

export function shouldCheckDocumentQuota({
  userId,
  userPlan,
  monetizationEnabled = MONETIZATION_ENABLED,
}) {
  return Boolean(monetizationEnabled && userId && userPlan === 'free');
}
