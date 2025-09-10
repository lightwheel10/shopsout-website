(async function(){
  if (!window.supabaseClient) return;

  // Global store names cache for filter display
  let storeNames = {};

  // Initialize store name from URL parameter if present
  async function initializeStoreNameFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('store');
    if (storeId && !storeNames[storeId]) {
      await fetchStoreNames([storeId]);
    }
  }

  async function fetchTopProducts(limit = 9) {
    // Fetch active products with images and a sale price first
    const { data, error } = await window.supabaseClient
      .from('cleaned_products')
      .select('hash_id, title, price, sale_price, image, brand, link, currency, store_id')
      .eq('status', 'published')
      .not('image', 'is', null)
      .not('store_id', 'is', null)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) {
      // console.error('[Supabase] fetch error', error);
      return [];
    }
    
    const products = data || [];
    if (products.length === 0) return [];
    
    // Get store names for all products
    const storeIds = [...new Set(products.map(p => p.store_id).filter(Boolean))];
    const storeMap = {};
    
    if (storeIds.length > 0) {
      const { data: stores } = await window.supabaseClient
        .from('cleaned_stores')
        .select('id, cleaned_name')
        .in('id', storeIds);
      
      if (stores) {
        stores.forEach(store => {
          storeMap[store.id] = store.cleaned_name;
        });
      }
    }
    
    // Add store names to products
    return products.map(p => ({
      ...p,
      store_name: storeMap[p.store_id] || p.brand
    }));
  }

  // Fetch and cache store names for filter display
  async function fetchStoreNames(storeIds) {
    if (!storeIds || storeIds.length === 0) return;
    
    // Only fetch stores we don't already have cached
    const uncachedIds = storeIds.filter(id => !storeNames[id]);
    if (uncachedIds.length === 0) return;
    
    const { data: stores } = await window.supabaseClient
      .from('cleaned_stores')
      .select('id, cleaned_name')
      .in('id', uncachedIds);
    
    if (stores) {
      stores.forEach(store => {
        storeNames[store.id] = store.cleaned_name;
      });
    }
  }

  function formatCurrency(value, currency = '€') {
    if (value == null) return '';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR' }).format(Number(value));
    } catch(_) {
      return `${Number(value).toFixed(2)} ${currency || '€'}`;
    }
  }

  function createProductCard(p) {
    const card = document.createElement('article');
    card.className = 'product-card';
    const media = document.createElement('div');
    media.className = 'product-media';
    
    // Add lazy loading for background images
    if (p.image) {
      // Create a temporary image for lazy loading
      const img = new Image();
      img.onload = () => {
        media.style.background = `center/cover no-repeat url(${CSS.escape ? CSS.escape(p.image) : p.image})`;
        media.style.opacity = '1';
      };
      img.src = p.image;
      media.style.opacity = '0.7'; // Show a loading state
      media.style.transition = 'opacity 0.3s ease';
    }
    
    const body = document.createElement('div');
    body.className = 'product-body';
    const brand = document.createElement('span');
    brand.className = 'brand-tag';
    brand.textContent = p.store_name || 'Deal';
    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = p.title || 'Product';
    const prices = document.createElement('div');
    prices.className = 'deal-prices';
    
    // Check if there's a discount
    const hasDiscount = p.sale_price && p.price && Number(p.price) > Number(p.sale_price);
    
    if (hasDiscount) {
      prices.classList.add('has-discount');
      // Add discount badge to product card (top right corner)
      const discountPercent = Math.round(((Number(p.price) - Number(p.sale_price)) / Number(p.price)) * 100);
      const discountBadge = document.createElement('span');
      discountBadge.className = 'discount-badge';
      discountBadge.textContent = `-${discountPercent}%`;
      // Remove inline styles - let CSS handle positioning and sizing
      card.appendChild(discountBadge); // Attach to card instead of prices
    }
    
    const now = document.createElement('span'); now.className = 'price-now';
    now.textContent = p.sale_price ? formatCurrency(p.sale_price, p.currency) : formatCurrency(p.price, p.currency);
    prices.appendChild(now);
    
    if (hasDiscount) {
      const old = document.createElement('span'); old.className = 'price-old';
      old.textContent = formatCurrency(p.price, p.currency); 
      prices.appendChild(old);
    }
    const cta = document.createElement('a'); cta.className = 'btn btn-primary';
    cta.href = p.link || '#'; cta.target = '_blank'; cta.rel = 'noopener noreferrer';
    cta.setAttribute('data-i18n', 'landing.featured.cta');
    cta.textContent = 'Shop now'; // fallback
    // Apply current language translation
    if (window.applyLanguageToElement) {
      window.applyLanguageToElement(cta);
    }
    body.append(brand, title, prices, cta); card.append(media, body);
    return card;
  }

  // Helper function to hide skeleton and show content with animation
  function showContentWithAnimation(skeletonId, contentId, content) {
    const skeleton = document.getElementById(skeletonId);
    const contentEl = document.getElementById(contentId);
    
    if (skeleton && contentEl) {
      // Hide skeleton
      skeleton.style.display = 'none';
      
      // Show content with fade-in animation
      contentEl.style.display = '';
      contentEl.classList.add('content-loaded');
      
      if (content) {
        contentEl.innerHTML = '';
        contentEl.append(content);
      }
    }
  }

  function renderIntoDealsGrid(products) {
    const grid = document.querySelector('.deals-grid');
    const skeleton = document.getElementById('dealsGridSkeleton');
    
    if (!grid || !Array.isArray(products)) return;
    
    // Hide skeleton and show grid with animation
    if (skeleton) {
      skeleton.style.display = 'none';
    }
    grid.style.display = '';
    grid.classList.add('content-loaded');
    
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();

    products.forEach(p => {
      const card = document.createElement('article');
      card.className = 'deal-card-v2';

      // --- Left Column ---
      const leftCol = document.createElement('div');
      leftCol.className = 'deal-v2-left';

      const media = document.createElement('div');
      media.className = 'deal-v2-media';
      if (p.image) {
        const img = document.createElement('img');
        img.className = 'product-image-lazy';
        img.alt = p.title;
        img.loading = 'lazy';
        
        // Enhanced lazy loading with placeholder
        img.onload = () => {
          img.classList.add('loaded');
        };
        
        img.onerror = () => {
          // Show placeholder on error
          media.innerHTML = '<div class="product-image-placeholder">Image not available</div>';
        };
        
        img.src = p.image;
        media.appendChild(img);
      } else {
        // Show placeholder when no image
        media.innerHTML = '<div class="product-image-placeholder">No image</div>';
      }
      
      const ctaContainer = document.createElement('div');
      ctaContainer.className = 'deal-v2-cta-container';
      const dealBtn = document.createElement('a');
      dealBtn.href = p.link || '#';
      dealBtn.className = 'btn btn-deal';
      dealBtn.setAttribute('data-i18n', 'card.cta');
      dealBtn.textContent = 'zum Deal'; // fallback
      dealBtn.target = '_blank';
      dealBtn.rel = 'noopener noreferrer';
      const detailsBtn = document.createElement('a');
      detailsBtn.href = `product.html?id=${encodeURIComponent(p.hash_id)}`;
      detailsBtn.className = 'btn btn-details';
      detailsBtn.setAttribute('data-i18n', 'button.dealDetails');
      detailsBtn.textContent = 'Deal-Details'; // fallback
      if (window.applyLanguageToElement) {
        window.applyLanguageToElement(detailsBtn);
      }
      ctaContainer.append(dealBtn, detailsBtn);
      leftCol.append(media, ctaContainer);

      // Apply current language to the buttons
      if (window.applyLanguageToElement) {
        window.applyLanguageToElement(dealBtn);
        window.applyLanguageToElement(detailsBtn);
      }

      // --- Right Column ---
      const rightCol = document.createElement('div');
      rightCol.className = 'deal-v2-right';

      const header = document.createElement('div');
      header.className = 'deal-v2-header';
      const title = document.createElement('h3');
      title.className = 'deal-v2-title';
      title.textContent = p.title || 'Product';
      header.appendChild(title);
      
      // Note: expiry functionality removed as valid_to column doesn't exist in cleaned_products table
      // Future enhancement: add expiry logic when schema supports it

      const shopLink = document.createElement('a');
      shopLink.href = p.link || '#';
      shopLink.className = 'deal-v2-shoplink';
      shopLink.textContent = `Shop: ${p.store_name || 'Unknown'}`;
      
      const detailsGrid = document.createElement('div');
      detailsGrid.className = 'deal-v2-details-grid';
      detailsGrid.style.position = 'relative'; // Add positioning context

      const discount = document.createElement('div');
      if (p.sale_price && p.price) {
        const percentage = Math.round(((p.price - p.sale_price) / p.price) * 100);
        if (percentage > 0) {
          discount.className = 'discount-badge';
          discount.textContent = `-${percentage}%`;
          // Attach discount badge to card (top right corner) instead of detailsGrid
          card.appendChild(discount);
        }
      }

      const validity = document.createElement('div');
      validity.className = 'deal-v2-validity';
      // Note: validity date display removed as valid_from/valid_to columns don't exist in cleaned_products table
      // Future enhancement: add validity dates when schema supports it

      const prices = document.createElement('div');
      prices.className = 'deal-v2-prices';
      // Get current language for price labels
      const currentLang = localStorage.getItem('selectedLanguage') || 'de';
      const priceLabels = currentLang === 'de' 
        ? { before: 'Vorher:', now: 'Jetzt nur:' }
        : { before: 'Before:', now: 'Now only:' };
      
      if (p.price && p.sale_price && Number(p.price) > Number(p.sale_price)) {
        prices.innerHTML += `<span class="price-old-v2">${priceLabels.before} ${formatCurrency(p.price, p.currency)}</span>`;
      }
      prices.innerHTML += `<span class="price-now-v2">${priceLabels.now} ${formatCurrency(p.sale_price || p.price, p.currency)}</span>`;

      const description = document.createElement('p');
      description.className = 'deal-v2-description';
      description.textContent = p.description ? (p.description.length > 150 ? p.description.substring(0, 150) + '…' : p.description) : '';

      detailsGrid.append(validity, prices, description);

      rightCol.append(header, shopLink, detailsGrid);
      
      // TODO: Add tags/categories if data is available
      // const tagsContainer = document.createElement('div'); ...

      card.append(leftCol, rightCol);
      frag.appendChild(card);
    });
    grid.append(frag);
  }

  // Auto-run on deals page with server-side pagination
  if (document.querySelector('.deals-grid')) {
    const grid = document.querySelector('.deals-grid');
    const pagination = document.getElementById('pagination');
    const paginationList = document.getElementById('paginationList');
    const PAGE_SIZE = 10;
    const resultsMeta = document.getElementById('resultsMeta');
    let totalCount = 0;
          let totalPages = 1;
      let currentPage = 1;
      // Simple filter state management
      let selectedCategories = [];
      
      // DOM elements
      let priceMinEl = document.getElementById('priceMin');
      let priceMaxEl = document.getElementById('priceMax');
      let categoriesListEl = document.getElementById('categoryFilters');

    async function loadCategories() {
      if (!categoriesListEl) return;
      
      // Use the same categories as the landing page for consistency
      const predefinedCategories = [
        'Electronics',
        'Home & Garden', 
        'Beauty',
        'Fashion',
        'Sport',
        'Children',
        'Groceries',
        'Shoes',
        'Smartphone',
        'Tablet', 
        'Notebook',
        'Television set',
        'Gaming',
        'Travel',
        'Hotel',
        'Wellness'
      ];
      
      // Get current language for translations
      const currentLang = localStorage.getItem('selectedLanguage') || 'de';
      
      // Create proper mapping between category names and translation keys
      const categoryTranslationMap = {
        'Electronics': 'cats.electronics',
        'Home & Garden': 'cats.home',
        'Beauty': 'cats.beauty', 
        'Fashion': 'cats.fashion',
        'Sport': 'cats.sport',
        'Children': 'cats.children',
        'Groceries': 'cats.grocery',
        'Shoes': 'cats.shoes',
        'Smartphone': 'cats.smartphone',
        'Tablet': 'cats.tablet',
        'Notebook': 'cats.notebook',
        'Television set': 'cats.tv',
        'Gaming': 'cats.gaming',
        'Travel': 'cats.travel',
        'Hotel': 'cats.hotel',
        'Wellness': 'cats.wellness'
      };
      
      // Render categories as checkboxes with proper translations
      categoriesListEl.innerHTML = predefinedCategories.map(category => {
        const translationKey = categoryTranslationMap[category] || 'cats.electronics'; // fallback
        
        // Get translated name
        let displayName = category; // fallback
        if (window.translations && window.translations[currentLang] && window.translations[currentLang][translationKey]) {
          displayName = window.translations[currentLang][translationKey];
        }
        
        return `<li><label><input type="checkbox" value="${category}"><span data-i18n="${translationKey}"> ${displayName}</span></label></li>`;
      }).join('');
      
      // Apply language to all category labels
      if (window.applyLanguageToElement) {
        categoriesListEl.querySelectorAll('[data-i18n]').forEach(el => {
          window.applyLanguageToElement(el);
        });
      }
    }
    
    // Add language change listener to update categories
    function setupCategoryLanguageListener() {
      // Listen for language changes
      document.addEventListener('click', function(e) {
        if (e.target.closest('[data-lang]')) {
          // Small delay to ensure language has been updated
          setTimeout(() => {
            loadCategories();
          }, 100);
        }
      });
      
      // Listen for storage changes (cross-tab language changes)
      window.addEventListener('storage', function(e) {
        if (e.key === 'selectedLanguage') {
          loadCategories();
        }
      });
    }

    async function fetchProductsPage(page, pageSize) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = window.supabaseClient
        .from('cleaned_products')
        .select('hash_id, title, price, sale_price, image, brand, link, currency, description, store_id, ai_category', { count: 'exact' })
        .eq('status', 'published')
        .not('image', 'is', null)
        .not('store_id', 'is', null)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .range(from, to);
      
      // Category filter
      if (Array.isArray(selectedCategories) && selectedCategories.length > 0) {
        query = query.in('ai_category', selectedCategories);
      }
      
      // URL parameters for category and store filters
      const urlParams = new URLSearchParams(window.location.search);
      const categoryParam = urlParams.get('category');
      const storeId = urlParams.get('store');
      
      // Auto-select category from URL parameter
      if (categoryParam && !selectedCategories.includes(categoryParam)) {
        query = query.eq('ai_category', categoryParam);
      }
      
      if (storeId) {
        query = query.eq('store_id', storeId);
      }
      
      // Text search
      if (typeof searchTerm === 'string' && searchTerm.trim().length > 0) {
        const escaped = searchTerm.replace(/,/g, ' ');
        query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%,ai_category.ilike.%${escaped}%`);
      }
      
      // Price filter using OR to cover price vs sale_price
      const min = Number(priceMinEl?.value || 0) || 0;
      const max = Number(priceMaxEl?.value || 3000) || 3000;
      if (!Number.isNaN(min) || !Number.isNaN(max)) {
        const parts = [];
        if (!Number.isNaN(min)) parts.push(`and(sale_price.gte.${min}),and(price.gte.${min})`);
        if (!Number.isNaN(max)) parts.push(`and(sale_price.lte.${max}),and(price.lte.${max})`);
        if (parts.length === 2) {
          // (sale between) OR (price between)
          query = query.or(`and(sale_price.gte.${min},sale_price.lte.${max}),and(price.gte.${min},price.lte.${max})`);
        } else if (parts.length === 1) {
          // single-sided filter
          if (!Number.isNaN(min)) query = query.or(`sale_price.gte.${min},price.gte.${min}`);
          if (!Number.isNaN(max)) query = query.or(`sale_price.lte.${max},price.lte.${max}`);
        }
      }
      
      const { data, error, count } = await query;
      if (error) { /* console.error('[Supabase] fetch page error', error); */ return { data: [], count: 0 }; }
      
      const products = data || [];
      
      if (products.length === 0) return { data: [], count: count || 0 };
      
      // Get store names for all products
      const storeIds = [...new Set(products.map(p => p.store_id).filter(Boolean))];
      const storeMap = {};
      
      if (storeIds.length > 0) {
        const { data: stores } = await window.supabaseClient
          .from('cleaned_stores')
          .select('id, cleaned_name')
          .in('id', storeIds);
        
        if (stores) {
          stores.forEach(store => {
            storeMap[store.id] = store.cleaned_name;
          });
        }
      }
      
      // Add store names to products
      const productsWithStores = products.map(p => ({
        ...p,
        store_name: storeMap[p.store_id] || p.brand
      }));
      
      // Fetch store names for filter display
      const currentStoreIds = [...new Set(data.map(p => p.store_id).filter(Boolean))];
      await fetchStoreNames(currentStoreIds);
      
      return { data: productsWithStores, count: count || 0 };
    }

    function updateResultsMeta(total) {
      if (!resultsMeta) return;
      const filters = [];
      
      if (Array.isArray(selectedCategories) && selectedCategories.length > 0) {
        filters.push(`Kategorien: ${selectedCategories.slice(0, 3).join(', ')}${selectedCategories.length > 3 ? ` (+${selectedCategories.length - 3})` : ''}`);
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      const storeId = urlParams.get('store');
      if (storeId && storeNames[storeId]) {
        filters.push(`Store: ${storeNames[storeId]}`);
      } else if (storeId) {
        filters.push(`Store: ${storeId}`);
      }
      
      const filterText = filters.length > 0 ? ` • ${filters.join(' • ')}` : '';
      resultsMeta.textContent = `${total} Ergebnisse${filterText}`;
    }

    function buildPaginationUI(total, size, page) {
      totalPages = Math.max(1, Math.ceil(total / size));
      if (!pagination || !paginationList) return;
      if (totalPages <= 1) { pagination.style.display = 'none'; return; }
      pagination.style.display = '';
      const items = [];
      const maxButtons = 6;
      const start = Math.max(1, Math.min(page - 2, totalPages - maxButtons + 1));
      const end = Math.min(totalPages, start + maxButtons - 1);
      for (let i = start; i <= end; i += 1) {
        items.push(`<li><a ${i === page ? 'class="current"' : ''} href="#" data-page="${i}">${i}</a></li>`);
      }
      if (end < totalPages) items.push('<li aria-hidden="true">…</li>');
      items.push(`<li><a class="next" href="#" data-page="${Math.min(totalPages, page + 1)}">Weiter</a></li>`);
      paginationList.innerHTML = items.join('');
    }

    async function goTo(page) {
      currentPage = Math.max(1, Math.min(page, totalPages));
      
      // Show skeleton during loading (except for pagination clicks)
      const skeleton = document.getElementById('dealsGridSkeleton');
      const grid = document.querySelector('.deals-grid');
      
      if (page === 1 && skeleton && grid) {
        skeleton.style.display = '';
        grid.style.display = 'none';
      }
      
      // Fetch page; also get count the first time
      const { data, count } = await fetchProductsPage(currentPage, PAGE_SIZE);
      if (count != null) totalCount = count;
      
      // Show no results message if needed  
      const noResults = document.getElementById('noResults');
      
      if (data.length === 0) {
        // Hide both grid and skeleton when no results
        if (skeleton) skeleton.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (noResults) {
          noResults.style.display = 'block';
          // Get current language for error message
          const currentLang = localStorage.getItem('selectedLanguage') || 'de';
          const errorMsg = currentLang === 'de' 
            ? 'Keine Produkte gefunden. Versuchen Sie es mit anderen Filtern.'
            : 'No products found. Try different filters.';
          noResults.textContent = errorMsg;
        }
      } else {
        if (grid) grid.style.display = '';
        if (noResults) noResults.style.display = 'none';
        renderIntoDealsGrid(data);
      }
      
      updateResultsMeta(totalCount);
      buildPaginationUI(totalCount, PAGE_SIZE, currentPage);
    }

    paginationList?.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.matches('a[data-page]')) {
        e.preventDefault();
        const page = Number(target.getAttribute('data-page')) || 1;
        goTo(page);
      }
    });

    // Wire interactions
    // Header search box integration: server-side search on title/description
    const searchInput = document.querySelector('.search input[type="search"]');
    let searchTerm = '';
    searchInput?.addEventListener('input', (e) => {
      searchTerm = String(e.target.value || '').trim();
      goTo(1);
    });

    // Filter event listeners
    categoriesListEl?.addEventListener('change', () => {
      selectedCategories = Array.from(categoriesListEl.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
      goTo(1);
    });
    
    priceMinEl?.addEventListener('change', () => goTo(1));
    priceMaxEl?.addEventListener('change', () => goTo(1));
    
    // Reset filters functionality
    document.getElementById('filtersReset')?.addEventListener('click', () => {
      // Reset all filter states
      selectedCategories = [];
      
      // Reset UI elements
      document.querySelectorAll('#filtersPanel input[type="checkbox"]').forEach(cb => cb.checked = false);
      if (priceMinEl) priceMinEl.value = 0;
      if (priceMaxEl) priceMaxEl.value = 3000;
      
      // Reload results
      goTo(1);
    });

    // Initial load
    await loadCategories();
    
    // Setup language change listener for categories
    setupCategoryLanguageListener();
    
    // Initialize store name from URL if present
    await initializeStoreNameFromURL();
    
    // Auto-select category from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    if (categoryParam && categoriesListEl) {
      // Wait a bit for categories to load, then auto-select
      setTimeout(() => {
        const categoryCheckbox = categoriesListEl.querySelector(`input[value="${categoryParam}"]`);
        if (categoryCheckbox) {
          categoryCheckbox.checked = true;
          selectedCategories = [categoryParam];
        }
      }, 100);
    }
    
    await goTo(1);
    // Hide the old static empty message; we will set our own meta text
    const noResults = document.getElementById('noResults');
    if (noResults) noResults.style.display = 'none';
  }

  // New function to fetch featured products specifically
  async function fetchFeaturedProducts(limit = 4) {
    const { data, error } = await window.supabaseClient
      .from('cleaned_products')
      .select('hash_id, title, price, sale_price, image, brand, link, currency, store_id')
      .eq('status', 'published')
      .eq('is_featured', true)
      .not('image', 'is', null)
      .not('store_id', 'is', null)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(limit);
      
    if (error) {
      // console.error('[Supabase] fetch featured error', error);
      return [];
    }
    
    const products = data || [];
    if (products.length === 0) return [];
    
    // Get store names for all products
    const storeIds = [...new Set(products.map(p => p.store_id).filter(Boolean))];
    const storeMap = {};
    
    if (storeIds.length > 0) {
      const { data: stores } = await window.supabaseClient
        .from('cleaned_stores')
        .select('id, cleaned_name')
        .in('id', storeIds);
      
      if (stores) {
        stores.forEach(store => {
          storeMap[store.id] = store.cleaned_name;
        });
      }
    }
    
    // Add store names to products
    return products.map(p => ({
      ...p,
      store_name: storeMap[p.store_id] || p.brand
    }));
  }

  // Landing page: featured and best sections with skeleton loading
  if (document.getElementById('featuredGrid')) {
    try {
      // Add a small delay to show the skeleton loading effect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const list = await fetchFeaturedProducts(4);
      const grid = document.getElementById('featuredGrid');
      
      if (grid) {
        const frag = document.createDocumentFragment();
        if (list.length > 0) {
          list.forEach(p => frag.append(createProductCard(p)));
        }
        
        // Show content with animation and hide skeleton (even if empty)
        showContentWithAnimation('featuredSkeleton', 'featuredGrid', frag);
      }
    } catch (error) {
      // console.error('[Products] Featured loading error:', error);
      // Show empty grid on error
      const skeleton = document.getElementById('featuredSkeleton');
      const grid = document.getElementById('featuredGrid');
      if (skeleton) skeleton.style.display = 'none';
      if (grid) grid.style.display = '';
    }
  }
  
  if (document.getElementById('bestGrid')) {
    try {
      // Add a small delay to show the skeleton loading effect
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const list = await fetchTopProducts(9);
      const grid = document.getElementById('bestGrid');
      
      if (grid) {
        const frag = document.createDocumentFragment();
        if (list.length > 0) {
          list.forEach(p => frag.append(createProductCard(p)));
        }
        
        // Show content with animation and hide skeleton (even if empty)
        showContentWithAnimation('bestSkeleton', 'bestGrid', frag);
      }
    } catch (error) {
      // console.error('[Products] Best deals loading error:', error);
      // Show empty grid on error
      const skeleton = document.getElementById('bestSkeleton');
      const grid = document.getElementById('bestGrid');
      if (skeleton) skeleton.style.display = 'none';
      if (grid) grid.style.display = '';
    }
  }
})();
