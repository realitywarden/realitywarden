export const industrialMaterials = {
  deviceMetal: { color: '#8A8D91', roughness: 0.6, metalness: 0.4 },
  darkMetal: { color: '#2B2D31', roughness: 0.8, metalness: 0.6 },
  rubber: { color: '#18191B', roughness: 0.95, metalness: 0 },
  industrialPlastic: { color: '#D1D5DB', roughness: 0.5, metalness: 0.1 },
  glass: { color: '#94A3B8', opacity: 0.28, transparent: true, roughness: 0.15, metalness: 0 },
  status: {
    pass: '#10B981',
    running: '#F59E0B',
    blocked: '#E11D48'
  },
  commandPath: { color: '#0284C7', dashSize: 0.2, gapSize: 0.1 }
} as const;
