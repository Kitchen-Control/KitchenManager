import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchOrders,
  getAllShippers,
  getAllStores,
  getReceiptsByStatus,
  createDelivery,
  updateOrderStatus,
} from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Package, Truck, MapPin, CheckCircle2, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function OrderAggregation() {
  const [orders, setOrders] = useState([]);
  const [readyReceipts, setReadyReceipts] = useState([]);
  const [shippers, setShippers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState([]); // Array of receipt_id
  const [showCreateDelivery, setShowCreateDelivery] = useState(false);
  const [selectedShipper, setSelectedShipper] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCreating, setIsCreating] = useState(false);

  const fetchEverything = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchOrders().catch(() => []),
      getAllShippers().catch(() => []),
      getAllStores().catch(() => []),
      getReceiptsByStatus('READY').catch(() => []),
    ]).then(([ordersRes, shippersRes, storesRes, receiptsRes]) => {
      const allOrders = Array.isArray(ordersRes) ? ordersRes : [];
      setOrders(allOrders);
      setShippers(Array.isArray(shippersRes) ? shippersRes : []);
      setStores(Array.isArray(storesRes) ? storesRes : []);

      // Show READY receipts for orders that are DISPATCHED or PARTIAL_DELIVERED
      // (Supplemental receipts for already delivered orders should also appear here)
      const allReceipts = Array.isArray(receiptsRes) ? receiptsRes : [];
      const dispatched = allOrders.filter(o => 
        (o.status === 'DISPATCHED' || o.status === 'PARTIAL_DELIVERED') && !o.delivery_id
      );
      const dispatchedOrderIds = new Set(dispatched.map(o => o.order_id));

      const groupable = allReceipts.filter(r => dispatchedOrderIds.has(r.order_id));
      setReadyReceipts(groupable);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEverything();
  }, [fetchEverything]);

  // Orders in PROCESSING / DRAFT receipt status - being handled by warehouse (preview only)
  const processingOrders = orders.filter(o =>
    (o.status === 'PROCESSING') && !o.delivery_id
  ).sort((a, b) => b.order_id - a.order_id);

  // Orders DISPATCHED but already assigned to a delivery (exclude from grouping)
  const inDeliveryOrders = orders.filter(o =>
    (o.status === 'DISPATCHED' || o.status === 'DELIVERING') && o.delivery_id
  ).sort((a, b) => b.order_id - a.order_id);

  const toggleReceipt = (receiptId) => {
    setSelectedReceiptIds(prev =>
      prev.includes(receiptId) ? prev.filter(id => id !== receiptId) : [...prev, receiptId]
    );
  };

  const toggleAll = () => {
    if (selectedReceiptIds.length === readyReceipts.length) {
      setSelectedReceiptIds([]);
    } else {
      setSelectedReceiptIds(readyReceipts.map(r => r.receipt_id));
    }
  };

  const handleAssignShipper = async () => {
    if (!selectedShipper || selectedReceiptIds.length === 0) {
      toast.error('Vui lòng chọn shipper và ít nhất 1 phiếu xuất');
      return;
    }
    setIsCreating(true);
    try {
      // 1. Get unique order IDs from selected receipts
      const selectedRecs = readyReceipts.filter(r => selectedReceiptIds.includes(r.receipt_id));
      const orderIds = Array.from(new Set(selectedRecs.map(r => r.order_id)));

      // 2. Create the delivery record via POST /deliveries
      await createDelivery({
        shipperId: parseInt(selectedShipper, 10),
        orderIds: orderIds,
        deliveryDate: deliveryDate,
      });

      toast.success(`Đã tạo chuyến giao hàng cho ${orderIds.length} đơn hàng thành công!`);
      setShowCreateDelivery(false);
      setSelectedReceiptIds([]);
      setSelectedShipper('');
      fetchEverything();
    } catch (error) {
      toast.error(error.message || 'Giao hàng thất bại');
    } finally {
      setIsCreating(false);
    }
  };

  const selectedReceiptsData = readyReceipts.filter(r => selectedReceiptIds.includes(r.receipt_id));
  const groupedByStore = selectedReceiptsData.reduce((acc, receipt) => {
    const orderId = receipt.order_id;
    if (!acc[orderId]) {
      const order = orders.find(o => o.order_id === orderId);
      const store = stores.find(s => s.store_id === order?.store_id) || {
        store_name: order?.store_name || `Đơn #${orderId}`
      };
      acc[orderId] = { store, receipts: [] };
    }
    acc[orderId].receipts.push(receipt);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground ml-2">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Điều phối giao hàng</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gom các phiếu xuất kho đã sẵn sàng (READY) từ đơn DISPATCHED thành chuyến giao
          </p>
        </div>
        <div className="flex gap-2">
          {readyReceipts.length > 0 && (
            <Button variant="outline" onClick={toggleAll}>
              {selectedReceiptIds.length === readyReceipts.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          )}
          <Button
            onClick={() => setShowCreateDelivery(true)}
            disabled={selectedReceiptIds.length === 0}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <Truck className="h-4 w-4" />
            Tạo chuyến giao ({selectedReceiptIds.length} phiếu)
          </Button>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Section 1: DISPATCHED orders with READY receipts - ready to group */}
        {readyReceipts.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-indigo-700 border-b pb-2">
              <CheckCircle2 className="h-5 w-5" />
              Đơn hàng sẵn sàng giao (READY) — Chờ gom chuyến ({readyReceipts.length} phiếu)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyReceipts.map((receipt) => {
                const isSelected = selectedReceiptIds.includes(receipt.receipt_id);
                const order = orders.find(o => o.order_id === receipt.order_id);
                const store = stores.find(s => s.store_id === order?.store_id);

                return (
                  <Card
                    key={receipt.receipt_id}
                    className={`cursor-pointer transition-all border-2 ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    onClick={() => toggleReceipt(receipt.receipt_id)}
                  >
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-lg">Phiếu #{receipt.receipt_id}</CardTitle>
                        <p className="text-sm text-muted-foreground">Mã: {receipt.receipt_code}</p>
                      </div>
                      <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary border-primary shadow-sm' : 'border-muted'}`}>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-3">
                      <div className="text-sm space-y-1">
                        <p className="font-bold text-slate-700 flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-primary" />
                          {store ? store.store_name : order?.store_name || (order ? `Cửa hàng #${order.store_id}` : 'Đang tải...')}
                        </p>
                        <p className="text-xs text-muted-foreground">Đơn hàng: #{receipt.order_id}</p>
                        <StatusBadge status={order?.status || 'DISPATCHED'} type="order" />
                      </div>

                      {/* Product preview from inventory transactions */}
                      {(receipt.inventory_transactions || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {Array.from(
                            receipt.inventory_transactions.reduce((map, tx) => {
                              const name = tx.productName || `SP #${tx.productId}`;
                              map.set(name, (map.get(name) || 0) + tx.quantity);
                              return map;
                            }, new Map())
                          ).map(([name, qty], idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 h-5 bg-slate-100 text-slate-700 hover:bg-slate-200 border-none">
                              {name} x{qty}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Show order details if receipt has no transactions */}
                      {(receipt.inventory_transactions || []).length === 0 && order && (order.order_details || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(order.order_details || []).map((od, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 h-5 bg-slate-100 text-slate-700 hover:bg-slate-200 border-none">
                              {od.product_name} x{od.quantity}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-indigo-700 border-b pb-2">
              <CheckCircle2 className="h-5 w-5" />
              Chờ phiếu xuất kho (COMPLETED)
            </h2>
            <EmptyState
              title="Không có phiếu xuất sẵn sàng"
              description="Phiếu xuất sẽ xuất hiện ở đây khi Warehouse xác nhận xuất kho (trạng thái COMPLETED) và đơn hàng chuyển sang DISPATCHED."
              icon={Package}
            />
          </section>
        )}

        {/* Section 2: PROCESSING orders - being prepared by warehouse (preview only, cannot group) */}
        {processingOrders.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-600 border-b pb-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Đang soạn hàng tại Kho ({processingOrders.length} đơn) — Chưa thể gom chuyến
            </h2>
            <p className="text-xs text-muted-foreground mb-3 italic">
              Các đơn này đang được Warehouse soạn hàng. Chỉ khi Warehouse xác nhận xuất kho (phiếu COMPLETED) mới có thể gom chuyến.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
              {processingOrders.map((order) => {
                const store = stores.find(s => s.store_id === order.store_id);
                return (
                  <Card key={order.order_id} className="bg-muted/30 border-dashed border-amber-200">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg text-muted-foreground">Đơn #{order.order_id}</CardTitle>
                        <StatusBadge status={order.status} type="order" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2 leading-none">
                          <MapPin className="h-3 w-3" />
                          <span>{store?.store_name || order.store_name || `Cửa hàng #${order.store_id}`}</span>
                        </div>
                        {(order.order_details || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(order.order_details || []).map((od, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] px-1.5 h-5 border-amber-200 text-amber-700">
                                {od.product_name} x{od.quantity}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="italic text-xs">Chờ Warehouse tạo phiếu xuất kho...</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}


        {readyReceipts.length === 0 && processingOrders.length === 0 && inDeliveryOrders.length === 0 && (
          <EmptyState
            title="Không có đơn hàng nào"
            description="Hiện không có đơn hàng nào đang xử lý hoặc chờ giao."
            icon={Package}
          />
        )}
      </div>

      <Dialog open={showCreateDelivery} onOpenChange={setShowCreateDelivery}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo chuyến giao hàng</DialogTitle>
            <DialogDescription>
              Chọn Shipper để giao {selectedReceiptIds.length} phiếu xuất ({Object.keys(groupedByStore).length} đơn hàng).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phiếu xuất đã chọn ({selectedReceiptIds.length})</Label>
              <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-muted/50 rounded-lg">
                {Object.values(groupedByStore).map(({ store, receipts: recs }) => (
                  <div key={store.store_id || Math.random()} className="text-sm border-b pb-2 last:border-0">
                    <p className="font-medium text-indigo-700">{store.store_name}</p>
                    <div className="pl-2 mt-1">
                      {recs.map(r => (
                        <p key={r.receipt_id} className="text-xs text-muted-foreground">• Phiếu #{r.receipt_id} ({r.receipt_code})</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Chọn Shipper</Label>
              <Select value={selectedShipper} onValueChange={setSelectedShipper}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhân viên giao hàng" />
                </SelectTrigger>
                <SelectContent>
                  {shippers.map((shipper) => (
                    <SelectItem key={shipper.user_id} value={String(shipper.user_id)}>
                      {shipper.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ngày giao hàng</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDelivery(false)}>
              Hủy
            </Button>
            <Button onClick={handleAssignShipper} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Xác nhận tạo chuyến'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
