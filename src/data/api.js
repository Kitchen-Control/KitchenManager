// src/data/api.js
// API client theo OpenAPI spec: https://kitchencontrolbe.onrender.com/swagger-ui/index.html
// Base URL qua Vercel rewrites: /api -> backend

const API_BASE_URL = '/api';
import { ROLE_ID } from './constants';

async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = `Lỗi ${response.status}: ${response.statusText}`;
    const status = response.status;
    try {
      const text = await response.text();
      const errorData = text ? JSON.parse(text) : {};
      const msg =
        (errorData && (errorData.message ?? errorData.error ?? errorData.errorDescription ?? errorData.msg)) ||
        '';
      if (msg && String(msg).trim()) {
        errorMessage = String(msg).trim();
      } else {
        const defaults = {
          400: 'Yêu cầu không hợp lệ. Kiểm tra lại thông tin gửi lên.',
          401: 'Tên đăng nhập hoặc mật khẩu không đúng.',
          404: 'Không tìm thấy.',
          500: 'Lỗi máy chủ. Vui lòng thử lại sau.',
        };
        errorMessage = defaults[status] || errorMessage;
      }
    } catch (e) {
      const defaults = {
        400: 'Yêu cầu không hợp lệ. Kiểm tra lại thông tin gửi lên.',
        401: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      };
      errorMessage = defaults[status] || errorMessage;
    }
    throw new Error(errorMessage);
  }
  // Fix lỗi "Unexpected end of JSON input" khi body rỗng
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// --- Mappers: API camelCase -> app snake_case ---

function mapProduct(p) {
  if (!p) return null;
  return {
    product_id: p.productId,
    product_name: p.productName,
    product_type: p.productType,
    unit: p.unit,
    price: p.price,
    shelf_life_days: p.shelfLifeDays,
    available_stock: p.availableStock ?? 0,
    image: p.img || '📦',
  };
}

function mapOrderDetail(od) {
  if (!od) return null;
  return {
    order_detail_id: od.orderDetailId,
    order_id: od.orderId,
    product_id: od.productId ?? od.product?.productId,
    product_name: od.productName ?? od.product?.productName,
    quantity: od.quantity,
    price: od.price,
    item_total_price: od.itemTotalPrice,
    order_detail_fills: Array.isArray(od.orderDetailFills) ? od.orderDetailFills.map(mapOrderDetailFill) : [],
  };
}

function mapOrder(o) {
  if (!o) return null;
  return {
    order_id: o.orderId,
    delivery_id: o.deliveryId,
    store_id: o.storeId ?? o.store?.storeId,
    store_name: o.storeName ?? o.store?.storeName,
    order_date: o.orderDate,
    status: o.status,
    img: o.img,
    comment: o.comment,
    total_price: o.totalPrice,
    order_details: Array.isArray(o.orderDetails) ? o.orderDetails.map(mapOrderDetail) : [],
    feedback_id: o.feedbackId,
    feedback_rating: o.feedbackRating,
    feedback_comment: o.feedbackComment,
    delivery_id: o.deliveryId, // Added for Coordinator/Shipper logic
  };
}

function mapDelivery(d) {
  if (!d) return null;
  return {
    delivery_id: d.deliveryId,
    delivery_date: d.deliveryDate,
    created_at: d.createdAt,
    shipper_id: d.shipperId ?? d.shipper?.userId,
    shipper_name: d.shipperName ?? d.shipper?.fullName,
    status: d.status,
    orders: Array.isArray(d.orders) ? d.orders.map(mapOrder) : [],
  };
}

function mapInventory(inv) {
  if (!inv) return null;
  const batchObj = inv.batch;
  const productObj = inv.product || batchObj?.product || null;
  const productId = inv.productId ??
    inv.product_id ??
    productObj?.productId ??
    productObj?.product_id ??
    batchObj?.productId ??
    null;

  return {
    inventory_id: inv.inventoryId,
    product_id: productId,
    product_name: inv.productName ?? inv.product_name ?? productObj?.productName ?? productObj?.product_name ?? batchObj?.productName ?? 'N/A',
    product_type: inv.productType ?? inv.product_type ?? productObj?.productType ?? productObj?.product_type ?? productObj?.type ?? inv.category ?? inv.type ?? batchObj?.productType ?? null,
    product: productObj, // Keep original product object for flexible access
    batch: batchObj,
    batch_id: batchObj?.batchId ?? inv.batchId,
    quantity: inv.quantity ?? 0,
    expiry_date: inv.expiryDate ?? inv.expiry_date,
  };
}

