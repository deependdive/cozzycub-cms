// Product Classifications
export const PRODUCT_CLASSIFICATIONS = [
  { id: 'kits', label: 'DIY Kits', description: 'Complete DIY kits and bundles' },
  { id: 'supplies', label: 'Art Supplies', description: 'Individual art supplies and materials' },
  { id: 'gift', label: 'Gift Sets', description: 'Curated gift sets and bundles' },
]

export const getClassificationLabel = (id: string) => {
  return PRODUCT_CLASSIFICATIONS.find((c) => c.id === id)?.label || id
}
