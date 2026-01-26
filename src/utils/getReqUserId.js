/**
 * Safely extract user ID from request object
 * Works in both development and production environments
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} User ID as string, or null if not found
 */
export function getReqUserId(req) {
  const id = req?.user?._id || req?.user?.id;
  return id ? String(id) : null;
}