function mapLogBatch(b) {
  if (!b) return null;
  return {
    batch_id: b.batchId,
    plan_id: b.planId,
    product_id: b.productId,
    product_name: b.productName,
    quantity: b.quantity,
    production_date: b.productionDate,
    expiry_date: b.expiryDate,
    status: b.status,
    type: b.type,
    created_at: b.createdAt,
  };
}

function mapReceiptDetail(rd) {
  if (!rd) return null;
  return {
    receipt_detail_id: rd.receiptDetailId,
    receipt_id: rd.receiptId,
    product_id: rd.productId ?? rd.product?.productId,
    product_name: rd.productName ?? rd.product?.productName,
    quantity: rd.quantity,
    price: rd.price,
  };
}

function mapReceipt(r) {
  if (!r) return null;
  return {
    receipt_id: r.receiptId,
    receipt_code: r.receiptCode,
    order_id: r.orderId,
    shipper_id: r.shipperId, // Added for new schema
    export_date: r.exportDate,
    status: r.status,
    note: r.note,
    type: r.type, // IMPORT/EXPORT
    receipt_details: Array.isArray(r.receiptDetails) ? r.receiptDetails.map(mapReceiptDetail) : [],
    inventory_transactions: Array.isArray(r.inventoryTransactions) ? r.inventoryTransactions : [],
  };
}

function mapOrderDetailFill(f) {
  if (!f) return null;
  return {
    fill_id: f.fillId,
    order_detail_id: f.orderDetailId,
    batch_id: f.batchId,
    quantity: f.quantity,
    created_at: f.createdAt,
  };
}

function mapWasteLog(w) {
  if (!w) return null;
  return {
    waste_id: w.wasteId,
    product_id: w.productId,
    product_name: w.productName,
    batch_id: w.batchId,
    order_id: w.orderId,
    quantity: w.quantity,
    waste_type: w.wasteType,
    note: w.note,
    created_at: w.createdAt,
  };
}

const ROLE_NAME_TO_ID = {
  'admin': ROLE_ID.ADMIN,
  'manager': ROLE_ID.MANAGER,
  'store staff': ROLE_ID.STORE_STAFF,
  'kitchen manager': ROLE_ID.KITCHEN_MANAGER,
  'supply coordinator': ROLE_ID.SUPPLY_COORDINATOR,
  'shipper': ROLE_ID.SHIPPER,
  'warehouse': 7,
};

function mapUserResponse(u) {
  if (!u) return null;

  let roleId = u.roleId ?? u.role?.roleId;
  const roleName = u.roleName ?? u.role?.roleName;

  if (!roleId && roleName) {
    const cleanName = String(roleName).trim().toLowerCase();
    const key = Object.keys(ROLE_NAME_TO_ID).find(k => k === cleanName);
    if (key) {
      roleId = ROLE_NAME_TO_ID[key];
    } else {
      if (cleanName.includes('admin')) roleId = ROLE_ID.ADMIN;
      else if (cleanName.includes('kitchen')) roleId = ROLE_ID.KITCHEN_MANAGER;
      else if (cleanName.includes('coord')) roleId = ROLE_ID.SUPPLY_COORDINATOR;
      else if (cleanName.includes('store')) roleId = ROLE_ID.STORE_STAFF;
      else if (cleanName.includes('shipper')) roleId = ROLE_ID.SHIPPER;
      else if (cleanName.includes('ship')) roleId = ROLE_ID.SHIPPER;
      else if (cleanName.includes('warehouse')) roleId = 7;
      else if (cleanName.includes('manager')) roleId = ROLE_ID.MANAGER;
    }
  }

  const role = { role_id: roleId, role_name: roleName || 'Unknown' };
  const store = {
    store_id: u.storeId ?? u.store?.storeId,
    store_name: u.storeName ?? u.store?.storeName
  };

  return {
    user_id: u.userId ?? u.user_id,
    username: u.username,
    full_name: u.fullName ?? u.full_name,
    role_name: roleName,
    role_id: roleId,
    store_id: store.store_id,
    store_name: store.store_name,
    role,
    store
  };
}

