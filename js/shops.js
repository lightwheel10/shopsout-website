(async function(){
  if (!window.supabaseClient) return;

  // Fetch stores from the cleaned_stores table
  async function fetchStores(limit = 50) {
    const { data, error } = await window.supabaseClient
      .from('cleaned_stores')
      .select('id, name, cleaned_name, logo_url, url, description, status, is_published_to_deals')
      .eq('status', 'active')
      .eq('is_published_to_deals', true)
      .not('cleaned_name', 'is', null)
      .order('name', { ascending: true })
      .limit(limit);
    
    if (error) {
      // console.error('[Supabase] fetch stores error', error);
      return [];
    }
    return data || [];
  }

  // Create a shop card element
  function createShopCard(store) {
    const card = document.createElement('a');
    card.className = 'shop-card';
    card.href = `store.html?id=${encodeURIComponent(store.id)}`;
    card.setAttribute('data-store-id', store.id);
    
    // Use cleaned_name only
    const displayName = store.cleaned_name;
    
    const logoDiv = document.createElement('div');
    logoDiv.className = 'shop-logo';
    
    if (store.logo_url) {
      const img = document.createElement('img');
      img.className = 'product-image-lazy shop-logo-img';
      img.alt = displayName;
      img.width = 48;
      img.height = 48;
      img.loading = 'lazy';
      img.setAttribute('decoding', 'async');
      
      // Enhanced lazy loading with fade-in effect
      img.onload = function() {
        this.classList.add('loaded');
      };
      
      // Add error handling for broken images
      img.onerror = function() {
        this.style.display = 'none';
        logoDiv.innerHTML = `<div class="shop-logo-fallback">${displayName.charAt(0).toUpperCase()}</div>`;
      };
      
      img.src = store.logo_url;
      logoDiv.appendChild(img);
    } else {
      // Create a fallback logo with the first letter of the store name
      logoDiv.innerHTML = `<div class="shop-logo-fallback">${displayName.charAt(0).toUpperCase()}</div>`;
    }
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'shop-name';
    nameDiv.textContent = displayName;
    
    card.appendChild(logoDiv);
    card.appendChild(nameDiv);
    
    return card;
  }

  // Render stores into the shops grid
  function renderShops(stores) {
    const shopsGrid = document.querySelector('.shops-grid');
    const skeleton = document.getElementById('shopsGridSkeleton');
    
    if (!shopsGrid || !Array.isArray(stores)) return;
    
    // Hide skeleton and show grid with animation
    if (skeleton) {
      skeleton.style.display = 'none';
    }
    shopsGrid.style.display = '';
    shopsGrid.classList.add('content-loaded');
    
    // Clear existing content
    shopsGrid.innerHTML = '';
    
    if (stores.length === 0) {
      shopsGrid.innerHTML = '<div class="no-shops-message">No shops available at the moment.</div>';
      return;
    }
    
    const fragment = document.createDocumentFragment();
    
    stores.forEach(store => {
      const card = createShopCard(store);
      fragment.appendChild(card);
    });
    
    shopsGrid.appendChild(fragment);
  }

  // Initialize shops page
  async function initShops() {
    try {
      // Add a small delay to show the skeleton loading effect
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const stores = await fetchStores();
      renderShops(stores);
      
      // Set up search functionality
      const searchInput = document.querySelector('.search input[type="search"]');
      if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
          const searchTerm = e.target.value.trim().toLowerCase();
          
          if (searchTerm === '') {
            // Show all stores if search is empty
            renderShops(stores);
          } else {
            // Filter stores by name
            const filteredStores = stores.filter(store => {
              const name = (store.cleaned_name || '').toLowerCase();
              return name.includes(searchTerm);
            });
            renderShops(filteredStores);
          }
        });
      }
      
    } catch (error) {
      // console.error('[Shops] initialization error', error);
      const shopsGrid = document.querySelector('.shops-grid');
      if (shopsGrid) {
        shopsGrid.innerHTML = '<div class="error-message">Error loading shops. Please try again later.</div>';
      }
    }
  }

  // Auto-run on shops page
  if (document.getElementById('shopsGridSkeleton')) {
    initShops();
  }
})();
