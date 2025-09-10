(async function(){
  if (!window.supabaseClient) return;
  
  // Store the current store data globally for language switching
  let currentStoreData = null;

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

  // Create product card (same design as related products in product.html)
  function createProductCard(product, storeName = '') {
    const card = document.createElement('article');
    card.className = 'product-card';
    
    const media = document.createElement('div');
    media.className = 'product-media';
    if (product.image) {
      media.style.background = `center/cover no-repeat url(${CSS.escape ? CSS.escape(product.image) : product.image})`;
    }
    
    const body = document.createElement('div');
    body.className = 'product-body';
    
    const brand = document.createElement('span');
    brand.className = 'brand-tag';
    brand.textContent = storeName || product.store_name || product.brand || '';
    
    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = product.title || 'Product';
    
    const prices = document.createElement('div');
    prices.className = 'deal-prices';
    
    // Check if there's a discount
    const hasDiscount = product.sale_price && product.price && Number(product.price) > Number(product.sale_price);
    if (hasDiscount) {
      prices.classList.add('has-discount');
      // Add discount badge to product card (top right corner)
      const discountPercent = Math.round(((Number(product.price) - Number(product.sale_price)) / Number(product.price)) * 100);
      const discountBadge = document.createElement('span');
      discountBadge.className = 'discount-badge';
      discountBadge.textContent = `-${discountPercent}%`;
      card.appendChild(discountBadge); // Attach to card instead of prices
    }
    
    const now = document.createElement('span');
    now.className = 'price-now';
    now.textContent = product.sale_price ? formatCurrency(product.sale_price, product.currency || 'EUR') : formatCurrency(product.price, product.currency || 'EUR');
    prices.appendChild(now);
    
    if (hasDiscount) {
      const old = document.createElement('span');
      old.className = 'price-old';
      old.textContent = formatCurrency(product.price, product.currency || 'EUR');
      prices.appendChild(old);
    }
    
    const cta = document.createElement('a');
    cta.className = 'btn btn-primary';
    cta.href = `product.html?id=${encodeURIComponent(product.hash_id)}`;
    cta.setAttribute('data-i18n', 'card.cta');
    cta.textContent = 'View deal'; // fallback
    
    body.append(brand, title, prices, cta);
    card.append(media, body);
    
    // Apply current language to the button
    if (window.applyLanguageToElement) {
      window.applyLanguageToElement(cta);
    }
    
    return card;
  }

  // Update store description based on current language
  function updateStoreDescription(store) {
    const descriptionEl = document.getElementById('aboutStoreDescription');
    if (!descriptionEl || !store) return;
    
    const currentLang = localStorage.getItem('selectedLanguage') || 'de';
    let storeDescription = null;
    
    if (currentLang === 'de') {
      // German: try description_german first, then fallbacks
      storeDescription = store.description_german || store.seo_text || store.description || null;
    } else {
      // English: try description_english first, then fallbacks  
      storeDescription = store.description_english || store.seo_text || store.description || null;
    }
    
    if (storeDescription && storeDescription.trim()) {
      descriptionEl.textContent = storeDescription.trim();
    } else {
      // Show appropriate "no description" message based on language
      const noDescMsg = currentLang === 'de' 
        ? '<em>Keine Beschreibung für diesen Shop verfügbar.</em>'
        : '<em>No description available for this store.</em>';
      descriptionEl.innerHTML = noDescMsg;
    }
  }

  // Render store details
  function renderStoreDetails(store, stats) {
    // Store the data globally for language switching
    currentStoreData = store;
    
    const displayName = store.cleaned_name;
    
    // Hero Section
    document.getElementById('storeMainTitle').textContent = displayName;
    
    // Store badge
    const badge = document.getElementById('storeBadge');
    // Get current language for badge text
    const currentLang = localStorage.getItem('selectedLanguage') || 'de';
    if (store.is_published_to_deals) {
      badge.textContent = currentLang === 'de' ? 'Ausgewählter Shop' : 'Featured Store';
      badge.style.background = '#10b981';
    } else {
      badge.textContent = currentLang === 'de' ? 'Shop-Highlight' : 'Store Highlight';
    }
    
    // Main store image/logo
    const imageContainer = document.getElementById('storeMainImage');
    if (store.logo_url) {
      imageContainer.innerHTML = `<img src="${store.logo_url}" alt="${displayName}" />`;
    } else {
      imageContainer.innerHTML = `<div class="store-logo-fallback">${displayName.charAt(0).toUpperCase()}</div>`;
    }
    
    // Meta information
    
    const statusEl = document.getElementById('storeStatus');
    statusEl.textContent = store.status || 'Unknown';
    statusEl.className = `meta-value status-${store.status}`;
    
    // Action buttons
    document.getElementById('visitStoreMainBtn').href = store.url;
    document.getElementById('viewAllStoreDealsBtn').href = `index.html?store=${store.id}`;
    
    // Statistics Card
    document.getElementById('totalActiveDeals').textContent = stats.totalProducts || '0';
    const naText = currentLang === 'de' ? 'Keine Angabe' : 'N/A';
    document.getElementById('averageDiscount').textContent = stats.avgDiscount > 0 ? `${stats.avgDiscount}%` : naText;
    
    if (stats.lastDealAdded) {
      const lastDealDate = new Date(stats.lastDealAdded);
      const daysAgo = Math.floor((new Date() - lastDealDate) / (1000 * 60 * 60 * 24));
      const todayText = currentLang === 'de' ? 'Heute' : 'Today';
      const daysAgoText = currentLang === 'de' ? `vor ${daysAgo} Tagen` : `${daysAgo} days ago`;
      document.getElementById('lastDealDate').textContent = daysAgo === 0 ? todayText : daysAgoText;
    } else {
      document.getElementById('lastDealDate').textContent = naText;
    }
    
    // Shipping Card
    const notSpecifiedText = currentLang === 'de' ? 'Nicht angegeben' : 'Not specified';
    document.getElementById('shippingCountryMain').textContent = store.ai_shipping_country || notSpecifiedText;
    document.getElementById('shippingPriceMain').textContent = store.ai_shipping_price || notSpecifiedText;
    document.getElementById('shippingServiceMain').textContent = store.ai_shipping_service || notSpecifiedText;
    
    const daysText = currentLang === 'de' ? 'Tage' : 'days';
    if (store.ai_shipping_min_handling_time && store.ai_shipping_max_handling_time) {
      document.getElementById('handlingTimeMain').textContent = `${store.ai_shipping_min_handling_time}-${store.ai_shipping_max_handling_time} ${daysText}`;
    } else {
      document.getElementById('handlingTimeMain').textContent = notSpecifiedText;
    }
    
    if (store.ai_shipping_min_transit_time && store.ai_shipping_max_transit_time) {
      document.getElementById('transitTimeMain').textContent = `${store.ai_shipping_min_transit_time}-${store.ai_shipping_max_transit_time} ${daysText}`;
    } else {
      document.getElementById('transitTimeMain').textContent = notSpecifiedText;
    }
    
    // About Store Section
    document.getElementById('aboutStoreTitle').textContent = displayName;
    
    // Update store description (will be called again on language change)
    updateStoreDescription(store);
    
    // Store Features
    const featuresList = document.getElementById('storeFeaturesList');
    const features = [];
    
    // Use the same currentLang variable from above
    
    if (store.ai_shipping_country) {
      const shipsToText = currentLang === 'de' ? 'Versand nach' : 'Ships to';
      features.push(`${shipsToText} ${store.ai_shipping_country}`);
    }
    if (store.platform) {
      const poweredText = currentLang === 'de' ? 'betriebener Shop' : 'powered store';
      const platformName = store.platform.charAt(0).toUpperCase() + store.platform.slice(1);
      features.push(`${platformName} ${poweredText}`);
    }
    if (store.ai_shipping_service) {
      const shippingText = currentLang === 'de' ? 'Versand' : 'shipping';
      features.push(`${store.ai_shipping_service} ${shippingText}`);
    }
    if (store.status === 'active') {
      const activeText = currentLang === 'de' ? 'Aktiver und verifizierter Shop' : 'Active and verified store';
      features.push(activeText);
    }
    
    if (features.length === 0) {
      const noFeaturesText = currentLang === 'de' ? 'Keine zusätzlichen Features verfügbar' : 'No additional features available';
      features.push(noFeaturesText);
    }
    
    featuresList.innerHTML = features.map(feature => `<li>${feature}</li>`).join('');
    
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
      fragment.appendChild(createProductCard(deal, storeName));
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

  // Initialize toggle functionality for store details
  function initToggleFunctionality() {
    const toggleHeaders = document.querySelectorAll('.toggle-header');
    
    function toggleSection(header) {
      const toggleId = header.getAttribute('data-toggle');
      const content = document.getElementById(toggleId + 'Content');
      
      if (content) {
        // Toggle collapsed state
        const isCollapsed = header.classList.contains('collapsed');
        
        if (isCollapsed) {
          // Expand
          header.classList.remove('collapsed');
          content.classList.remove('collapsed');
          header.setAttribute('aria-expanded', 'true');
        } else {
          // Collapse
          header.classList.add('collapsed');
          content.classList.add('collapsed');
          header.setAttribute('aria-expanded', 'false');
        }
      }
    }
    
    toggleHeaders.forEach(header => {
      // Click event
      header.addEventListener('click', function() {
        toggleSection(this);
      });
      
      // Keyboard navigation (Enter and Space)
      header.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleSection(this);
        }
      });
    });
    
    // Initialize with all sections collapsed by default
    setTimeout(() => {
      toggleHeaders.forEach(header => {
        const toggleId = header.getAttribute('data-toggle');
        const content = document.getElementById(toggleId + 'Content');
        
        if (content) {
          header.classList.add('collapsed');
          content.classList.add('collapsed');
          header.setAttribute('aria-expanded', 'false');
        }
      });
    }, 100);
  }

  // Listen for language changes to update store description
  function setupLanguageChangeListener() {
    // Listen for language changes (custom event or manual checking)
    document.addEventListener('languageChanged', function() {
      if (currentStoreData) {
        updateStoreDescription(currentStoreData);
      }
    });
    
    // Also listen for storage changes (when language is changed from other tabs/pages)
    window.addEventListener('storage', function(e) {
      if (e.key === 'selectedLanguage' && currentStoreData) {
        updateStoreDescription(currentStoreData);
      }
    });
    
    // Listen for clicks on language buttons (backup method)
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-lang]') && currentStoreData) {
        // Small delay to ensure language has been updated
        setTimeout(() => {
          updateStoreDescription(currentStoreData);
        }, 100);
      }
    });
  }

  // Auto-run on store page
  if (document.querySelector('.store-content')) {
    await initStorePage();
    initToggleFunctionality();
    setupLanguageChangeListener();
  }
})();

