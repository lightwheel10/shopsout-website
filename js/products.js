(async function(){
  if (!window.supabaseClient) return;

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
      // Add discount badge
      const discountPercent = Math.round(((Number(p.price) - Number(p.sale_price)) / Number(p.price)) * 100);
      const discountBadge = document.createElement('span');
      discountBadge.className = 'discount-badge';
      discountBadge.textContent = `-${discountPercent}%`;
      discountBadge.style.cssText = 'background: #ef4444 !important; color: white !important; position: absolute !important; top: -12px !important; right: -12px !important; z-index: 999 !important; padding: 4px 8px !important; border-radius: 6px !important; font-size: 0.75rem !important; font-weight: 700 !important; display: block !important; box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;';
      prices.appendChild(discountBadge);
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
    cta.textContent = 'Shop now';
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
    if (!grid || !Array.isArray(products)) return;
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
        img.src = p.image;
        img.alt = p.title;
        img.loading = 'lazy';
        media.appendChild(img);
      }
      
      const ctaContainer = document.createElement('div');
      ctaContainer.className = 'deal-v2-cta-container';
      const dealBtn = document.createElement('a');
      dealBtn.href = p.link || '#';
      dealBtn.className = 'btn btn-deal';
      dealBtn.textContent = 'zum Deal';
      dealBtn.target = '_blank';
      dealBtn.rel = 'noopener noreferrer';
      const detailsBtn = document.createElement('a');
      detailsBtn.href = `product.html?id=${encodeURIComponent(p.hash_id)}`;
      detailsBtn.className = 'btn btn-details';
      detailsBtn.textContent = 'Deal-Details';
      ctaContainer.append(dealBtn, detailsBtn);
      leftCol.append(media, ctaContainer);

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

      const discount = document.createElement('div');
      if (p.sale_price && p.price) {
        const percentage = Math.round(((p.price - p.sale_price) / p.price) * 100);
        if (percentage > 0) {
          discount.className = 'discount-badge';
          discount.textContent = `-${percentage}%`;
        }
      }

      const validity = document.createElement('div');
      validity.className = 'deal-v2-validity';
      // Note: validity date display removed as valid_from/valid_to columns don't exist in cleaned_products table
      // Future enhancement: add validity dates when schema supports it

      const prices = document.createElement('div');
      prices.className = 'deal-v2-prices';
      if (p.price && p.sale_price && Number(p.price) > Number(p.sale_price)) {
        prices.innerHTML += `<span class="price-old-v2">Vorher: ${formatCurrency(p.price, p.currency)}</span>`;
      }
      prices.innerHTML += `<span class="price-now-v2">Jetzt nur: ${formatCurrency(p.sale_price || p.price, p.currency)}</span>`;

      const description = document.createElement('p');
      description.className = 'deal-v2-description';
      description.textContent = p.description ? (p.description.length > 150 ? p.description.substring(0, 150) + '…' : p.description) : '';

      detailsGrid.append(discount, validity, prices, description);

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
      // Use ai_category as the main category field since that's what your schema defines for product categories
      const { data, error } = await window.supabaseClient
        .from('cleaned_products')
        .select('ai_category')
        .eq('status', 'published')
        .not('ai_category', 'is', null)
        .order('ai_category', { ascending: true })
        .limit(200);
      if (error) { /* console.warn('[Supabase] load categories error', error); */ return; }
      const uniq = Array.from(new Set((data || []).map(r => (r.ai_category || '').trim()).filter(Boolean)));
      // Render categories as checkboxes
      categoriesListEl.innerHTML = uniq.slice(0, 30).map(c => `
        <li><label><input type="checkbox" value="${c}"><span> ${c}</span></label></li>
      `).join('');
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
      if (storeId) {
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
      // Fetch page; also get count the first time
      const { data, count } = await fetchProductsPage(currentPage, PAGE_SIZE);
      if (count != null) totalCount = count;
      
      // Show no results message if needed
      const grid = document.querySelector('.deals-grid');
      const noResults = document.getElementById('noResults');
      
      if (data.length === 0) {
        if (grid) grid.style.display = 'none';
        if (noResults) {
          noResults.style.display = 'block';
          noResults.textContent = 'Keine Produkte gefunden. Versuchen Sie es mit anderen Filtern.';
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
