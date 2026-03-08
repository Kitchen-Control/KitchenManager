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
    order_details: Array.isArray(o.orderDetails) ? o.orderDetails.map(mapOrderDetail) : [],
    feedback_id: o.feedbackId,
    feedback_rating: o.feedbackRating,
    feedback_comment: o.feedbackComment,
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
    orders: Array.isArray(d.orders) ? d.orders.map(mapOrder) : [],
  };
}

function mapInventory(inv) {
  if (!inv) return null;
  // InventoryResponse: { inventoryId, product_name, batch, quantity, expiryDate }
  // product_name is directly on InventoryResponse (snake_case from backend)
  const batchObj = inv.batch;
  return {
    inventory_id: inv.inventoryId,
    product_id: batchObj?.product?.productId ?? inv.productId ?? null,
    product_name: inv.product_name ?? inv.productName ?? batchObj?.product?.productName ?? 'N/A',
    batch: batchObj,
    batch_id: batchObj?.batchId ?? inv.batchId,
    quantity: inv.quantity,
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

function mapReceipt(r) {
  if (!r) return null;
  return {
    receipt_id: r.receiptId,
    receipt_code: r.receiptCode,
    order_id: r.orderId,
    export_date: r.exportDate,
    status: r.status,
    note: r.note,
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
    const key = Object.keys(ROLE_NAME_TO_ID).find(k => k.toLowerCase() === roleName.toLowerCase());
    if (key) roleId = ROLE_NAME_TO_ID[key];
  }

  return {
    user_id: u.userId,
    username: u.username,
    full_name: u.fullName,
    role_name: roleName,
    role_id: roleId,
    store_id: u.storeId ?? u.store?.storeId,
    store_name: u.storeName ?? u.store?.storeName,
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

// --- Authentication (OpenAPI: /auth/login) ---

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

export const loginUser = async (username, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (response.status === 400 || response.status === 401) {
      throw new Error(LOGIN_ERROR_MSG);
    }
    const data = await handleResponse(response);
    console.log("API Login Response Raw:", data);

    const responseData = data?.data ?? data;
    const apiUser = responseData?.user ?? responseData;
    const token = data?.token ?? responseData?.token ?? apiUser?.token;

    if (apiUser && (apiUser.userId != null || apiUser.user_id != null)) {
      const uid = apiUser.userId ?? apiUser.user_id;
      let finalUserDetail = apiUser;
      let rawRoleName = apiUser.roleName ?? apiUser.role_name;
      let rawRoleId = apiUser.roleId ?? apiUser.role_id;
      let rawStoreId = apiUser.storeId ?? apiUser.store_id;
      let rawStoreName = apiUser.storeName ?? apiUser.store_name;

      if (!rawRoleName && !rawRoleId) {
        try {
          console.log(`[Login Fix] Fetching details for User ID: ${uid}`);
          const detailResponse = await fetch(`${API_BASE_URL}/users/${uid}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          });

          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            const userResp = detailData?.data ?? detailData;
            console.log("[Login Fix] User Detail Response:", userResp);

            if (userResp) {
              finalUserDetail = { ...apiUser, ...userResp };
              rawRoleName = userResp.roleName;
              rawStoreId = userResp.storeId;
              rawStoreName = userResp.storeName;
            }
          }
        } catch (err) {
          console.error("[Login Fix] Failed to fetch user details:", err);
        }
      }

      if (!rawRoleId && rawRoleName) {
        const cleanName = String(rawRoleName).trim().toLowerCase();
        const mappedKey = Object.keys(ROLE_NAME_TO_ID).find(k => k === cleanName);
        if (mappedKey) {
          rawRoleId = ROLE_NAME_TO_ID[mappedKey];
        } else {
          console.warn(`[Login Fix] Role name '${cleanName}' không khớp chính xác. Đang thử tìm kiếm mờ...`);
          if (cleanName.includes('kitchen')) {
            rawRoleId = ROLE_ID.KITCHEN_MANAGER;
          } else if (cleanName.includes('coord')) {
            rawRoleId = ROLE_ID.SUPPLY_COORDINATOR;
          } else if (cleanName.includes('store')) {
            rawRoleId = ROLE_ID.STORE_STAFF;
          } else if (cleanName.includes('ship')) {
            rawRoleId = ROLE_ID.SHIPPER;
          } else if (cleanName.includes('admin')) {
            rawRoleId = ROLE_ID.ADMIN;
          } else if (cleanName.includes('warehouse')) {
            rawRoleId = 7;
          } else if (cleanName.includes('manager')) {
            rawRoleId = ROLE_ID.MANAGER;
          }
        }
      }

      const role = { role_id: rawRoleId, role_name: rawRoleName || 'Unknown' };
      const store = { store_id: rawStoreId, store_name: rawStoreName };

      const mappedUser = {
        user_id: uid,
        username: finalUserDetail.username,
        full_name: finalUserDetail.fullName ?? finalUserDetail.full_name,
        role_id: rawRoleId ?? null,
        store_id: rawStoreId ?? null,
        role,
        store,
        token: token,
      };

      console.log("Final Mapped User:", mappedUser);
      return { user: mappedUser, token: token };
    }
    return data;
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    if (error instanceof Error && error.message && !error.message.startsWith('Failed to fetch') && !error.message.includes('NetworkError')) {
      throw error;
    }
    throw new Error('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
  }
};

// --- Orders API ---

export const fetchOrders = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders`));
  return Array.isArray(data) ? data.map(mapOrder) : data;
};

export const getWaitingOrders = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders/waiting`));
  return Array.isArray(data) ? data.map(mapOrder) : data;
};

export const getOrdersByStore = async (storeId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders/get-by-store/${storeId}`));
  return Array.isArray(data) ? data.map(mapOrder) : data;
};

export const getOrdersByShipperId = async (shipperId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders/get-by-shipper/${shipperId}`));
  return Array.isArray(data) ? data.map(mapOrder) : data;
};

export const getOrdersByStatus = async (status) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/orders/filter-by-status?status=${status}`));
  return Array.isArray(data) ? data.map(mapOrder) : data;
};

/** @param {{ storeId?: number, store_id?: number, comment?: string, orderDetails?: Array<{ productId?: number, product_id?: number, quantity: number }> }} orderData */
export const createOrder = async (orderData) => {
  const storeId = orderData.storeId ?? orderData.store_id;
  const comment = orderData.comment ?? '';
  const orderDetails = (orderData.orderDetails ?? []).map((od) => ({
    productId: od.productId ?? od.product_id,
    quantity: Number(od.quantity),
  }));
  const response = await authFetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId, comment, orderDetails }),
  });
  const data = await handleResponse(response);
  return data ? mapOrder(data) : data;
};

