// Constants for status labels and product types (used across app, no API)

export const ORDER_STATUS = {
  WAITING: { label: 'Chờ xử lý', color: 'warning', class: 'status-waiting' },
  PROCESSING: { label: 'Đang xử lý', color: 'info', class: 'status-processing' },
  DISPATCHED: { label: 'Đã xuất kho', color: 'primary', class: 'status-dispatched' },
  DELIVERING: { label: 'Đang giao', color: 'purple', class: 'status-delivering' },
  PARTIAL_DELIVERED: { label: 'Giao một phần', color: 'warning', class: 'status-partial' },
  DONE: { label: 'Hoàn thành', color: 'success', class: 'status-done' },
  DAMAGED: { label: 'Hư hỏng', color: 'destructive', class: 'status-damaged' },
  CANCELED: { label: 'Đã hủy', color: 'muted', class: 'status-cancelled' },
};

export const DELIVERY_STATUS = {
  WAITING: { label: 'Chờ giao', color: 'warning', class: 'status-waiting' },
  DELIVERING: { label: 'Đang giao', color: 'info', class: 'status-delivering' },
  DONE: { label: 'Hoàn thành', color: 'success', class: 'status-done' },
  CANCELED: { label: 'Đã hủy', color: 'muted', class: 'status-cancelled' },
};

export const BATCH_STATUS = {
  PROCESSING: { label: 'Đang sản xuất', color: 'info', class: 'status-processing' },
  WAITING_TO_CONFIRM: { label: 'Chờ xác nhận', color: 'warning', class: 'status-waiting' },
  DONE: { label: 'Đã xác nhận', color: 'success', class: 'status-done' },
  WAITING_TO_CANCEL: { label: 'Chờ huỷ / hỏng', color: 'warning', class: 'status-waiting' },
  DAMAGED: { label: 'Đã hỏng (Kho xác nhận)', color: 'destructive', class: 'status-damaged' },
};

export const PRODUCT_TYPE = {
  RAW_MATERIAL: { label: 'Nguyên liệu', color: 'blue' },
  MAIN: { label: 'Món chính', color: 'orange' },
  SIDE: { label: 'Món phụ', color: 'green' },
  BEVERAGE: { label: 'Đồ uống', color: 'purple' },
  DESSERT: { label: 'Tráng miệng', color: 'pink' },
  SAUCE: { label: 'Xốt', color: 'yellow' },
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

export const PRODUCTION_PLAN_STATUS = {
  DRAFT: { label: 'Nháp', color: 'muted' },
  WAITING: { label: 'Chờ duyệt', color: 'warning' },
  PROCESSING: { label: 'Đang thực hiện', color: 'info' },
  COMPLETE_ONE_SECTION: { label: 'Hoàn thành 1 phần', color: 'primary' },
  DONE: { label: 'Hoàn thành', color: 'success' },
  CANCEL: { label: 'Đã hủy', color: 'destructive' },
};

export const RECEIPT_STATUS = {
  DRAFT: { label: 'Nháp', color: 'muted' },
  COMPLETED: { label: 'Hoàn thành', color: 'success' },
  CANCELED: { label: 'Đã hủy', color: 'destructive' },
};

export const INVENTORY_TYPE = {
  IMPORT: { label: 'Nhập kho', color: 'success' },
  EXPORT: { label: 'Xuất kho', color: 'danger' },
};
