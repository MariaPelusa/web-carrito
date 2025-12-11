document.addEventListener('DOMContentLoaded', () => {
    // --- Storage Helper for file:// protocol support ---
    const StorageHelper = {
        load: () => {
            const candidates = [];
            const safeParse = (str) => {
                try { return JSON.parse(str); } catch (e) { return null; }
            };

            // Helper to normalize data: { cart: [], timestamp: 0 }
            const normalize = (data) => {
                if (!data) return null;
                if (Array.isArray(data)) return { cart: data, timestamp: 0 }; // Legacy format
                if (data.cart && Array.isArray(data.cart)) return data; // New format
                return null;
            };

            // 1. LocalStorage
            try {
                const ls = normalize(safeParse(localStorage.getItem('pelusaCart')));
                if (ls) candidates.push(ls);
            } catch (e) {}

            // 2. SessionStorage
            try {
                const ss = normalize(safeParse(sessionStorage.getItem('pelusaCart')));
                if (ss) candidates.push(ss);
            } catch (e) {}

            // 3. Window.name
            try {
                const wn = normalize(safeParse(window.name));
                if (wn) candidates.push(wn);
            } catch (e) {}

            // DEBUG: Log candidates to see what's happening
            console.log('Storage Candidates:', candidates);

            if (candidates.length === 0) return [];

            // Sort by timestamp descending (newest first)
            candidates.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            const bestData = candidates[0];

            // CONVERGENCE: Update all storages to match the best data
            // This ensures that if window.name brought newer data, localStorage gets updated immediately.
            const dataStr = JSON.stringify(bestData);
            try { localStorage.setItem('pelusaCart', dataStr); } catch (e) {}
            try { sessionStorage.setItem('pelusaCart', dataStr); } catch (e) {}
            try { window.name = dataStr; } catch (e) {}

            return bestData.cart;
        },
        save: (cart) => {
            const data = {
                cart: cart,
                timestamp: Date.now()
            };
            const dataStr = JSON.stringify(data);
            
            // 1. LocalStorage
            try { localStorage.setItem('pelusaCart', dataStr); } catch (e) {}

            // 2. SessionStorage
            try { sessionStorage.setItem('pelusaCart', dataStr); } catch (e) {}
            
            // 3. Backup to window.name
            try { window.name = dataStr; } catch (e) {}
        }
    };

    // --- Global State ---
    let cart = [];

    function loadCart() {
        cart = StorageHelper.load();
        updateCartCount();
    }

    // Initial load
    loadCart();

    // Handle Back/Forward Cache (BFCache)
    window.addEventListener('pageshow', (event) => {
        loadCart();
    });

    // Listen for storage changes in other tabs/windows
    window.addEventListener('storage', (event) => {
        if (event.key === 'pelusaCart') {
            loadCart();
        }
    });

    // Force reload when tab becomes visible (fixes some mobile/background tab issues)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadCart();
        }
    });

    // --- Tienda Logic ---
    const productItems = document.querySelectorAll('.product-item');
    const modal = document.getElementById('product-modal');
    
    if (modal) {
        const closeModal = document.querySelector('.close-modal');
        const addToCartBtn = document.getElementById('add-to-cart-btn');
        const sizeSelect = document.getElementById('size-select');
        const paperSelect = document.getElementById('paper-select');
        const modalTitle = document.getElementById('modal-title');
        const modalBasePrice = document.getElementById('modal-base-price');
        const modalTotalPrice = document.getElementById('modal-total-price');
        
        let currentProduct = null;

        // Open Modal
        productItems.forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const title = item.dataset.title;
                const price = parseFloat(item.dataset.price);

                currentProduct = { id, title, basePrice: price };

                modalTitle.textContent = title;
                modalBasePrice.textContent = `Precio base: ${price}€`;
                
                // Reset selects
                sizeSelect.value = 'A4';
                paperSelect.value = 'Mate';
                
                updateModalPrice();
                modal.style.display = 'block';
            });
        });

        // Close Modal
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Update Price on Change
        sizeSelect.addEventListener('change', updateModalPrice);
        paperSelect.addEventListener('change', updateModalPrice);

        function updateModalPrice() {
            if (!currentProduct) return;
            
            const sizeMultiplier = parseFloat(sizeSelect.options[sizeSelect.selectedIndex].dataset.multiplier);
            const paperExtra = parseFloat(paperSelect.options[paperSelect.selectedIndex].dataset.extra);
            
            const total = (currentProduct.basePrice * sizeMultiplier) + paperExtra;
            modalTotalPrice.textContent = total.toFixed(2);
        }

        // Add to Cart
        addToCartBtn.addEventListener('click', () => {
            if (!currentProduct) return;

            const size = sizeSelect.value;
            const paper = paperSelect.value;
            const price = parseFloat(modalTotalPrice.textContent);

            const cartItem = {
                ...currentProduct,
                size,
                paper,
                finalPrice: price,
                cartId: Date.now() // Unique ID for cart item
            };

            cart.push(cartItem);
            saveCart();
            updateCartCount();
            modal.style.display = 'none';
            alert('Producto añadido al carrito');
        });
    }

    // --- Carrito Logic ---
    const cartItemsContainer = document.getElementById('cart-items');
    const cartSummary = document.getElementById('cart-summary');
    const checkoutBtn = document.getElementById('checkout-btn');
    const checkoutSection = document.getElementById('checkout-section');
    const subtotalEl = document.getElementById('subtotal-price');
    const totalEl = document.getElementById('total-price');

    if (cartItemsContainer) {
        renderCart();

        checkoutBtn.addEventListener('click', () => {
            checkoutSection.style.display = 'block';
            checkoutBtn.style.display = 'none'; // Hide button after clicking
            // Scroll to form
            checkoutSection.scrollIntoView({ behavior: 'smooth' });
        });

        const checkoutForm = document.getElementById('checkout-form');
        checkoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('¡Gracias por tu compra! Nos pondremos en contacto contigo pronto.');
            cart = [];
            saveCart();
            window.location.href = 'index.html';
        });
    }

    function renderCart() {
        if (!cartItemsContainer) return;

        cartItemsContainer.innerHTML = '';
        
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío.</p>';
            cartSummary.style.display = 'none';
            checkoutSection.style.display = 'none';
            return;
        }

        cartSummary.style.display = 'block';
        let subtotal = 0;

        cart.forEach(item => {
            subtotal += item.finalPrice;
            
            const itemEl = document.createElement('div');
            itemEl.classList.add('cart-item');
            itemEl.innerHTML = `
                <div class="cart-item-details">
                    <h4>${item.title}</h4>
                    <p>Tamaño: ${item.size} | Papel: ${item.paper}</p>
                    <p class="item-price">${item.finalPrice.toFixed(2)}€</p>
                </div>
                <button class="remove-btn" data-id="${item.cartId}">&times;</button>
            `;
            cartItemsContainer.appendChild(itemEl);
        });

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                cart = cart.filter(item => item.cartId !== id);
                saveCart();
                updateCartCount();
                renderCart();
            });
        });

        subtotalEl.textContent = subtotal.toFixed(2) + '€';
        const shipping = 5.00;
        totalEl.textContent = (subtotal + shipping).toFixed(2) + '€';
    }

    // --- Shared Functions ---
    function saveCart() {
        StorageHelper.save(cart);
    }

    function updateCartCount() {
        const countEls = document.querySelectorAll('#cart-count');
        countEls.forEach(el => el.textContent = cart.length);
    }
});