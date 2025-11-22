// API Configuration
const API_BASE_URL = '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

// Utility Functions
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: getAuthHeaders()
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        // Check if online
        const isOnline = navigator.onLine;
        
        // Try to make the request
        let response;
        try {
            response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        } catch (networkError) {
            // Network error - handle offline
            if (!isOnline || networkError.message.includes('Failed to fetch')) {
                // For write operations, store locally
                if (method !== 'GET' && offlineManager) {
                    const pendingId = await offlineManager.storePendingTransaction(
                        endpoint, 
                        method, 
                        body,
                        Date.now()
                    );
                    
                    // Return a mock success response for offline operations
                    return {
                        success: true,
                        offline: true,
                        message: 'Transaction saved locally. Will sync when online.',
                        pendingId
                    };
                }
                
                // For GET requests, try to get from cache
                if (method === 'GET' && offlineManager) {
                    const cachedData = await offlineManager.getOfflineData(endpoint);
                    if (cachedData) {
                        console.log('[API] Using cached data for:', endpoint);
                        return cachedData;
                    }
                }
                
                throw new Error('Network error. Please check your connection.');
            }
            throw networkError;
        }
        
        // Parse response
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(response.statusText || 'API request failed');
        }
        
        // Handle error responses
        if (!response.ok) {
            const errorMessage = data.message || 
                               data.error?.message || 
                               data.error || 
                               `API request failed (${response.status})`;
            const error = new Error(errorMessage);
            error.status = response.status;
            throw error;
        }
        
        // Check if response has success flag set to false
        if (data.hasOwnProperty('success') && data.success === false) {
            throw new Error(data.message || 'API request failed');
        }
        
        // Cache successful GET responses for offline use
        if (method === 'GET' && response.ok && offlineManager) {
            await offlineManager.storeOfflineData(endpoint, data);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        
        // If it's an auth error, redirect to login (but not during login itself)
        if ((error.status === 401 || error.message.includes('Not authorized')) && 
            !endpoint.includes('/auth/login') && 
            !endpoint.includes('/auth/register')) {
            handleLogout();
        }
        throw error;
    }
}

// Authentication Functions
function showLogin(event) {
    if (event) event.preventDefault();
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginError').classList.add('hidden');
}

function showRegister(event) {
    if (event) event.preventDefault();
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginError').classList.add('hidden');
}