function mapStoreResponse(s) {
  if (!s) return null;
  return {
    store_id: s.storeId,
    store_name: s.storeName,
    address: s.address,
    phone: s.phone,
  };
}

function mapFeedback(f) {
  if (!f) return null;
  return {
    feedback_id: f.feedbackId,
    order_id: f.orderId,
    store_id: f.storeId,
    store_name: f.storeName,
    rating: f.rating,
    comment: f.comment,
    created_at: f.createdAt,
  };
}

// --- Authorized Fetch Wrapper ---

/**
 * Lấy token từ sessionStorage và tự động gắn vào Header Authorization
 */
const getToken = () => {
  try {
    const storedUser = sessionStorage.getItem('kitchen_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user?.token || null;
    }
  } catch (e) {
    return null;
  }
  return null;
};

const authFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
};

// --- Authentication ---

const LOGIN_ERROR_MSG = 'Tên đăng nhập hoặc mật khẩu không đúng.';

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

/**
 * Login using v2 JWT auth: POST /auth/v2/login
 * Then fetches user details: GET /users/{userId}
 */
export const loginUser = async (username, password) => {
  try {
    // Phase 1: POST /auth/v2/login -> { token, authenticated }
    const loginResponse = await fetch(`${API_BASE_URL}/auth/v2/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!loginResponse.ok) {
      if (loginResponse.status === 400 || loginResponse.status === 401) {
        throw new Error(LOGIN_ERROR_MSG);
      }
      throw new Error('Lỗi máy chủ khi đăng nhập.');
    }

    const loginData = await loginResponse.json();
    const token = loginData?.token;

    if (!token || !loginData.authenticated) {
      throw new Error(LOGIN_ERROR_MSG);
    }

    // Phase 2: Decode token to get userId, then GET /users/{userId}
    const decodedToken = parseJwt(token);
    const userId = decodedToken?.userId || decodedToken?.sub;

    if (!userId) {
      console.error("JWT Payload lacks userId or sub:", decodedToken);
      throw new Error('Token không hợp lệ (thiếu thông tin người dùng).');
    }

    const detailResponse = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!detailResponse.ok) {
      throw new Error('Không thể lấy thông tin chi tiết người dùng.');
    }

    const userData = await detailResponse.json();
    const u = userData?.data ?? userData;

    const mappedUser = mapUserResponse(u);
    if (mappedUser) {
      mappedUser.token = token;
      return { user: mappedUser, token: token };
    }

    throw new Error('Dữ liệu người dùng từ API không hợp lệ.');
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    throw error;
  }
};

/**
 * Introspect token: POST /auth/introspect
 * @param {string} token
 * @returns {{ valid: boolean }}
 */
export const introspectToken = async (token) => {
  const response = await fetch(`${API_BASE_URL}/auth/introspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return await handleResponse(response);
};

// --- Orders API ---

/** GET /orders */
export const fetchOrders = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders`));
  return Array.isArray(data) ? data.map(mapOrder) : data;
};

/** GET /orders/get-by-store/{storeId} */
export const getOrdersByStore = async (storeId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders/get-by-store/${storeId}`));
  return Array.isArray(data) ? data.map(mapOrder) : data;
};

/** GET /orders/get-by-shipper/{shipperId} */
export const getOrdersByShipperId = async (shipperId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders/get-by-shipper/${shipperId}`));
  return Array.isArray(data) ? data.map(mapOrder) : data;
};

/** GET /orders/filter-by-status?status={status} */
export const getOrdersByStatus = async (status) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders/filter-by-status?status=${status}`));
  return Array.isArray(data) ? data.map(mapOrder) : data;
};

/** Convenience wrapper: get orders with WAITING status */
export const getWaitingOrders = () => getOrdersByStatus('WAITING');

/**
 * GET /orders (filtered client-side by orderId)
 * NOTE: The spec does NOT have GET /orders/{id}. We fetch all orders and filter.
 * @param {number|string} orderId
 */
