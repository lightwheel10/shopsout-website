/**
 * Google Shopping Product Feed Generator for ShopShout
 * 
 * Generates RSS 2.0 product feed with:
 * - Product titles, descriptions, prices
 * - Sale prices (if available)
 * - Images, brands, links
 * 
 * Compatible with Google Merchant Center
 * Deployed as Vercel Serverless Function
 */

import { createClient } from '@supabase/supabase-js';

// Supabase credentials (same as in js/env.js)
const SUPABASE_URL = 'https://wazkqegmwdtjulvfjhls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhemtxZWdtd2R0anVsdmZqaGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxNTMwMTgsImV4cCI6MjA1MzcyOTAxOH0.Ie6HVgVA-jAPrJmmHviV01-HORSA4LIr0X434lzNaRw';

// Base domain
const BASE_URL = 'https://shopshout.ai';

/**
 * Generate SEO-friendly URL slug from product title
 */
function createSlugFromTitle(title) {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return 'product';
  }

  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
    .replace(/-+$/, '');
}

/**
 * Generate SEO-friendly product URL
 */
function createProductUrl(hashId, title) {
  const slug = createSlugFromTitle(title);
  return `${BASE_URL}/product/${slug}--id--${hashId}`;
}

/**
 * Format price with currency
 */
function formatPrice(price, currency = 'EUR') {
  if (!price || isNaN(price)) return null;
  return `${Number(price).toFixed(2)} ${currency}`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Strip HTML tags from description
 */
function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500); // Limit to 500 chars
}

/**
 * Format date to RFC 822 (required for RSS)
 */
function formatRFC822Date(date) {
  if (!date) return new Date().toUTCString();
  
  try {
    return new Date(date).toUTCString();
  } catch (e) {
    return new Date().toUTCString();
  }
}

/**
 * Main handler function
 */
export default async function handler(req, res) {
  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });

    // Fetch all published products with full details
    const { data: products, error } = await supabase
      .from('cleaned_products')
      .select('hash_id, title, description, description_english, price, sale_price, currency, image, brand, updated_at, availability')
      .eq('status', 'published')
      .not('store_id', 'is', null)
      .not('image', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Product Feed] Database error:', error);
      return res.status(500).send('Error generating product feed');
    }

    const productList = products || [];
    const buildDate = new Date().toUTCString();

    // Build RSS 2.0 XML with Google Shopping namespace
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n';
    xml += '  <channel>\n';
    xml += `    <title>ShopShout - AI Deal Platform</title>\n`;
    xml += `    <link>${BASE_URL}</link>\n`;
    xml += `    <description>Discover the best deals, coupons and offers from verified stores</description>\n`;
    xml += `    <language>en</language>\n`;
    xml += `    <lastBuildDate>${buildDate}</lastBuildDate>\n`;
    xml += '\n';

    // Add each product as an item
    productList.forEach(product => {
      if (!product.hash_id || !product.title) return;

      const productUrl = createProductUrl(product.hash_id, product.title);
      const pubDate = formatRFC822Date(product.updated_at);
      
      // Use English description if available, otherwise German
      const description = stripHtml(product.description_english || product.description || product.title);
      
      // Determine which price to show (sale_price if available, otherwise regular price)
      const displayPrice = product.sale_price || product.price;
      const currency = product.currency || 'EUR';
      
      // Format prices
      const priceFormatted = formatPrice(displayPrice, currency);
      const regularPriceFormatted = product.price ? formatPrice(product.price, currency) : null;
      const salePriceFormatted = product.sale_price ? formatPrice(product.sale_price, currency) : null;

      xml += '    <item>\n';
      xml += `      <title>${escapeXml(product.title)}</title>\n`;
      xml += `      <link>${escapeXml(productUrl)}</link>\n`;
      xml += `      <description>${escapeXml(description)}</description>\n`;
      xml += `      <pubDate>${pubDate}</pubDate>\n`;
      xml += `      <guid isPermaLink="true">${escapeXml(productUrl)}</guid>\n`;
      
      // Google Shopping specific fields
      xml += `      <g:id>${escapeXml(product.hash_id)}</g:id>\n`;
      
      if (priceFormatted) {
        xml += `      <g:price>${escapeXml(priceFormatted)}</g:price>\n`;
      }
      
      // If there's a sale price, include both regular and sale price
      if (salePriceFormatted && regularPriceFormatted && product.sale_price < product.price) {
        xml += `      <g:sale_price>${escapeXml(salePriceFormatted)}</g:sale_price>\n`;
      }
      
      if (product.image) {
        xml += `      <g:image_link>${escapeXml(product.image)}</g:image_link>\n`;
      }
      
      if (product.brand) {
        xml += `      <g:brand>${escapeXml(product.brand)}</g:brand>\n`;
      }
      
      // Availability
      const availability = product.availability || 'in stock';
      xml += `      <g:availability>${escapeXml(availability)}</g:availability>\n`;
      
      // Condition (assuming new)
      xml += `      <g:condition>new</g:condition>\n`;
      
      xml += '    </item>\n';
      xml += '\n';
    });

    xml += '  </channel>\n';
    xml += '</rss>';

    // Set proper headers
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // Cache for 1 hour
    
    return res.status(200).send(xml);

  } catch (error) {
    console.error('[Product Feed] Error:', error);
    return res.status(500).send('Internal server error');
  }
}

