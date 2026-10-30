function parseFeatureFlag(value) {
  return value === 'true';
}

const MONETIZATION_ENABLED = parseFeatureFlag(process.env.MONETIZATION_ENABLED);

module.exports = {
  MONETIZATION_ENABLED,
  parseFeatureFlag,
};