export const getOrderById = async (orderId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders`));
  const list = Array.isArray(data) ? data.map(mapOrder) : [];
  return list.find(o => String(o.order_id) === String(orderId)) ?? null;
};

/**
 * POST /orders
 * @param {{ storeId?: number, store_id?: number, comment?: string, type?: string, orderDetails?: Array<{ productId?: number, product_id?: number, quantity: number }> }} orderData
 */
export const createOrder = async (orderData) => {
  const storeId = orderData.storeId ?? orderData.store_id;
  const comment = orderData.comment ?? '';
  const type = orderData.type ?? 'NORMAL';
  const orderDetails = (orderData.orderDetails ?? []).map((od) => ({
    productId: od.productId ?? od.product_id,
    quantity: Number(od.quantity),
  }));
  const response = await authFetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId, comment, type, orderDetails }),
  });
  const data = await handleResponse(response);
  return data ? mapOrder(data) : data;
};

/**
 * Create additional (supplement) order with a parent order
 * PUT /orders/{id}
 * @param {number} parentOrderId
 * @param {{ storeId?: number, comment?: string, type?: string, orderDetails?: Array }} orderData
 */
export const createAdditionalOrder = async (parentOrderId, orderData) => {
  const storeId = orderData.storeId ?? orderData.store_id;
  const comment = orderData.comment ?? '';
  const type = orderData.type ?? 'SUPPLEMENT';
  // Ensure orderDetails is not empty for supplement orders
  const orderDetails = (orderData.orderDetails ?? []).map((od) => ({
    productId: od.productId ?? od.product_id,
    quantity: Number(od.quantity),
  })).filter(od => od.quantity > 0); // Filter out 0 quantity items

  if (orderDetails.length === 0) {
    throw new Error('Đơn bổ sung phải có ít nhất một sản phẩm với số lượng lớn hơn 0.');
  }

  const response = await authFetch(`${API_BASE_URL}/orders/${parentOrderId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId, comment, type, orderDetails }),
  });
  return await handleResponse(response);
};

/**
 * Update order status
 * PATCH /orders/update-status/{note}?orderId=&status=&note=
 * NOTE: The spec has `note` as the path variable (oddly), and also as an optional query param.
 * We pass note in the query params as well.
 * @param {number} orderId
 * @param {string} status - One of: WAITING, PROCESSING, DISPATCHED, DELIVERING, PARTIAL_DELIVERED, DONE, DAMAGED, CANCELED
 * @param {string} note
 */
export const updateOrderStatus = async (orderId, status, note = '') => {
  const params = new URLSearchParams();
  params.append('orderId', orderId);
  params.append('status', status);
  if (note) params.append('note', note);

  // The spec path is PATCH /orders/update-status/{note}. We always use "update" as the fixed
  // path segment to avoid 500s caused by arbitrary Vietnamese/special-char strings.
  // The actual note value is passed via query param (already appended above).
  const response = await authFetch(`${API_BASE_URL}/orders/update-status/update?${params.toString()}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}) // Added empty body for some backends that require it
  });
  return await handleResponse(response);
};

/**
 * GET /orders/{orderId}/allocation-suggestion
 * Get FEFO batch suggestion (read-only, does NOT modify data)
 */
export const getFefoSuggestion = async (orderId) => {
  const response = await authFetch(`${API_BASE_URL}/orders/${orderId}/allocation-suggestion`);
  return await handleResponse(response);
};

/**
 * POST /orders/{orderId}/confirm-allocation
 * Confirm batch allocation. Creates order_detail_fill records and moves order to PROCESSING.
 * @param {number} orderId
 * @param {Array<{ orderDetailId: number, batchPicks: Array<{batchId: number, quantity: number}> }>} finalAllocations
 */
export const confirmAllocation = async (orderId, finalAllocations) => {
  const response = await authFetch(`${API_BASE_URL}/orders/${orderId}/confirm-allocation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finalAllocations }),
  });
  return await handleResponse(response);
};

// --- Order Details API ---

/** GET /order-details/order/{orderId} */
export const getOrderDetailsByOrderId = async (orderId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/order-details/order/${orderId}`));
  return Array.isArray(data) ? data.map(mapOrderDetail) : data;
};

// --- Receipts API ---

/** GET /receipts/order/{orderId} */
export const getReceiptsByOrderId = async (orderId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/receipts/order/${orderId}`));
  return Array.isArray(data) ? data.map(mapReceipt) : data;
};

