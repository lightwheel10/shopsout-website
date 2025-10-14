/**
 * SEO-Friendly URL Utilities
 * 
 * Generates and parses SEO-friendly product URLs in the format:
 * /product/wireless-bluetooth-headphones-550e8400
 * 
 * Maintains backward compatibility with old format:
 * /product.html?id=550e8400-e29b-41d4-a716-446655440000
 */

(function() {
  'use strict';

  /**
   * Generates SEO-friendly product URL
   * @param {string} productId - Full UUID or hash_id
   * @param {string} productTitle - Product title
   * @returns {string} SEO-friendly URL or fallback to old format
   */
  function createSeoFriendlyProductUrl(productId, productTitle) {
    try {
      // CRITICAL: Only use SEO URLs in production (Vercel)
      // For localhost/development, use old format
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname === '[::1]' ||
                         window.location.port !== '';
      
      if (isLocalhost) {
        // Local development - use old URL format
        return `product.html?id=${encodeURIComponent(productId)}`;
      }
      
      // Validate inputs
      if (!productId || typeof productId !== 'string') {
        console.warn('[SEO] Invalid product ID, using fallback');
        return `product.html?id=${productId || 'unknown'}`;
      }

      // If no title provided, use old format
      if (!productTitle || typeof productTitle !== 'string' || productTitle.trim() === '') {
        return `product.html?id=${encodeURIComponent(productId)}`;
      }

      // Generate URL-safe slug from product title
      const slug = productTitle
        .toLowerCase()
        .trim()
        // Replace special characters and spaces with hyphens
        .replace(/[^a-z0-9]+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
        // Limit length to 50 characters for readability
        .substring(0, 50)
        // Remove trailing hyphen if substring cut in the middle
        .replace(/-+$/, '');

      // Extract first 8 characters of ID for uniqueness
      // Works with both full UUIDs and hash_ids
      const shortId = productId.substring(0, 8);

      // Combine slug with short ID
      // Format: /product/{slug}-{shortId}
      const seoUrl = `product/${slug}-${shortId}`;

      return seoUrl;

    } catch (error) {
      // If anything fails, fall back to old format
      console.warn('[SEO] Error generating SEO URL, using fallback:', error);
      return `product.html?id=${encodeURIComponent(productId)}`;
    }
  }

  /**
   * Parses product ID from SEO-friendly URL slug
   * @param {string} slug - URL slug (e.g., "wireless-headphones-550e8400")
   * @returns {string|null} Short product ID or null if parsing fails
   */
  function parseProductIdFromSlug(slug) {
    try {
      if (!slug || typeof slug !== 'string') {
        return null;
      }

      // Find the last hyphen-separated segment (should be the short ID)
      const parts = slug.split('-');
      
      if (parts.length === 0) {
        return null;
      }

      // Get last part (should be short UUID/hash)
      const shortId = parts[parts.length - 1];

      // Validate it looks like a hex string (8 characters)
      if (shortId && /^[a-f0-9]{8}$/i.test(shortId)) {
        return shortId;
      }

      return null;

    } catch (error) {
      console.warn('[SEO] Error parsing slug:', error);
      return null;
    }
  }

  /**
   * Extracts product slug from URL path
   * Supports both old and new URL formats
   * @returns {string|null} Product slug or null
   */
  function getProductSlugFromUrl() {
    try {
      const path = window.location.pathname;
      
      // Check if path matches /product/{slug} format
      const match = path.match(/\/product\/([a-z0-9-]+)/i);
      
      if (match && match[1]) {
        return match[1];
      }

      return null;

    } catch (error) {
      console.warn('[SEO] Error extracting slug from URL:', error);
      return null;
    }
  }

  // Expose functions globally
  window.seoUtils = {
    createSeoFriendlyProductUrl: createSeoFriendlyProductUrl,
    parseProductIdFromSlug: parseProductIdFromSlug,
    getProductSlugFromUrl: getProductSlugFromUrl
  };

})();

