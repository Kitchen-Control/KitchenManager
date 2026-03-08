import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrders, getDeliveries, getAllStores } from '../../data/api';
import { StatsCard } from '../../components/common/StatsCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  ClipboardList,
  Truck,
  Clock,
  CheckCircle2,
  ArrowRight,
  Package,
} from 'lucide-react';

export default function CoordinatorDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  const reloadDashboard = () => {
    setLoading(true);
    Promise.all([
      fetchOrders().catch(() => []),
      getDeliveries().catch(() => []),
      getAllStores().catch(() => []),
    ])
      .then(([ordersRes, deliveriesRes, storesRes]) => {
        setOrders(Array.isArray(ordersRes) ? ordersRes : []);
        setDeliveries(Array.isArray(deliveriesRes) ? deliveriesRes : []);
        setStores(Array.isArray(storesRes) ? storesRes : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reloadDashboard();
  }, []);

  const calculateDeliveryStatus = (delivery) => {
    if (!delivery.orders || delivery.orders.length === 0) return 'WAITTING';
    const hasWaiting = delivery.orders.some(o => o.status === 'WAITTING');
    const hasDelivering = delivery.orders.some(o => o.status === 'DELIVERING');
    const hasProcessing = delivery.orders.some(o => o.status === 'PROCESSING');
    const allDone = delivery.orders.every(o => o.status === 'DONE');
    
    if (allDone) return 'DONE';
    if (hasDelivering) return 'DELIVERING';
    if (hasProcessing) return 'PROCESSING';
    return 'WAITTING';
  };

  const enrichedDeliveries = deliveries.map(d => ({
    ...d,
    status: calculateDeliveryStatus(d)
  }));

  const sortedOrders = [...orders].sort((a, b) => b.order_id - a.order_id);
  const waitingOrders = sortedOrders.filter((o) => o.status === 'WAITTING' && !o.delivery_id);
  const processingDeliveries = enrichedDeliveries.filter((d) => d.status === 'DELIVERING');
  const today = new Date().toISOString().split('T')[0];
  const todayDeliveries = enrichedDeliveries.filter((d) => (d.delivery_date || d.createdAt || '').startsWith(today));
  const completedToday = orders.filter(
    (o) => o.status === 'DONE' && (o.order_date || '').startsWith(today)
  );

  const recentOrders = waitingOrders.slice(0, 5).map((o) => ({
    ...o,
    store: stores.find((s) => s.store_id === o.store_id),
  }));

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bảng điều khiển</h1>
        <p className="text-muted-foreground">Tổng quan hoạt động điều phối giao hàng</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Đơn chờ xử lý"
          value={waitingOrders.length}
          icon={ClipboardList}
          description="Cần gom đơn"
        />
        <StatsCard
          title="Đang giao hàng"
          value={processingDeliveries.length}
          icon={Truck}
          description="Chuyến xe đang chạy"
        />
        <StatsCard
          title="Giao hôm nay"
          value={todayDeliveries.length}
          icon={Clock}
          description="Chuyến xe lên lịch"
        />
        <StatsCard
          title="Hoàn thành"
          value={completedToday.length}
          icon={CheckCircle2}
          description="Đơn hàng hôm nay"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Đơn hàng chờ gom</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/coordinator/orders')}>
              Xem tất cả
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Không có đơn hàng chờ xử lý
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.order_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Đơn #{order.order_id}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.store?.store_name ?? order.store_name}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={order.status} type="order" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Chuyến xe đang giao</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/coordinator/deliveries')}>
              Xem tất cả
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {processingDeliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Không có chuyến xe đang giao
              </div>
            ) : (
              <div className="space-y-3">
                {processingDeliveries.slice(0, 5).map((delivery) => (
                  <div
                    key={delivery.delivery_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                        <Truck className="h-5 w-5 text-info" />
                      </div>
                      <div>
                        <p className="font-medium">Chuyến #{delivery.delivery_id}</p>
                        <p className="text-sm text-muted-foreground">
                          {(delivery.orders || []).length} đơn hàng
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={delivery.status} type="delivery" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