/** GET /receipts/status/{status} - status: DRAFT | READY | COMPLETED */
export const getReceiptsByStatus = async (status) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/receipts/status/${status}`));
  return Array.isArray(data) ? data.map(mapReceipt) : data;
};

/**
 * POST /receipts/order/{orderId}?note=
 * Creates a DRAFT receipt for an order
 */
export const createReceipt = async (orderId, note = '') => {
  const params = note ? `?note=${encodeURIComponent(note)}` : '';
  const response = await authFetch(`${API_BASE_URL}/receipts/order/${orderId}${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await handleResponse(response);
  return data ? mapReceipt(data) : data;
};

/**
 * PATCH /receipts/status?receiptId={receiptId}&status={status}
 * Update receipt status: DRAFT | READY | COMPLETED
 * @param {number} receiptId
 * @param {'DRAFT'|'READY'|'COMPLETED'} status
 */
export const updateReceiptStatus = async (receiptId, status) => {
  const params = new URLSearchParams();
  params.append('receiptId', receiptId);
  params.append('status', status);
  const response = await authFetch(`${API_BASE_URL}/receipts/status?${params.toString()}`, {
    method: 'PATCH',
  });
  return await handleResponse(response);
};

/** Alias: confirm a receipt by marking it READY */
export const confirmReceipt = (receiptId) => updateReceiptStatus(receiptId, 'READY');

/**
 * NOTE: The spec does NOT have a PATCH /receipts/{receiptId}/assign-shipper endpoint.
 * Shipper assignment is done via POST /deliveries (AssignShipperRequest).
 * This function is kept as a no-op stub to avoid breaking existing callers.
 * Use createDelivery() instead to assign a shipper to orders.
 */
export const assignShipperToReceipt = async (_receiptId, _shipperId) => {
  console.warn('assignShipperToReceipt: endpoint không tồn tại trong API spec. Dùng createDelivery() thay thế.');
  return null;
};

// --- Product API ---

/** GET /products */
export const getProducts = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/products`));
  return Array.isArray(data) ? data.map(mapProduct) : data;
};

/**
 * GET /products/get-by-type/{productType}
 * productType: RAW_MATERIAL | MAIN | SIDE | BEVERAGE | DESSERT | SAUCE
 */
export const getProductsByType = async (productType) => {
  const response = await authFetch(`${API_BASE_URL}/products/get-by-type/${productType}`);
  const data = await handleResponse(response);
  return Array.isArray(data) ? data.map(mapProduct) : data;
};

/** POST /products */
export const createProduct = async (productData) => {
  const response = await authFetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });
  const data = await handleResponse(response);
  return data ? mapProduct(data) : data;
};

/** PUT /products/{productId} */
export const updateProduct = async (productId, productData) => {
  const response = await authFetch(`${API_BASE_URL}/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });
  const data = await handleResponse(response);
  return data ? mapProduct(data) : data;
};

// --- User API ---

/** GET /users */
export const getAllUsers = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/users`));
  return Array.isArray(data) ? data.map(mapUserResponse) : data;
};

/** GET /users/shippers */
export const getAllShippers = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/users/shippers`));
  return Array.isArray(data) ? data.map(mapUserResponse) : data;
};

/** GET /users/{userId} */
export const getUserById = async (userId) => {
  const response = await authFetch(`${API_BASE_URL}/users/${userId}`);
  const data = await handleResponse(response);
  return data ? mapUserResponse(data) : data;
};

/** POST /users */
export const createUser = async (userData) => {
  const response = await authFetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  const data = await handleResponse(response);
  return data ? mapUserResponse(data) : data;
};

/** PUT /users/{userId} */
export const updateUser = async (userId, userData) => {
  const response = await authFetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  const data = await handleResponse(response);
  return data ? mapUserResponse(data) : data;
};

/** DELETE /users/{userId} */
export const deleteUser = async (userId) => {
  const response = await authFetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'DELETE',
  });
  return await handleResponse(response);
};

// --- Stores API ---

/** GET /stores */
export const getAllStores = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/stores`));
  return Array.isArray(data) ? data.map(mapStoreResponse) : data;
};

/** GET /stores/{id} */
export const getStoreById = async (id) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/stores/${id}`));
  return data ? mapStoreResponse(data) : data;
};

