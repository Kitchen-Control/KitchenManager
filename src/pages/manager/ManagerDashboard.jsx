import React, { useState, useEffect } from 'react';
import { fetchOrders, getInventories, getProducts } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  ClipboardList,
  AlertTriangle,
  ShoppingCart,
  PackageCheck,
  ArrowDownToLine,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reloadDashboard();
  }, []);

  const reloadDashboard = () => {
    setLoading(true);
    Promise.all([
      fetchOrders().catch(() => []),
      getInventories().catch(() => []),
      getProducts().catch(() => []),
    ]).then(([o, inv, p]) => {
      setOrders(Array.isArray(o) ? o : []);
      setInventories(Array.isArray(inv) ? inv : []);
      setProducts(Array.isArray(p) ? p : []);
    }).finally(() => setLoading(false));
  };

  const activePlans = 0;
  const pendingOrders = orders.filter((o) => o.status === 'WAITTING').length;
  const lowStockItems = inventories.filter((i) => (i.quantity ?? 0) < 50);
  const expiredInventory = inventories.filter((i) => {
    const expiry = new Date(i.expiry_date || 0);
    return expiry < new Date() && (i.quantity ?? 0) > 0;
  });
  // Note: pendingImportBatches cần API Production Batches từ backend
  // Hiện tại để [], khi backend bổ sung API sẽ thay thế bằng dữ liệu thật
  const pendingImportBatches = [];
  const finishedProducts = products.filter((p) => p.product_type === 'FINISHED_PRODUCT');

  const handleImportBatch = () => {
    toast.info('Chức năng nhập kho từ lô sản xuất cần API Production Batches.');
  };

  const handleDisposeInventory = (inv) => {
    toast.info('Chức năng tiêu hủy hàng hết hạn cần API Inventory Transactions (EXPORT).');
  };

  const stockData = finishedProducts.map((p) => {
    const totalStock = inventories
      .filter((i) => i.product_id === p.product_id)
      .reduce((sum, i) => sum + (i.quantity ?? 0), 0);
    return { name: p.product_name, stock: totalStock };
  });

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
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan Quản lý</h1>
        <p className="text-muted-foreground">
          Theo dõi sản xuất, tồn kho và duyệt nhập kho (Flow 2 & 4)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kế hoạch đang chạy</CardTitle>
            <ClipboardList className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePlans}</div>
            <p className="text-xs text-muted-foreground">Flow 2: Sản xuất</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đơn hàng chờ</CardTitle>
            <ShoppingCart className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground">Nhu cầu từ cửa hàng</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cần nhập kho</CardTitle>
            <ArrowDownToLine className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingImportBatches.length}</div>
            <p className="text-xs text-muted-foreground">Lô hàng đã SX xong</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cảnh báo rủi ro</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredInventory.length + lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">Hết hạn / Tồn thấp</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Duyệt nhập kho thành phẩm</CardTitle>
            <CardDescription>Các lô hàng Bếp đã hoàn thành (Flow 2-B3)</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingImportBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không có lô hàng nào cần nhập kho. (Cần API Production Batches)
              </p>
            ) : (
              <div className="space-y-4">
                {pendingImportBatches.map((batch) => (
                  <div
                    key={batch.batch_id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-medium">Lô #{batch.batch_id}</p>
                      <span>SL: {batch.quantity}</span>
                    </div>
                    <Button size="sm" onClick={handleImportBatch}>
                      <PackageCheck className="mr-2 h-4 w-4" />
                      Nhập kho
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tồn kho thành phẩm hiện tại</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stockData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Chưa có dữ liệu
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="stock" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {expiredInventory.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Cảnh báo hàng hết hạn (Cần tiêu hủy)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiredInventory.map((inv) => {
                const product = finishedProducts.find((p) => p.product_id === inv.product_id) || {};
                return (
                  <div
                    key={inv.inventory_id}
                    className="flex items-center justify-between bg-white p-3 rounded border border-red-100"
                  >
                    <div>
                      <p className="font-medium text-red-900">
                        {product.product_name || `SP #${inv.product_id}`}
                      </p>
                      <p className="text-sm text-red-700">
                        Lô: {inv.batch_id} - SL: {inv.quantity} - Hết hạn: {inv.expiry_date}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDisposeInventory(inv)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Tiêu hủy
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
