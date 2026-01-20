import Ad from '../models/Ad.js';
import mongoose from 'mongoose';
import { AppError } from '../middlewares/error.middleware.js';

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML
 */
const escapeHtml = (str) => {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Get share page for an ad with OpenGraph meta tags
 * GET /share/ads/:id
 */
export const getAdSharePage = async (req, res, next) => {
  try {
    // Log in development only
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SHARE] GET /share/ads/${req.params.id}`);
    }

    // Validate ObjectId format
    const adId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(404).send(getNotFoundHtml());
    }

    // Find ad - only active, non-deleted ads
    const ad = await Ad.findOne({
      _id: adId,
      status: 'active',
      isDeleted: false,
    }).lean();

    if (!ad) {
      return res.status(404).send(getNotFoundHtml());
    }

    // Get frontend URL and normalize (remove trailing slash)
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000')
      .trim()
      .replace(/\/+$/, '');

    // Get backend public URL for share link
    const backendUrl = req.protocol + '://' + req.get('host');
    const shareUrl = `${backendUrl}/share/ads/${adId}`;
    const redirectUrl = `${frontendUrl}/#/ads/${adId}`;

    // Prepare meta data
    const title = escapeHtml(ad.title);
    const price = ad.price || 0;
    const currency = ad.currency || 'EUR';
    const description = ad.description || '';
    const descriptionPreview = description.length > 120 
      ? description.substring(0, 120) + '...' 
      : description;
    const metaDescription = escapeHtml(`${price} ${currency} • ${descriptionPreview}`);

    // Pick image: first image or fallback
    let imageUrl = `${frontendUrl}/og-fallback.png`; // Default fallback
    if (ad.images && Array.isArray(ad.images) && ad.images.length > 0 && ad.images[0]) {
      imageUrl = ad.images[0];
    }

    // Build HTML with OpenGraph and Twitter meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- OpenGraph Meta Tags -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${metaDescription}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:site_name" content="Ads Platform" />
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${metaDescription}" />
  <meta name="twitter:image" content="${imageUrl}" />
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${shareUrl}" />
  
  <!-- Redirect humans to frontend after 200ms -->
  <script>
    setTimeout(function() {
      window.location.href = "${redirectUrl}";
    }, 200);
  </script>
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 600px;
    }
    .link {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
    }
    .link:hover {
      background: #0056b3;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${metaDescription}</p>
    <a href="${redirectUrl}" class="link">View Ad →</a>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate 404 HTML page for non-existing ads
 * @returns {string} HTML string
 */
const getNotFoundHtml = () => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ad not found</title>
  
  <!-- OpenGraph Meta Tags -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Ad not found" />
  <meta property="og:description" content="The requested ad could not be found." />
  <meta property="og:url" content="${frontendUrl}" />
  
  <!-- Redirect to frontend -->
  <script>
    setTimeout(function() {
      window.location.href = "${frontendUrl}";
    }, 200);
  </script>
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .link {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Ad not found</h1>
    <p>The requested ad could not be found.</p>
    <a href="${frontendUrl}" class="link">Go to Home →</a>
  </div>
</body>
</html>`;
};