export const updateOrderStatus = async (orderId, status) => {
  const params = new URLSearchParams();
  // Fixed: orderId should be in query as per OpenAPI search result previously seen or implied
  params.append('orderId', orderId);
  params.append('status', status === 'CANCELLED' ? 'CANCLED' : status);
  const response = await authFetch(`${API_BASE_URL}/orders/update-status/0?${params.toString()}`, { // storeId parameter is in Path /orders/update-status/{storeId}
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  return await handleResponse(response);
};

// PATCH /orders/{orderId}/complete — Shipper marks order as DONE
export const completeOrder = async (orderId) => {
  const response = await authFetch(`${API_BASE_URL}/orders/${orderId}/complete`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await handleResponse(response);
  return data ? mapOrder(data) : data;
};

// --- Order Details API ---

export const getOrderDetailsByOrderId = async (orderId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/order-details/order/${orderId}`));
  return Array.isArray(data) ? data.map(mapOrderDetail) : data;
};

// --- Order Detail Fills API ---

export const getAllOrderDetailFills = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/order-detail-fills`));
  return Array.isArray(data) ? data.map(mapOrderDetailFill) : data;
};

export const getOrderDetailFillsByOrderDetailId = async (orderDetailId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/order-detail-fills/order-detail/${orderDetailId}`));
  return Array.isArray(data) ? data.map(mapOrderDetailFill) : data;
};

export const getOrderDetailFillsByBatchId = async (batchId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/order-detail-fills/batch/${batchId}`));
  return Array.isArray(data) ? data.map(mapOrderDetailFill) : data;
};

// --- Receipts API ---

