import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrdersByStore, fetchOrders, updateOrderStatus, createWasteLog } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reloadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      let data = [];
      if (user?.store_id) {
        // Primary: fetch orders for this specific store
        data = await getOrdersByStore(user.store_id).catch(() => []);
      } else {
        // Fallback: fetch all orders and filter by store_id from user context
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

  // Refresh when user switches back to this tab/window (e.g., after placing an order)
  useEffect(() => {
    const handleFocus = () => reloadDashboard();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [reloadDashboard]);

  const storeOrders = [...orders].sort(
    (a, b) => b.order_id - a.order_id
  );

  const toggleOrder = (orderId) => {
    setOpenOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleCancelOrder = async () => {
    if (!cancelOrder) return;
    try {
      await updateOrderStatus(cancelOrder.order_id, 'CANCELED', cancelOrder.store_id);
      setOrders((prev) =>
        prev.map((o) => (o.order_id === cancelOrder.order_id ? { ...o, status: 'CANCELED' } : o))
      );
      toast.success('Đơn hàng đã được hủy thành công');
      reloadDashboard();
    } catch (e) {
      toast.error(e.message || 'Hủy đơn thất bại');
    }
    setCancelOrder(null);
  };

  const handleReportDamaged = async () => {
    if (!damagedOrder) return;
    setIsSubmitting(true);
    try {
      // Flow 1 Step 6 Risk 2: Update status and Log Waste
      await updateOrderStatus(damagedOrder.order_id, 'DAMAGED', 'Cửa hàng báo hỏng khi nhận - Đã tiêu hủy');
      
      // Attempt to log waste for each product in the order
      // (Simplified: Log one entry for the whole order or per detail)
      const details = damagedOrder.order_details || [];
      await Promise.all(details.map(detail => 
        createWasteLog({
          productId: detail.product_id,
          orderId: damagedOrder.order_id,
          quantity: detail.quantity,
          wasteType: 'DAMAGED_UPON_RECEIPT',
          note: `Hỏng từ đơn #${damagedOrder.order_id}`
        }).catch(err => console.error('Waste log failed for detail:', detail, err))
      ));

      toast.success('Đã báo cáo hàng hỏng và ghi nhận Hao phí (Waste).');
      reloadDashboard();
    } catch (e) {
      toast.error(e.message || 'Báo hỏng thất bại');
    } finally {
      setIsSubmitting(false);
      setDamagedOrder(null);
    }
  };

  const handleReportPartial = async () => {
    if (!partialOrder) return;
    
    const missingEntries = Object.entries(missingItems).filter(([_, qty]) => qty > 0);
    if (missingEntries.length === 0) {
      toast.error('Vui lòng nhập số lượng thiếu cho ít nhất 1 sản phẩm');
      return;
    }

    setIsSubmitting(true);
    try {
      // Flow 1 Step 6 Risk 1: Update status to PARTIAL_DELIVERED
      // Rule: NO new supplement order. Warehouse will create a new Receipt for this same order id.
      const note = missingEntries.map(([id, qty]) => {
        const detail = partialOrder.order_details.find(d => String(d.order_detail_id) === id);
        return `${detail.product_name} thiếu ${qty}`;
      }).join(', ');

      await updateOrderStatus(partialOrder.order_id, 'PARTIAL_DELIVERED', `Giao thiếu: ${note}`);
      
      toast.success('Đã báo thiếu hàng. Warehouse sẽ tạo phiếu xuất bù cho đơn hàng này.');
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    // Bù +7 tiếng nếu Server đang lưu giờ UTC
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
          const canCancel = order.status === 'WAITING';
          const canReportIssue = ['DISPATCHED', 'DELIVERING'].includes(order.status);

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
                          </CardTitle>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(order.order_date)}
                            </span>
                            <span>{details.length} sản phẩm</span>
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
                        {canReportIssue && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-orange-600 border-orange-200 hover:bg-orange-50"
                              onClick={() => {
                                setPartialOrder(order);
                                setMissingItems({});
                              }}
                            >
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Báo thiếu
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setDamagedOrder(order)}
                            >
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Báo hỏng
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
                            <p className="text-sm text-muted-foreground">x{detail.quantity}</p>
                          </div>
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

      <AlertDialog open={!!damagedOrder} onOpenChange={() => setDamagedOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận báo hàng hỏng?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn xác nhận đơn hàng #{damagedOrder?.order_id} bị hỏng và không thể nhận? 
              Trạng thái sẽ chuyển thành DAMAGED và hàng sẽ được tiêu hủy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bỏ qua</AlertDialogCancel>
            <AlertDialogAction onClick={handleReportDamaged} className="bg-red-600">Xác nhận hỏng</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!partialOrder} onOpenChange={(open) => !open && setPartialOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Báo thiếu hàng - Đơn #{partialOrder?.order_id}</DialogTitle>
            <DialogDescription>
              Nhập số lượng thực tế bị thiếu cho từng sản phẩm. Hệ thống sẽ tạo đơn bù SUPPLEMENT.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {partialOrder?.order_details?.map(detail => (
              <div key={detail.order_detail_id} className="flex items-center justify-between gap-4 p-2 border rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium">{detail.product_name}</p>
                  <p className="text-xs text-muted-foreground">Tổng đặt: {detail.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Thiếu:</Label>
                  <Input 
                    type="number"
                    min="0"
                    max={detail.quantity}
                    className="w-20 h-8"
                    value={missingItems[detail.order_detail_id] || ''}
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
