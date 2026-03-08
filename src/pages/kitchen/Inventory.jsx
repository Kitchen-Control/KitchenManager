import React, { useState, useEffect } from 'react';
import { getInventories } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Inventory() {
  const [inventories, setInventories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const data = await getInventories();
      setInventories(data || []);
    } catch (error) {
      toast.error('Không thể tải dữ liệu tồn kho: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const getExpiryStatus = (dateString) => {
    const expiry = new Date(dateString);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { color: 'text-red-600 bg-red-50', label: 'Đã hết hạn' };
    if (diffDays <= 3) return { color: 'text-orange-600 bg-orange-50', label: 'Sắp hết hạn' };
    return { color: 'text-green-600 bg-green-50', label: 'Còn hạn' };
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý Tồn kho Bếp</h1>
          <p className="text-muted-foreground">Theo dõi số lượng và hạn sử dụng nguyên vật liệu tại bếp.</p>
        </div>
        <Button onClick={fetchInventory} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Làm mới
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inventories.map((item) => {
          const status = getExpiryStatus(item.expiry_date);
          return (
            <Card key={item.inventory_id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {item.product_name}
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.quantity} <span className="text-sm font-normal text-muted-foreground">đơn vị</span></div>
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Lô hàng:</span>
                    <span className="font-mono">{item.batch?.batchId || item.batch || 'N/A'}</span>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full w-fit flex items-center gap-1 ${status.color}`}>
                    {status.label === 'Đã hết hạn' && <AlertTriangle className="h-3 w-3" />}
                    {status.label === 'Sắp hết hạn' && <AlertTriangle className="h-3 w-3" />}
                    <span>HSD: {item.expiry_date ? format(new Date(item.expiry_date), 'dd/MM/yyyy') : 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {inventories.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Kho đang trống.
          </div>
        )}
      </div>
    </div>
  );
}