import React, { useState, useEffect } from 'react';
import {
  fetchOrders,
  getAllShippers,
  getAllStores,
  createDelivery,
} from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Package, Truck, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';



export default function OrderAggregation() {
  const [orders, setOrders] = useState([]);
  const [shippers, setShippers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [showCreateDelivery, setShowCreateDelivery] = useState(false);
  const [selectedShipper, setSelectedShipper] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchOrders().catch(() => []),
      getAllShippers().catch(() => []),
      getAllStores().catch(() => []),
    ]).then(([ordersRes, shippersRes, storesRes]) => {
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
      setShippers(Array.isArray(shippersRes) ? shippersRes : []);
      setStores(Array.isArray(storesRes) ? storesRes : []);
    }).finally(() => setLoading(false));
  }, []);

  const waitingOrders = orders
    .filter((o) => o.status === 'WAITTING' && !o.delivery_id)
    .sort((a, b) => b.order_id - a.order_id)
    .map((o) => ({
      ...o,
      store: stores.find((s) => s.store_id === o.store_id),
      details: (o.order_details || []).map((od) => ({ ...od })),
    }));

  // shippers is already fetched directly from /users/shippers API

  const toggleOrder = (orderId) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleAll = () => {
    if (selectedOrders.length === waitingOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(waitingOrders.map((o) => o.order_id));
    }
  };

  const handleCreateDelivery = async () => {
    if (!selectedShipper || selectedOrders.length === 0) {
      toast.error('Vui lòng chọn shipper và ít nhất 1 đơn hàng');
      return;
    }
    setIsCreating(true);
    try {
      await createDelivery({
        shipperId: parseInt(selectedShipper, 10),
        deliveryDate,
        orderIds: selectedOrders,
      });
      const ordersRes = await fetchOrders();
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
      toast.success(`Đã tạo chuyến giao hàng với ${selectedOrders.length} đơn`);
      setShowCreateDelivery(false);
      setSelectedOrders([]);
      setSelectedShipper('');
    } catch (error) {
      toast.error(error.message || 'Tạo chuyến giao hàng thất bại');
    } finally {
      setIsCreating(false);
    }
  };

  const selectedOrdersData = waitingOrders.filter((o) => selectedOrders.includes(o.order_id));
  const groupedByStore = selectedOrdersData.reduce((acc, order) => {
    const storeId = order.store_id;
    if (!acc[storeId]) {
      acc[storeId] = { store: order.store, orders: [] };
    }
    acc[storeId].orders.push(order);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (waitingOrders.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Không có đơn hàng chờ xử lý"
          description="Tất cả đơn hàng đã được gom vào chuyến giao"
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gom đơn hàng</h1>
          <p className="text-muted-foreground">Chọn các đơn hàng để tạo chuyến giao hàng</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={toggleAll}>
            {selectedOrders.length === waitingOrders.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </Button>
          <Button
            onClick={() => setShowCreateDelivery(true)}
          >
            <Truck className="h-4 w-4 mr-2" />
            Tạo chuyến ({selectedOrders.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {waitingOrders.map((order) => {
          const isSelected = selectedOrders.includes(order.order_id);
          return (
            <Card
              key={order.order_id}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
              onClick={() => toggleOrder(order.order_id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOrder(order.order_id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <CardTitle className="text-base">Đơn #{order.order_id}</CardTitle>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {order.store?.store_name ?? order.store_name}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={order.status} type="order" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {order.store?.address}
                </p>
                <div className="space-y-2">
                  {(order.details || []).map((detail) => (
                    <div
                      key={detail.order_detail_id || detail.product_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {detail.product_name || `SP #${detail.product_id}`}
                      </span>
                      <Badge variant="secondary">x{detail.quantity}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showCreateDelivery} onOpenChange={setShowCreateDelivery}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo chuyến giao hàng</DialogTitle>
            <DialogDescription>Xác nhận thông tin chuyến giao hàng</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Đơn hàng đã chọn ({selectedOrders.length})</Label>
              <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-muted/50 rounded-lg">
                {Object.values(groupedByStore).map(({ store, orders: ords }) => (
                  <div key={store?.store_id} className="text-sm">
                    <p className="font-medium">{store?.store_name}</p>
                    <p className="text-muted-foreground text-xs">{store?.address}</p>
                    <p className="text-muted-foreground">{ords.length} đơn hàng</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Chọn Shipper</Label>
              <Select value={selectedShipper} onValueChange={setSelectedShipper}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhân viên giao hàng" />
                </SelectTrigger>
                <SelectContent>
                  {shippers.map((shipper) => (
                    <SelectItem key={shipper.user_id} value={String(shipper.user_id)}>
                      {shipper.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ngày giao hàng</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDelivery(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateDelivery} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Xác nhận
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
