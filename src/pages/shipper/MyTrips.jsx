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
  createAdditionalOrder
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
  const [orderOutcomes, setOrderOutcomes] = useState({}); // { orderId: { status: 'DONE'|'PARTIAL_DELIVERED'|'DAMAGED', details: [] } }

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

  const updateOrderStatusWithFallback = async (orderId, status, note) => {
    try {
      await updateOrderStatus(orderId, status, note);
    } catch (error) {
      if (error.message.includes('500')) {
        const updatedOrder = await getOrderById(orderId).catch(() => null);
        if (updatedOrder && updatedOrder.status === status) return;
      }
      throw error;
    }
  };

  const handleStartDelivery = async (delivery) => {
    const orderIds = (delivery.orders || []).map(o => o.order_id);
    setProcessingId(delivery.delivery_id);
    try {
      await updateDeliveryStatus(delivery.delivery_id, 'DELIVERING');
      for (const orderId of orderIds) {
        try {
          await updateOrderStatusWithFallback(orderId, 'DELIVERING', 'Shipper nhận hàng và bắt đầu giao');
          // Update associated READY receipts to COMPLETED upon pickup
          const receipts = await getReceiptsByOrderId(orderId).catch(() => []);
          const readyReceipts = receipts.filter(r => r.status === 'READY');
          for (const r of readyReceipts) {
            await updateReceiptStatus(r.receipt_id, 'COMPLETED');
          }
        } catch (e) {
          console.warn(`Failed to update order #${orderId} or receipts:`, e.message);
        }
      }
      toast.success('Đã bắt đầu chuyến giao hàng!');
      fetchData();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenCompleteDialog = async (delivery) => {
    setProcessingId(delivery.delivery_id);
    const initialOutcomes = {};
    for (const order of delivery.orders || []) {
      const receipts = await getReceiptsByOrderId(order.order_id).catch(() => []);
      const exportReceipts = receipts.filter(r => r.type === 'EXPORT' || !r.type);
      
      // Robust fallback chain for details: Order > Receipt > API Fetch
      let detailsToUse = order.order_details || [];
      
      // If order details are empty, try to fetch them
      if (detailsToUse.length === 0) {
        try {
          const fetchedDetails = await getOrderDetailsByOrderId(order.order_id);
          if (fetchedDetails && fetchedDetails.length > 0) {
            detailsToUse = fetchedDetails;
          }
        } catch (e) {
          console.error(`Failed to fetch specific details for order #${order.order_id}:`, e);
        }
      }

      // Final fallback to receipt details if still empty
      const finalDetails = detailsToUse.length > 0 ? detailsToUse : (exportReceipts[0]?.receipt_details || []);
      
      const mappedDetails = finalDetails.map(d => ({
        ...d,
        actualQuantity: d.quantity
      }));

      // CRITICAL: Ensure we have details for supplement creation
      initialOutcomes[order.order_id] = {
        status: 'DONE',
        details: finalDetails,
        receipts: exportReceipts,
        storeId: order.store?.storeId || order.store_id || order.sender_id
      };
    }
    setOrderOutcomes(initialOutcomes);
    setProcessingId(null);
    setSelectedDelivery(delivery);
    setShowCompleteDialog(true);
  };

  const handleFinalizeTrip = async () => {
    if (!selectedDelivery) return;
    setProcessingId(selectedDelivery.delivery_id);
    try {
      // 1. Process each order and its receipts FIRST
      for (const orderId in orderOutcomes) {
        const outcome = orderOutcomes[orderId];
        const status = outcome.status;
        const note = status === 'DONE' ? 'Giao thanh cong' : 
                     status === 'DAMAGED' ? 'Hang hong' : 'Loi';

        // Update Order Status first
        try {
          await updateOrderStatus(parseInt(orderId), status, note);
        } catch (e) {
          console.warn(`Order #${orderId} update failed:`, e);
        }

        // Update all related EXPORT receipts to COMPLETED
        for (const r of (outcome.receipts || [])) {
          try {
            await updateReceiptStatus(r.receipt_id, 'COMPLETED');
          } catch (e) {
            console.warn(`Receipt #${r.receipt_id} update failed:`, e);
          }
        }

        // Handle Waste Log if Damaged
        if (status === 'DAMAGED') {
          // 1. Log Waste
          for (const item of (outcome.details || [])) {
            const receipt = outcome.receipts[0];
            const tx = (receipt?.inventory_transactions || []).find(t => t.product_id === item.product_id);
            
            await createWasteLog({
              productId: item.product_id,
              batchId: tx?.batch_id || 0,
              orderId: parseInt(orderId),
              quantity: item.quantity,
              wasteType: 'DAMAGED_SHIPPING',
              note: `Hang hong don #${orderId}`
            }).catch(e => console.error('Waste log failed:', e));
          }

          // 2. DELAY FOR STABILITY (Ensures parent order update is committed)
          await new Promise(resolve => setTimeout(resolve, 1200));

          // 3. AUTO CREATE SUPPLEMENT ORDER
          toast.loading(`Đang tạo đơn bù cho #${orderId}...`, { id: `supp-${orderId}` });
          const newOrder = await createAdditionalOrder(parseInt(orderId), {
            storeId: outcome.storeId,
            type: 'SUPPLEMENT',
            comment: `SUPPLEMENT - Shipper bao hong #${orderId} - Ho tro giao lai`,
            orderDetails: (outcome.details || []).map(d => ({
              productId: d.product_id,
              quantity: d.quantity
            }))
          }).catch(e => {
            console.error('Shipper auto-supplement failed:', e);
            toast.error(`Không thể tạo đơn bù #${orderId}: ` + e.message, { id: `supp-${orderId}` });
            return null;
          });

          // 4. FORCE WAITING STATUS for supplemental order (prevent inheriting DAMAGED)
          if (newOrder && newOrder.order_id) {
            try {
              await updateOrderStatus(newOrder.order_id, 'WAITING', 'Cho xu ly (Tu dong)');
              toast.success(`Đã tạo đơn bù #${newOrder.order_id} thành công!`, { id: `supp-${orderId}` });
            } catch (e) {
              console.error('Status update for supplement failed:', e);
              // Still show success for creation, even if status update (UI visibility) is delayed
              toast.success(`Đã tạo đơn bù #${newOrder.order_id}`, { id: `supp-${orderId}` });
            }
          } else {
             toast.dismiss(`supp-${orderId}`);
          }
        }
      }
      
      // Calculate trip status
      const allDamaged = Object.values(orderOutcomes).every(o => o.status === 'DAMAGED');
      const tripStatus = allDamaged ? 'DAMAGED' : 'DONE'; 

      await updateDeliveryStatus(selectedDelivery.delivery_id, tripStatus).catch(err => {
        console.warn('Delivery status update failed, ignoring:', err);
      });

      toast.success('Chuyển hàng đã hoàn thành và đối soát!');
    } catch (error) {
      console.error('Finalize trip error:', error);
      toast.error('Có lỗi xảy ra nhưng chuyến đi đã được xử lý: ' + error.message);
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
                onClick={() => handleOpenCompleteDialog(delivery)}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Hoàn tất chuyến đi & Đối soát
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

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Đối soát & Hoàn tất chuyến #{selectedDelivery?.delivery_id}</DialogTitle>
            <DialogDescription>Xác nhận tình trạng thực tế của từng đơn hàng trước khi đóng chuyến.</DialogDescription>
            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 font-bold"
                onClick={() => {
                  const bulk = {};
                  selectedDelivery?.orders.forEach(o => {
                    bulk[o.order_id] = { ...orderOutcomes[o.order_id], status: 'DONE' };
                  });
                  setOrderOutcomes(prev => ({ ...prev, ...bulk }));
                }}
              >
                Hoàn thành tất cả
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-red-50 text-red-700 border-red-200 hover:bg-red-100 font-bold"
                onClick={() => {
                  const bulk = {};
                  selectedDelivery?.orders.forEach(o => {
                    bulk[o.order_id] = { ...orderOutcomes[o.order_id], status: 'DAMAGED' };
                  });
                  setOrderOutcomes(prev => ({ ...prev, ...bulk }));
                }}
              >
                Hỏng tất cả
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {selectedDelivery?.orders.map(order => {
              const outcome = orderOutcomes[order.order_id] || { status: 'DONE' };
              return (
                <div key={order.order_id} className="p-4 rounded-xl border bg-slate-50/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-indigo-900 underline underline-offset-4">Đơn hàng #{order.order_id}</span>
                    <Badge variant="outline" className="bg-white">{order.store_name}</Badge>
                  </div>

                  <RadioGroup 
                    value={outcome.status} 
                    onValueChange={(val) => setOrderOutcomes(prev => ({
                      ...prev,
                      [order.order_id]: { ...prev[order.order_id], status: val }
                    }))}
                    className="grid grid-cols-1 gap-2"
                  >
                    <div className="flex items-center space-x-2 p-2 rounded-lg bg-white border cursor-pointer hover:bg-green-50/30">
                      <RadioGroupItem value="DONE" id={`done-${order.order_id}`} />
                      <Label htmlFor={`done-${order.order_id}`} className="flex-1 cursor-pointer flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" /> Giao thành công (DONE)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-2 rounded-lg bg-white border cursor-pointer hover:bg-red-50/30 text-red-600">
                      <RadioGroupItem value="DAMAGED" id={`damaged-${order.order_id}`} />
                      <Label htmlFor={`damaged-${order.order_id}`} className="flex-1 cursor-pointer flex items-center gap-2">
                        <PackageX className="h-4 w-4 text-red-500" /> Hàng hỏng / Từ chối (DAMAGED)
                      </Label>
                    </div>
                  </RadioGroup>

                  {outcome.status === 'DAMAGED' && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                      <p className="text-[11px] text-red-800">
                        Hệ thống sẽ ghi nhận hàng hỏng vào Waste Log. Toàn bộ hàng sẽ bị hủy bỏ theo quy trình ATTP.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Đóng</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700" 
              onClick={handleFinalizeTrip}
              disabled={!!processingId}
            >
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Xác nhận & Hoàn tất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
