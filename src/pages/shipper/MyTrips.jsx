import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getDeliveriesByShipperId, 
  updateDeliveryStatus, 
  updateOrderStatus, 
  getReceiptsByOrderId,
  updateReceiptStatus,
  createWasteLog,
  getOrderById,
  createAdditionalOrder,
  getOrderDetailsByOrderId
} from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Navigation,
  Loader2,
  RefreshCw,
  ClipboardList,
  AlertTriangle,
  PackageX
} from 'lucide-react';
import { toast } from 'sonner';

export default function MyTrips() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [orderOutcomes, setOrderOutcomes] = useState({}); // { orderId: { damagedProducts: { productId: boolean }, details: [], receipts: [], storeId: number } }
  const [localDelivered, setLocalDelivered] = useState({}); // { deliveryId: { orderId: boolean } }
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
          [orderId]: !prev[deliveryId]?.[orderId]
        }
      };
      localStorage.setItem('shipper_delivered_orders', JSON.stringify(newMap));
      return newMap;
    });
  };

  const fetchData = useCallback(async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const data = await getDeliveriesByShipperId(user.user_id);
      setDeliveries(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Lỗi tải danh sách vận chuyển: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartDelivery = async (delivery) => {
    setProcessingId(delivery.delivery_id);
    try {
      const orderIds = (delivery.orders || []).map(o => o.order_id);
      
      // Update delivery → DELIVERING. Order vẫn ở DISPATCHED.
      await updateDeliveryStatus(delivery.delivery_id, 'DELIVERING');
      
      // Chuyển tất cả Phiếu xuất (READY) của các đơn trong chuyến sang COMPLETED
      // -> Đây là trigger để backend TRỪ KHO thực tế.
      const receiptPromises = orderIds.map(async (orderId) => {
        try {
          const receipts = await getReceiptsByOrderId(orderId).catch(() => []);
          const readyReceipts = receipts.filter(r => r.status === 'READY');
          for (const r of readyReceipts) {
            await updateReceiptStatus(r.receipt_id, 'COMPLETED');
          }
        } catch (e) {
          console.warn(`Failed to update receipts for order #${orderId}:`, e.message);
        }
      });
      await Promise.all(receiptPromises);

      toast.success('Đã bắt đầu chuyến giao hàng và xác nhận xuất kho!');
      fetchData();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenOrderDialog = async (delivery, order) => {
    setProcessingId(delivery.delivery_id);
    setSelectedDelivery(delivery);
    
    // Fetch order details if missing
    try {
      const receipts = await getReceiptsByOrderId(order.order_id).catch(() => []);
      const exportReceipts = receipts.filter(r => r.type === 'EXPORT' || !r.type);

      let detailsToUse = order.order_details || [];
      if (detailsToUse.length === 0) {
        const fetchedDetails = await getOrderDetailsByOrderId(order.order_id);
        if (fetchedDetails && fetchedDetails.length > 0) detailsToUse = fetchedDetails;
      }

      const finalDetails = detailsToUse.length > 0 ? detailsToUse : (exportReceipts[0]?.receipt_details || []);
      const initialDamagedProducts = {};
      finalDetails.forEach(d => { 
        initialDamagedProducts[d.product_id] = orderOutcomes[order.order_id]?.damagedProducts?.[d.product_id] || false; 
      });

      setOrderOutcomes(prev => ({
        ...prev,
        [order.order_id]: {
          damagedProducts: initialDamagedProducts,
          details: finalDetails,
          receipts: exportReceipts,
          storeId: order.store?.storeId || order.store_id || order.sender_id,
        }
      }));
      
      setSelectedOrder(order);
      setShowOrderDialog(true);
    } catch (error) {
      toast.error('Lỗi tải chi tiết đơn hàng: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmOrderDelivery = (orderId) => {
    markAsDelivered(selectedDelivery.delivery_id, orderId);
    setShowOrderDialog(false);
    toast.success(`Đã xác nhận giao đơn #${orderId}`);
  };

  const handleFinalizeTrip = async () => {
    if (!selectedDelivery) return;
    setProcessingId(selectedDelivery.delivery_id);
    try {
      for (const orderId in orderOutcomes) {
        const outcome = orderOutcomes[orderId];
        const damagedProductIds = Object.keys(outcome.damagedProducts).filter(id => outcome.damagedProducts[id]);
        const isAnyDamaged = damagedProductIds.length > 0;

        if (isAnyDamaged) {
          // Chỉ đơn hàng có sản phẩm hỏng mới update status → DAMAGED
          const damagedIdsTag = ` [DAMAGED_IDS: ${damagedProductIds.join(',')}]`;
          try {
            await updateOrderStatus(parseInt(orderId), 'DAMAGED', `Shipper báo hỏng sản phẩm${damagedIdsTag}`);
          } catch (e) {
            console.warn(`Order #${orderId} DAMAGED update failed:`, e);
          }

          // Tạo waste log cho từng sản phẩm hỏng
          const damagedDetails = outcome.details.filter(d => outcome.damagedProducts[d.product_id]);
          for (const item of damagedDetails) {
            const receipt = outcome.receipts[0];
            const tx = (receipt?.inventory_transactions || []).find(t => t.product_id === item.product_id);
            await createWasteLog({
              productId: item.product_id,
              batchId: tx?.batch_id || 0,
              orderId: parseInt(orderId),
              quantity: item.quantity,
              wasteType: 'DAMAGED_SHIPPING',
              note: `Hang hong SP #${item.product_id} trong don #${orderId}`
            }).catch(e => console.error('Waste log failed:', e));
          }

          // Tạo đơn bù SUPPLEMENT cho sản phẩm hỏng
          toast.loading(`Đang tạo đơn bù cho #${orderId}...`, { id: `supp-${orderId}` });
          const newOrder = await createAdditionalOrder(parseInt(orderId), {
            storeId: outcome.storeId,
            type: 'SUPPLEMENT',
            comment: `SUPPLEMENT - Shipper bao hong san pham - don #${orderId}`,
            orderDetails: damagedDetails.map(d => ({
              productId: d.product_id,
              quantity: d.quantity
            }))
          }).catch(e => {
            console.error('Shipper auto-supplement failed:', e);
            toast.error(`Không thể tạo đơn bù #${orderId}: ` + e.message, { id: `supp-${orderId}` });
            return null;
          });

          if (newOrder && newOrder.order_id) {
            toast.success(`Đã tạo đơn bù #${newOrder.order_id} thành công!`, { id: `supp-${orderId}` });
          } else {
            toast.dismiss(`supp-${orderId}`);
          }
        }
        // Đơn bình thường (không hỏng): GIỮ NGUYÊN trạng thái DELIVERING.
        // Store sẽ xác nhận → DONE.
      }

      // Update delivery status → DONE (chuyến đi kết thúc, các đơn hàng bên trong có trạng thái riêng biệt)
      // Chú ý: Backend KHÔNG CÓ trạng thái DAMAGED cho delivery, chỉ có WAITING | DELIVERING | DONE | CANCEL
      await updateDeliveryStatus(selectedDelivery.delivery_id, 'DONE').catch(err => {
        console.warn('Delivery status update failed:', err);
        throw err; // Ném lỗi để UI hiện thông báo lỗi rõ ràng nếu API thật sự fail
      });

      toast.success('Chuyến hàng đã hoàn tất! Chờ cửa hàng xác nhận các đơn bình thường.');
    } catch (error) {
      console.error('Finalize trip error:', error);
      toast.error('Có lỗi xảy ra: ' + error.message);
    } finally {
      setShowCompleteDialog(false);
      setProcessingId(null);
      fetchData();
    }
  };

  const DeliveryCard = ({ delivery }) => {
    const isProcessing = processingId === delivery.delivery_id;
    const canStart = delivery.status === 'WAITING';
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
            <div className="space-y-2">
              {orders.map(order => (
                <div key={order.order_id} className="flex flex-col p-3 rounded-lg border bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm">Đơn #{order.order_id}</span>
                    <Badge variant="outline" className="text-[10px] h-5">{order.status || 'DISPATCHED'}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{order.store_name || `Cửa hàng #${order.store_id || '...'}`}</span>
                  </div>
                  {(order.order_details || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(order.order_details || []).map((od, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[10px]">
                          {od.product_name} x{od.quantity}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 pt-2 border-t flex justify-end">
                    <Button
                      size="sm"
                      variant={localDelivered[delivery.delivery_id]?.[order.order_id] ? "ghost" : "default"}
                      className={`h-8 text-xs ${localDelivered[delivery.delivery_id]?.[order.order_id] ? "text-green-600 font-bold" : "bg-blue-600 hover:bg-blue-700"}`}
                      onClick={() => handleOpenOrderDialog(delivery, order)}
                      disabled={order.status === 'DAMAGED' || isDone || localDelivered[delivery.delivery_id]?.[order.order_id]}
                    >
                      {localDelivered[delivery.delivery_id]?.[order.order_id] ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Đã giao xong</>
                      ) : (
                        "Kiểm tra hàng"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Không có đơn hàng trong chuyến này.</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            {canStart && (
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 h-10 font-bold"
                onClick={() => handleStartDelivery(delivery)}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Navigation className="h-4 w-4 mr-2" />}
                Nhận và giao
              </Button>
            )}
            {canComplete && (
              <Button 
                className="w-full bg-green-600 hover:bg-green-700 h-10 font-bold"
                onClick={() => {
                  const tripFinished = (delivery.orders || []).every(o => 
                    localDelivered[delivery.delivery_id]?.[o.order_id] || o.status === 'DAMAGED'
                  );
                  if (!tripFinished) {
                    toast.error('Vui lòng kiểm hàng và ấn "Giao thành công" cho tất cả các đơn hàng.');
                    return;
                  }
                  setSelectedDelivery(delivery);
                  setShowCompleteDialog(true);
                }}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Xác nhận & Hoàn tất chuyến đi
              </Button>
            )}
            {isDone && (
              <div className="w-full flex items-center justify-center p-2 bg-green-50 text-green-700 rounded border border-green-100 text-sm font-medium gap-2">
                <CheckCircle2 className="h-4 w-4" /> Đã hoàn thành nhiệm vụ
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading && deliveries.length === 0) {
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
          {deliveries.filter(d => d.status === 'DONE').slice(0, 3).map(d => <DeliveryCard key={d.delivery_id} delivery={d} />)}
        </div>
      )}

      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kiểm hàng Đơn #{selectedOrder?.order_id}</DialogTitle>
            <DialogDescription>
              Kiểm tra từng sản phẩm và báo hỏng nếu có. Sau đó ấn "Giao thành công".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedOrder && (
              <div className="p-4 rounded-xl border bg-slate-50/50 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-bold text-indigo-900">Cửa hàng: {selectedOrder.store_name}</span>
                </div>

                <div className="space-y-2">
                  {(orderOutcomes[selectedOrder.order_id]?.details || []).map(product => {
                    const isDamaged = orderOutcomes[selectedOrder.order_id]?.damagedProducts[product.product_id];
                    return (
                      <div key={product.product_id} className="flex justify-between items-center bg-white p-2 rounded border text-sm">
                        <span className={isDamaged ? "text-red-600 font-medium" : ""}>
                          {product.product_name} <span className="text-muted-foreground text-xs">x{product.quantity}</span>
                        </span>
                        <Button 
                          variant={isDamaged ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => setOrderOutcomes(prev => {
                            const outcome = prev[selectedOrder.order_id];
                            return {
                              ...prev,
                              [selectedOrder.order_id]: {
                                ...outcome,
                                damagedProducts: {
                                  ...outcome.damagedProducts,
                                  [product.product_id]: !isDamaged
                                }
                              }
                            };
                          })}
                          className={`h-7 px-2 text-[10px] ${isDamaged ? 'bg-red-600' : 'text-slate-500'}`}
                        >
                          <PackageX className="h-3 w-3 mr-1" /> {isDamaged ? 'Hỏng' : 'Báo hỏng'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderDialog(false)}>Bỏ qua</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700" 
              onClick={() => handleConfirmOrderDelivery(selectedOrder.order_id)}
            >
              Giao thành công
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hoàn tất chuyến đi #{selectedDelivery?.delivery_id}</DialogTitle>
            <DialogDescription>
              Bạn đã giao xong tất cả các đơn hàng. Xác nhận để kết thúc chuyến đi và cập nhật báo cáo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-600">
              Hệ thống sẽ tự động tạo đơn bù và waste log cho các sản phẩm bạn đã báo hỏng.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Đóng</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700" 
              onClick={handleFinalizeTrip}
              disabled={!!processingId}
            >
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Xác nhận & Hoàn tất"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
