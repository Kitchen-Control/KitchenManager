import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getInventories, fetchOrders } from '../../data/api';

export default function WarehouseDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalInventory: 0, expiringSoon: 0, processingOrders: 0 });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [inventories, orders] = await Promise.all([
        getInventories().catch(() => []),
        fetchOrders().catch(() => []),
      ]);
      const inv = Array.isArray(inventories) ? inventories : [];
      const ord = Array.isArray(orders) ? orders : [];
      const now = new Date();
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      setStats({
        totalInventory: inv.reduce((sum, i) => sum + (i.quantity || 0), 0),
        expiringSoon: inv.filter(i => {
          if (!i.expiry_date) return false;
          const exp = new Date(i.expiry_date);
          return exp > now && exp <= threeDays;
        }).length,
        processingOrders: ord.filter(o => o.status === 'PROCESSING').length,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const menuItems = [
    {
      title: 'Quản lý Tồn kho',
      description: 'Xem danh sách tồn kho, hạn sử dụng và vị trí lô hàng.',
      icon: <Package className="h-8 w-8 text-blue-500" />,
      path: '/warehouse/inventory',
      color: 'bg-blue-50 hover:bg-blue-100',
      stat: stats.totalInventory > 0 ? `${stats.totalInventory.toFixed(0)} đv` : null,
    },
    {
      title: 'Nhập kho (Procurement)',
      description: 'Nhập nguyên liệu mua từ nhà cung cấp vào kho.',
      icon: <ArrowDownToLine className="h-8 w-8 text-green-500" />,
      path: '/warehouse/procurement',
      color: 'bg-green-50 hover:bg-green-100',
    },
    {
      title: 'Xuất kho (Outbound)',
      description: 'Soạn hàng và tạo phiếu xuất kho cho các đơn PROCESSING.',
      icon: <ArrowUpFromLine className="h-8 w-8 text-purple-500" />,
      path: '/warehouse/outbound',
      color: 'bg-purple-50 hover:bg-purple-100',
      stat: stats.processingOrders > 0 ? `${stats.processingOrders} đơn` : null,
    },
    {
      title: 'Hủy hàng (Waste)',
      description: 'Xử lý và tiêu hủy các lô hàng hết hạn hoặc hư hỏng.',
      icon: <AlertTriangle className="h-8 w-8 text-red-500" />,
      path: '/warehouse/waste',
      color: 'bg-red-50 hover:bg-red-100',
      stat: stats.expiringSoon > 0 ? `${stats.expiringSoon} sắp hết hạn` : null,
    }
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kho Bếp Trung Tâm</h1>
          <p className="text-muted-foreground">Quản lý nhập xuất kho và tồn trữ hàng hóa</p>
        </div>
        <Button variant="outline" onClick={loadStats} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {menuItems.map((item, index) => (
          <Card
            key={index}
            className={`cursor-pointer transition-all shadow-sm hover:shadow-md ${item.color} border`}
            onClick={() => navigate(item.path)}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 bg-white rounded-full shadow-sm">{item.icon}</div>
              <div className="flex-1">
                <CardTitle className="text-xl">{item.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              </div>
              {item.stat && (
                <div className="text-right">
                  <span className="text-lg font-bold text-primary">{item.stat}</span>
                </div>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}