/** POST /stores */
export const createStore = async (storeData) => {
  const response = await authFetch(`${API_BASE_URL}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(storeData),
  });
  const data = await handleResponse(response);
  return data ? mapStoreResponse(data) : data;
};

/** PUT /stores/{id} */
export const updateStore = async (id, storeData) => {
  const response = await authFetch(`${API_BASE_URL}/stores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(storeData),
  });
  const data = await handleResponse(response);
  return data ? mapStoreResponse(data) : data;
};

/** DELETE /stores/{id} */
export const deleteStore = async (id) => {
  const response = await authFetch(`${API_BASE_URL}/stores/${id}`, {
    method: 'DELETE',
  });
  return await handleResponse(response);
};

// --- Delivery API ---

/** GET /deliveries */
export const getDeliveries = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/deliveries`));
  return Array.isArray(data) ? data.map(mapDelivery) : data;
};

/** GET /deliveries/get-by-shipper/{shipperId} */
export const getDeliveriesByShipperId = async (shipperId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/deliveries/get-by-shipper/${shipperId}`));
  return Array.isArray(data) ? data.map(mapDelivery) : data;
};

/**
 * POST /deliveries
 * Create delivery and assign orders + shipper
 * @param {{ shipperId: number, orderIds: number[], deliveryDate: string }} deliveryData
 */
export const createDelivery = async (deliveryData) => {
  const body = {
    shipperId: deliveryData.shipperId,
    orderIds: deliveryData.orderIds,
    deliveryDate: deliveryData.deliveryDate,
  };
  const response = await authFetch(`${API_BASE_URL}/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await handleResponse(response);
};

/**
 * PATCH /deliveries/{deliveryId}/status?status=...
 * status: WAITING | DELIVERING | DONE | CANCEL
 */
export const updateDeliveryStatus = async (deliveryId, status) => {
  const response = await authFetch(`${API_BASE_URL}/deliveries/${deliveryId}/status?status=${status}`, {
    method: 'PATCH',
  });
  return await handleResponse(response);
};

// --- Inventory Transactions API ---

/** GET /inventory-transactions */
export const getAllTransactions = async () => {
  const response = await authFetch(`${API_BASE_URL}/inventory-transactions`);
  return await handleResponse(response);
};

/** POST /inventory-transactions */
export const createTransaction = async (data) => {
  const response = await authFetch(`${API_BASE_URL}/inventory-transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await handleResponse(response);
};

/** GET /inventory-transactions/product/{productId} */
export const getTransactionsByProductId = async (productId) => {
  const response = await authFetch(`${API_BASE_URL}/inventory-transactions/product/${productId}`);
  return await handleResponse(response);
};

/** GET /inventory-transactions/batch/{batchId} */
export const getTransactionsByBatchId = async (batchId) => {
  const response = await authFetch(`${API_BASE_URL}/inventory-transactions/batch/${batchId}`);
  return await handleResponse(response);
};

// --- Inventories API ---

/** GET /inventories */
export const getInventories = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/inventories`));
  return Array.isArray(data) ? data.map(mapInventory) : data;
};

/**
 * GET /inventories/type/{productType}
 * productType: RAW_MATERIAL | MAIN | SIDE | BEVERAGE | DESSERT | SAUCE
 */
export const getInventoryByProductType = async (productType) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/inventories/type/${productType}`));
  return Array.isArray(data) ? data.map(mapInventory) : data;
};

/** GET /inventories/get-by-id/{inventoryId} */
export const getInventoryById = async (inventoryId) => {
  const response = await authFetch(`${API_BASE_URL}/inventories/get-by-id/${inventoryId}`);
  const data = await handleResponse(response);
  return data ? mapInventory(data) : data;
};

// --- Log Batches API ---

/** GET /log-batches */
export const getAllLogBatches = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches`));
  return Array.isArray(data) ? data.map(mapLogBatch) : data;
};

/** GET /log-batches/{batchId} */
export const getLogBatchById = async (batchId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches/${batchId}`));
  return data ? mapLogBatch(data) : data;
};

/** GET /log-batches/plan/{planId} */
export const getLogBatchesByPlanId = async (planId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches/plan/${planId}`));
  return Array.isArray(data) ? data.map(mapLogBatch) : data;
};

/** GET /log-batches/product/{productId} */
export const getLogBatchesByProductId = async (productId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches/product/${productId}`));
  return Array.isArray(data) ? data.map(mapLogBatch) : data;
};

