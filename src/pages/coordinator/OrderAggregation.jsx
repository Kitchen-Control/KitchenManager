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

  const allRelevantOrders = orders
    .filter((o) => (o.status === 'DISPATCHED' || o.status === 'PROCESSING') && !o.delivery_id)
    .sort((a, b) => {
      // Priority to DISPATCHED
      if (a.status === 'DISPATCHED' && b.status !== 'DISPATCHED') return -1;
      if (a.status !== 'DISPATCHED' && b.status === 'DISPATCHED') return 1;
      return b.order_id - a.order_id;
    })
    .map((o) => ({
      ...o,
      store: stores.find((s) => s.store_id === o.store_id),
      details: (o.order_details || []).map((od) => ({ ...od })),
    }));
  
  const selectableOrders = allRelevantOrders.filter(o => o.status === 'DISPATCHED');
  const previewOrders = allRelevantOrders.filter(o => o.status === 'PROCESSING');

  // shippers is already fetched directly from /users/shippers API

  const toggleOrder = (orderId) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleAll = () => {
    if (selectedOrders.length === selectableOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(selectableOrders.map((o) => o.order_id));
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

  const selectedOrdersData = selectableOrders.filter((o) => selectedOrders.includes(o.order_id));
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground ml-2">Đang tải...</p>
      </div>
    );
  }

  if (allRelevantOrders.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Gom đơn hàng</h1>
        <EmptyState
          title="Không có đơn hàng nào"
          description="Hiện không có đơn hàng nào đã được Warehouse xác nhận xuất kho để gom chuyến."
          icon={Package}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gom đơn hàng</h1>
          <p className="text-muted-foreground">
            Chỉ gom những đơn hàng đã được Warehouse xác nhận (DISPATCHED)
          </p>
        </div>
        <div className="flex gap-2">
          {selectableOrders.length > 0 && (
            <Button
              variant="outline"
              onClick={toggleAll}
            >
              {selectedOrders.length === selectableOrders.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả sẵn sàng'}
            </Button>
          )}
          <Button
            onClick={() => setShowCreateDelivery(true)}
            disabled={selectedOrders.length === 0}
            className="gap-2"
          >
            <Truck className="h-4 w-4" />
            Tạo chuyến xe ({selectedOrders.length})
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {selectableOrders.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Sẵn sàng giao ({selectableOrders.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectableOrders.map((order) => (
                <Card
                  key={order.order_id}
                  className={`cursor-pointer transition-all border-2 ${
                    selectedOrders.includes(order.order_id)
                      ? 'border-primary ring-1 ring-primary'
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => toggleOrder(order.order_id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedOrders.includes(order.order_id)}
                          onCheckedChange={() => toggleOrder(order.order_id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <CardTitle className="text-lg">Đơn #{order.order_id}</CardTitle>
                      </div>
                      <StatusBadge status={order.status} type="order" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{order.store_name}</p>
                          <p className="text-muted-foreground line-clamp-1">{order.store?.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>{order.details.length} sản phẩm</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {previewOrders.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Đang chuẩn bị tại Warehouse ({previewOrders.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
              {previewOrders.map((order) => (
                <Card key={order.order_id} className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg text-muted-foreground">Đơn #{order.order_id}</CardTitle>
                      <StatusBadge status={order.status} type="order" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{order.store_name}</span>
                      </div>
                      <p className="italic">Đang chờ Warehouse xác nhận xuất kho...</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
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
                  <div key={store?.store_id || Math.random()} className="text-sm">
                    <p className="font-medium">{store?.store_name || 'Cửa hàng không xác định'}</p>
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
