(async function(){
  if (!window.supabaseClient) return;

  function getQueryParam(name) {
    const params = new URLSearchParams(location.search);
    return params.get(name);
  }

  function formatCurrency(value, currency = 'EUR') {
    if (value == null) return '';
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value)); }
    catch(_) { return `${Number(value).toFixed(2)} ${currency || '€'}`; }
  }

  async function fetchProduct(idOrHash) {
    // console.log('[Product Debug] fetchProduct called with:', idOrHash);
    let query = window.supabaseClient
      .from('cleaned_products')
      .select('hash_id, product_id, title, description, price, sale_price, link, image, brand, currency, coupon_code, coupon_value, availability, store_id, affiliate_link')
      .eq('status', 'published')
      .not('store_id', 'is', null)
      .limit(1);
    if (!idOrHash) {
      // console.log('[Product Debug] No ID provided');
      return { data: null };
    }
    if (/^[0-9a-f-]{36}$/i.test(idOrHash)) {
      // console.log('[Product Debug] Using product_id field for UUID:', idOrHash);
      query = query.eq('product_id', idOrHash);
    } else {
      // console.log('[Product Debug] Using hash_id field for:', idOrHash);
      query = query.eq('hash_id', idOrHash);
    }
    const { data, error } = await query.single();
    // console.log('[Product Debug] Query result - data:', data, 'error:', error);
    if (error) { 
      // console.log('[Product Debug] Database error:', error); 
      return { data: null }; 
    }
    
    if (data && data.store_id) {
      // Get store name
      const { data: store } = await window.supabaseClient
        .from('cleaned_stores')
        .select('cleaned_name')
        .eq('id', data.store_id)
        .single();
      
      if (store) {
        data.store_name = store.cleaned_name;
      }
    }
    
    return { data };
  }

  function setText(el, text) { if (el) el.textContent = text || ''; }
  function setVisible(el, show) { if (el) el.style.display = show ? '' : 'none'; }

  async function render() {
    const id = getQueryParam('id') || getQueryParam('hash');
    // console.log('[Product Debug] URL ID:', id);
    const { data: p } = await fetchProduct(id);
    // console.log('[Product Debug] Fetched product:', p);
    if (!p) {
      // console.log('[Product Debug] No product found, exiting render');
      return;
    }
    const media = document.getElementById('pdMedia');
    const brand = document.getElementById('pdBrand');
    const title = document.getElementById('pdTitle');
    const now = document.getElementById('pdPriceNow');
    const old = document.getElementById('pdPriceOld');
    const cta = document.getElementById('pdCta');
    const desc = document.getElementById('pdDesc');
    // Coupon element removed

    if (p.image && media) media.style.background = `center/cover no-repeat url(${CSS.escape ? CSS.escape(p.image) : p.image})`;
    setText(brand, p.store_name || p.brand || '');
    setText(title, p.title || '');
    
    // Check for discount and add styling
    const hasDiscount = p.sale_price && p.price && Number(p.price) > Number(p.sale_price);
    const pricesContainer = document.querySelector('.deal-prices');
    
    if (hasDiscount && pricesContainer) {
      pricesContainer.classList.add('has-discount');
    }
    
    setText(now, p.sale_price ? formatCurrency(p.sale_price, p.currency || 'EUR') : formatCurrency(p.price, p.currency || 'EUR'));
    if (hasDiscount) {
      setText(old, formatCurrency(p.price, p.currency || 'EUR'));
      setVisible(old, true);
    }
    // Coupon display removed
    // Use affiliate_link for the button, completely disable if not available
    if (p.affiliate_link && p.affiliate_link.trim() !== '') { 
      cta.href = p.affiliate_link;
      cta.classList.remove('disabled');
      cta.style.pointerEvents = '';
      cta.onclick = null;
      cta.title = '';
      cta.style.cursor = '';
    } else { 
      // COMPLETELY disable the button
      cta.href = 'javascript:void(0)';
      cta.classList.add('disabled');
      cta.style.pointerEvents = 'none';
      cta.style.cursor = 'not-allowed';
      cta.title = 'Affiliate link not available';
      cta.addEventListener('click', function(e) { 
        e.preventDefault(); 
        e.stopImmediatePropagation(); 
        return false; 
      }, true);
      cta.onclick = function(e) { 
        e.preventDefault(); 
        e.stopImmediatePropagation(); 
        return false; 
      };
    }
    setText(desc, p.description || '');
    
    // Add discount badge AFTER all other DOM manipulations
    if (hasDiscount) {
      // Remove any existing discount badges and wrappers first
      const existingBadges = document.querySelectorAll('.discount-badge, .brand-discount');
      existingBadges.forEach(badge => badge.remove());
      const existingWrappers = document.querySelectorAll('.brand-wrapper');
      existingWrappers.forEach(wrapper => {
        // Move brand back to original position before removing wrapper
        const brandElement = wrapper.querySelector('#pdBrand');
        if (brandElement) {
          wrapper.parentNode.insertBefore(brandElement, wrapper);
        }
        wrapper.remove();
      });
      
      // Add discount badge next to brand name
      const brandElement = document.getElementById('pdBrand');
      if (brandElement) {
        const discountPercent = Math.round(((Number(p.price) - Number(p.sale_price)) / Number(p.price)) * 100);
        const discountBadge = document.createElement('span');
        discountBadge.className = 'brand-discount';
        discountBadge.textContent = `-${discountPercent}%`;
        
        // Create a wrapper to keep brand and badge on same line
        const brandWrapper = document.createElement('div');
        brandWrapper.className = 'brand-wrapper';
        brandWrapper.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-direction: row;';
        
        // Replace brand element with wrapper containing both brand and badge
        const parentElement = brandElement.parentNode;
        parentElement.insertBefore(brandWrapper, brandElement);
        
        // Move brand to wrapper first, then add badge after
        brandWrapper.appendChild(brandElement); // Brand first (left)
        brandWrapper.appendChild(discountBadge); // Badge second (right)
      }
    }

    // Related products: same brand, otherwise recent ones; min 6
    const relatedGrid = document.getElementById('relatedGrid');
    if (relatedGrid) {
      const { data: sameBrand } = await window.supabaseClient
        .from('cleaned_products')
        .select('hash_id, product_id, title, price, sale_price, image, brand, currency, store_id')
        .eq('status', 'published')
        .not('image', 'is', null)
        .not('store_id', 'is', null)
        .eq('store_id', p.store_id)
        .neq('hash_id', p.hash_id)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(6);
      let items = sameBrand || [];
      if (items.length < 6) {
        const { data: fallback } = await window.supabaseClient
          .from('cleaned_products')
          .select('hash_id, product_id, title, price, sale_price, image, brand, currency, store_id')
          .eq('status', 'published')
          .not('image', 'is', null)
          .not('store_id', 'is', null)
          .neq('hash_id', p.hash_id)
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(6 - items.length);
        items = items.concat(fallback || []);
      }
      
      // Get store names for related products
      if (items.length > 0) {
        const storeIds = [...new Set(items.map(item => item.store_id).filter(Boolean))];
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
        
        // Add store names to items
        items = items.map(item => ({
          ...item,
          store_name: storeMap[item.store_id] || item.brand
        }));
      }
      
      relatedGrid.innerHTML = '';
      const frag = document.createDocumentFragment();
      items.slice(0, 6).forEach(r => {
        const card = document.createElement('article'); card.className = 'product-card';
        const media = document.createElement('div'); media.className = 'product-media';
        if (r.image) media.style.background = `center/cover no-repeat url(${CSS.escape ? CSS.escape(r.image) : r.image})`;
        const body = document.createElement('div'); body.className = 'product-body';
        const b = document.createElement('span'); b.className = 'brand-tag'; b.textContent = r.store_name || '';
        const t = document.createElement('h3'); t.className = 'product-title'; t.textContent = r.title || '';
        const prices = document.createElement('div'); prices.className = 'deal-prices';
        
        // Check if there's a discount
        const hasDiscount = r.sale_price && r.price && Number(r.price) > Number(r.sale_price);
        if (hasDiscount) {
          prices.classList.add('has-discount');
          // Add discount badge to product card (top right corner)
          const discountPercent = Math.round(((Number(r.price) - Number(r.sale_price)) / Number(r.price)) * 100);
          const discountBadge = document.createElement('span');
          discountBadge.className = 'discount-badge';
          discountBadge.textContent = `-${discountPercent}%`;
          card.appendChild(discountBadge); // Attach to card instead of prices
        }
        
        const now = document.createElement('span'); now.className = 'price-now'; now.textContent = r.sale_price ? formatCurrency(r.sale_price, r.currency || 'EUR') : formatCurrency(r.price, r.currency || 'EUR');
        prices.appendChild(now);
        if (hasDiscount) { const old = document.createElement('span'); old.className = 'price-old'; old.textContent = formatCurrency(r.price, r.currency || 'EUR'); prices.appendChild(old); }
        const cta = document.createElement('a'); cta.className = 'btn btn-primary'; cta.href = `product.html?id=${encodeURIComponent(r.hash_id)}`; cta.setAttribute('data-i18n', 'card.cta'); cta.textContent = 'View deal'; // fallback
        body.append(b, t, prices, cta); card.append(media, body); 
        
        // Apply current language to the button
        if (window.applyLanguageToElement) {
          window.applyLanguageToElement(cta);
        }
        
        frag.append(card);
      });
      relatedGrid.append(frag);
    }
  }

  await render();
})();