/**
 * GET /log-batches/status/{status}
 * status: PROCESSING | WAITING_TO_CONFIRM | DONE | WAITING_TO_CANCEL | DAMAGED
 */
export const getLogBatchesByStatus = async (status) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches/status/${status}`));
  return Array.isArray(data) ? data.map(mapLogBatch) : data;
};

/**
 * PATCH /log-batches/{batchId}/status?status=...
 * status: PROCESSING | WAITING_TO_CONFIRM | DONE | WAITING_TO_CANCEL | DAMAGED
 */
export const updateLogBatchStatus = async (batchId, status) => {
  const response = await authFetch(`${API_BASE_URL}/log-batches/${batchId}/status?status=${status}`, {
    method: 'PATCH',
  });
  const data = await handleResponse(response);
  return data ? mapLogBatch(data) : data;
};

/**
 * Mark a batch as DAMAGED.
 * NOTE: The spec does NOT have POST /log-batches/{batchId}/expire.
 * Use PATCH /log-batches/{batchId}/status?status=DAMAGED instead.
 * @param {number} batchId
 */
export const expireBatch = async (batchId) => {
  return await updateLogBatchStatus(batchId, 'DAMAGED');
};

/**
 * POST /log-batches/production
 * Create production log batches (array)
 */
export const createProLogBatch = async (batchData) => {
  const payload = Array.isArray(batchData) ? batchData : [batchData];
  const response = await authFetch(`${API_BASE_URL}/log-batches/production`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await handleResponse(response);
};

/**
 * POST /log-batches/purchase
 * Create a single purchase log batch
 */
export const createPurLogBatch = async (batchData) => {
  const response = await authFetch(`${API_BASE_URL}/log-batches/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchData),
  });
  const data = await handleResponse(response);
  return data ? mapLogBatch(data) : data;
};

/** Aliases for backward compatibility */
export const createBatch = createProLogBatch;
export const createPurchaseBatch = createPurLogBatch;

// --- Production Plans API ---

/** GET /production-plans */
export const getProductionPlans = async () => {
  const response = await authFetch(`${API_BASE_URL}/production-plans`);
  return await handleResponse(response);
};

/** POST /production-plans */
export const createProductionPlan = async (planData) => {
  const payload = { ...planData, status: planData.status || 'DRAFT' };
  const response = await authFetch(`${API_BASE_URL}/production-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await handleResponse(response);
};

/** PUT /production-plans/{id} */
export const updateProductionPlan = async (planId, planData) => {
  const response = await authFetch(`${API_BASE_URL}/production-plans/${planId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(planData),
  });
  return await handleResponse(response);
};

/**
 * PATCH /production-plans/{id}/status?status=...
 * status: DRAFT | WAITING | PROCESSING | COMPLETE_ONE_SECTION | DONE | CANCEL
 */
export const updateProductionPlanStatus = async (planId, status) => {
  const response = await authFetch(`${API_BASE_URL}/production-plans/${planId}/status?status=${status}`, {
    method: 'PATCH',
  });
  return await handleResponse(response);
};

/** GET /production-plans/{id} */
export const getProductionPlanById = async (id) => {
  const response = await authFetch(`${API_BASE_URL}/production-plans/${id}`);
  return await handleResponse(response);
};

/**
 * GET /production-plans/{id}/material-requirements
 * Returns total raw materials required based on recipes for a plan.
 */
export const getMaterialRequirementsForPlan = async (planId) => {
  const response = await authFetch(`${API_BASE_URL}/production-plans/${planId}/material-requirements`);
  return await handleResponse(response);
};

/** GET /production-plan-details/plan/{planId} */
export const getProductionPlanDetails = async (planId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/production-plan-details/plan/${planId}`));
  return Array.isArray(data) ? data : [];
};

// --- Quality Feedback API ---

/** GET /feedbacks */
export const getAllFeedbacks = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/feedbacks`));
  return Array.isArray(data) ? data.map(mapFeedback) : data;
};

/**
 * POST /feedbacks
 * @param {{ orderId: number, rating: number, comment: string }} data
 */
