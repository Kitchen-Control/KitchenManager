import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getDeliveriesByShipperId, startDelivery, completeOrder, updateOrderStatus, getReceiptsByOrderId } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
    if (orders.every(o => o.status === 'DONE' || o.status === 'DAMAGED' || o.status === 'CANCLED')) return 'DONE';
    if (orders.some(o => o.status === 'DELIVERING')) return 'DELIVERING';
    return 'WAITING';
  };

  const handleStartDelivery = async (deliveryId, orders) => {
    setIsStarting(deliveryId);
    try {
      // Check if ALL orders are DISPATCHED and have COMPLETED receipts
      const readyOrders = orders.filter(o => {
        const hasCompletedReceipt = (orderReceipts[o.order_id] || []).some(r => r.status === 'COMPLETED');
        return o.status === 'DISPATCHED' && hasCompletedReceipt;
      });

      if (readyOrders.length < orders.length) {
        toast.error(`Có đơn hàng chưa được Kho xuất hàng (COMPLETED & DISPATCHED). Vui lòng chờ Kho Hoàn tất Xuất kho trước.`);
        setIsStarting(null);
        return;
      }

      await startDelivery(deliveryId);
      toast.success('Đã bắt đầu chuyến giao hàng!');
      reloadData();
    } catch (error) {
      toast.error('Lỗi khi bắt đầu giao hàng: ' + error.message);
    } finally {
      setIsStarting(null);
    }
  };


  const handleCompleteOrder = async (status) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      if (status === 'DONE') {
        // PATCH /orders/{id}/complete
        await completeOrder(selectedOrder.order_id);
        toast.success(`Đã giao thành công đơn hàng #${selectedOrder.order_id}`);
      } else {
        // DAMAGED — dùng updateOrderStatus
        await updateOrderStatus(selectedOrder.order_id, 'DAMAGED');
        toast.warning(`Đã báo cáo đơn hàng #${selectedOrder.order_id} bị hư hỏng`);
      }
      setShowCompleteDialog(false);
      setSelectedOrder(null);
      reloadData();
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
            {(delivery.orders || []).map((order, index) => (
              <div key={order.order_id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{order.store_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Cửa hàng #{order.store_id}
                      </p>
                    </div>
                  </div>
                  {showActions && order.status === 'DELIVERING' && (
                    <Button
                      size="sm"
                      onClick={() => { setSelectedOrder(order); setShowCompleteDialog(true); }}
                    >
                      Hoàn thành
                    </Button>
                  )}
                  {(order.status === 'DONE' || order.status === 'DAMAGED' || order.status === 'DISPATCHED') && (
                    <StatusBadge status={order.status} type="order" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(order.order_details || []).map(detail => (
                    <span
                      key={detail.order_detail_id || detail.product_id}
                      className="inline-flex items-center gap-1 text-xs bg-background px-2 py-1 rounded border shadow-sm"
                    >
                      <Package className="h-3 w-3 text-purple-500" />
                      {detail.product_name || `SP #${detail.product_id}`} ×{detail.quantity}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {showActions && deliveryStatus === 'WAITING' && (() => {
            const allReady = (delivery.orders || []).every(o => {
              const receipts = orderReceipts[o.order_id] || [];
              return o.status === 'DISPATCHED' && receipts.some(r => r.status === 'COMPLETED');
            });

            return (
              <div className="flex justify-center mt-4">
                <Button
                  className="w-full sm:w-1/2 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleStartDelivery(delivery.delivery_id, delivery.orders)}
                  disabled={isDeliveryStarting || !allReady}
                >
                  {isDeliveryStarting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</>
                    : !allReady
                      ? <><Navigation className="mr-2 h-4 w-4 opacity-50" /> Chờ kho xuất hàng</>
                      : <><Navigation className="mr-2 h-4 w-4" /> Nhận và giao</>
                  }
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
              Xác nhận trạng thái đơn hàng #{selectedOrder?.order_id} — {selectedOrder?.store_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 border-green-400 hover:bg-green-50"
              onClick={() => handleCompleteOrder('DONE')}
              disabled={isUpdating}
            >
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <span>Giao thành công</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2 border-red-400 hover:bg-red-50"
              onClick={() => handleCompleteOrder('DAMAGED')}
              disabled={isUpdating}
            >
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <span>Hàng hư hỏng</span>
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
