/**
 * Dynamic Sitemap Generator for ShopShout
 * 
 * Generates XML sitemap with:
 * - Static pages (landing, deals, shops, etc.)
 * - All published products with SEO-friendly URLs
 * 
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
 * Matches the logic in js/seo-utils.js
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
 * Format: /product/{slug}--id--{hash_id}
 */
function createProductUrl(hashId, title) {
  const slug = createSlugFromTitle(title);
  return `${BASE_URL}/product/${slug}--id--${hashId}`;
}

/**
 * Format date to ISO 8601 (YYYY-MM-DD)
 */
function formatDate(date) {
  if (!date) return new Date().toISOString().split('T')[0];
  
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
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
 * Main handler function
 */
export default async function handler(req, res) {
  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });

    // Fetch all published products
    const { data: products, error } = await supabase
      .from('cleaned_products')
      .select('hash_id, title, updated_at')
      .eq('status', 'published')
      .not('store_id', 'is', null)
      .not('image', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Sitemap] Database error:', error);
      // Return empty sitemap on error
      return res.status(500).send('Error generating sitemap');
    }

    const productList = products || [];
    const today = formatDate(new Date());

    // Build XML sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'weekly' },
      { loc: '/landing.html', priority: '1.0', changefreq: 'weekly' },
      { loc: '/index.html', priority: '0.9', changefreq: 'daily' },
      { loc: '/shops.html', priority: '0.9', changefreq: 'weekly' },
      { loc: '/store.html', priority: '0.8', changefreq: 'weekly' },
      { loc: '/contact.html', priority: '0.6', changefreq: 'monthly' },
      { loc: '/privacy.html', priority: '0.4', changefreq: 'monthly' },
      { loc: '/impressum.html', priority: '0.4', changefreq: 'monthly' }
    ];

    staticPages.forEach(page => {
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(BASE_URL + page.loc)}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    // Product pages
    productList.forEach(product => {
      if (!product.hash_id || !product.title) return;

      const productUrl = createProductUrl(product.hash_id, product.title);
      const lastmod = formatDate(product.updated_at);

      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(productUrl)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    // Set proper headers
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // Cache for 1 hour
    
    return res.status(200).send(xml);

  } catch (error) {
    console.error('[Sitemap] Error:', error);
    return res.status(500).send('Internal server error');
  }
}