export const getReceiptsByOrderId = async (orderId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/receipts/order/${orderId}`));
  return Array.isArray(data) ? data.map(mapReceipt) : data;
};

export const getReceiptsByStatus = async (status) => {
  // Since there is no /receipts endpoint that returns all receipts globally,
  // we must get all orders, then fetch receipts for all relevant orders, and filter.
  // This is a workaround. To be efficient, we might only fetch receipts for certain orders.
  // However, for the Warehouse Outbound, we just need receipts for orders we are dealing with.
  // We will change the component logic to simply filter its known receipts.
  return []; // Placeholder. We will handle this in the component.
};

/** Creates a DRAFT receipt for an order */
export const createReceipt = async (orderId, note = '') => {
  const params = note ? `?note=${encodeURIComponent(note)}` : '';
  const response = await authFetch(`${API_BASE_URL}/receipts/order/${orderId}${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await handleResponse(response);
  return data ? mapReceipt(data) : data;
};

/** Confirms receipts: marks COMPLETED and auto-deducts inventory. Takes an array of receipt IDs. */
export const confirmReceipts = async (receiptIds) => {
  const response = await authFetch(`${API_BASE_URL}/receipts/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Array.isArray(receiptIds) ? receiptIds : [receiptIds]),
  });
  return await handleResponse(response);
};

// Keep compatibility for single ID calls
export const confirmReceipt = (receiptId) => confirmReceipts([receiptId]);



// --- Product API ---

export const getProducts = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/products`));
  return Array.isArray(data) ? data.map(mapProduct) : data;
};

export const getProductsByType = async (productType) => {
  const response = await authFetch(`${API_BASE_URL}/products/get-by-type/${productType}`);
  const data = await handleResponse(response);
  return Array.isArray(data) ? data.map(mapProduct) : data;
};

export const createProduct = async (productData) => {
  const response = await authFetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });
  return await handleResponse(response);
};

export const updateProduct = async (productId, productData) => {
  const response = await authFetch(`${API_BASE_URL}/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });
  return await handleResponse(response);
};

// --- User API ---

export const getAllUsers = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/users`));
  return Array.isArray(data) ? data.map(mapUserResponse) : data;
};

export const getAllShippers = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/users/shippers`));
  return Array.isArray(data) ? data.map(mapUserResponse) : data;
};

export const getUserById = async (userId) => {
  const response = await authFetch(`${API_BASE_URL}/users/${userId}`);
  return await handleResponse(response);
};

export const createUser = async (userData) => {
  const response = await authFetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  return await handleResponse(response);
};

export const updateUser = async (userId, userData) => {
  const response = await authFetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  return await handleResponse(response);
};

export const deleteUser = async (userId) => {
  const response = await authFetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'DELETE',
  });
  return await handleResponse(response);
};

// --- Stores API ---

export const getAllStores = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/stores`));
  return Array.isArray(data) ? data.map(mapStoreResponse) : data;
};

export const getStoreById = async (id) => {
  const response = await authFetch(`${API_BASE_URL}/stores/${id}`);
  return await handleResponse(response);
};

export const createStore = async (storeData) => {
  const response = await authFetch(`${API_BASE_URL}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(storeData),
  });
  return await handleResponse(response);
};

export const updateStore = async (id, storeData) => {
  const response = await authFetch(`${API_BASE_URL}/stores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(storeData),
  });
  return await handleResponse(response);
};

export const deleteStore = async (id) => {
  const response = await authFetch(`${API_BASE_URL}/stores/${id}`, {
    method: 'DELETE',
  });
  return await handleResponse(response);
};

// --- Delivery API ---

export const getDeliveries = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/deliveries`));
  return Array.isArray(data) ? data.map(mapDelivery) : data;
};

export const getDeliveriesByShipperId = async (shipperId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/deliveries/get-by-shipper/${shipperId}`));
  return Array.isArray(data) ? data.map(mapDelivery) : data;
};

/**
 * Create delivery and assign orders + shipper
 * POST /deliveries/create — body: AssignShipperRequest { shipperId, orderIds[], deliveryDate }
 */
export const createDelivery = async (deliveryData) => {
  const body = {
    shipperId: deliveryData.shipperId,
    orderIds: deliveryData.orderIds,
    deliveryDate: deliveryData.deliveryDate,
  };
  const response = await authFetch(`${API_BASE_URL}/deliveries/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await handleResponse(response);
  return data ? mapDelivery(data) : data;
};

/** PATCH /deliveries/{deliveryId}/start — Shipper starts trip → orders become DELIVERING */
export const startDelivery = async (deliveryId) => {
  const response = await authFetch(`${API_BASE_URL}/deliveries/${deliveryId}/start`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await handleResponse(response);
  return data ? mapDelivery(data) : data;
};

export const deleteDelivery = async (id) => {
  const response = await authFetch(`${API_BASE_URL}/deliveries/${id}`, {
    method: 'DELETE',
  });
  return await handleResponse(response);
};

// --- Inventory Transactions API ---

export const getAllTransactions = async () => {
  const response = await authFetch(`${API_BASE_URL}/inventory-transactions`);
  return await handleResponse(response);
};

export const createTransaction = async (data) => {
  const response = await authFetch(`${API_BASE_URL}/inventory-transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await handleResponse(response);
};

export const getTransactionsByProductId = async (productId) => {
  const response = await authFetch(`${API_BASE_URL}/inventory-transactions/product/${productId}`);
  return await handleResponse(response);
};

export const getTransactionsByBatchId = async (batchId) => {
  const response = await authFetch(`${API_BASE_URL}/inventory-transactions/batch/${batchId}`);
  return await handleResponse(response);
};

// --- Inventories API ---

export const getInventories = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/inventories`));
  return Array.isArray(data) ? data.map(mapInventory) : data;
};

export const getInventoryById = async (inventoryId) => {
  const response = await authFetch(`${API_BASE_URL}/inventories/get-by-id/${inventoryId}`);
  const data = await handleResponse(response);
  return data ? mapInventory(data) : data;
};

// --- Log Batches API ---

export const getAllLogBatches = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches`));
  return Array.isArray(data) ? data.map(mapLogBatch) : data;
};

