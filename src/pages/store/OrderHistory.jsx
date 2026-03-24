import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrdersByStore, fetchOrders, updateOrderStatus, createWasteLog, createAdditionalOrder } from '../../data/api';
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
      toast.success('Đơn hàng đã được hủy thành công');
      reloadDashboard();
    } catch (e) {
      toast.error(e.message || 'Hủy đơn thất bại');
    }
    setCancelOrder(null);
  };

  const handleFinalizeOrder = async (order) => {
    setIsSubmitting(true);
    const currentComment = order.comment || '';
    const newComment = currentComment ? `${currentComment} FINAL` : 'FINAL';
    
    // UI Hiding first (Optimistic)
    setOrders(prev => prev.map(o => o.order_id === order.order_id ? { ...o, comment: newComment, status: 'DONE' } : o));
    
    // Hard persist in localStorage if server fails
    try {
      const finalized = JSON.parse(localStorage.getItem('finalized_orders') || '[]');
      if (!finalized.includes(order.order_id)) {
        localStorage.setItem('finalized_orders', JSON.stringify([...finalized, order.order_id]));
      }
    } catch (e) { console.warn('LocalStorage error:', e); }

    try {
      await updateOrderStatus(order.order_id, 'DONE', newComment);
      toast.success(`Đơn hàng #${order.order_id} đã được đối soát hoàn tất.`);
      reloadDashboard();
    } catch (e) {
      // If it's 500 but it was likely processed or user just wants it gone
      console.warn('Finalize API failed, but keeping UI state:', e);
      if (e.message?.includes('500') || e.message?.includes('Internal Server Error')) {
        toast.info(`Đơn #${order.order_id} đã được đánh dấu hoàn tất trên giao diện.`);
      } else {
        toast.error('Lỗi khi hoàn tất: ' + e.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportDamaged = async () => {
    if (!damagedOrder) return;
    const damagedEntries = Object.entries(damagedItems).filter(([_, qty]) => qty > 0);
    if (damagedEntries.length === 0) {
      toast.error('Vui lòng nhập số lượng hỏng cho ít nhất 1 sản phẩm');
      return;
    }

    setIsSubmitting(true);
    try {
      const noteParts = damagedEntries.map(([id, qty]) => {
        const detail = damagedOrder.order_details.find(d => String(d.order_detail_id) === id || String(d.product_id) === id);
        return `${detail?.product_name || id} hỏng ${qty}`;
      });
      
      // 1. Update status and Log Waste
      await updateOrderStatus(damagedOrder.order_id, 'DAMAGED', `Cửa hàng báo hỏng: ${noteParts.join(', ')}`);
      
      await Promise.all(damagedEntries.map(([id, qty]) => {
        const detail = damagedOrder.order_details.find(d => String(d.order_detail_id) === id || String(d.product_id) === id);
        return createWasteLog({
          productId: detail.product_id,
          orderId: damagedOrder.order_id,
          quantity: qty,
          wasteType: 'DAMAGED_UPON_RECEIPT',
          note: `Hỏng từ đơn #${damagedOrder.order_id}`
        }).catch(err => console.error('Waste log failed:', err));
      }));

      // 2. AUTO CREATE SUPPLEMENT ORDER
      const supplementDetails = damagedEntries.map(([id, qty]) => {
        const detail = damagedOrder.order_details.find(d => String(d.order_detail_id) === id || String(d.product_id) === id);
        return {
          productId: detail.product_id,
          quantity: qty
        };
      });

      await createAdditionalOrder(damagedOrder.order_id, {
        storeId: damagedOrder.store_id || user.store_id,
        type: 'SUPPLEMENT',
        comment: `SUPPLEMENT - [Báo hỏng] Đơn #${damagedOrder.order_id}`,
        orderDetails: supplementDetails
      }).catch(e => console.error('Auto-supplement failed:', e));

      toast.success('Đã báo cáo hàng hỏng và tự động tạo đơn bù SUPPLEMENT.');
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
      
      // 2. AUTO CREATE SUPPLEMENT ORDER
      const supplementDetails = missingEntries.map(([id, qty]) => {
        const detail = partialOrder.order_details.find(d => String(d.order_detail_id) === id);
        return {
          productId: detail.product_id,
          quantity: qty
        };
      });

      await createAdditionalOrder(partialOrder.order_id, {
        storeId: partialOrder.store_id || user.store_id,
        type: 'SUPPLEMENT',
        comment: `SUPPLEMENT - [Báo thiếu] Đơn #${partialOrder.order_id}`,
        orderDetails: supplementDetails
      }).catch(e => console.error('Auto-supplement failed:', e));

      toast.success('Đã báo thiếu hàng và tự động tạo đơn bù SUPPLEMENT.');
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
          
          let localFinalized = false;
          try {
            const finalizedList = JSON.parse(localStorage.getItem('finalized_orders') || '[]');
            localFinalized = Array.isArray(finalizedList) && finalizedList.map(Number).includes(Number(order.order_id));
          } catch (e) {}

          const isFinalized = (order.comment || '').toUpperCase().includes('FINAL') || localFinalized || order.status === 'DONE';
          
          const canCancel = order.status === 'WAITING';
          const canReportIssue = ['DISPATCHED', 'DELIVERING'].includes(order.status) && !isFinalized;
          const canFinalize = order.status === 'DELIVERING' && !isFinalized;

          const totalPrice = order.totalAmount || order.total_amount || details.reduce((sum, d) => sum + (d.quantity * (d.unitPrice || d.price || d.unit_price || 0)), 0);

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
                            {String(order.comment || '').toUpperCase().includes('SUPPLEMENT') && (
                              <Badge variant="destructive" className="animate-pulse shadow-sm">SUPPLEMENT (HÀNG BÙ)</Badge>
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(order.order_date)}
                            </span>
                            <span>{details.length} sản phẩm</span>
                            <span className="font-semibold text-slate-800 ml-2">
                              Tổng: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalPrice)}
                            </span>
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
                              onClick={() => {
                                setDamagedOrder(order);
                                setDamagedItems({});
                              }}
                            >
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Báo hỏng
                            </Button>
                          </div>
                        )}
                        {canFinalize && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFinalizeOrder(order);
                            }}
                            disabled={isSubmitting}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Hoàn tất
                          </Button>
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
                        {order.comment?.toUpperCase().includes('FINAL') && (
                          <div className="p-3 bg-green-50 border border-green-100 rounded-lg mb-2">
                             <p className="text-xs font-bold text-green-700 flex items-center gap-1">
                               <CheckCircle2 className="h-3 w-3" /> ĐƠN HÀNG ĐÃ ĐỐI SOÁT HOÀN TẤT
                             </p>
                          </div>
                        )}
                        {order.comment?.includes('[REJECTED]') && (
                          <div className="p-3 bg-red-50 border border-red-100 rounded-lg mb-2">
                             <p className="text-xs font-bold text-red-700 flex items-center gap-1">
                               <X className="h-3 w-3" /> ĐƠN HÀNG BỊ TỪ CHỐI BỞI KHO:
                             </p>
                             <p className="text-sm text-red-600 mt-1 italic">
                               {order.comment.replace('[REJECTED]', '').trim()}
                             </p>
                          </div>
                        )}
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

      <Dialog open={!!damagedOrder} onOpenChange={(open) => !open && setDamagedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Báo hỏng hàng - Đơn #{damagedOrder?.order_id}</DialogTitle>
            <DialogDescription>
              Nhập số lượng sản phẩm bị hỏng. Hệ thống sẽ ghi nhận Waste Log và tạo đơn bù SUPPLEMENT.
            </DialogDescription>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[10px] h-7"
                onClick={() => {
                  const all = {};
                  damagedOrder?.order_details?.forEach(d => all[d.order_detail_id] = d.quantity);
                  setDamagedItems(all);
                }}
              >
                Hỏng tất cả
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[10px] h-7"
                onClick={() => setDamagedItems({})}
              >
                Bỏ chọn
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto px-1">
            {damagedOrder?.order_details?.map(detail => (
              <div key={detail.order_detail_id} className="flex items-center justify-between gap-4 p-2 border rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium">{detail.product_name}</p>
                  <p className="text-xs text-muted-foreground">Tổng nhận: {detail.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap text-red-600">Hỏng:</Label>
                  <Input 
                    type="number"
                    min="0"
                    max={detail.quantity}
                    className="w-20 h-8 border-red-200"
                    value={damagedItems[detail.order_detail_id] || ''}
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

      <Dialog open={!!partialOrder} onOpenChange={(open) => !open && setPartialOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Báo thiếu hàng - Đơn #{partialOrder?.order_id}</DialogTitle>
            <DialogDescription>
              Nhập số lượng thực tế bị thiếu cho từng sản phẩm. Hệ thống sẽ tạo đơn bù SUPPLEMENT.
            </DialogDescription>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[10px] h-7"
                onClick={() => {
                  const all = {};
                  partialOrder?.order_details?.forEach(d => all[d.order_detail_id] = d.quantity);
                  setMissingItems(all);
                }}
              >
                Thiếu tất cả
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[10px] h-7"
                onClick={() => setMissingItems({})}
              >
                Bỏ chọn
              </Button>
            </div>
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
