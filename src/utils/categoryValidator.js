import { categories, getCategoryBySlug, getSubCategoryBySlugs } from '../config/categories.js';

/**
 * Check if category slug is valid
 * @param {string} categorySlug
 * @returns {boolean}
 */
export const isValidCategory = (categorySlug) => {
  if (!categorySlug || typeof categorySlug !== 'string') {
    return false;
  }
  return getCategoryBySlug(categorySlug) !== null;
};

/**
 * Check if subcategory slug is valid for given category
 * @param {string} categorySlug
 * @param {string} subCategorySlug
 * @returns {boolean}
 */
export const isValidSubCategory = (categorySlug, subCategorySlug) => {
  if (!categorySlug || !subCategorySlug) {
    return false;
  }
  if (typeof categorySlug !== 'string' || typeof subCategorySlug !== 'string') {
    return false;
  }
  return getSubCategoryBySlugs(categorySlug, subCategorySlug) !== null;
};

/**
 * Get complete category tree
 * @returns {array} Array of categories with subcategories
 */
export const getCategoryTree = () => {
  return categories;
};

