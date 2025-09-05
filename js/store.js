(async function(){
  if (!window.supabaseClient) return;

  // Get store ID from URL parameter
  function getStoreIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  }

  // Fetch store details from cleaned_stores table
  async function fetchStoreDetails(storeId) {
    const { data, error } = await window.supabaseClient
      .from('cleaned_stores')
      .select('*')
      .eq('id', storeId)
      .single();
    
    if (error) {
      // console.error('[Supabase] fetch store error', error);
      return null;
    }
    return data;
  }

  // Fetch store statistics (products count, avg discount, etc.)
  async function fetchStoreStats(storeId) {
    try {
      // Get total products count
      const { count: totalProducts } = await window.supabaseClient
        .from('cleaned_products')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('status', 'published');

      // Get products with prices for discount calculation
      const { data: products } = await window.supabaseClient
        .from('cleaned_products')
        .select('price, sale_price, updated_at')
        .eq('store_id', storeId)
        .eq('status', 'published')
        .not('price', 'is', null)
        .not('sale_price', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(100);

      // Calculate average discount
      let avgDiscount = 0;
      if (products && products.length > 0) {
        const discounts = products
          .filter(p => p.price > p.sale_price)
          .map(p => ((p.price - p.sale_price) / p.price) * 100);
        
        if (discounts.length > 0) {
          avgDiscount = Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length);
        }
      }

      // Get last deal added date
      const { data: lastDeal } = await window.supabaseClient
        .from('cleaned_products')
        .select('updated_at')
        .eq('store_id', storeId)
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(1);

      return {
        totalProducts: totalProducts || 0,
        avgDiscount,
        lastDealAdded: lastDeal && lastDeal[0] ? lastDeal[0].updated_at : null
      };
    } catch (error) {
      // console.error('[Supabase] fetch store stats error', error);
      return {
        totalProducts: 0,
        avgDiscount: 0,
        lastDealAdded: null
      };
    }
  }

  // Fetch recent deals from this store
  async function fetchStoreDeals(storeId, limit = 6) {
    const { data, error } = await window.supabaseClient
      .from('cleaned_products')
      .select('hash_id, title, price, sale_price, image, brand, link, currency, description')
      .eq('store_id', storeId)
      .eq('status', 'published')
      .not('image', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      // console.error('[Supabase] fetch store deals error', error);
      return [];
    }
    return data || [];
  }

  // Format currency helper
  function formatCurrency(value, currency = '€') {
    if (value == null) return '';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR' }).format(Number(value));
    } catch(_) {
      return `${Number(value).toFixed(2)} ${currency || '€'}`;
    }
  }

  // Create deal card (reused from products.js)
  function createDealCard(product, storeName = '') {
    const card = document.createElement('article');
    card.className = 'deal-card-v2';

    // Left Column
    const leftCol = document.createElement('div');
    leftCol.className = 'deal-v2-left';

    const media = document.createElement('div');
    media.className = 'deal-v2-media';
    if (product.image) {
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.title;
      img.loading = 'lazy';
      media.appendChild(img);
    }
    
    const ctaContainer = document.createElement('div');
    ctaContainer.className = 'deal-v2-cta-container';
    const dealBtn = document.createElement('a');
    dealBtn.href = product.link || '#';
    dealBtn.className = 'btn btn-deal';
    dealBtn.textContent = 'zum Deal';
    dealBtn.target = '_blank';
    dealBtn.rel = 'noopener noreferrer';
    const detailsBtn = document.createElement('a');
    detailsBtn.href = `product.html?id=${encodeURIComponent(product.hash_id)}`;
    detailsBtn.className = 'btn btn-details';
    detailsBtn.textContent = 'Deal-Details';
    ctaContainer.append(dealBtn, detailsBtn);
    leftCol.append(media, ctaContainer);

    // Right Column
    const rightCol = document.createElement('div');
    rightCol.className = 'deal-v2-right';

    const header = document.createElement('div');
    header.className = 'deal-v2-header';
    const title = document.createElement('h3');
    title.className = 'deal-v2-title';
    title.textContent = product.title || 'Product';
    header.appendChild(title);
    
    const shopLink = document.createElement('a');
    shopLink.href = product.link || '#';
    shopLink.className = 'deal-v2-shoplink';
    shopLink.textContent = `Shop: ${storeName || product.brand || 'Unknown'}`;
    
    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'deal-v2-details-grid';

    const discount = document.createElement('div');
    if (product.sale_price && product.price) {
      const percentage = Math.round(((product.price - product.sale_price) / product.price) * 100);
      if (percentage > 0) {
        discount.className = 'discount-badge';
        discount.textContent = `-${percentage}%`;
      }
    }

    const validity = document.createElement('div');
    validity.className = 'deal-v2-validity';

    const prices = document.createElement('div');
    prices.className = 'deal-v2-prices';
    if (product.price && product.sale_price && Number(product.price) > Number(product.sale_price)) {
      prices.innerHTML += `<span class="price-old-v2">Vorher: ${formatCurrency(product.price, product.currency)}</span>`;
    }
    prices.innerHTML += `<span class="price-now-v2">Jetzt nur: ${formatCurrency(product.sale_price || product.price, product.currency)}</span>`;

    const description = document.createElement('p');
    description.className = 'deal-v2-description';
    description.textContent = product.description ? (product.description.length > 100 ? product.description.substring(0, 100) + '…' : product.description) : '';

    detailsGrid.append(discount, validity, prices, description);
    rightCol.append(header, shopLink, detailsGrid);
    
    card.append(leftCol, rightCol);
    return card;
  }

  // Render store details
  function renderStoreDetails(store, stats) {
    const displayName = store.cleaned_name;
    
    // Hero Section
    document.getElementById('storeMainTitle').textContent = displayName;
    
    // Store badge
    const badge = document.getElementById('storeBadge');
    if (store.is_published_to_deals) {
      badge.textContent = 'Featured Store';
      badge.style.background = '#10b981';
    } else {
      badge.textContent = 'Store Highlight';
    }
    
    // Main store image/logo
    const imageContainer = document.getElementById('storeMainImage');
    if (store.logo_url) {
      imageContainer.innerHTML = `<img src="${store.logo_url}" alt="${displayName}" />`;
    } else {
      imageContainer.innerHTML = `<div class="store-logo-fallback">${displayName.charAt(0).toUpperCase()}</div>`;
    }
    
    // Meta information
    document.getElementById('storeLastUpdated').textContent = store.last_scraped 
      ? new Date(store.last_scraped).toLocaleDateString()
      : 'Not available';
    
    const statusEl = document.getElementById('storeStatus');
    statusEl.textContent = store.status || 'Unknown';
    statusEl.className = `meta-value status-${store.status}`;
    
    // Action buttons
    document.getElementById('visitStoreMainBtn').href = store.url;
    document.getElementById('viewAllStoreDealsBtn').href = `index.html?store=${store.id}`;
    
    // Statistics Card
    document.getElementById('totalActiveDeals').textContent = stats.totalProducts || '0';
    document.getElementById('averageDiscount').textContent = stats.avgDiscount > 0 ? `${stats.avgDiscount}%` : 'N/A';
    
    if (stats.lastDealAdded) {
      const lastDealDate = new Date(stats.lastDealAdded);
      const daysAgo = Math.floor((new Date() - lastDealDate) / (1000 * 60 * 60 * 24));
      document.getElementById('lastDealDate').textContent = daysAgo === 0 ? 'Today' : `${daysAgo} days ago`;
    } else {
      document.getElementById('lastDealDate').textContent = 'N/A';
    }
    
    // Shipping Card
    document.getElementById('shippingCountryMain').textContent = store.ai_shipping_country || 'Not specified';
    document.getElementById('shippingPriceMain').textContent = store.ai_shipping_price || 'Not specified';
    document.getElementById('shippingServiceMain').textContent = store.ai_shipping_service || 'Not specified';
    
    if (store.ai_shipping_min_handling_time && store.ai_shipping_max_handling_time) {
      document.getElementById('handlingTimeMain').textContent = `${store.ai_shipping_min_handling_time}-${store.ai_shipping_max_handling_time} days`;
    } else {
      document.getElementById('handlingTimeMain').textContent = 'Not specified';
    }
    
    if (store.ai_shipping_min_transit_time && store.ai_shipping_max_transit_time) {
      document.getElementById('transitTimeMain').textContent = `${store.ai_shipping_min_transit_time}-${store.ai_shipping_max_transit_time} days`;
    } else {
      document.getElementById('transitTimeMain').textContent = 'Not specified';
    }
    
    // About Store Section
    document.getElementById('aboutStoreTitle').textContent = displayName;
    const descriptionEl = document.getElementById('aboutStoreDescription');
    
    // Check multiple description sources in order of preference
    const storeDescription = store.seo_text || store.description || null;
    
    if (storeDescription && storeDescription.trim()) {
      descriptionEl.textContent = storeDescription.trim();
    } else {
      descriptionEl.innerHTML = '<em>No description available for this store.</em>';
    }
    
    // Store Features
    const featuresList = document.getElementById('storeFeaturesList');
    const features = [];
    
    if (store.ai_shipping_country) features.push(`Ships to ${store.ai_shipping_country}`);
    if (store.platform) features.push(`${store.platform.charAt(0).toUpperCase() + store.platform.slice(1)} powered store`);
    if (store.ai_shipping_service) features.push(`${store.ai_shipping_service} shipping`);
    if (store.status === 'active') features.push('Active and verified store');
    
    if (features.length === 0) {
      features.push('No additional features available');
    }
    
    featuresList.innerHTML = features.map(feature => `<li>${feature}</li>`).join('');
    
    // Coupon Section
    if (store.coupon_code) {
      const couponSection = document.getElementById('couponSection');
      couponSection.style.display = 'block';
      document.getElementById('mainCouponCode').textContent = store.coupon_code;
      
      // Copy coupon functionality
      document.getElementById('copyCouponMainBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(store.coupon_code).then(() => {
          const btn = document.getElementById('copyCouponMainBtn');
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        }).catch(() => {
          // console.log('Failed to copy coupon code');
        });
      });
    }
  }

  // Render store deals
  function renderStoreDeals(deals, storeName = '') {
    const dealsGrid = document.getElementById('storeProductsGrid');
    dealsGrid.innerHTML = '';
    
    if (deals.length === 0) {
      dealsGrid.innerHTML = '<div class="no-deals-message">No deals available from this store at the moment.</div>';
      return;
    }
    
    const fragment = document.createDocumentFragment();
    deals.forEach(deal => {
      fragment.appendChild(createDealCard(deal, storeName));
    });
    dealsGrid.appendChild(fragment);
  }

  // Show loading state
  function showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('storeContent').style.display = 'none';
  }

  // Show error state
  function showError() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('storeContent').style.display = 'none';
  }

  // Show content
  function showContent() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('storeContent').style.display = 'block';
  }

  // Initialize store page
  async function initStorePage() {
    const storeId = getStoreIdFromURL();
    
    if (!storeId) {
      showError();
      return;
    }
    
    showLoading();
    
    try {
      // Fetch store details and stats in parallel
      const [store, stats, deals] = await Promise.all([
        fetchStoreDetails(storeId),
        fetchStoreStats(storeId),
        fetchStoreDeals(storeId)
      ]);
      
      if (!store) {
        showError();
        return;
      }
      
      // Update page title
      document.title = `${store.cleaned_name} – Store Details – Selecdoo`;
      
      // Render everything
      renderStoreDetails(store, stats);
      renderStoreDeals(deals, store.cleaned_name);
      
      showContent();
      
    } catch (error) {
      // console.error('[Store] initialization error', error);
      showError();
    }
  }

  // Auto-run on store page
  if (document.querySelector('.store-content')) {
    await initStorePage();
  }
})();

