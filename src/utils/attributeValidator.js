/**
 * Category-specific allowed attributes
 * Maps category slugs to their allowed attribute keys
 */
const categoryAttributes = {
  auto: ['brand', 'model', 'year', 'fuel'],
  'real-estate': ['rooms', 'area'],
  electronics: ['brand', 'condition'],
};

/**
 * Get allowed attributes for a category
 * @param {string} categorySlug
 * @returns {array} Array of allowed attribute keys
 */
export const getAllowedAttributes = (categorySlug) => {
  if (!categorySlug || typeof categorySlug !== 'string') {
    return [];
  }
  return categoryAttributes[categorySlug] || [];
};

/**
 * Validate attributes object against category rules
 * @param {string} categorySlug
 * @param {object} attributes
 * @returns {object} { valid: boolean, invalidKeys: array }
 */
export const validateAttributes = (categorySlug, attributes) => {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return { valid: true, invalidKeys: [] };
  }

  const allowedKeys = getAllowedAttributes(categorySlug);
  const providedKeys = Object.keys(attributes);
  const invalidKeys = providedKeys.filter((key) => !allowedKeys.includes(key));

  return {
    valid: invalidKeys.length === 0,
    invalidKeys,
  };
};