async function handleLogin(event) {
    if (event) event.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    // Clear previous errors
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';

    // Validate inputs
    if (!email) {
        errorDiv.textContent = 'Please enter your email address';
        errorDiv.classList.remove('hidden');
        document.getElementById('loginEmail').focus();
        return;
    }

    if (!password) {
        errorDiv.textContent = 'Please enter your password';
        errorDiv.classList.remove('hidden');
        document.getElementById('loginPassword').focus();
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorDiv.textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        document.getElementById('loginEmail').focus();
        return;
    }
    
    // Show loading state
    const loginBtn = event ? event.target.querySelector('button[type="submit"]') || event.target : document.querySelector('#loginForm button[type="submit"]');
    const originalText = loginBtn.textContent;
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    
    try {
        const response = await apiCall('/auth/login', 'POST', { email, password });
        if (response.token && response.user) {
            authToken = response.token;
            currentUser = response.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        let errorMessage = error.message || 'Login failed. Please check your credentials.';
        
        // Make error messages more user-friendly
        if (errorMessage.includes('Invalid credentials')) {
            errorMessage = 'Invalid email or password. Please try again.';
        } else if (errorMessage.includes('Not authorized')) {
            errorMessage = 'Authentication failed. Please login again.';
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = originalText;
    }
}

async function handleRegister(event) {
    if (event) event.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('registerRole').value;
    const errorDiv = document.getElementById('loginError');

    // Clear previous errors
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';

    // Validate inputs one by one
    if (!name) {
        errorDiv.textContent = 'Please enter your name';
        errorDiv.classList.remove('hidden');
        document.getElementById('registerName').focus();
        return;
    }

    if (!email) {
        errorDiv.textContent = 'Please enter your email address';
        errorDiv.classList.remove('hidden');
        document.getElementById('registerEmail').focus();
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorDiv.textContent = 'Please enter a valid email address';
        errorDiv.classList.remove('hidden');
        document.getElementById('registerEmail').focus();
        return;
    }

    if (!password) {
        errorDiv.textContent = 'Please enter a password';
        errorDiv.classList.remove('hidden');
        document.getElementById('registerPassword').focus();
        return;
    }

    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters long';
        errorDiv.classList.remove('hidden');
        document.getElementById('registerPassword').focus();
        return;
    }

    if (!role) {
        errorDiv.textContent = 'Please select a role';
        errorDiv.classList.remove('hidden');
        document.getElementById('registerRole').focus();
        return;
    }
    
    // Show loading state
    const registerBtn = event ? event.target.querySelector('button[type="submit"]') || event.target : document.querySelector('#registerForm button[type="submit"]');
    const originalText = registerBtn.textContent;
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';
    
    try {
        const response = await apiCall('/auth/register', 'POST', { name, email, password, role });
        if (response.token && response.user) {
            authToken = response.token;
            currentUser = response.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        let errorMessage = error.message || 'Registration failed. Please try again.';
        
        // Make error messages more user-friendly
        if (errorMessage.includes('already exists')) {
            errorMessage = 'An account with this email already exists. Please login instead.';
        } else if (errorMessage.includes('valid email')) {
            errorMessage = 'Please enter a valid email address.';
        } else if (errorMessage.includes('password')) {
            errorMessage = 'Password must be at least 6 characters long.';
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.classList.remove('hidden');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = originalText;
    }
}

function handleLogout() {
    authToken = null;
    currentUser = {};
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showLoginPage();
}

function showLoginPage() {
    // Hide app page
    const appPage = document.getElementById('appPage');
    appPage.classList.remove('active');
    
    // Show login page
    const loginPage = document.getElementById('loginPage');
    loginPage.classList.add('active');
    
    // Clear form and show login form by default
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').classList.add('hidden');
    showLogin();
}

function showApp() {
    // Hide login page
    const loginPage = document.getElementById('loginPage');
    loginPage.classList.remove('active');
    
    // Show app page
    const appPage = document.getElementById('appPage');
    appPage.classList.add('active');
    
    // Update user info
    if (currentUser.name) {
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userRole').textContent = currentUser.role === 'inventory_manager' ? 'Manager' : 'Staff';
    }
    showDashboard();
}

// Navigation Functions
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(`${pageName}Page`);
    if (targetPage) {
        targetPage.classList.add('active');
    } else {
        console.error(`Page ${pageName}Page not found`);
        return;
    }
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeNavItem = document.querySelector(`[data-page="${pageName}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    // Close mobile menu if open
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
            if (overlay) overlay.classList.remove('active');
        }
    }
}

function showDashboard() {
    showPage('dashboard');
    loadDashboard();
}

function showProducts() {
    showPage('products');
    loadProducts();
}

function showWarehouses() {
    showPage('warehouses');
    loadWarehouses();
}

function showReceipts() {
    showPage('receipts');
    loadReceipts();
}

function showDeliveries() {
    showPage('deliveries');
    loadDeliveries();
}

function showTransfers() {
    showPage('transfers');
    loadTransfers();
}

function showAdjustments() {
    showPage('adjustments');
    loadAdjustments();
}

// Dashboard Functions
async function loadDashboard() {
    try {
        const data = await apiCall('/dashboard');
        const kpis = data.data.kpis;
        
        document.getElementById('kpiTotalProducts').textContent = kpis.totalProducts || 0;
        document.getElementById('kpiLowStock').textContent = kpis.lowStockItems || 0;
        document.getElementById('kpiOutOfStock').textContent = kpis.outOfStockItems || 0;
        document.getElementById('kpiPendingReceipts').textContent = kpis.pendingReceipts || 0;
        document.getElementById('kpiPendingDeliveries').textContent = kpis.pendingDeliveries || 0;
        document.getElementById('kpiWarehouses').textContent = kpis.totalWarehouses || 0;
        
        // Load stock value chart
        const stockValue = data.data.stockValue || [];
        displayStockValueChart(stockValue);
        
        // Calculate inventory valuation
        calculateInventoryValuation(stockValue);
        
        // Load recent transactions
        const transactions = data.data.recentTransactions || [];
        displayRecentTransactions(transactions);
        
        // Low stock summary for quick insights
        const lowStockDetails = data.data.lowStockDetails || [];
        displayLowStockSummary(lowStockDetails);
        
        // Load demand forecasts - ADD THIS
        const demandForecasts = data.data.demandForecasts || [];
        displayDemandForecasts(demandForecasts);
        
        // Load categories for filter
        loadCategoriesForFilter();
        
        // Store forecast data for kanban view
        forecastData = data.data.demandForecasts || [];
        
        // Load demand forecasts
        displayDemandForecasts(forecastData);
        
        // If kanban view is active, update it
        if (currentView === 'kanban') {
            displayKanbanView();
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('recentTransactions').innerHTML = 
            '<p class="loading">Error loading dashboard data</p>';
    }
}

// Display Stock Value Chart
function displayStockValueChart(stockValue) {
    const container = document.getElementById('stockValueChart');
    if (!stockValue || stockValue.length === 0) {
        container.innerHTML = '<p class="loading">No stock value data available</p>';
        return;
    }
    
    // Calculate max value for percentage
    const maxValue = Math.max(...stockValue.map(item => item.totalValue || 0));
    
    let html = '';
    stockValue.forEach(item => {
        const percentage = maxValue > 0 ? (item.totalValue / maxValue) * 100 : 0;
        const formattedValue = formatCurrency(item.totalValue || 0);
        
        html += `
            <div class="chart-item">
                <div style="flex: 1;">
                    <div class="chart-label">${item._id || 'Uncategorized'}</div>
                    <div class="chart-bar">
                        <div class="chart-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <div class="chart-value">${formattedValue}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Calculate Inventory Valuation
function calculateInventoryValuation(stockValue) {
    const totalValue = stockValue.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    // Assuming 30% profit margin for potential revenue
    const potentialRevenue = totalValue * 1.3;
    
    document.getElementById('totalInventoryValue').textContent = formatCurrency(totalValue);
    document.getElementById('potentialRevenue').textContent = formatCurrency(potentialRevenue);
}

// Format Currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Load Categories for Filter
async function loadCategoriesForFilter() {
    try {
        const data = await apiCall('/products/categories');
        const categories = data.data || [];
        const select = document.getElementById('filterCategory');
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Seed Sample Data
async function seedSampleData() {
    if (!confirm('This will clear existing data and add sample data. Are you sure?')) {
        return;
    }
    
    try {
        const response = await apiCall('/seed', 'POST');
        alert('Sample data seeding started! Check the server console for progress. The page will refresh in 5 seconds.');
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    } catch (error) {
        alert('Error seeding data: ' + error.message);
    }
}

// Export Dashboard
function exportDashboard() {
    alert('Export functionality coming soon! You can print the page using Ctrl+P');
}

// Global Search
function handleGlobalSearch(event) {
    if (event.key === 'Enter') {
        const searchTerm = event.target.value.trim();
        if (searchTerm) {
            // Search in products
            showProducts();
            document.getElementById('productSearch').value = searchTerm;
            filterProducts();
        }
    }
}

// Clear Search
function clearSearch() {
    document.getElementById('globalSearch').value = '';
    document.getElementById('filterCategory').value = '';
    if (document.getElementById('productsPage').classList.contains('active')) {
        document.getElementById('productSearch').value = '';
        loadProducts();
    }
}

// Apply Filters
function applyFilters() {
    const category = document.getElementById('filterCategory').value;
    if (category) {
        showProducts();
        // Filter products by category
        filterProductsByCategory(category);
    }
}

// Show All Transactions
function showAllTransactions() {
    // Show transactions page or filter view
    alert('Viewing all transactions. Full transaction list coming soon!');
}

function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');
    if (!container) return;
    
    if (transactions.length === 0) {
        container.innerHTML = '<p class="loading">No recent transactions</p>';
        return;
    }
    
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Created By</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    transactions.forEach(txn => {
        const date = new Date(txn.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const type = (txn.type || '').toUpperCase();
        const status = (txn.status || '').toUpperCase();
        
        // Map status to CSS classes
        let statusClass = 'draft';
        if (status === 'COMPLETED') statusClass = 'completed';
        else if (status === 'READY') statusClass = 'ready';
        else if (status === 'WAITING') statusClass = 'draft';
        else if (status === 'CANCELLED') statusClass = 'cancelled';
        
        html += `
            <tr>
                <td><strong>${txn.reference || 'N/A'}</strong></td>
                <td>${type}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>${date}</td>
                <td>${txn.createdBy?.name || 'N/A'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function displayLowStockSummary(items) {
    const container = document.getElementById('lowStockSummary');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<p class="loading">No low stock items right now</p>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Warehouse</th>
                    <th>Qty</th>
                    <th>Min Level</th>
                </tr>
            </thead>
            <tbody>
    `;

    items.forEach(item => {
        const productInfo = item.productInfo || {};
        const warehouseName = item.warehouse?.name || 'N/A';
        const quantity = item.quantity || 0;
        const minLevel = productInfo.minStockLevel ?? '-';

        html += `
            <tr>
                <td><strong>${productInfo.name || 'N/A'}</strong></td>
                <td>${productInfo.sku || 'N/A'}</td>
                <td>${warehouseName}</td>
                <td>${quantity}</td>
                <td>${minLevel}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Display Demand Forecasts
function displayDemandForecasts(forecasts) {
    const container = document.getElementById('demandForecasts');
    
    if (!forecasts || forecasts.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-light);">
                <p style="font-size: 16px; margin-bottom: 8px;">✨ No immediate shortages predicted</p>
                <p style="font-size: 14px;">All products have sufficient stock based on current demand patterns.</p>
            </div>
        `;
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Prediction</th>
                    <th>Days Until Shortage</th>
                    <th>Suggested Reorder</th>
                    <th>Confidence</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
    `;

    forecasts.forEach(forecast => {
        const urgencyClass = forecast.daysUntilShortage <= 7 ? 'urgent' : 
                            forecast.daysUntilShortage <= 14 ? 'warning' : 'info';
        
        const confidenceBadge = forecast.confidence === 'high' ? 
            '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">High</span>' :
            forecast.confidence === 'medium' ?
            '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">Medium</span>' :
            '<span style="background: #6b7280; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">Low</span>';

        const predictionText = forecast.daysUntilShortage <= 0 ? 
            '⚠️ Out of stock' :
            `Predicted shortage in ${forecast.daysUntilShortage} days`;

        html += `
            <tr class="${urgencyClass}">
                <td>
                    <div style="font-weight: 600;">${forecast.productName}</div>
                    <div style="font-size: 12px; color: var(--text-light);">${forecast.sku} • ${forecast.warehouseName}</div>
                </td>
                <td>
                    <span style="font-weight: 600;">${forecast.currentStock}</span>
                    <span style="font-size: 12px; color: var(--text-light);"> ${forecast.unitOfMeasure || 'units'}</span>
                </td>
                <td>
                    <div style="font-weight: 500; color: ${forecast.daysUntilShortage <= 7 ? '#ef4444' : forecast.daysUntilShortage <= 14 ? '#f59e0b' : '#3b82f6'};">
                        ${predictionText}
                    </div>
                    <div style="font-size: 11px; color: var(--text-light); margin-top: 2px;">
                        Daily demand: ${forecast.dailyDemand || 'N/A'} ${forecast.unitOfMeasure || 'units'}
                    </div>
                </td>
                <td>
                    <span style="font-weight: 600; font-size: 18px; color: ${forecast.daysUntilShortage <= 7 ? '#ef4444' : '#f59e0b'};">
                        ${forecast.daysUntilShortage}
                    </span>
                    <span style="font-size: 12px; color: var(--text-light);"> days</span>
                </td>
                <td>
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 8px 12px; border-radius: 6px; font-weight: 600; text-align: center;">
                        ${forecast.suggestedReorderQuantity} ${forecast.unitOfMeasure || 'units'}
                    </div>
                </td>
                <td>
                    ${confidenceBadge}
                    <div style="font-size: 11px; color: var(--text-light); margin-top: 4px;">
                        ${forecast.reason || ''}
                    </div>
                </td>
                <td>
                    <button onclick="placeOrderFromForecast('${forecast.productId}', '${forecast.productName}', ${forecast.suggestedReorderQuantity}, '${forecast.warehouseName}', '${forecast.unitOfMeasure}')" 
                            class="btn btn-sm" style="background: #10b981; color: white; white-space: nowrap;">
                        📦 Place Order
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// Place Order from Forecast
function placeOrderFromForecast(productId, productName, quantity, warehouseName, unitOfMeasure) {
    if (confirm(`Place order for ${quantity} ${unitOfMeasure} of ${productName} for ${warehouseName}?`)) {
        // Open receipt form with pre-filled data
        showAddReceipt();
        setTimeout(() => {
            // Pre-fill the receipt form
            document.getElementById('receiptNotes').value = `Auto-ordered from AI Forecast: ${productName} - ${quantity} ${unitOfMeasure}`;
            
            // Add the item to receipt
            receiptItems = [{
                product: productId,
                productName: productName,
                quantity: quantity,
                unitPrice: 0,
                location: ''
            }];
            renderReceiptItems();
        }, 500);
    }
}

// Products Functions
let allProducts = [];

async function loadProducts() {
    try {
        const data = await apiCall('/products');
        allProducts = data.data || [];
        displayProducts(allProducts);
        updateProductsCount(allProducts.length);
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('productsList').innerHTML = 
            '<p class="loading">Error loading products</p>';
    }
}

// Filter Products
function filterProducts() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase().trim();
    
    if (!searchTerm) {
        displayProducts(allProducts);
        updateProductsCount(allProducts.length);
        return;
    }
    
    const filtered = allProducts.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.sku.toLowerCase().includes(searchTerm) ||
        (product.category && product.category.toLowerCase().includes(searchTerm))
    );
    
    displayProducts(filtered);
    updateProductsCount(filtered.length);
}

// Filter Products by Category
function filterProductsByCategory(category) {
    const filtered = allProducts.filter(product => 
        product.category === category
    );
    displayProducts(filtered);
    updateProductsCount(filtered.length);
}

// Update Products Count
function updateProductsCount(count) {
    const countElement = document.getElementById('productsCount');
    if (countElement) {
        countElement.textContent = `${count} product${count !== 1 ? 's' : ''}`;
    }
}

function displayProducts(products) {
    const container = document.getElementById('productsList');
    const countContainer = document.getElementById('productsCount');
    
    if (countContainer) {
        countContainer.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;
    }
    
    if (products.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);"><p>No products found</p></div>';
        return;
    }
    
    let html = `
        <div style="background: white; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-light);">
            <table class="data-table" style="width: 100%; margin: 0;">
                <thead>
                    <tr>
                        <th>SKU</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Cost Price</th>
                        <th>Selling Price</th>
                        <th>Min Stock</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    products.forEach(product => {
        const costPrice = product.costPrice ? formatCurrency(product.costPrice) : '-';
        const sellingPrice = product.sellingPrice ? formatCurrency(product.sellingPrice) : '-';
        
        html += `
            <tr>
                <td><strong>${product.sku}</strong></td>
                <td>${product.name}</td>
                <td><span class="status-badge draft">${product.category}</span></td>
                <td>${product.unitOfMeasure}</td>
                <td>${costPrice}</td>
                <td>${sellingPrice}</td>
                <td>${product.minStockLevel || 0}</td>
                <td>
                    <button onclick="viewProduct('${product._id}')" class="btn btn-sm" style="background: var(--zoho-blue); color: white; padding: 6px 12px; font-size: 12px; border-radius: 4px;">View</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Product View Functions
let currentViewProduct = null;
let currentProductStockLevels = [];

async function viewProduct(productId) {
    try {
        // Try to load from API
        const data = await apiCall(`/products/${productId}`);
        currentViewProduct = data.data.product;
        currentProductStockLevels = data.data.stockLevels || [];
        
        // If no stock levels, generate demo data
        if (currentProductStockLevels.length === 0) {
            currentProductStockLevels = generateProductDemoStock(currentViewProduct);
        }
        
        displayProductDetails(currentViewProduct, currentProductStockLevels);
    } catch (error) {
        console.error('Error loading product:', error);
        // Use demo data from allProducts array
        const product = allProducts.find(p => p._id === productId);
        if (product) {
            currentViewProduct = product;
            currentProductStockLevels = generateProductDemoStock(product);
            displayProductDetails(product, currentProductStockLevels);
        } else {
            alert('Product not found');
            return;
        }
    }
    
    document.getElementById('productViewModal').style.display = 'block';
}

function generateProductDemoStock(product) {
    // Generate realistic demo stock data based on product
    const warehouses = [
        { name: 'Main Warehouse', code: 'WH001' },
        { name: 'Secondary Warehouse', code: 'WH002' },
        { name: 'Production Floor', code: 'PF001' }
    ];
    
    const stockLevels = [];
    const numWarehouses = Math.floor(Math.random() * 2) + 1; // 1-2 warehouses
    
    for (let i = 0; i < numWarehouses; i++) {
        const warehouse = warehouses[i];
        const baseQuantity = product.minStockLevel || 10;
        const quantity = Math.floor(Math.random() * (baseQuantity * 5)) + baseQuantity;
        const rack = Math.floor(Math.random() * 10) + 1;
        const shelf = Math.floor(Math.random() * 5) + 1;
        
        stockLevels.push({
            warehouse: warehouse,
            quantity: quantity,
            location: `Rack-${rack}-Shelf-${shelf}`,
            reservedQuantity: Math.floor(quantity * 0.1),
            lastUpdated: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
        });
    }
    
    return stockLevels;
}

function displayProductDetails(product, stockLevels) {
    const container = document.getElementById('productViewContent');
    
    // Calculate total stock across all warehouses
    const totalStock = stockLevels.reduce((sum, stock) => sum + (stock.quantity || 0), 0);
    const totalReserved = stockLevels.reduce((sum, stock) => sum + (stock.reservedQuantity || 0), 0);
    const totalAvailable = totalStock - totalReserved;
    
    // Calculate stock value
    const totalStockValue = totalStock * (product.costPrice || 0);
    const potentialRevenue = totalStock * (product.sellingPrice || 0);
    const profitMargin = product.sellingPrice && product.costPrice ? 
        ((product.sellingPrice - product.costPrice) / product.costPrice * 100).toFixed(1) : 0;
    
    // Stock status
    const stockStatus = totalAvailable <= (product.minStockLevel || 0) ? 'low' : 
                       totalAvailable <= (product.minStockLevel || 0) * 1.5 ? 'warning' : 'normal';
    
    const html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
            <!-- Left Column -->
            <div>
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
                    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">SKU</div>
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 12px;">${product.sku}</div>
                    <div style="font-size: 18px; font-weight: 600;">${product.name}</div>
                </div>
                
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 16px 0; color: var(--text-dark); font-size: 16px;">Basic Information</h3>
                    <div style="display: grid; gap: 12px;">
                        <div>
                            <strong style="color: var(--text-light); font-size: 12px; display: block; margin-bottom: 4px;">Category</strong>
                            <span class="status-badge draft" style="font-size: 13px;">${product.category}</span>
                        </div>
                        <div>
                            <strong style="color: var(--text-light); font-size: 12px; display: block; margin-bottom: 4px;">Unit of Measure</strong>
                            <div style="font-size: 14px; font-weight: 500;">${product.unitOfMeasure}</div>
                        </div>
                        <div>
                            <strong style="color: var(--text-light); font-size: 12px; display: block; margin-bottom: 4px;">Status</strong>
                            <span class="status-badge ${product.isActive !== false ? 'completed' : 'cancelled'}" style="font-size: 13px;">
                                ${product.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
                    <h3 style="margin: 0 0 16px 0; color: var(--text-dark); font-size: 16px;">Stock Levels</h3>
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="color: var(--text-light); font-size: 13px;">Min Stock Level</span>
                            <strong style="font-size: 14px;">${product.minStockLevel || 0}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="color: var(--text-light); font-size: 13px;">Max Stock Level</span>
                            <strong style="font-size: 14px;">${product.maxStockLevel || 'Not Set'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                            <span style="color: var(--text-light); font-size: 13px;">Current Stock Status</span>
                            <span class="status-badge ${stockStatus}" style="font-size: 13px;">
                                ${stockStatus === 'low' ? '⚠️ Low Stock' : stockStatus === 'warning' ? '⚠️ Warning' : '✓ Normal'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Right Column -->
            <div>
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 16px 0; color: var(--text-dark); font-size: 16px;">Pricing Information</h3>
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #ef4444;">
                            <div>
                                <div style="color: var(--text-light); font-size: 12px; margin-bottom: 4px;">Cost Price</div>
                                <div style="font-size: 20px; font-weight: 700; color: #ef4444;">
                                    ${product.costPrice ? formatCurrency(product.costPrice) : 'Not Set'}
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">
                            <div>
                                <div style="color: var(--text-light); font-size: 12px; margin-bottom: 4px;">Selling Price</div>
                                <div style="font-size: 20px; font-weight: 700; color: #10b981;">
                                    ${product.sellingPrice ? formatCurrency(product.sellingPrice) : 'Not Set'}
                                </div>
                            </div>
                        </div>
                        ${product.sellingPrice && product.costPrice ? `
                            <div style="padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #3b82f6;">
                                <div style="color: var(--text-light); font-size: 12px; margin-bottom: 4px;">Profit Margin</div>
                                <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">
                                    ${profitMargin}%
                                </div>
                                <div style="font-size: 11px; color: var(--text-light); margin-top: 4px;">
                                    Profit per unit: ${formatCurrency(product.sellingPrice - product.costPrice)}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 16px 0; color: var(--text-dark); font-size: 16px;">Stock Summary</h3>
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 10px; background: white; border-radius: 6px;">
                            <span style="color: var(--text-light); font-size: 13px;">Total Stock</span>
                            <strong style="font-size: 16px; color: #3b82f6;">${totalStock} ${product.unitOfMeasure}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px; background: white; border-radius: 6px;">
                            <span style="color: var(--text-light); font-size: 13px;">Reserved</span>
                            <strong style="font-size: 16px; color: #f59e0b;">${totalReserved} ${product.unitOfMeasure}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">
                            <span style="color: var(--text-light); font-size: 13px;">Available</span>
                            <strong style="font-size: 18px; font-weight: 700; color: #10b981;">${totalAvailable} ${product.unitOfMeasure}</strong>
                        </div>
                        ${product.costPrice ? `
                            <div style="padding: 10px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 6px; color: white;">
                                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px;">Total Stock Value</div>
                                <div style="font-size: 20px; font-weight: 700;">${formatCurrency(totalStockValue)}</div>
                                ${product.sellingPrice ? `
                                    <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">Potential Revenue: ${formatCurrency(potentialRevenue)}</div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Stock by Warehouse -->
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 16px 0; color: var(--text-dark); font-size: 16px;">📦 Stock by Warehouse</h3>
            ${stockLevels.length > 0 ? `
                <div style="display: grid; gap: 12px;">
                    ${stockLevels.map(stock => {
                        const available = (stock.quantity || 0) - (stock.reservedQuantity || 0);
                        const stockPercent = product.maxStockLevel ? 
                            ((stock.quantity / product.maxStockLevel) * 100).toFixed(0) : 0;
                        return `
                            <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">
                                            ${stock.warehouse?.name || 'Unknown Warehouse'}
                                        </div>
                                        <div style="font-size: 12px; color: var(--text-light);">
                                            ${stock.warehouse?.code || 'N/A'}
                                            ${stock.location ? ` • 📍 ${stock.location}` : ''}
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 20px; font-weight: 700; color: #3b82f6;">
                                            ${stock.quantity || 0}
                                        </div>
                                        <div style="font-size: 11px; color: var(--text-light);">${product.unitOfMeasure}</div>
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                                    <div>
                                        <div style="font-size: 11px; color: var(--text-light);">Available</div>
                                        <div style="font-size: 14px; font-weight: 600; color: #10b981;">${available}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 11px; color: var(--text-light);">Reserved</div>
                                        <div style="font-size: 14px; font-weight: 600; color: #f59e0b;">${stock.reservedQuantity || 0}</div>
                                    </div>
                                </div>
                                ${product.maxStockLevel && stock.quantity ? `
                                    <div style="margin-top: 8px;">
                                        <div style="background: #e5e7eb; height: 6px; border-radius: 3px; overflow: hidden;">
                                            <div style="background: ${stockPercent > 80 ? '#ef4444' : stockPercent > 50 ? '#f59e0b' : '#10b981'}; height: 100%; width: ${Math.min(stockPercent, 100)}%; transition: width 0.3s;"></div>
                                        </div>
                                        <div style="font-size: 11px; color: var(--text-light); margin-top: 4px;">
                                            ${stockPercent}% of max stock level
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : `
                <p style="color: var(--text-light); text-align: center; padding: 20px;">No stock information available</p>
            `}
        </div>
        
        ${product.description ? `
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
                <h3 style="margin: 0 0 12px 0; color: var(--text-dark); font-size: 16px;">📝 Description</h3>
                <p style="margin: 0; color: var(--text-dark); line-height: 1.6;">${product.description}</p>
            </div>
        ` : ''}
        
        <!-- Transaction History -->
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <h3 style="margin: 0 0 16px 0; color: var(--text-dark); font-size: 16px;">📊 Recent Activity</h3>
            <div style="background: white; padding: 12px; border-radius: 6px; font-size: 13px; color: var(--text-light);">
                <p style="margin: 0;">View transaction history in the Move History page</p>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function closeProductViewModal() {
    document.getElementById('productViewModal').style.display = 'none';
    currentViewProduct = null;
    currentProductStockLevels = [];
}

function printProductDetails() {
    if (!currentViewProduct) return;
    
    const printContent = document.getElementById('productViewContent').innerHTML;
    const printWindow = window.open('', '_blank');
    
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Product Details - ${currentViewProduct.name}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: Arial, sans-serif;
                    padding: 40px;
                    color: #1f2937;
                    background: white;
                }
                .header {
                    border-bottom: 3px solid #3b82f6;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 {
                    font-size: 28px;
                    color: #1f2937;
                    margin-bottom: 8px;
                }
                .header .sku {
                    font-size: 18px;
                    color: #6b7280;
                    font-weight: 600;
                }
                .section {
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                }
                .section h2 {
                    font-size: 18px;
                    color: #1f2937;
                    margin-bottom: 16px;
                    border-bottom: 2px solid #e5e7eb;
                    padding-bottom: 8px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .info-item {
                    padding: 12px;
                    background: #f9fafb;
                    border-radius: 6px;
                }
                .info-label {
                    font-size: 12px;
                    color: #6b7280;
                    margin-bottom: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .info-value {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1f2937;
                }
                .price-box {
                    padding: 16px;
                    background: #f9fafb;
                    border-radius: 8px;
                    border-left: 4px solid #3b82f6;
                    margin-bottom: 12px;
                }
                .price-label {
                    font-size: 12px;
                    color: #6b7280;
                    margin-bottom: 6px;
                }
                .price-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1f2937;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 12px;
                }
                th, td {
                    padding: 12px;
                    text-align: left;
                    border-bottom: 1px solid #e5e7eb;
                }
                th {
                    background: #f9fafb;
                    font-weight: 600;
                    color: #1f2937;
                    font-size: 12px;
                    text-transform: uppercase;
                }
                .badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge-primary {
                    background: #dbeafe;
                    color: #1e40af;
                }
                @media print {
                    body {
                        padding: 20px;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${currentViewProduct.name}</h1>
                <div class="sku">SKU: ${currentViewProduct.sku}</div>
            </div>
            
            <div class="section">
                <h2>Basic Information</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Category</div>
                        <div class="info-value">${currentViewProduct.category}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Unit of Measure</div>
                        <div class="info-value">${currentViewProduct.unitOfMeasure}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Min Stock Level</div>
                        <div class="info-value">${currentViewProduct.minStockLevel || 0}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Max Stock Level</div>
                        <div class="info-value">${currentViewProduct.maxStockLevel || 'Not Set'}</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>Pricing Information</h2>
                <div class="price-box">
                    <div class="price-label">Cost Price</div>
                    <div class="price-value">${currentViewProduct.costPrice ? formatCurrency(currentViewProduct.costPrice) : 'Not Set'}</div>
                </div>
                <div class="price-box">
                    <div class="price-label">Selling Price</div>
                    <div class="price-value">${currentViewProduct.sellingPrice ? formatCurrency(currentViewProduct.sellingPrice) : 'Not Set'}</div>
                </div>
                ${currentViewProduct.sellingPrice && currentViewProduct.costPrice ? `
                    <div class="price-box">
                        <div class="price-label">Profit Margin</div>
                        <div class="price-value">${((currentViewProduct.sellingPrice - currentViewProduct.costPrice) / currentViewProduct.costPrice * 100).toFixed(1)}%</div>
                    </div>
                ` : ''}
            </div>
            
            <div class="section">
                <h2>Stock Information</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Warehouse</th>
                            <th>Code</th>
                            <th>Quantity</th>
                            <th>Available</th>
                            <th>Reserved</th>
                            <th>Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentProductStockLevels.map(stock => {
                            const available = (stock.quantity || 0) - (stock.reservedQuantity || 0);
                            return `
                                <tr>
                                    <td>${stock.warehouse?.name || 'Unknown'}</td>
                                    <td>${stock.warehouse?.code || 'N/A'}</td>
                                    <td><strong>${stock.quantity || 0}</strong></td>
                                    <td>${available}</td>
                                    <td>${stock.reservedQuantity || 0}</td>
                                    <td>${stock.location || 'N/A'}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${currentProductStockLevels.length === 0 ? `
                            <tr>
                                <td colspan="6" style="text-align: center; color: #6b7280;">No stock information available</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            
            ${currentViewProduct.description ? `
                <div class="section">
                    <h2>Description</h2>
                    <p style="line-height: 1.6; color: #1f2937;">${currentViewProduct.description}</p>
                </div>
            ` : ''}
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
                <p>Generated on ${new Date().toLocaleString()}</p>
                <p>StockMaster Inventory Management System</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Warehouses Functions
async function loadWarehouses() {
    try {
        const data = await apiCall('/warehouses');
        const warehouses = data.data || [];
        displayWarehouses(warehouses);
    } catch (error) {
        console.error('Error loading warehouses:', error);
        document.getElementById('warehousesList').innerHTML = 
            '<p class="loading">Error loading warehouses</p>';
    }
}

function displayWarehouses(warehouses) {
    const container = document.getElementById('warehousesList');
    const countContainer = document.getElementById('warehousesCount');
    
    if (countContainer) {
        countContainer.textContent = `${warehouses.length} warehouse${warehouses.length !== 1 ? 's' : ''}`;
    }
    
    if (warehouses.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);"><p>No warehouses found</p></div>';
        return;
    }
    
    let html = `
        <div style="background: white; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-light);">
            <table class="data-table" style="width: 100%; margin: 0;">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>City</th>
                        <th>State</th>
                        <th>Address</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    warehouses.forEach(warehouse => {
        const address = warehouse.address ? 
            `${warehouse.address.street || ''} ${warehouse.address.city || ''} ${warehouse.address.state || ''} ${warehouse.address.zipCode || ''}`.trim() : 
            'N/A';
        
        html += `
            <tr>
                <td><strong>${warehouse.code}</strong></td>
                <td>${warehouse.name}</td>
                <td>${warehouse.address?.city || 'N/A'}</td>
                <td>${warehouse.address?.state || 'N/A'}</td>
                <td style="color: var(--text-light); font-size: 13px;">${address}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Filter warehouses function
function filterWarehouses() {
    const searchTerm = document.getElementById('warehouseSearch').value.toLowerCase();
    const table = document.querySelector('#warehousesList table tbody');
    if (!table) return;
    
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Receipts Functions
async function loadReceipts() {
    try {
        const data = await apiCall('/transactions?type=receipt');
        const receipts = data.data || [];
        displayTransactions(receipts, 'receiptsList');
    } catch (error) {
        console.error('Error loading receipts:', error);
        document.getElementById('receiptsList').innerHTML = 
            '<p class="loading">Error loading receipts</p>';
    }
}

// Deliveries Functions
async function loadDeliveries() {
    try {
        const data = await apiCall('/transactions?type=delivery');
        const deliveries = data.data || [];
        displayTransactions(deliveries, 'deliveriesList');
    } catch (error) {
        console.error('Error loading deliveries:', error);
        document.getElementById('deliveriesList').innerHTML = 
            '<p class="loading">Error loading deliveries</p>';
    }
}

// Transfers Functions
async function loadTransfers() {
    try {
        const data = await apiCall('/transactions?type=transfer');
        const transfers = data.data || [];
        displayTransactions(transfers, 'transfersList');
    } catch (error) {
        console.error('Error loading transfers:', error);
        document.getElementById('transfersList').innerHTML = 
            '<p class="loading">Error loading transfers</p>';
    }
}

// Adjustments Functions
async function loadAdjustments() {
    try {
        const data = await apiCall('/transactions?type=adjustment');
        const adjustments = data.data || [];
        displayTransactions(adjustments, 'adjustmentsList');
    } catch (error) {
        console.error('Error loading adjustments:', error);
        document.getElementById('adjustmentsList').innerHTML = 
            '<p class="loading">Error loading adjustments</p>';
    }
}

function displayTransactions(transactions, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    
    if (transactions.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);"><p>No transactions found</p></div>';
        return;
    }
    
    // Determine if this is receipts page to show View button
    const isReceiptsPage = containerId === 'receiptsList';
    
    let html = `
        <div style="background: white; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-light);">
            <table class="data-table" style="width: 100%; margin: 0;">
                <thead>
                    <tr>
                        <th>Reference</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Items</th>
                        ${isReceiptsPage ? '<th>Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody>
    `;
    
    transactions.forEach(txn => {
        const date = new Date(txn.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const itemCount = txn.items?.length || 0;
        const type = (txn.type || '').toUpperCase();
        const status = (txn.status || '').toUpperCase();
        
        // Map status to CSS classes
        let statusClass = 'draft';
        if (status === 'COMPLETED') statusClass = 'completed';
        else if (status === 'READY') statusClass = 'ready';
        else if (status === 'WAITING') statusClass = 'draft';
        else if (status === 'CANCELLED') statusClass = 'cancelled';
        
        html += `
            <tr>
                <td><strong>${txn.reference || 'N/A'}</strong></td>
                <td>${type}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>${date}</td>
                <td>${itemCount} item(s)</td>
                ${isReceiptsPage ? `
                    <td>
                        <button onclick="viewReceipt('${txn._id}')" class="btn btn-sm" style="background: var(--zoho-blue); color: white; padding: 6px 12px; font-size: 12px; border-radius: 4px; margin-right: 4px;">View</button>
                    </td>
                ` : ''}
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Receipt View Functions
let currentViewReceipt = null;

async function viewReceipt(receiptId) {
    try {
        const data = await apiCall(`/transactions/${receiptId}`);
        currentViewReceipt = data.data;
        displayReceiptDetails(currentViewReceipt);
        document.getElementById('receiptViewModal').style.display = 'block';
    } catch (error) {
        console.error('Error loading receipt:', error);
        alert('Error loading receipt details. Please try again.');
    }
}

function displayReceiptDetails(receipt) {
    const container = document.getElementById('receiptViewContent');
    
    const date = new Date(receipt.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const status = (receipt.status || '').toUpperCase();
    let statusClass = 'draft';
    if (status === 'COMPLETED') statusClass = 'completed';
    else if (status === 'READY') statusClass = 'ready';
    else if (status === 'WAITING') statusClass = 'draft';
    else if (status === 'CANCELLED') statusClass = 'cancelled';
    
    // Calculate totals
    let totalAmount = 0;
    const items = receipt.items || [];
    items.forEach(item => {
        const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
        totalAmount += itemTotal;
    });
    
    const html = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div>
                    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Reference</div>
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">${receipt.reference || 'N/A'}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${(receipt.type || '').toUpperCase()}</div>
                </div>
                <div style="text-align: right;">
                    <span class="status-badge ${statusClass}" style="background: rgba(255,255,255,0.2); color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                        ${status}
                    </span>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2);">
                <div>
                    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Date</div>
                    <div style="font-size: 14px; font-weight: 600;">${date}</div>
                </div>
                <div>
                    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Total Items</div>
                    <div style="font-size: 14px; font-weight: 600;">${items.length} item(s)</div>
                </div>
            </div>
        </div>
        
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 16px 0; color: var(--text-dark); font-size: 16px;">Transaction Details</h3>
            <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: var(--text-light); font-size: 13px;">Supplier/Customer</span>
                    <strong style="font-size: 14px;">${receipt.supplier || receipt.customer || 'N/A'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: var(--text-light); font-size: 13px;">Responsible</span>
                    <strong style="font-size: 14px;">${receipt.responsible || 'N/A'}</strong>
                </div>
                ${receipt.scheduleDate ? `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                        <span style="color: var(--text-light); font-size: 13px;">Schedule Date</span>
                        <strong style="font-size: 14px;">${new Date(receipt.scheduleDate).toLocaleDateString('en-GB')}</strong>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div style="background: white; border: 1px solid var(--border-light); border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
            <h3 style="margin: 0; padding: 16px; background: #f9fafb; border-bottom: 1px solid var(--border-light); font-size: 16px; color: var(--text-dark);">Items</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f9fafb;">
                        <th style="padding: 12px; text-align: left; font-size: 12px; color: var(--text-light); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid var(--border-light);">Product</th>
                        <th style="padding: 12px; text-align: right; font-size: 12px; color: var(--text-light); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid var(--border-light);">Quantity</th>
                        <th style="padding: 12px; text-align: right; font-size: 12px; color: var(--text-light); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid var(--border-light);">Unit Price</th>
                        <th style="padding: 12px; text-align: right; font-size: 12px; color: var(--text-light); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid var(--border-light);">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
                        return `
                            <tr style="border-bottom: 1px solid var(--border-light);">
                                <td style="padding: 12px; font-size: 14px;">${item.productName || item.product?.name || 'N/A'}</td>
                                <td style="padding: 12px; text-align: right; font-size: 14px;">${item.quantity || 0}</td>
                                <td style="padding: 12px; text-align: right; font-size: 14px;">${formatCurrency(item.unitPrice || 0)}</td>
                                <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600;">${formatCurrency(itemTotal)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #f9fafb; border-top: 2px solid var(--border-color);">
                        <td colspan="3" style="padding: 16px; text-align: right; font-size: 14px; font-weight: 600; color: var(--text-dark);">Total Amount:</td>
                        <td style="padding: 16px; text-align: right; font-size: 18px; font-weight: 700; color: var(--zoho-blue);">${formatCurrency(totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

function closeReceiptViewModal() {
    document.getElementById('receiptViewModal').style.display = 'none';
    currentViewReceipt = null;
}

function printReceiptView() {
    if (!currentViewReceipt) {
        alert('No receipt to print');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    const receipt = currentViewReceipt;
    
    const date = new Date(receipt.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Calculate totals
    let totalAmount = 0;
    const items = receipt.items || [];
    items.forEach(item => {
        const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
        totalAmount += itemTotal;
    });
    
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt ${receipt.reference}</title>
            <style>
                @media print {
                    @page { margin: 20mm; }
                }
                body {
                    font-family: Arial, sans-serif;
                    padding: 40px;
                    color: #1f2937;
                    background: white;
                }
                .header {
                    border-bottom: 3px solid #3b82f6;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                    text-align: center;
                }
                .header h1 {
                    font-size: 28px;
                    color: #1f2937;
                    margin-bottom: 8px;
                }
                .header .reference {
                    font-size: 18px;
                    color: #6b7280;
                    font-weight: 600;
                }
                .details {
                    margin-bottom: 30px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                .detail-item {
                    padding: 12px;
                    background: #f9fafb;
                    border-radius: 6px;
                }
                .detail-label {
                    font-size: 12px;
                    color: #6b7280;
                    margin-bottom: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .detail-value {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1f2937;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    padding: 12px;
                    text-align: left;
                    border-bottom: 1px solid #e5e7eb;
                }
                th {
                    background: #f9fafb;
                    font-weight: 600;
                    color: #1f2937;
                    font-size: 12px;
                    text-transform: uppercase;
                }
                tfoot td {
                    background: #f9fafb;
                    font-weight: 700;
                    border-top: 2px solid #1f2937;
                }
                .total-row {
                    font-size: 18px;
                    color: #3b82f6;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 2px solid #e5e7eb;
                    text-align: center;
                    color: #6b7280;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${(receipt.type || '').toUpperCase()}</h1>
                <div class="reference">Reference: ${receipt.reference || 'N/A'}</div>
                <div style="margin-top: 8px; font-size: 14px; color: #6b7280;">Date: ${date}</div>
            </div>
            
            <div class="details">
                <div class="detail-item">
                    <div class="detail-label">Supplier/Customer</div>
                    <div class="detail-value">${receipt.supplier || receipt.customer || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Responsible</div>
                    <div class="detail-value">${receipt.responsible || 'N/A'}</div>
                </div>
                ${receipt.scheduleDate ? `
                    <div class="detail-item">
                        <div class="detail-label">Schedule Date</div>
                        <div class="detail-value">${new Date(receipt.scheduleDate).toLocaleDateString('en-GB')}</div>
                    </div>
                ` : ''}
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${(receipt.status || '').toUpperCase()}</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th style="text-align: right;">Quantity</th>
                        <th style="text-align: right;">Unit Price</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
                        return `
                            <tr>
                                <td>${item.productName || item.product?.name || 'N/A'}</td>
                                <td style="text-align: right;">${item.quantity || 0}</td>
                                <td style="text-align: right;">${formatCurrency(item.unitPrice || 0)}</td>
                                <td style="text-align: right;">${formatCurrency(itemTotal)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="text-align: right; font-weight: 600;">Total Amount:</td>
                        <td style="text-align: right;" class="total-row">${formatCurrency(totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div class="footer">
                <p>Generated on ${new Date().toLocaleString()}</p>
                <p>StockMaster Inventory Management System</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// Placeholder functions for add buttons
function showAddProduct() {
    // Open a modal or navigate to add product page
    alert('Add Product form coming soon!\n\nFor now, you can add products via the API: POST /api/products\nRequired fields: name, sku, category, unitOfMeasure');
}

function showAddWarehouse() {
    alert('Add Warehouse form coming soon!\n\nFor now, you can add warehouses via the API: POST /api/warehouses\nRequired fields: name, code, address');
}

let receiptItems = [];
let cameraStream = null;

// Load Tesseract.js from CDN (add this in index.html head or load dynamically)
async function loadTesseract() {
    if (typeof Tesseract === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js';
        document.head.appendChild(script);
        return new Promise((resolve) => {
            script.onload = resolve;
        });
    }
}

// Update showAddReceipt to handle different transaction types
let currentReceiptType = 'receipt';
let currentReceiptId = null;
let receiptStatus = 'draft';

async function showAddReceipt(type = 'receipt') {
    currentReceiptType = type;
    currentReceiptId = null;
    receiptStatus = 'draft';
    
    await loadTesseract();
    document.getElementById('receiptModal').style.display = 'block';
    
    // Update modal title based on type
    const titles = {
        'receipt': '📥 Create New Receipt',
        'delivery': '📤 Create New Delivery',
        'transfer': '🔄 Create New Transfer',
        'adjustment': '⚖️ Create Stock Adjustment'
    };
    document.getElementById('receiptModalTitle').textContent = titles[type] || titles['receipt'];
    
    receiptItems = [];
    loadWarehousesForReceipt();
    renderReceiptItems();
    
    // Auto-fill responsible with current user
    if (currentUser && currentUser.name) {
        document.getElementById('receiptResponsible').value = currentUser.name;
    }
    
    // Generate reference
    const prefix = type === 'receipt' ? 'WH/IN' : type === 'delivery' ? 'WH/OUT' : type === 'transfer' ? 'WH/TRF' : 'WH/ADJ';
    const ref = `${prefix}/${String(Date.now()).slice(-6)}`;
    document.getElementById('receiptReference').textContent = ref;
    
    // Update validate button
    updateValidateButton();
}

// Update Validate Button based on status
function updateValidateButton() {
    const btn = document.getElementById('validateBtn');
    const statusSpan = document.getElementById('receiptStatus');
    
    if (receiptStatus === 'draft') {
        btn.textContent = 'To DO';
        btn.style.background = '#10b981';
        statusSpan.textContent = 'Draft';
        statusSpan.style.background = '#f3f4f6';
        statusSpan.style.color = '#6b7280';
    } else if (receiptStatus === 'ready') {
        btn.textContent = 'Validate';
        btn.style.background = '#3b82f6';
        statusSpan.textContent = 'Ready';
        statusSpan.style.background = '#dbeafe';
        statusSpan.style.color = '#1e40af';
    } else {
        btn.textContent = 'Done';
        btn.style.background = '#10b981';
        statusSpan.textContent = 'Done';
        statusSpan.style.background = '#d1fae5';
        statusSpan.style.color = '#065f46';
    }
}

// Validate Receipt
function validateReceipt() {
    if (receiptStatus === 'draft') {
        // Move to Ready
        receiptStatus = 'ready';
        updateValidateButton();
        alert('Receipt moved to Ready status');
    } else if (receiptStatus === 'ready') {
        // Move to Done
        receiptStatus = 'completed';
        updateValidateButton();
        // Auto-submit if all fields are valid
        if (validateReceiptForm()) {
            submitReceipt(new Event('submit'));
        }
    }
}

// Validate Receipt Form
function validateReceiptForm() {
    const warehouse = document.getElementById('receiptWarehouse').value;
    const supplier = document.getElementById('receiptSupplier').value;
    
    if (!warehouse) {
        alert('Please select a warehouse');
        return false;
    }
    
    if (!supplier) {
        alert('Please enter supplier/customer name');
        return false;
    }
    
    if (receiptItems.length === 0) {
        alert('Please add at least one item');
        return false;
    }
    
    const invalidItems = receiptItems.filter(item => !item.product);
    if (invalidItems.length > 0) {
        alert(`Please select products for all items. ${invalidItems.length} item(s) missing product selection.`);
        return false;
    }
    
    return true;
}

// Save Receipt as Draft
async function saveReceiptDraft() {
    if (!validateReceiptForm()) return;
    
    const warehouse = document.getElementById('receiptWarehouse').value;
    const supplier = document.getElementById('receiptSupplier').value;
    const notes = document.getElementById('receiptNotes').value;
    const scheduleDate = document.getElementById('receiptScheduleDate').value;
    const responsible = document.getElementById('receiptResponsible').value;
    
    const items = receiptItems.map(item => ({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        location: item.location || ''
    }));

    try {
        const endpoint = currentReceiptType === 'receipt' ? '/transactions/receipt' :
                        currentReceiptType === 'delivery' ? '/transactions/delivery' :
                        currentReceiptType === 'transfer' ? '/transactions/transfer' : '/transactions/adjustment';
        
        const payload = {
            toWarehouse: currentReceiptType === 'receipt' ? warehouse : undefined,
            fromWarehouse: currentReceiptType !== 'receipt' ? warehouse : undefined,
            toWarehouse: currentReceiptType === 'transfer' ? document.getElementById('receiptToWarehouse')?.value : undefined,
            supplier: currentReceiptType === 'receipt' ? supplier : undefined,
            customer: currentReceiptType === 'delivery' ? supplier : undefined,
            items,
            notes: notes || `Draft saved - ${responsible} - ${scheduleDate || 'No date'}`,
            status: 'draft'
        };

        const data = await apiCall(endpoint, 'POST', payload);
        currentReceiptId = data.data._id;
        
        alert('Draft saved successfully!');
        loadReceipts();
    } catch (error) {
        console.error('Error saving draft:', error);
        alert('Failed to save draft: ' + (error.message || 'Unknown error'));
    }
}

// Print Receipt
function printReceipt() {
    const printWindow = window.open('', '_blank');
    const receiptData = {
        reference: document.getElementById('receiptReference').textContent,
        type: currentReceiptType,
        supplier: document.getElementById('receiptSupplier').value,
        responsible: document.getElementById('receiptResponsible').value,
        scheduleDate: document.getElementById('receiptScheduleDate').value,
        items: receiptItems,
        status: receiptStatus
    };
    
    printWindow.document.write(generateReceiptHTML(receiptData));
    printWindow.document.close();
    printWindow.print();
}

// Download Receipt
function downloadReceipt() {
    const receiptData = {
        reference: document.getElementById('receiptReference').textContent,
        type: currentReceiptType,
        supplier: document.getElementById('receiptSupplier').value,
        responsible: document.getElementById('receiptResponsible').value,
        scheduleDate: document.getElementById('receiptScheduleDate').value,
        items: receiptItems,
        status: receiptStatus
    };
    
    const html = generateReceiptHTML(receiptData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${receiptData.reference}.html`;
    a.click();
    URL.revokeObjectURL(url);
}

// Generate Receipt HTML
function generateReceiptHTML(data) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt ${data.reference}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .details { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${data.type.toUpperCase()} - ${data.reference}</h1>
                <p>Status: ${data.status}</p>
            </div>
            <div class="details">
                <p><strong>Supplier/Customer:</strong> ${data.supplier}</p>
                <p><strong>Responsible:</strong> ${data.responsible}</p>
                <p><strong>Schedule Date:</strong> ${data.scheduleDate || 'N/A'}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(item => `
                        <tr>
                            <td>${item.productName || 'N/A'}</td>
                            <td>${item.quantity}</td>
                            <td>${item.unitPrice || 0}</td>
                            <td>${(item.quantity * (item.unitPrice || 0)).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;
}

// Close Receipt Modal
function closeReceiptModal() {
    document.getElementById('receiptModal').style.display = 'none';
    document.getElementById('receiptForm').reset();
    receiptItems = [];
    document.getElementById('scannedPreview').style.display = 'none';
    document.getElementById('ocrProgress').style.display = 'none';
}

// Load Warehouses for Receipt Form
async function loadWarehousesForReceipt() {
    try {
        const data = await apiCall('/warehouses');
        const warehouses = data.data || [];
        const select = document.getElementById('receiptWarehouse');
        select.innerHTML = '<option value="">Select Warehouse</option>';
        warehouses.forEach(warehouse => {
            const option = document.createElement('option');
            option.value = warehouse._id;
            option.textContent = `${warehouse.name} (${warehouse.code})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading warehouses:', error);
    }
}

// Handle Document Upload
async function handleDocumentUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('scannedImage').src = e.target.result;
        document.getElementById('scannedPreview').style.display = 'block';
    };
    reader.readAsDataURL(file);

    // Process with OCR
    await processDocumentWithOCR(file);
}

// Process Document with OCR (Client-side)
async function processDocumentWithOCR(file) {
    const progressDiv = document.getElementById('ocrProgress');
    const progressBar = document.getElementById('ocrProgressBar');
    
    progressDiv.style.display = 'flex';
    progressBar.style.width = '0%';

    try {
        // Use server-side OCR (recommended for better accuracy)
        const formData = new FormData();
        formData.append('image', file);

        progressBar.style.width = '30%';

        // Fix: Use the correct API_BASE_URL (should be '/api' not full URL)
        const apiUrl = API_BASE_URL.startsWith('http') ? API_BASE_URL : window.location.origin + API_BASE_URL;
        
        const response = await fetch(`${apiUrl}/ocr/process`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
                // Don't set Content-Type - let browser set it with boundary for FormData
            },
            body: formData
        });

        progressBar.style.width = '70%';

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'OCR processing failed');
        }

        const result = await response.json();
        progressBar.style.width = '100%';

        if (result.success && result.data) {
            // Auto-fill form with extracted data
            autoFillReceiptForm(result.data);
        } else {
            throw new Error('No data extracted from document');
        }

        setTimeout(() => {
            progressDiv.style.display = 'none';
        }, 1000);

    } catch (error) {
        console.error('Server OCR Error:', error);
        
        // Fallback to client-side OCR if available
        if (typeof Tesseract !== 'undefined') {
            try {
                progressBar.style.width = '50%';
                
                const { data: { text } } = await Tesseract.recognize(file, 'eng', {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            progressBar.style.width = `${50 + (m.progress * 50)}%`;
                        }
                    }
                });

                // Parse text and extract items
                const items = parseOCRText(text);
                autoFillReceiptForm({ items, text, supplier: 'Extracted from Document' });

                progressBar.style.width = '100%';
                setTimeout(() => {
                    progressDiv.style.display = 'none';
                }, 1000);

            } catch (clientError) {
                console.error('Client OCR Error:', clientError);
                alert('Failed to process document. You can enter items manually or try the demo data.');
                progressDiv.style.display = 'none';
            }
        } else {
            alert('OCR service unavailable. Please enter items manually or try the demo data.');
            progressDiv.style.display = 'none';
        }
    }
}

// Parse OCR Text (Client-side fallback)
function parseOCRText(text) {
    const items = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    for (const line of lines) {
        const numbers = line.match(/\d+(?:\.\d+)?/g);
        if (numbers && numbers.length >= 1) {
            const quantity = parseFloat(numbers[0]);
            if (quantity > 0 && quantity < 10000) {
                const productName = line.replace(/\d+(?:\.\d+)?/g, '').trim();
                if (productName.length > 2) {
                    items.push({
                        productName: productName.substring(0, 100),
                        quantity: Math.round(quantity),
                        unitPrice: numbers.length > 1 ? parseFloat(numbers[1]) : 0,
                        matchedProduct: null
                    });
                }
            }
        }
    }
    
    return items;
}

// Auto-fill Receipt Form
function autoFillReceiptForm(ocrData) {
    // Fill supplier if available
    if (ocrData.supplier && ocrData.supplier !== 'Unknown Supplier') {
        document.getElementById('receiptSupplier').value = ocrData.supplier;
    }

    // Add items from OCR
    if (ocrData.items && ocrData.items.length > 0) {
        receiptItems = ocrData.items.map(item => ({
            product: item.matchedProduct?._id || '',
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice || 0,
            location: '',
            matched: item.matchedProduct ? true : false
        }));
        renderReceiptItems();
        
        if (ocrData.items.some(i => !i.matchedProduct)) {
            alert(`Found ${ocrData.items.length} items. Some products need to be matched manually.`);
        }
    }
}

// Camera Functions
async function startCameraScan() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } // Use back camera on mobile
        });
        cameraStream = stream;
        document.getElementById('cameraVideo').srcObject = stream;
        document.getElementById('cameraModal').style.display = 'block';
    } catch (error) {
        console.error('Camera error:', error);
        alert('Unable to access camera. Please upload an image instead.');
    }
}

function closeCameraModal() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    document.getElementById('cameraModal').style.display = 'none';
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
        closeCameraModal();
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('scannedImage').src = e.target.result;
            document.getElementById('scannedPreview').style.display = 'block';
        };
        reader.readAsDataURL(blob);
        
        // Process with OCR
        await processDocumentWithOCR(blob);
    }, 'image/jpeg', 0.9);
}

// Receipt Item Management
function addReceiptItem() {
    receiptItems.push({
        product: '',
        productName: '',
        quantity: 1,
        unitPrice: 0,
        location: ''
    });
    renderReceiptItems();
}

function removeReceiptItem(index) {
    receiptItems.splice(index, 1);
    renderReceiptItems();
}

async function renderReceiptItems() {
    const container = document.getElementById('receiptItemsList');
    
    if (receiptItems.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">No items added. Use document scanner or add manually.</p>';
        return;
    }

    // Load products for dropdown
    const productsData = await apiCall('/products?limit=1000');
    const products = productsData.data || [];

    let html = '';
    receiptItems.forEach((item, index) => {
        html += `
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid var(--border-light);">
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 12px; align-items: start;">
                    <div>
                        <label style="font-size: 12px; color: var(--text-light); margin-bottom: 4px; display: block;">Product *</label>
                        <select class="receipt-item-product" data-index="${index}" onchange="updateReceiptItem(${index}, 'product', this.value)" required>
                            <option value="">Select or type to search</option>
                            ${products.map(p => `
                                <option value="${p._id}" ${item.product === p._id ? 'selected' : ''}>
                                    ${p.name} (${p.sku})
                                </option>
                            `).join('')}
                        </select>
                        ${item.productName && !item.product ? `
                            <input type="text" class="receipt-item-name" value="${item.productName}" 
                                   placeholder="Product name from scan" style="margin-top: 4px; font-size: 12px; padding: 4px; width: 100%;" readonly>
                        ` : ''}
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-light); margin-bottom: 4px; display: block;">Quantity *</label>
                        <input type="number" class="receipt-item-qty" value="${item.quantity}" min="1" 
                               onchange="updateReceiptItem(${index}, 'quantity', this.value)" required>
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-light); margin-bottom: 4px; display: block;">Unit Price</label>
                        <input type="number" class="receipt-item-price" value="${item.unitPrice}" min="0" step="0.01"
                               onchange="updateReceiptItem(${index}, 'unitPrice', this.value)">
                    </div>
                    <div>
                        <label style="font-size: 12px; color: var(--text-light); margin-bottom: 4px; display: block;">Location</label>
                        <input type="text" class="receipt-item-location" value="${item.location}" 
                               onchange="updateReceiptItem(${index}, 'location', this.value)" placeholder="Rack-1">
                    </div>
                    <div>
                        <button type="button" onclick="removeReceiptItem(${index})" 
                                style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-top: 20px;">
                            ✕
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateReceiptItem(index, field, value) {
    if (field === 'quantity' || field === 'unitPrice') {
        receiptItems[index][field] = parseFloat(value) || 0;
    } else {
        receiptItems[index][field] = value;
    }
}

// Submit Receipt
async function submitReceipt(event) {
    event.preventDefault();
    
    const warehouse = document.getElementById('receiptWarehouse').value;
    const supplier = document.getElementById('receiptSupplier').value;
    const notes = document.getElementById('receiptNotes').value;

    if (!warehouse) {
        alert('Please select a warehouse');
        return;
    }

    if (receiptItems.length === 0) {
        alert('Please add at least one item');
        return;
    }

    // Validate all items have products
    const invalidItems = receiptItems.filter(item => !item.product);
    if (invalidItems.length > 0) {
        alert(`Please select products for all items. ${invalidItems.length} item(s) missing product selection.`);
        return;
    }

    const items = receiptItems.map(item => ({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        location: item.location || ''
    }));

    try {
        const data = await apiCall('/transactions/receipt', 'POST', {
            toWarehouse: warehouse,
            supplier: supplier || undefined,
            items,
            notes: notes || undefined
        });

        alert('Receipt created successfully!');
        closeReceiptModal();
        loadReceipts();
        loadDashboard();
    } catch (error) {
        console.error('Error creating receipt:', error);
        alert('Failed to create receipt: ' + (error.message || 'Unknown error'));
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    if (authToken && currentUser && currentUser.name) {
        // Verify token is still valid by trying to get user info
        apiCall('/auth/me')
            .then(response => {
                if (response.data) {
                    currentUser = response.data;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    showApp();
                } else {
                    showLoginPage();
                }
            })
            .catch(() => {
                // Token invalid, show login
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                authToken = null;
                currentUser = {};
                showLoginPage();
            });
    } else {
        showLoginPage();
    }
});

// Demo mode with sample invoice data
function loadDemoInvoiceData() {
    const progressDiv = document.getElementById('ocrProgress');
    const progressBar = document.getElementById('ocrProgressBar');
    
    progressDiv.style.display = 'flex';
    progressBar.style.width = '0%';
    
    // Simulate processing
    setTimeout(() => progressBar.style.width = '30%', 100);
    setTimeout(() => progressBar.style.width = '60%', 300);
    setTimeout(() => progressBar.style.width = '90%', 500);
    
    // Sample invoice/GRN data for testing
    const demoData = {
        supplier: 'Akash Metals Pvt. Ltd.',
        invoiceNumber: 'INV-2024-001',
        items: [
            {
                productName: 'Steel Rods',
                quantity: 50,
                unitPrice: 50,
                matchedProduct: null
            },
            {
                productName: 'Aluminum Sheets',
                quantity: 25,
                unitPrice: 120,
                matchedProduct: null
            },
            {
                productName: 'Copper Wire',
                quantity: 100,
                unitPrice: 80,
                matchedProduct: null
            }
        ],
        text: 'Sample Invoice Data - Demo Mode'
    };
    
    // Try to match products
    setTimeout(async () => {
        progressBar.style.width = '100%';
        const matchedData = await matchDemoProducts(demoData);
        autoFillReceiptForm(matchedData);
        setTimeout(() => {
            progressDiv.style.display = 'none';
        }, 500);
    }, 700);
}

// Match demo products with database
async function matchDemoProducts(demoData) {
    try {
        const productsData = await apiCall('/products?limit=1000');
        const products = productsData.data || [];
        
        const matchedItems = await Promise.all(
            demoData.items.map(async (item) => {
                // Try to find matching product
                const product = products.find(p => 
                    p.name.toLowerCase().includes(item.productName.toLowerCase().substring(0, 5)) ||
                    item.productName.toLowerCase().includes(p.name.toLowerCase().substring(0, 5)) ||
                    p.sku.toLowerCase().includes(item.productName.toLowerCase().substring(0, 5))
                );
                
                return {
                    ...item,
                    matchedProduct: product ? {
                        _id: product._id,
                        name: product.name,
                        sku: product.sku,
                        unitOfMeasure: product.unitOfMeasure
                    } : null,
                    confidence: product ? 'high' : 'low'
                };
            })
        );
        
        return {
            ...demoData,
            items: matchedItems
        };
    } catch (error) {
        console.error('Error matching demo products:', error);
        return demoData;
    }
}

// QR Code Scanner Variables
let qrScannerInstance = null;
let currentQRMode = null;

// Initialize QR Code Scanner
async function startQRScanner(mode) {
    currentQRMode = mode;
    const scannerDiv = document.getElementById(`qrScanner${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
    
    if (!scannerDiv) {
        alert('QR scanner container not found');
        return;
    }

    if (qrScannerInstance) {
        qrScannerInstance.stop();
    }

    scannerDiv.style.display = 'block';
    scannerDiv.innerHTML = '<div id="qr-reader-' + mode + '" style="width: 100%;"></div>';

    try {
        const html5QrCode = new Html5Qrcode(`qr-reader-${mode}`);
        
        await html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            (decodedText, decodedResult) => {
                handleQRCodeScanned(decodedText, mode);
                html5QrCode.stop();
                scannerDiv.style.display = 'none';
                qrScannerInstance = null;
            },
            (errorMessage) => {
                // Ignore errors
            }
        );
        
        qrScannerInstance = html5QrCode;
    } catch (error) {
        console.error('QR Scanner error:', error);
        alert('Failed to start QR scanner. Please check camera permissions.');
        scannerDiv.style.display = 'none';
    }
}

// Handle QR Code Scanned
function handleQRCodeScanned(qrData, mode) {
    try {
        const data = JSON.parse(qrData);
        
        switch(mode) {
            case 'product':
                fillProductFromQR(data);
                break;
            case 'receipt':
                fillReceiptFromQR(data);
                break;
            case 'delivery':
                fillDeliveryFromQR(data);
                break;
            case 'transfer':
                fillTransferFromQR(data);
                break;
            case 'adjustment':
                fillAdjustmentFromQR(data);
                break;
        }
    } catch (error) {
        // If not JSON, try to parse as product SKU or other format
        if (mode === 'product') {
            document.getElementById('productSku').value = qrData.toUpperCase();
        } else {
            alert('QR Code data: ' + qrData);
        }
    }
}

// Product Functions
function showAddProduct() {
    document.getElementById('productModal').style.display = 'block';
    document.getElementById('productForm').reset();
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    if (qrScannerInstance) {
        qrScannerInstance.stop();
        qrScannerInstance = null;
    }
}

function fillProductFromQR(data) {
    if (data.name) document.getElementById('productName').value = data.name;
    if (data.sku) document.getElementById('productSku').value = data.sku.toUpperCase();
    if (data.category) document.getElementById('productCategory').value = data.category;
    if (data.unitOfMeasure) document.getElementById('productUnit').value = data.unitOfMeasure;
    if (data.costPrice) document.getElementById('productCostPrice').value = data.costPrice;
    if (data.sellingPrice) document.getElementById('productSellingPrice').value = data.sellingPrice;
    if (data.minStockLevel) document.getElementById('productMinStock').value = data.minStockLevel;
    if (data.maxStockLevel) document.getElementById('productMaxStock').value = data.maxStockLevel;
    if (data.description) document.getElementById('productDescription').value = data.description;
}

async function submitProduct(event) {
    event.preventDefault();
    
    const productData = {
        name: document.getElementById('productName').value.trim(),
        sku: document.getElementById('productSku').value.trim().toUpperCase(),
        category: document.getElementById('productCategory').value.trim(),
        unitOfMeasure: document.getElementById('productUnit').value,
        costPrice: parseFloat(document.getElementById('productCostPrice').value) || 0,
        sellingPrice: parseFloat(document.getElementById('productSellingPrice').value) || 0,
        minStockLevel: parseInt(document.getElementById('productMinStock').value) || 0,
        maxStockLevel: parseInt(document.getElementById('productMaxStock').value) || 0,
        description: document.getElementById('productDescription').value.trim()
    };

    try {
        const data = await apiCall('/products', 'POST', productData);
        alert('Product created successfully!');
        closeProductModal();
        loadProducts();
    } catch (error) {
        console.error('Error creating product:', error);
        alert('Failed to create product: ' + (error.message || 'Unknown error'));
    }
}

// Warehouse Functions
function showAddWarehouse() {
    document.getElementById('warehouseModal').style.display = 'block';
    document.getElementById('warehouseForm').reset();
}

function closeWarehouseModal() {
    document.getElementById('warehouseModal').style.display = 'none';
}

async function submitWarehouse(event) {
    event.preventDefault();
    
    const warehouseData = {
        name: document.getElementById('warehouseName').value.trim(),
        code: document.getElementById('warehouseCode').value.trim().toUpperCase(),
        address: {
            street: document.getElementById('warehouseStreet').value.trim(),
            city: document.getElementById('warehouseCity').value.trim(),
            state: document.getElementById('warehouseState').value.trim(),
            zipCode: document.getElementById('warehouseZip').value.trim()
        },
        contactPerson: {
            name: document.getElementById('warehouseContactName').value.trim(),
            phone: document.getElementById('warehouseContactPhone').value.trim(),
            email: document.getElementById('warehouseContactEmail').value.trim()
        },
        capacity: parseInt(document.getElementById('warehouseCapacity').value) || 0
    };

    try {
        const data = await apiCall('/warehouses', 'POST', warehouseData);
        alert('Warehouse created successfully!');
        closeWarehouseModal();
        loadWarehouses();
        loadDashboard();
    } catch (error) {
        console.error('Error creating warehouse:', error);
        alert('Failed to create warehouse: ' + (error.message || 'Unknown error'));
    }
}

// Delivery Functions
function showAddDelivery() {
    // Similar to showAddReceipt but for deliveries
    alert('Delivery form - implement similar to receipt form');
}

// Transfer Functions  
function showAddTransfer() {
    // Similar to showAddReceipt but for transfers
    alert('Transfer form - implement similar to receipt form');
}

// Adjustment Functions
function showAddAdjustment() {
    // Similar to showAddReceipt but for adjustments
    alert('Adjustment form - implement similar to receipt form');
}

// QR Code Fill Functions
function fillReceiptFromQR(data) {
    if (data.supplier) document.getElementById('receiptSupplier').value = data.supplier;
    if (data.items && Array.isArray(data.items)) {
        receiptItems = data.items.map(item => ({
            product: item.productId || '',
            productName: item.productName || '',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
            location: item.location || ''
        }));
        renderReceiptItems();
    }
}

function fillDeliveryFromQR(data) {
    // Similar implementation for delivery
}

function fillTransferFromQR(data) {
    // Similar implementation for transfer
}

function fillAdjustmentFromQR(data) {
    // Similar implementation for adjustment
}

// Filter Deliveries
function filterDeliveries() {
    const searchTerm = document.getElementById('deliverySearch').value.toLowerCase();
    // Implementation for filtering deliveries
    loadDeliveries(searchTerm);
}

// Load Deliveries with Search
async function loadDeliveries(searchTerm = '') {
    try {
        let endpoint = '/transactions?type=delivery';
        if (searchTerm) {
            endpoint += `&search=${encodeURIComponent(searchTerm)}`;
        }
        const data = await apiCall(endpoint);
        const deliveries = data.data || [];
        displayTransactions(deliveries, 'deliveriesList');
    } catch (error) {
        console.error('Error loading deliveries:', error);
        document.getElementById('deliveriesList').innerHTML = 
            '<p class="loading">Error loading deliveries</p>';
    }
}

// Kanban View Functions
let currentView = 'table';
let forecastData = [];
let colorSettings = {
    low: '#ef4444',
    medium: '#f59e0b',
    high: '#10b981',
    normal: '#3b82f6'
};

// Load color settings from localStorage
if (localStorage.getItem('kanbanColors')) {
    try {
        colorSettings = JSON.parse(localStorage.getItem('kanbanColors'));
    } catch (e) {
        console.error('Error loading color settings:', e);
    }
}

function switchView(view) {
    currentView = view;
    const tableBtn = document.getElementById('viewTableBtn');
    const kanbanBtn = document.getElementById('viewKanbanBtn');
    
    if (tableBtn && kanbanBtn) {
        tableBtn.style.background = view === 'table' ? 'var(--zoho-blue)' : 'var(--text-light)';
        kanbanBtn.style.background = view === 'kanban' ? 'var(--zoho-blue)' : 'var(--text-light)';
    }
    
    if (view === 'kanban') {
        displayKanbanView();
    } else {
        // Reload table view
        if (forecastData.length > 0) {
            displayDemandForecasts(forecastData);
        }
    }
}

function displayKanbanView() {
    const container = document.getElementById('aiInsightsView');
    
    if (!forecastData || forecastData.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-light);">
                <p style="font-size: 16px; margin-bottom: 8px;">✨ No forecasts available</p>
                <p style="font-size: 14px;">Load dashboard to see AI insights</p>
            </div>
        `;
        return;
    }
    
    // Group forecasts by urgency
    const urgent = forecastData.filter(f => f.daysUntilShortage <= 7);
    const warning = forecastData.filter(f => f.daysUntilShortage > 7 && f.daysUntilShortage <= 14);
    const normal = forecastData.filter(f => f.daysUntilShortage > 14 && f.daysUntilShortage <= 30);
    const safe = forecastData.filter(f => f.daysUntilShortage > 30);
    
    let html = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; min-height: 400px;">
            <div style="background: ${colorSettings.low}20; border: 2px solid ${colorSettings.low}; border-radius: 8px; padding: 16px;">
                <h3 style="margin: 0 0 12px 0; color: ${colorSettings.low}; font-size: 14px; font-weight: 600;">
                    🔴 URGENT (${urgent.length})
                </h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${urgent.map(f => createKanbanCard(f, colorSettings.low)).join('')}
                </div>
            </div>
            <div style="background: ${colorSettings.medium}20; border: 2px solid ${colorSettings.medium}; border-radius: 8px; padding: 16px;">
                <h3 style="margin: 0 0 12px 0; color: ${colorSettings.medium}; font-size: 14px; font-weight: 600;">
                    🟡 WARNING (${warning.length})
                </h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${warning.map(f => createKanbanCard(f, colorSettings.medium)).join('')}
                </div>
            </div>
            <div style="background: ${colorSettings.normal}20; border: 2px solid ${colorSettings.normal}; border-radius: 8px; padding: 16px;">
                <h3 style="margin: 0 0 12px 0; color: ${colorSettings.normal}; font-size: 14px; font-weight: 600;">
                    🔵 NORMAL (${normal.length})
                </h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${normal.map(f => createKanbanCard(f, colorSettings.normal)).join('')}
                </div>
            </div>
            <div style="background: ${colorSettings.high}20; border: 2px solid ${colorSettings.high}; border-radius: 8px; padding: 16px;">
                <h3 style="margin: 0 0 12px 0; color: ${colorSettings.high}; font-size: 14px; font-weight: 600;">
                    🟢 SAFE (${safe.length})
                </h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${safe.map(f => createKanbanCard(f, colorSettings.high)).join('')}
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function createKanbanCard(forecast, color) {
    return `
        <div style="background: white; border-left: 4px solid ${color}; padding: 12px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;" 
             onclick="placeOrderFromForecast('${forecast.productId}', '${forecast.productName}', ${forecast.suggestedReorderQuantity}, '${forecast.warehouseName}', '${forecast.unitOfMeasure}')">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${forecast.productName}</div>
            <div style="font-size: 11px; color: var(--text-light); margin-bottom: 6px;">${forecast.sku}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                <span style="font-size: 11px; color: var(--text-light);">${forecast.daysUntilShortage} days</span>
                <span style="font-size: 11px; font-weight: 600; color: ${color};">${forecast.suggestedReorderQuantity} ${forecast.unitOfMeasure}</span>
            </div>
        </div>
    `;
}

function showColorSettings() {
    const currentColors = `${colorSettings.low},${colorSettings.medium},${colorSettings.high},${colorSettings.normal}`;
    const colors = prompt(`Enter colors for Kanban columns (Urgent, Warning, Safe, Normal) separated by commas:\n\nCurrent: ${currentColors}\n\nExample: #ef4444,#f59e0b,#10b981,#3b82f6`, currentColors);
    
    if (colors) {
        const colorArray = colors.split(',').map(c => c.trim());
        if (colorArray.length === 4) {
            colorSettings = {
                low: colorArray[0],
                medium: colorArray[1],
                high: colorArray[2],
                normal: colorArray[3]
            };
            localStorage.setItem('kanbanColors', JSON.stringify(colorSettings));
            if (currentView === 'kanban') {
                displayKanbanView();
            }
            alert('Color settings saved!');
        } else {
            alert('Please enter exactly 4 colors separated by commas');
        }
    }
}

function printAIInsights() {
    const printContent = document.getElementById('aiInsightsView').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>AI Insights Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                ${document.querySelector('style')?.innerHTML || ''}
            </style>
        </head>
        <body>
            <h1>AI Insights Report</h1>
            ${printContent}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Move History Functions
function showMoveHistory() {
    showPage('moveHistory');
    loadMoveHistory();
}

async function loadMoveHistory() {
    try {
        // Try to load from API first
        const data = await apiCall('/transactions?limit=100');
        const transactions = data.data || [];
        
        // If no data, use demo data
        if (transactions.length === 0) {
            transactions.push(...generateMoveHistoryDemoData());
        }
        
        displayMoveHistory(transactions);
    } catch (error) {
        console.error('Error loading move history:', error);
        // Use demo data on error
        displayMoveHistory(generateMoveHistoryDemoData());
    }
}

function generateMoveHistoryDemoData() {
    return [
        {
            _id: 'demo1',
            type: 'receipt',
            reference: 'WH/IN/0001',
            status: 'completed',
            toWarehouse: { name: 'Main Warehouse', code: 'WH001' },
            supplier: 'Akash Metals Pvt. Ltd.',
            items: [
                { product: { name: 'Steel Rods', sku: 'STL-ROD-001' }, quantity: 50 }
            ],
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
            _id: 'demo2',
            type: 'delivery',
            reference: 'WH/OUT/0001',
            status: 'completed',
            fromWarehouse: { name: 'Main Warehouse', code: 'WH001' },
            customer: 'Omkar Constructions',
            items: [
                { product: { name: 'Steel Rods', sku: 'STL-ROD-001' }, quantity: 20 }
            ],
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        {
            _id: 'demo3',
            type: 'transfer',
            reference: 'WH/TRF/0001',
            status: 'completed',
            fromWarehouse: { name: 'Main Warehouse', code: 'WH001' },
            toWarehouse: { name: 'Secondary Warehouse', code: 'WH002' },
            items: [
                { product: { name: 'Aluminum Sheets', sku: 'ALM-SHT-002' }, quantity: 15 }
            ],
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        },
        {
            _id: 'demo4',
            type: 'receipt',
            reference: 'WH/IN/0002',
            status: 'completed',
            toWarehouse: { name: 'Secondary Warehouse', code: 'WH002' },
            supplier: 'BrightBuild Industrial Supplies',
            items: [
                { product: { name: 'Copper Wire', sku: 'COP-WIR-003' }, quantity: 100 }
            ],
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        },
        {
            _id: 'demo5',
            type: 'adjustment',
            reference: 'WH/ADJ/0001',
            status: 'completed',
            fromWarehouse: { name: 'Main Warehouse', code: 'WH001' },
            items: [
                { product: { name: 'LED Bulbs', sku: 'ELE-BLB-201' }, quantity: -5 }
            ],
            notes: 'Stock adjustment - damaged items',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
    ];
}

function displayMoveHistory(transactions) {
    const container = document.getElementById('moveHistoryList');
    const filter = document.getElementById('moveHistoryFilter')?.value || 'all';
    const search = document.getElementById('moveHistorySearch')?.value?.toLowerCase() || '';
    
    // Filter transactions
    let filtered = transactions;
    
    if (filter !== 'all') {
        if (filter === 'in') {
            filtered = filtered.filter(t => t.type === 'receipt');
        } else if (filter === 'out') {
            filtered = filtered.filter(t => t.type === 'delivery');
        } else if (filter === 'transfer') {
            filtered = filtered.filter(t => t.type === 'transfer');
        }
    }
    
    if (search) {
        filtered = filtered.filter(t => 
            t.reference?.toLowerCase().includes(search) ||
            t.supplier?.toLowerCase().includes(search) ||
            t.customer?.toLowerCase().includes(search) ||
            t.items?.some(item => item.product?.name?.toLowerCase().includes(search))
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="loading">No movements found</p>';
        return;
    }
    
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Direction</th>
                    <th>From/To</th>
                    <th>Products</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    filtered.forEach(transaction => {
        const date = new Date(transaction.completedAt || transaction.createdAt).toLocaleDateString();
        const typeIcon = transaction.type === 'receipt' ? '📥' : 
                        transaction.type === 'delivery' ? '📤' : 
                        transaction.type === 'transfer' ? '🔄' : '⚖️';
        const direction = transaction.type === 'receipt' ? 'IN' : 
                         transaction.type === 'delivery' ? 'OUT' : 
                         transaction.type === 'transfer' ? 'TRANSFER' : 'ADJUST';
        const fromTo = transaction.type === 'receipt' ? 
                       `To: ${transaction.toWarehouse?.name || 'N/A'}` :
                       transaction.type === 'delivery' ?
                       `From: ${transaction.fromWarehouse?.name || 'N/A'}` :
                       transaction.type === 'transfer' ?
                       `${transaction.fromWarehouse?.name || 'N/A'} → ${transaction.toWarehouse?.name || 'N/A'}` :
                       transaction.fromWarehouse?.name || 'N/A';
        const contact = transaction.supplier || transaction.customer || 'N/A';
        const products = transaction.items?.map(item => 
            `${item.product?.name || 'Unknown'} (${item.quantity})`
        ).join(', ') || 'N/A';
        const statusClass = transaction.status === 'completed' ? 'completed' : 
                           transaction.status === 'ready' ? 'ready' : 'draft';
        
        html += `
            <tr>
                <td>${date}</td>
                <td>${typeIcon} ${transaction.type.toUpperCase()}</td>
                <td><strong>${transaction.reference || 'N/A'}</strong></td>
                <td><span class="status-badge ${statusClass}">${direction}</span></td>
                <td>
                    <div>${fromTo}</div>
                    <div style="font-size: 12px; color: var(--text-light);">${contact}</div>
                </td>
                <td style="font-size: 12px;">${products}</td>
                <td><span class="status-badge ${statusClass}">${transaction.status}</span></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function filterMoveHistory() {
    loadMoveHistory();
}

// Add these functions to public/app.js

// Toggle Password Visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input.nextElementSibling;
    const eyeText = toggle.querySelector('.eye-text');
    
    if (input.type === 'password') {
        input.type = 'text';
        eyeText.textContent = 'Show';
    } else {
        input.type = 'password';
        eyeText.textContent = 'Hide';
    }
}

// Handle Apple Login (Placeholder)
function handleAppleLogin() {
    alert('Apple Sign In integration coming soon!');
}

// Handle Forgot Password
function handleForgotPassword(event) {
    if (event) event.preventDefault();
    const email = prompt('Enter your email address to reset password:');
    if (email) {
        // Call forgot password API
        apiCall('/auth/forgotpassword', 'POST', { email })
            .then(() => {
                alert('Password reset instructions sent to your email!');
            })
            .catch(error => {
                alert('Error: ' + (error.message || 'Failed to send reset email'));
            });
    }
}

// Mobile Menu Functions
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
}

// Add smooth scroll behavior
document.addEventListener('DOMContentLoaded', () => {
    // Add smooth transitions to all pages
    const pages = document.querySelectorAll('.content-page');
    pages.forEach(page => {
        page.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    });
    
    // Add intersection observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all cards and sections
    document.querySelectorAll('.kpi-card, .modern-card, .dashboard-section').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Add this debug function at the top of navigation functions

// Debug: Check if all pages exist
function checkPagesExist() {
    const pages = ['dashboard', 'products', 'warehouses', 'receipts', 'deliveries', 'transfers', 'adjustments', 'moveHistory'];
    pages.forEach(page => {
        const pageElement = document.getElementById(`${page}Page`);
        if (!pageElement) {
            console.error(`Page element ${page}Page not found!`);
        } else {
            console.log(`✓ Page ${page}Page exists`);
        }
    });
}

// Call on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        checkPagesExist();
    }, 1000);
});

