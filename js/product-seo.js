/**
 * Product Page SEO Enhancement
 * 
 * Dynamically updates:
 * - Page title with product name and price
 * - Meta description with product details
 * - Open Graph tags for social sharing
 * - Twitter Card tags
 * - JSON-LD structured data for search engines
 */

(function() {
  'use strict';

  /**
   * Format currency for display
   */
  function formatCurrency(value, currency = 'EUR') {
    if (value == null) return '';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value));
    } catch(_) {
      return `${Number(value).toFixed(2)} ${currency || '€'}`;
    }
  }

  /**
   * Strip HTML tags from text
   */
  function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  /**
   * Truncate text to specified length
   */
  function truncate(text, maxLength = 160) {
    if (!text) return '';
    const cleaned = stripHtml(text).trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength - 3) + '...';
  }

  /**
   * Update or create meta tag
   */
  function setMetaTag(property, content, isProperty = false) {
    if (!content) return;

    const attribute = isProperty ? 'property' : 'name';
    let meta = document.querySelector(`meta[${attribute}="${property}"]`);
    
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, property);
      document.head.appendChild(meta);
    }
    
    meta.setAttribute('content', content);
  }

  /**
   * Update page title
   */
  function updateTitle(title) {
    if (title) {
      document.title = title;
    }
  }

  /**
   * Add JSON-LD structured data
   */
  function addStructuredData(product, productUrl) {
    // Remove existing structured data if any
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Determine which price to show (sale_price if available, otherwise regular price)
    const displayPrice = product.sale_price || product.price;
    const currency = product.currency || 'EUR';

    // Build structured data object
    const structuredData = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.title,
      "image": product.image || '',
      "description": truncate(product.description_english || product.description || product.title, 500),
      "brand": {
        "@type": "Brand",
        "name": product.store_name || product.brand || 'Unknown'
      },
      "offers": {
        "@type": "Offer",
        "url": productUrl,
        "priceCurrency": currency,
        "price": displayPrice ? Number(displayPrice).toFixed(2) : '0.00',
        "availability": product.availability === 'in stock' 
          ? "https://schema.org/InStock" 
          : "https://schema.org/OutOfStock",
        "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
      }
    };

    // Add sale price if available
    if (product.sale_price && product.price && product.sale_price < product.price) {
      structuredData.offers.price = Number(product.sale_price).toFixed(2);
    }

    // Create and append script tag
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData, null, 2);
    document.head.appendChild(script);
  }

  /**
   * Update all SEO meta tags for product
   */
  function updateProductSEO(product) {
    if (!product || !product.title) return;

    const baseUrl = 'https://shopshout.ai';
    
    // Generate product URL (same logic as seo-utils.js)
    let productUrl = baseUrl;
    if (window.seoUtils && product.hash_id) {
      const seoUrl = window.seoUtils.createSeoFriendlyProductUrl(product.hash_id, product.title);
      productUrl = `${baseUrl}/${seoUrl}`;
    }

    // Determine display price (sale_price if available, otherwise regular price)
    const displayPrice = product.sale_price || product.price;
    const priceFormatted = displayPrice ? formatCurrency(displayPrice, product.currency || 'EUR') : '';

    // Build page title
    const pageTitle = priceFormatted 
      ? `${product.title} - ${priceFormatted} | ShopShout`
      : `${product.title} | ShopShout`;

    // Build meta description
    const description = product.description_english || product.description || product.title;
    const metaDescription = priceFormatted
      ? `Get ${product.title} for ${priceFormatted}. ${truncate(description, 120)}`
      : truncate(description, 160);

    // Update page title
    updateTitle(pageTitle);

    // Update standard meta tags
    setMetaTag('description', metaDescription);

    // Open Graph tags (Facebook, LinkedIn, etc.)
    setMetaTag('og:type', 'product', true);
    setMetaTag('og:title', pageTitle, true);
    setMetaTag('og:description', metaDescription, true);
    setMetaTag('og:url', productUrl, true);
    setMetaTag('og:site_name', 'ShopShout', true);
    
    if (product.image) {
      setMetaTag('og:image', product.image, true);
      setMetaTag('og:image:alt', product.title, true);
    }

    // Open Graph product-specific tags
    if (displayPrice) {
      setMetaTag('product:price:amount', Number(displayPrice).toFixed(2), true);
      setMetaTag('product:price:currency', product.currency || 'EUR', true);
    }

    if (product.brand || product.store_name) {
      setMetaTag('product:brand', product.store_name || product.brand, true);
    }

    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', pageTitle);
    setMetaTag('twitter:description', metaDescription);
    
    if (product.image) {
      setMetaTag('twitter:image', product.image);
      setMetaTag('twitter:image:alt', product.title);
    }

    // Add canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = productUrl;

    // Add JSON-LD structured data
    addStructuredData(product, productUrl);

    console.log('[Product SEO] Meta tags updated for:', product.title);
  }

  // Expose function globally
  window.updateProductSEO = updateProductSEO;

})();

