export const safetyRules = {
  asset_id: 'generic-agv-mobile-robot',
  block_unauthorized_brand_assets: true,
  require_license: true,
  blocked_targets: ['restricted_zone', 'unsafe_zone'],
  allow_real_device_execution: false
};