export const getLogBatchById = async (batchId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches/${batchId}`));
  return mapLogBatch(data);
};

export const getLogBatchesByPlanId = async (planId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches/plan/${planId}`));
  return Array.isArray(data) ? data.map(mapLogBatch) : data;
};

export const getLogBatchesByProductId = async (productId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches/product/${productId}`));
  return Array.isArray(data) ? data.map(mapLogBatch) : data;
};

/**
 * Update a log batch status
 * PATCH /log-batches/{batchId}/status?status=...
 */
export const updateLogBatchStatus = async (batchId, status) => {
  const response = await authFetch(`${API_BASE_URL}/log-batches/${batchId}/status?status=${status}`, {
    method: 'PATCH',
  });
  const data = await handleResponse(response);
  return mapLogBatch(data);
};

/**
 * Get all log batches by status
 * GET /log-batches/status/{status}
 */
export const getLogBatchesByStatus = async (status) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/log-batches/status/${status}`));
  return Array.isArray(data) ? data.map(mapLogBatch) : data;
};

/**
 * Create a log batch (Production)
 * POST /log-batches/production
 */
export const createProLogBatch = async (batchData) => {
  const response = await authFetch(`${API_BASE_URL}/log-batches/production`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchData),
  });
  const data = await handleResponse(response);
  return mapLogBatch(data);
};

/**
 * Create a log batch (Purchase)
 * POST /log-batches/purchase
 */
export const createPurLogBatch = async (batchData) => {
  const response = await authFetch(`${API_BASE_URL}/log-batches/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchData),
  });
  const data = await handleResponse(response);
  return mapLogBatch(data);
};

/** Alias for backward compatibility */
export const createBatch = createProLogBatch;
export const createPurchaseBatch = createPurLogBatch;

// --- Production Plans API ---

export const getProductionPlans = async () => {
  const response = await authFetch(`${API_BASE_URL}/production-plans`);
  return await handleResponse(response);
};

export const createProductionPlan = async (planData) => {
  const response = await authFetch(`${API_BASE_URL}/production-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(planData),
  });
  return await handleResponse(response);
};

export const getProductionPlanById = async (id) => {
  const response = await authFetch(`${API_BASE_URL}/production-plans/${id}`);
  return await handleResponse(response);
};

export const getProductionPlanDetails = async (planId) => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/production-plan-details/plan/${planId}`));
  return Array.isArray(data) ? data : [];
};

// --- Quality Feedback API ---

export const getAllFeedbacks = async () => {
  const data = await handleResponse(await authFetch(`${API_BASE_URL}/feedbacks`));
  return Array.isArray(data) ? data.map(mapFeedback) : data;
};

export const createFeedback = async (data) => {
  const response = await authFetch(`${API_BASE_URL}/feedbacks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await handleResponse(response);
};

// --- Recipes API ---

export const getRecipes = async () => {
  const response = await authFetch(`${API_BASE_URL}/recipes`);
  return await handleResponse(response);
};

export const searchRecipes = async (keyword) => {
  const response = await authFetch(`${API_BASE_URL}/recipes/search/${encodeURIComponent(keyword)}`);
  return await handleResponse(response);
};

// --- Recipe Details API ---

export const getAllRecipeDetails = async () => {
  const response = await authFetch(`${API_BASE_URL}/recipe-details`);
  return await handleResponse(response);
};

export const getRecipeDetailsByRecipeId = async (recipeId) => {
  const response = await authFetch(`${API_BASE_URL}/recipe-details/recipe/${recipeId}`);
  return await handleResponse(response);
};