export const createFeedback = async (data) => {
  const response = await authFetch(`${API_BASE_URL}/feedbacks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await handleResponse(response);
  return result ? mapFeedback(result) : result;
};

// --- Recipes API ---

/** GET /recipes */
export const getRecipes = async () => {
  const response = await authFetch(`${API_BASE_URL}/recipes`);
  return await handleResponse(response);
};

/** GET /recipes/search/{keyword} */
export const searchRecipes = async (keyword) => {
  const response = await authFetch(`${API_BASE_URL}/recipes/search/${encodeURIComponent(keyword)}`);
  return await handleResponse(response);
};

// --- Recipe Details API ---

/** GET /recipe-details */
export const getAllRecipeDetails = async () => {
  const response = await authFetch(`${API_BASE_URL}/recipe-details`);
  return await handleResponse(response);
};

/** GET /recipe-details/{id} */
export const getRecipeDetailById = async (id) => {
  const response = await authFetch(`${API_BASE_URL}/recipe-details/${id}`);
  return await handleResponse(response);
};

/** GET /recipe-details/recipe/{recipeId} */
export const getRecipeDetailsByRecipeId = async (recipeId) => {
  const response = await authFetch(`${API_BASE_URL}/recipe-details/recipe/${recipeId}`);
  return await handleResponse(response);
};

// --- Waste Log API ---

/** GET /waste-log */
export const getAllWasteLogs = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/waste-log`));
  return Array.isArray(data) ? data.map(mapWasteLog) : data;
};

/**
 * POST /waste-log?request=...
 * @param {{ productId: number, batchId: number, orderId?: number, quantity: number, wasteType: string, note?: string }} wasteData
 */
export const createWasteLog = async (wasteData) => {
  const params = new URLSearchParams();
  // The spec shows request as a query param object
  Object.entries(wasteData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value);
    }
  });
  const response = await authFetch(`${API_BASE_URL}/waste-log?${params.toString()}`, {
    method: 'POST',
  });
  const data = await handleResponse(response);
  return data ? mapWasteLog(data) : data;
};

// --- Report API ---

/**
 * GET /reports/orders/volume?startDate={startDate}&endDate={endDate}
 * Returns order volume by date range.
 * @param {string} startDate - format: YYYY-MM-DD
 * @param {string} endDate - format: YYYY-MM-DD
 * @returns {Array<{ date: string, totalOrders: number }>}
 */
export const getOrderVolume = async (startDate, endDate) => {
  const params = new URLSearchParams({ startDate, endDate });
  const response = await authFetch(`${API_BASE_URL}/reports/orders/volume?${params.toString()}`);
  return await handleResponse(response);
};

/**
 * GET /reports/orders/top-products?limit={limit}
 * Returns top ordered products sorted by quantity.
 * @param {number} limit - default 5
 * @returns {Array<{ productName: string, totalQuantity: number, unit: string }>}
 */
export const getTopOrderedProducts = async (limit = 5) => {
  const response = await authFetch(`${API_BASE_URL}/reports/orders/top-products?limit=${limit}`);
  return await handleResponse(response);
};

/**
 * GET /reports/orders/revenue/by-store?month={month}&year={year}
 * Returns internal revenue by store for a specific month and year.
 * @param {number} month
 * @param {number} year
 * @returns {Array<{ storeName: string, totalRevenue: number }>}
 */
export const getRevenueByStore = async (month, year) => {
  const params = new URLSearchParams({ month, year });
  const response = await authFetch(`${API_BASE_URL}/reports/orders/revenue/by-store?${params.toString()}`);
  return await handleResponse(response);
};

/**
 * GET /reports/orders/live-status
 * Returns live order status counts for today.
 * @returns {Object<string, number>} - e.g. { WAITING: 3, PROCESSING: 5, ... }
 */
export const getLiveOrderStatusToday = async () => {
  const response = await authFetch(`${API_BASE_URL}/reports/orders/live-status`);
  return await handleResponse(response);
};

/**
 * GET /reports/orders/damaged?page={page}&size={size}
 * Returns paginated list of canceled or damaged orders.
 * @param {number} page - default 0
 * @param {number} size - default 10
 * @returns {{ totalElements, totalPages, content: Array<IssueOrderResponse>, ... }}
 */
export const getDamagedOrCanceledOrders = async (page = 0, size = 10) => {
  const params = new URLSearchParams({ page, size });
  const response = await authFetch(`${API_BASE_URL}/reports/orders/damaged?${params.toString()}`);
  return await handleResponse(response);
};