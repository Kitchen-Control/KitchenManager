import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getDeliveriesByShipperId, updateDeliveryStatus, updateOrderStatus, getReceiptsByOrderId, updateReceiptStatus } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Badge } from '../../components/ui/badge';
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
  Truck,
  MapPin,
  Package,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function MyTrips() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [orderReceipts, setOrderReceipts] = useState({}); // { orderId: [receipts] }
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isStarting, setIsStarting] = useState(null);

  const reloadData = async () => {
    if (!user?.user_id) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getDeliveriesByShipperId(user.user_id);
      const deliveryList = Array.isArray(data) ? data : [];
      setDeliveries(deliveryList);

      // Fetch receipts for all orders in these deliveries
      const orderIds = [...new Set(deliveryList.flatMap(d => (d.orders || []).map(o => o.order_id)))];
      const receiptsData = {};
      await Promise.all(orderIds.map(async (id) => {
        try {
          const res = await getReceiptsByOrderId(id);
          receiptsData[id] = Array.isArray(res) ? res : [];
        } catch (e) {
          receiptsData[id] = [];
        }
      }));
      setOrderReceipts(receiptsData);
    } catch (error) {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reloadData(); }, [user?.user_id]);

  /**
   * Xác định trạng thái của delivery dựa trên orders bên trong
   * (DeliveryResponse không có field `status` riêng)
   */
  const getDeliveryStatus = (delivery) => {
    const orders = delivery.orders || [];
    if (orders.length === 0) return 'WAITING';
    if (orders.every(o => o.status === 'DONE' || o.status === 'DAMAGED' || o.status === 'CANCELED' || o.status === 'PARTIAL_DELIVERED')) return 'DONE';
    if (orders.some(o => o.status === 'DELIVERING')) return 'DELIVERING';
    return 'WAITING';
  };

  const handleStartDelivery = async (deliveryId, orders) => {
    if (!confirm('Xác nhận Đã Nhận Hàng tại Kho và Bắt đầu Giao?')) return;
    setIsStarting(deliveryId);
    try {
      // 1. Update delivery status to DELIVERING
      await updateDeliveryStatus(deliveryId, 'DELIVERING');
      
      // 2. Update all orders in this delivery to DELIVERING status (Flow 1 Step 5)
      // Receipts stay in COMPLETED status (representing exported) throughout delivery.
      await Promise.all(orders.map(o => 
        updateOrderStatus(o.order_id, 'DELIVERING', 'Bắt đầu giao hàng').catch(e => console.error(e))
      ));

      toast.success('Đã xác nhận lấy hàng và bắt đầu giao!');
      reloadData();
    } catch (error) {
      toast.error('Lỗi khi bắt đầu giao hàng: ' + error.message);
    } finally {
      setIsStarting(null);
    }
  };

  const handleCompleteReceipt = async (receipt, order, status) => {
    setIsUpdating(true);
    try {
      if (status === 'DONE') {
        // Flow 1 Step 6: Update receipt to DELIVERED
        await updateReceiptStatus(receipt.receipt_id, 'DELIVERED');
        
        // Check if all items for the order are now DELIVERED
        // We fetch fresh receipts to be sure
        const allReceipts = await getReceiptsByOrderId(order.order_id);
        const deliveredQty = allReceipts
            .filter(r => r.status === 'DELIVERED')
            .flatMap(r => r.receipt_details || []) // Note: receipt_details needed for accurate count
            .reduce((acc, rd) => acc + rd.quantity, 0);
        
        // Or if we don't have receipt_details, rely on order status if backend handles it
        // The flow says: Order -> DONE when total quantity matches.
        // For now, we update the order to DONE if this was the intended final fulfillment
        // or let the backend decide. User flow says we check sum.
        
        // Simple logic for UI: if this was the last pending receipt, mark order DONE
        const stillPending = allReceipts.some(r => r.status !== 'DELIVERED' && r.status !== 'CANCELED');
        if (!stillPending) {
           await updateOrderStatus(order.order_id, 'DONE', 'Giao thành công toàn bộ');
        }

        toast.success(`Đã giao xong phiếu #${receipt.receipt_id}`);
      } else if (status === 'DAMAGED') {
        // Flow 1 Risk 2: Update Order to DAMAGED, no inventory return
        await updateOrderStatus(order.order_id, 'DAMAGED', 'Hàng hư hỏng - Tiêu hủy');
        toast.warning('Đã báo cáo hàng hư hỏng (Tiêu hủy)');
      } else if (status === 'PARTIAL_DELIVERED') {
        // Flow 1 Risk 1: Update Order to PARTIAL_DELIVERED
        await updateOrderStatus(order.order_id, 'PARTIAL_DELIVERED', 'Giao thiếu hàng');
        toast.warning('Đã báo cáo giao thiếu hàng');
      }

      setShowCompleteDialog(false);
      setSelectedOrder(null);
      setTimeout(() => reloadData(), 500);
    } catch (e) {
      toast.error(e.message || 'Cập nhật thất bại');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      weekday: 'short', day: '2-digit', month: '2-digit',
    });
  };

  const DeliveryCard = ({ delivery, showActions = true }) => {
    const deliveryStatus = getDeliveryStatus(delivery);
    const isDeliveryStarting = isStarting === delivery.delivery_id;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Chuyến #{delivery.delivery_id}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {formatDate(delivery.delivery_date)} • {(delivery.orders || []).length} điểm giao
                </p>
              </div>
            </div>
            <StatusBadge status={deliveryStatus} type="delivery" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {(delivery.orders || []).map((order, index) => {
               const receipts = orderReceipts[order.order_id] || [];
               return (
                <div key={order.order_id} className="p-4 bg-muted/40 rounded-xl border border-muted-foreground/10 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{order.store_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Cửa hàng #{order.store_id}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={order.status} type="order" />
                  </div>

                  <div className="space-y-2 pl-11">
                    {receipts.length > 0 ? (
                      receipts.map(receipt => (
                        <div key={receipt.receipt_id} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                          <div>
                            <span className="font-medium">Phiếu #{receipt.receipt_id}</span>
                            <Badge variant="outline" className="ml-2 text-[10px] h-4">{receipt.status}</Badge>
                          </div>
                          {receipt.status === 'DELIVERING' && (
                            <Button 
                              size="sm" 
                              className="h-7 text-xs bg-green-600 hover:bg-green-700"
                              onClick={() => { 
                                setSelectedOrder({ ...order, currentReceipt: receipt }); 
                                setShowCompleteDialog(true); 
                              }}
                            >
                              Hoàn tất
                            </Button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs italic text-muted-foreground">Chưa có phiếu xuất</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {showActions && deliveryStatus === 'WAITING' && (() => {
            const allReceiptsInDelivery = (delivery.orders || []).flatMap(o => orderReceipts[o.order_id] || []);
            const hasCompletedReceipts = allReceiptsInDelivery.some(r => r.status === 'COMPLETED');

            return (
              <div className="flex justify-center mt-4">
                <Button
                  className="w-full sm:w-1/2 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => handleStartDelivery(delivery.delivery_id, delivery.orders)}
                  disabled={isDeliveryStarting || !hasCompletedReceipts}
                >
                  {isDeliveryStarting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</>
                  ) : hasCompletedReceipts ? (
                    <><Navigation className="mr-2 h-4 w-4" /> Bắt đầu giao ({allReceiptsInDelivery.filter(r => r.status === 'COMPLETED').length} phiếu)</>
                  ) : (
                    <><Navigation className="mr-2 h-4 w-4 opacity-50" /> Chờ Phiếu Sẵn sàng</>
                  )}
                </Button>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (deliveries.length === 0) {
    return (
      <div className="p-6">
        <EmptyState icon={Truck} title="Chưa có chuyến giao hàng" description="Bạn chưa được phân công chuyến giao hàng nào" />
      </div>
    );
  }

  const deliveringTrips = deliveries.filter(d => getDeliveryStatus(d) === 'DELIVERING');
  const waitingTrips = deliveries.filter(d => getDeliveryStatus(d) === 'WAITING');
  const doneTrips = deliveries.filter(d => getDeliveryStatus(d) === 'DONE');

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chuyến hàng của tôi</h1>
        <p className="text-muted-foreground">Quản lý và theo dõi các chuyến giao hàng</p>
      </div>

      {deliveringTrips.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Navigation className="h-5 w-5 text-blue-500" /> Đang giao hàng
          </h2>
          {deliveringTrips.map(d => <DeliveryCard key={d.delivery_id} delivery={d} />)}
        </div>
      )}

      {waitingTrips.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-yellow-500" /> Chờ nhận hàng
          </h2>
          {waitingTrips.map(d => <DeliveryCard key={d.delivery_id} delivery={d} />)}
        </div>
      )}

      {doneTrips.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" /> Đã hoàn thành
          </h2>
          {doneTrips.map(d => <DeliveryCard key={d.delivery_id} delivery={d} showActions={false} />)}
        </div>
      )}

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hoàn thành giao hàng</DialogTitle>
            <DialogDescription>
              Xác nhận trạng thái cho Phiếu #${selectedOrder?.currentReceipt?.receipt_id} của Đơn #{selectedOrder?.order_id} — {selectedOrder?.store_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 border-green-400 hover:bg-green-50"
              onClick={() => handleCompleteReceipt(selectedOrder.currentReceipt, selectedOrder, 'DONE')}
              disabled={isUpdating}
            >
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <span className="text-sm">Giao thành công</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 border-orange-400 hover:bg-orange-50"
              onClick={() => handleCompleteReceipt(selectedOrder.currentReceipt, selectedOrder, 'PARTIAL_DELIVERED')}
              disabled={isUpdating}
            >
              <Package className="h-6 w-6 text-orange-500" />
              <span className="text-sm">Giao thiếu</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 border-red-400 hover:bg-red-50"
              onClick={() => handleCompleteReceipt(selectedOrder.currentReceipt, selectedOrder, 'DAMAGED')}
              disabled={isUpdating}
            >
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <span className="text-sm">Hàng hư hỏng</span>
            </Button>
          </div>
          <DialogFooter>
            {isUpdating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Button variant="ghost" onClick={() => setShowCompleteDialog(false)} disabled={isUpdating}>Hủy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
