// Constants for status labels and product types (used across app, no API)

export const ORDER_STATUS = {
  WAITTING: { label: 'Chờ xử lý', color: 'warning', class: 'status-waiting' },
  PROCESSING: { label: 'Đang xử lý', color: 'info', class: 'status-processing' },
  DISPATCHED: { label: 'Đã xuất kho', color: 'primary', class: 'status-dispatched' },
  DELIVERING: { label: 'Đang giao', color: 'purple', class: 'status-delivering' },
  DONE: { label: 'Hoàn thành', color: 'success', class: 'status-done' },
  DAMAGED: { label: 'Hư hỏng', color: 'destructive', class: 'status-damaged' },
  CANCLED: { label: 'Đã hủy', color: 'muted', class: 'status-cancelled' },
};

export const DELIVERY_STATUS = {
  WAITTING: { label: 'Chờ giao', color: 'warning', class: 'status-waiting' },
  PROCESSING: { label: 'Chờ giao', color: 'info', class: 'status-processing' },
  DONE: { label: 'Hoàn thành', color: 'success', class: 'status-done' },
};

export const BATCH_STATUS = {
  PROCESSING: { label: 'Đang sản xuất', color: 'info', class: 'status-processing' },
  WAITING_TO_CONFIRM: { label: 'Chờ xác nhận', color: 'warning', class: 'status-waiting' },
  DONE: { label: 'Đã xác nhận', color: 'success', class: 'status-done' },
  WAITING_TO_CANCLE: { label: 'Chờ huỷ hàng', color: 'warning', class: 'status-waiting' },
  CANCLED: { label: 'Đã hủy', color: 'muted', class: 'status-cancelled' },
  EXPIRED: { label: 'Đã hết hạn', color: 'destructive', class: 'status-damaged' },
  DAMAGED: { label: 'Đã hỏng', color: 'destructive', class: 'status-damaged' },
};

export const PRODUCT_TYPE = {
  RAW_MATERIAL: { label: 'Nguyên liệu', color: 'blue' },
  SEMI_FINISHED: { label: 'Bán thành phẩm', color: 'orange' },
  FINISHED_PRODUCT: { label: 'Thành phẩm', color: 'green' },
};

export const ROLE_ID = {
  ADMIN: 1,
  MANAGER: 2,
  STORE_STAFF: 3,
  KITCHEN_MANAGER: 4,
  SUPPLY_COORDINATOR: 5,
  SHIPPER: 6,
  WAREHOUSE_KEEPER: 7,
};

export const ROLE_REDIRECT_PATH = {
  [ROLE_ID.ADMIN]: '/admin',
  [ROLE_ID.MANAGER]: '/manager',
  [ROLE_ID.STORE_STAFF]: '/store',
  [ROLE_ID.KITCHEN_MANAGER]: '/kitchen',
  [ROLE_ID.SUPPLY_COORDINATOR]: '/coordinator',
  [ROLE_ID.SHIPPER]: '/shipper',
};
