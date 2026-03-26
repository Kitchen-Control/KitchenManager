import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getDeliveriesByShipperId, 
  updateDeliveryStatus, 
  getReceiptsByOrderId,
  updateReceiptStatus,
  createAdditionalOrder
} from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/ui/badge';
import { 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Navigation,
  Loader2,
  RefreshCw,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function MyTrips() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [localDelivered, setLocalDelivered] = useState({}); // { deliveryId: { orderId: boolean } }
  const [damagedItems, setDamagedItems] = useState({}); // { orderId: { order_detail_id: qty } }

  // Load local delivered state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('shipper_delivered_orders');
      if (saved) setLocalDelivered(JSON.parse(saved));
    } catch (e) { console.error('Failed to load delivered state:', e); }
  }, []);

  // Save local delivered state
  const markAsDelivered = (deliveryId, orderId) => {
    setLocalDelivered(prev => {
      const newMap = {
        ...prev,
        [deliveryId]: {
          ...(prev[deliveryId] || {}),
          [orderId]: true
        }
      };
      localStorage.setItem('shipper_delivered_orders', JSON.stringify(newMap));
      return newMap;
    });
  };

  const fetchData = useCallback(async () => {
    if (!user?.user_id) return;
    setIsLoading(true);
    try {
      const data = await getDeliveriesByShipperId(user.user_id);
      setDeliveries(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Lỗi tải danh sách vận chuyển: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartDelivery = async (delivery) => {
    const orders = delivery.orders || [];

    // Pre-flight check: all orders must be DISPATCHED before starting the trip
    const notDispatched = orders.filter(o => o.status !== 'DISPATCHED');
    if (notDispatched.length > 0) {
      const names = notDispatched.map(o => `Đơn #${o.order_id} (${o.status})`).join(', ');
      toast.error(
        `Không thể bắt đầu: ${names} chưa sẵn sàng. Yêu cầu tất cả đơn phải ở trạng thái DISPATCHED.`
      );
      return;
    }

    setProcessingId(delivery.delivery_id);
    try {
      await updateDeliveryStatus(delivery.delivery_id, 'DELIVERING');

      // Also complete any READY receipts for these orders
      const receiptPromises = orders.map(async (order) => {
        try {
          const receipts = await getReceiptsByOrderId(order.order_id).catch(() => []);
          const readyReceipts = (receipts || []).filter(r => r.status === 'READY');
          for (const r of readyReceipts) {
            await updateReceiptStatus(r.receipt_id, 'COMPLETED');
          }
        } catch (e) {
          console.warn(`Failed to update receipts for order #${order.order_id}:`, e.message);
        }
      });
      await Promise.all(receiptPromises);

      toast.success('Đã bắt đầu chuyến giao hàng!');
      fetchData();
    } catch (error) {
      toast.error('Lỗi bắt đầu chuyến: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleDamage = (orderId, detailId) => {
    setDamagedItems(prev => {
      const orderDamage = prev[orderId] || {};
      const current = orderDamage[detailId] || 0;
      return {
        ...prev,
        [orderId]: {
          ...orderDamage,
          [detailId]: current > 0 ? 0 : 1
        }
      };
    });
  };

  const handleConfirmOrderDelivery = async (deliveryId, orderId) => {
    setProcessingId(orderId);
    try {
      const orderObj = deliveries.flatMap(d => d.orders).find(o => o.order_id === orderId);
      // Snapshot and immediately clear damage state for this order
      const currentOrderDamage = { ...(damagedItems[orderId] || {}) };
      const damagedEntries = Object.entries(currentOrderDamage).filter(([_, qty]) => qty > 0);

      // Clear damaged items for THIS order immediately to prevent bleed-over
      setDamagedItems(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });

      if (damagedEntries.length > 0) {
        // Create SUPPLEMENT order immediately when shipper reports damage
        try {
          const supplementDetails = damagedEntries.map(([did]) => {
            const detail = orderObj?.order_details?.find(d => String(d.order_detail_id) === String(did));
            return detail ? { productId: detail.product_id, quantity: detail.quantity } : null;
          }).filter(Boolean);

          if (supplementDetails.length > 0) {
            await createAdditionalOrder(orderId, {
              storeId: orderObj?.store_id,
              type: 'SUPPLEMENT',
              comment: 'SUPPLEMENT_SHIPPER_DAMAGE',
              orderDetails: supplementDetails
            });
            toast.success('Đã tạo đơn bù SUPPLEMENT cho các sản phẩm hỏng.');
          }
        } catch (suppErr) {
          console.error('Failed to create supplement order:', suppErr);
          toast.error('Lỗi tạo đơn bù: ' + suppErr.message);
        }
      }

      // Mark as confirmed locally (orders are already DELIVERING from trip start)
      // Store this in localStorage so the Store side can detect shipper confirmed
      localStorage.setItem(`shipper_confirmed_${orderId}`, 'true');
      markAsDelivered(deliveryId, orderId);
      toast.success(`Đã xác nhận giao đơn #${orderId}. Chờ Store đối soát.`);
      fetchData();
    } catch (error) {
      toast.error('Lỗi xác nhận: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const DeliveryCard = ({ delivery }) => {
    const isProcessingFull = processingId === delivery.delivery_id;
    const canStart = delivery.status === 'WAITING' || delivery.status === 'READY' || delivery.status === 'PROCESSING';
    const canComplete = delivery.status === 'DELIVERING';
    const isDone = delivery.status === 'DONE';
    const orders = delivery.orders || [];

    return (
      <Card className={`overflow-hidden border-l-4 ${canComplete ? 'border-l-blue-500' : isDone ? 'border-l-green-500' : 'border-l-slate-300'}`}>
        <CardHeader className="bg-slate-50/50 pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${isDone ? 'bg-green-100' : 'bg-blue-100'}`}>
                <Truck className={`h-5 w-5 ${isDone ? 'text-green-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <CardTitle className="text-lg">Chuyến #{delivery.delivery_id}</CardTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {delivery.delivery_date || 'Hôm nay'}
                  </span>
                </div>
              </div>
            </div>
            <StatusBadge status={delivery.status} type="delivery" />
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ClipboardList className="h-4 w-4" />
              Đơn hàng ({orders.length}):
            </div>
            <div className="space-y-3">
              {orders.map(order => {
                const isDeliveredLocally = localDelivered[delivery.delivery_id]?.[order.order_id] || order.status === 'DONE' || order.status === 'DAMAGED';
                const isProcessingOrder = processingId === order.order_id;
                
                return (
                  <div key={order.order_id} className="flex flex-col p-3 rounded-lg border bg-white shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm">Đơn #{order.order_id}</span>
                      <Badge variant="outline" className="text-[10px] h-5">{order.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3" />
                      <span>{order.store_name || `Cửa hàng #${order.store_id}`}</span>
                    </div>
                    
                    <div className="space-y-1 mt-1">
                      {order.order_details?.map(od => (
                        <div key={od.order_detail_id} className="flex items-center justify-between text-xs p-1.5 bg-slate-50 rounded border border-slate-100">
                          <span className="flex-1">{od.product_name} <strong>x{od.quantity}</strong></span>
                          {!isDeliveredLocally && (
                            <Button 
                              size="sm" 
                              variant={damagedItems[order.order_id]?.[od.order_detail_id] > 0 ? "destructive" : "outline"}
                              className="h-6 text-[10px] px-2 ml-2"
                              onClick={() => toggleDamage(order.order_id, od.order_detail_id)}
                            >
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Báo hỏng
                            </Button>
                          )}
                          {damagedItems[order.order_id]?.[od.order_detail_id] > 0 && isDeliveredLocally && (
                            <Badge variant="destructive" className="h-5 text-[10px] px-1">Hỏng</Badge>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-2 border-t flex justify-end">
                        <Button
                          size="sm"
                          variant={isDeliveredLocally ? "ghost" : "default"}
                          className={`h-8 text-xs ${isDeliveredLocally ? "text-green-600 font-bold" : "bg-blue-600 hover:bg-blue-700"}`}
                          onClick={() => handleConfirmOrderDelivery(delivery.delivery_id, order.order_id, order.status)}
                          disabled={isProcessingOrder || isDone || !canComplete || isDeliveredLocally}
                        >
                          {isDeliveredLocally ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Đã giao</>
                          ) : isProcessingOrder ? (
                            <><Loader2 className="h-3 w-3 animate-spin mr-1" /> ...</>
                          ) : (
                            "Xác nhận"
                          )}
                        </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            {canStart && (
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 h-10 font-bold"
                onClick={() => handleStartDelivery(delivery)}
                disabled={isProcessingFull}
              >
                {isProcessingFull ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Navigation className="h-4 w-4 mr-2" />}
                Nhận và giao
              </Button>
            )}
            {canComplete && (
              <div className="w-full flex items-center justify-center p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-sm font-bold gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang giao hàng...
              </div>
            )}
            {isDone && (
              <div className="w-full flex items-center justify-center p-3 bg-green-50 text-green-700 rounded-lg border border-green-100 text-sm font-bold gap-2">
                <CheckCircle2 className="h-4 w-4" /> Giao hàng thành công
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading && deliveries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lịch trình của tôi</h1>
          <p className="text-sm text-muted-foreground">Quản lý các chuyến đi được phân công</p>
        </div>
        <Button size="icon" variant="outline" onClick={fetchData} className="rounded-full">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          title="Không có chuyến đi"
          description="Bạn chưa được phân công chuyến đi nào."
          icon={Truck}
        />
      ) : (
        <div className="grid gap-6">
          {deliveries.filter(d => d.status === 'DELIVERING').map(d => <DeliveryCard key={d.delivery_id} delivery={d} />)}
          {deliveries.filter(d => d.status === 'WAITING' || d.status === 'READY' || d.status === 'PROCESSING').map(d => <DeliveryCard key={d.delivery_id} delivery={d} />)}
        </div>
      )}
    </div>
  );
}
