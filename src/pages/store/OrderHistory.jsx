import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrdersByStore, updateOrderStatus } from '../../data/api';
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
import { toast } from 'sonner';

export default function OrderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openOrders, setOpenOrders] = useState([]);
  const [cancelOrder, setCancelOrder] = useState(null);

  const reloadDashboard = () => {
    if (!user?.store_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getOrdersByStore(user.store_id)
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reloadDashboard();
  }, [user?.store_id]);

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
      await updateOrderStatus(cancelOrder.order_id, 'CANCLED');
      setOrders((prev) =>
        prev.map((o) => (o.order_id === cancelOrder.order_id ? { ...o, status: 'CANCLED' } : o))
      );
      toast.success('Đơn hàng đã được hủy thành công');
      reloadDashboard();
    } catch (e) {
      toast.error(e.message || 'Hủy đơn thất bại');
    }
    setCancelOrder(null);
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lịch sử đơn hàng</h1>
        <p className="text-muted-foreground">Theo dõi và quản lý các đơn hàng của cửa hàng</p>
      </div>

      <div className="space-y-4">
        {storeOrders.map((order) => {
          const details = order.order_details || [];
          const isOpen = openOrders.includes(order.order_id);
          const canCancel = order.status === 'WAITTING';

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
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
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
              // Xóa disabled, luôn cho thao tác
            >
              Hủy đơn hàng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
