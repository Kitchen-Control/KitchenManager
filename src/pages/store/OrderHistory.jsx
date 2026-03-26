import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrdersByStore, fetchOrders, updateOrderStatus, createWasteLog, createAdditionalOrder, getDeliveries, updateDeliveryStatus } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Package,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Minus,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';

export default function OrderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openOrders, setOpenOrders] = useState([]);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [damagedOrder, setDamagedOrder] = useState(null);
  const [partialOrder, setPartialOrder] = useState(null);
  const [missingItems, setMissingItems] = useState({}); // { detail_id: missing_qty }
  const [damagedItems, setDamagedItems] = useState({}); // { detail_id: damaged_qty }
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reloadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      let data = [];
      if (user?.store_id) {
        data = await getOrdersByStore(user.store_id).catch(() => []);
      } else {
        const all = await fetchOrders().catch(() => []);
        data = all.filter(o => o.store_id === user?.store_id || o.store_id != null);
      }
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.store_id]);

  useEffect(() => {
    reloadDashboard();
  }, [reloadDashboard]);

  useEffect(() => {
    const handleFocus = () => reloadDashboard();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [reloadDashboard]);

  const storeOrders = [...orders].sort((a, b) => b.order_id - a.order_id);

  const toggleOrder = (orderId) => {
    setOpenOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleCancelOrder = async () => {
    if (!cancelOrder) return;
    try {
      await updateOrderStatus(cancelOrder.order_id, 'CANCELED', 'STORE_CANCEL');
      toast.success('Đơn hàng đã được hủy thành công');
      reloadDashboard();
    } catch (e) {
      toast.error(e.message || 'Hủy đơn thất bại');
    }
    setCancelOrder(null);
  };

  const checkAndCompleteDelivery = async (deliveryId) => {
    if (!deliveryId) return;
    try {
      const allOrders = await fetchOrders();
      // Only consider non-supplement orders in this delivery
      const deliveryOrders = allOrders.filter(o =>
        o.delivery_id === deliveryId &&
        !String(o.comment || '').toUpperCase().includes('SUPPLEMENT')
      );

      if (deliveryOrders.length === 0) return;

      // Terminal: DONE/CANCELED, or Store has already processed (STORE_ comment)
      const allFinished = deliveryOrders.every(o =>
        o.status === 'DONE' ||
        o.status === 'CANCELED' ||
        String(o.comment || '').toUpperCase().includes('STORE_')
      );

      if (allFinished) {
        await updateDeliveryStatus(deliveryId, 'DONE');
        // Clear shipper_confirmed keys for these orders
        deliveryOrders.forEach(o => {
          localStorage.removeItem(`shipper_confirmed_${o.order_id}`);
        });
        toast.success('Chuyến giao hàng đã hoàn tất!');
      }
    } catch (e) {
      console.warn('Auto-complete delivery failed:', e);
    }
  };

  const handleFinalizeOrder = async (order) => {
    setIsSubmitting(true);
    setOrders(prev => prev.map(o =>
      o.order_id === order.order_id ? { ...o, status: 'DONE' } : o
    ));
    try {
      await updateOrderStatus(order.order_id, 'DONE', 'STORE_DONE');
      toast.success(`Đơn hàng #${order.order_id} đã hoàn tất.`);
      if (order.delivery_id) await checkAndCompleteDelivery(order.delivery_id);
      reloadDashboard();
    } catch (e) {
      toast.error('Lỗi khi hoàn tất: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportDamaged = async () => {
    const targetOrder = damagedOrder;
    if (!targetOrder) return;

    const manualEntries = Object.entries(damagedItems).filter(([_, qty]) => Number(qty) > 0);
    if (manualEntries.length === 0) {
      toast.error('Vui lòng nhập số lượng hỏng cho ít nhất 1 sản phẩm');
      return;
    }

    setIsSubmitting(true);
    try {
      const entriesToProcess = manualEntries.map(([id, qty]) => {
        const detail = (targetOrder.order_details || []).find(
          d => String(d.order_detail_id) === String(id)
        );
        if (!detail) return null;
        return { productId: detail.product_id, quantity: Number(qty), name: detail.product_name };
      }).filter(Boolean);

      if (entriesToProcess.length === 0) {
        toast.error('Không tìm thấy chi tiết sản phẩm hỏng');
        setIsSubmitting(false);
        return;
      }

      // Update order status to DAMAGED (store confirmed)
      await updateOrderStatus(targetOrder.order_id, 'DAMAGED', 'STORE_DAMAGED');

      // Create Waste Logs
      await Promise.all(entriesToProcess.map(e =>
        createWasteLog({
          productId: e.productId,
          orderId: targetOrder.order_id,
          quantity: e.quantity,
          wasteType: 'DAMAGED_UPON_RECEIPT',
          note: `Hang hong don ${targetOrder.order_id}`
        }).catch(err => console.error('Waste log failed:', err))
      ));

      // Create Supplement Order
      const supplementDetails = entriesToProcess.map(e => ({
        productId: e.productId,
        quantity: e.quantity
      }));

      await createAdditionalOrder(targetOrder.order_id, {
        storeId: targetOrder.store_id || user.store_id,
        type: 'SUPPLEMENT',
        comment: 'SUPPLEMENT_STORE_DAMAGED',
        orderDetails: supplementDetails
      });

      toast.success('Đã báo hỏng và tạo đơn bù SUPPLEMENT.');
      if (targetOrder.delivery_id) await checkAndCompleteDelivery(targetOrder.delivery_id);
      reloadDashboard();
      setDamagedOrder(null);
      setDamagedItems({});
    } catch (e) {
      toast.error(e.message || 'Báo hỏng thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportPartial = async () => {
    if (!partialOrder) return;

    const missingEntries = Object.entries(missingItems).filter(([_, qty]) => Number(qty) > 0);
    if (missingEntries.length === 0) {
      toast.error('Vui lòng nhập số lượng thiếu cho ít nhất 1 sản phẩm');
      return;
    }

    setIsSubmitting(true);
    try {
      const entriesToProcess = missingEntries.map(([id, qty]) => {
        const detail = (partialOrder.order_details || []).find(
          d => String(d.order_detail_id) === String(id)
        );
        if (!detail) return null;
        return { productId: detail.product_id, quantity: Number(qty), name: detail.product_name };
      }).filter(Boolean);

      if (entriesToProcess.length === 0) {
        toast.error('Không tìm thấy chi tiết sản phẩm thiếu');
        setIsSubmitting(false);
        return;
      }

      // Update to PARTIAL_DELIVERED (order is partially received - missing items)
      await updateOrderStatus(partialOrder.order_id, 'PARTIAL_DELIVERED', 'STORE_PARTIAL');

      // Create Supplement Order for missing items
      const supplementDetails = entriesToProcess.map(e => ({
        productId: e.productId,
        quantity: e.quantity
      }));

      await createAdditionalOrder(partialOrder.order_id, {
        storeId: partialOrder.store_id || user.store_id,
        type: 'SUPPLEMENT',
        comment: 'SUPPLEMENT_STORE_MISSING',
        orderDetails: supplementDetails
      }).catch(e => console.error('Auto-supplement failed:', e));

      toast.success('Đã báo thiếu hàng và tạo đơn bù SUPPLEMENT.');

      if (partialOrder.delivery_id) await checkAndCompleteDelivery(partialOrder.delivery_id);
      reloadDashboard();
      setPartialOrder(null);
      setMissingItems({});
    } catch (e) {
      toast.error(e.message || 'Xử lý thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMissingQtyChange = (detailId, val, max) => {
    const qty = Math.min(max, Math.max(0, parseInt(val) || 0));
    setMissingItems(prev => ({ ...prev, [detailId]: qty }));
  };

  const handleDamagedQtyChange = (detailId, val, max) => {
    const qty = Math.min(max, Math.max(0, parseInt(val) || 0));
    setDamagedItems(prev => ({ ...prev, [detailId]: qty }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (!dateString.includes('+07:00') && !dateString.includes('Z')) {
      date.setHours(date.getHours() + 7);
    }
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (storeOrders.length === 0) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Lịch sử đơn hàng</h1>
          <Button variant="outline" size="sm" onClick={reloadDashboard} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
        <EmptyState
          icon={Package}
          title="Chưa có đơn hàng"
          description="Bạn chưa đặt đơn hàng nào. Hãy bắt đầu đặt hàng ngay!"
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lịch sử đơn hàng</h1>
          <p className="text-muted-foreground">Theo dõi và quản lý các đơn hàng của cửa hàng</p>
        </div>
        <Button variant="outline" size="sm" onClick={reloadDashboard} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      <div className="space-y-4">
        {storeOrders.map((order) => {
          const details = order.order_details || [];
          const isOpen = openOrders.includes(order.order_id);

          // isFinalized: store has already taken action (comment starts with STORE_) or order cancelled
          const isFinalized = order.status === 'CANCELED' ||
                              (order.comment || '').toUpperCase().includes('STORE_');

          // isShipperDone: shipper confirmed this order (set via API to DELIVERED/PARTIAL_DELIVERED/DAMAGED)
          // Also accept localStorage signal for immediate UI feedback before page reload
          const isShipperDone = !isFinalized && (
            ['DELIVERED', 'PARTIAL_DELIVERED', 'DAMAGED'].includes(order.status) ||
            localStorage.getItem(`shipper_confirmed_${order.order_id}`) === 'true'
          );
          const canCancel = order.status === 'WAITING';
          const canFinalizeFlow = isShipperDone && !isFinalized;

          const totalPrice = details.reduce((sum, d) => sum + (d.quantity * (d.unitPrice || d.price || d.unit_price || 0)), 0);
          const isSupplement = String(order.comment || '').toUpperCase().includes('SUPPLEMENT');

          return (
            <Card key={order.order_id} className="overflow-hidden">
              <Collapsible open={isOpen} onOpenChange={() => toggleOrder(order.order_id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            Đơn hàng #{order.order_id}
                            <StatusBadge status={order.status} type="order" />
                            {isSupplement && (
                              <Badge variant="destructive" className="animate-pulse shadow-sm">HÀNG BÙ</Badge>
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(order.order_date)}
                            </span>
                            <span>{details.length} sản phẩm</span>
                            {totalPrice > 0 && (
                              <span className="font-semibold text-slate-800 ml-2">
                                Tổng: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalPrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canCancel && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelOrder(order);
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Hủy
                          </Button>
                        )}
                        {canFinalizeFlow && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Báo hỏng - opens dialog with quantity input */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => {
                                setDamagedOrder(order);
                                setDamagedItems({});
                              }}
                              disabled={isSubmitting}
                            >
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Báo hỏng
                            </Button>
                            {/* Báo thiếu - opens dialog with quantity input */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-orange-600 border-orange-200 hover:bg-orange-50"
                              onClick={() => {
                                setPartialOrder(order);
                                setMissingItems({});
                              }}
                              disabled={isSubmitting}
                            >
                              <Minus className="h-4 w-4 mr-1" />
                              Báo thiếu
                            </Button>
                            {/* Hoàn tất */}
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleFinalizeOrder(order)}
                              disabled={isSubmitting}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Hoàn tất
                            </Button>
                          </div>
                        )}
                        {isOpen ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="border-t pt-4">
                    <div className="space-y-3">
                      {details.map((detail) => (
                        <div
                          key={detail.order_detail_id || detail.product_id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{detail.product_name || `SP #${detail.product_id}`}</p>
                            <p className="text-sm text-muted-foreground">
                              {detail.price ? `${detail.price.toLocaleString('vi-VN')}đ` : '???'} x {detail.quantity}
                            </p>
                          </div>
                          {detail.price > 0 && (
                            <p className="text-sm font-semibold">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                                detail.price * detail.quantity
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Cancel order dialog */}
      <AlertDialog open={!!cancelOrder} onOpenChange={() => setCancelOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">Xác nhận hủy đơn hàng</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Bạn có chắc chắn muốn hủy đơn hàng #{cancelOrder?.order_id}? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Quay lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="bg-destructive hover:bg-destructive/90"
            >
              Hủy đơn hàng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Báo hỏng dialog - with quantity input */}
      <Dialog open={!!damagedOrder} onOpenChange={(open) => !open && setDamagedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Báo hỏng - Đơn #{damagedOrder?.order_id}</DialogTitle>
            <DialogDescription>
              Nhập số lượng hỏng cho từng sản phẩm. Hệ thống sẽ tạo đơn bù SUPPLEMENT.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[50vh] overflow-y-auto px-1">
            {(damagedOrder?.order_details || []).map(detail => (
              <div key={detail.order_detail_id} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{detail.product_name}</p>
                  <p className="text-xs text-muted-foreground">Tổng đặt: {detail.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap text-red-600">Số hỏng:</Label>
                  <Input
                    type="number"
                    min="0"
                    max={detail.quantity}
                    className="w-20 h-8"
                    value={damagedItems[detail.order_detail_id] || ''}
                    placeholder="0"
                    onChange={(e) => handleDamagedQtyChange(detail.order_detail_id, e.target.value, detail.quantity)}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDamagedOrder(null)}>Hủy</Button>
            <Button onClick={handleReportDamaged} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
              {isSubmitting ? 'Đang xử lý...' : 'Xác nhận & Tạo đơn bù'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Báo thiếu dialog - with quantity input */}
      <Dialog open={!!partialOrder} onOpenChange={(open) => !open && setPartialOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Báo thiếu - Đơn #{partialOrder?.order_id}</DialogTitle>
            <DialogDescription>
              Nhập số lượng thực tế bị thiếu cho từng sản phẩm. Hệ thống sẽ tạo đơn bù SUPPLEMENT.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[50vh] overflow-y-auto px-1">
            {(partialOrder?.order_details || []).map(detail => (
              <div key={detail.order_detail_id} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{detail.product_name}</p>
                  <p className="text-xs text-muted-foreground">Tổng đặt: {detail.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap text-orange-600">Số thiếu:</Label>
                  <Input
                    type="number"
                    min="0"
                    max={detail.quantity}
                    className="w-20 h-8"
                    value={missingItems[detail.order_detail_id] || ''}
                    placeholder="0"
                    onChange={(e) => handleMissingQtyChange(detail.order_detail_id, e.target.value, detail.quantity)}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialOrder(null)}>Hủy</Button>
            <Button onClick={handleReportPartial} disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
              {isSubmitting ? 'Đang xử lý...' : 'Xác nhận & Tạo đơn bù'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
