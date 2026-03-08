import React, { useState, useEffect } from 'react';
import { getDeliveries, getInventories, createTransaction } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';

export default function Outbound() {
  const [deliveries, setDeliveries] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [delData, invData] = await Promise.all([getDeliveries(), getInventories()]);
      // Chỉ lấy các chuyến xe đang chờ (WAITING)
      setDeliveries((delData || []).filter(d => d.orders && d.orders.some(o => o.status === 'WAITING')));
      setInventories(invData || []);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Gom nhóm sản phẩm cần xuất cho 1 chuyến xe
  const aggregateItems = (delivery) => {
    const items = {};
    delivery.orders.forEach(order => {
      if (order.status !== 'WAITING') return;
      order.order_details.forEach(detail => {
        if (!items[detail.product_id]) {
          items[detail.product_id] = {
            id: detail.product_id,
            name: detail.product_name,
            quantity: 0
          };
        }
        items[detail.product_id].quantity += detail.quantity;
      });
    });
    return Object.values(items);
  };

  const handleDispatch = async (delivery) => {
    if (!confirm(`Xác nhận xuất kho cho chuyến xe #${delivery.delivery_id}?`)) return;
    
    setProcessingId(delivery.delivery_id);
    const itemsNeeded = aggregateItems(delivery);
    
    try {
      // BR-020: FEFO Algorithm (First Expired First Out)
      for (const item of itemsNeeded) {
        let remainingQty = item.quantity;
        
        // Tìm các lô hàng của sản phẩm này, sắp xếp theo HSD tăng dần
        const availableBatches = inventories
          .filter(inv => inv.product_id === item.id && inv.quantity > 0)
          .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

        if (availableBatches.reduce((sum, b) => sum + b.quantity, 0) < remainingQty) {
          throw new Error(`Không đủ tồn kho cho sản phẩm: ${item.name}`);
        }

        // Trừ dần từng lô
        for (const batch of availableBatches) {
          if (remainingQty <= 0) break;
          
          const deductQty = Math.min(batch.quantity, remainingQty);
          
          await createTransaction({
            productId: item.id,
            batchId: typeof batch.batch === 'object' ? batch.batch.batchId : batch.batch,
            type: 'EXPORT',
            quantity: deductQty,
            note: `Xuất kho cho Delivery #${delivery.delivery_id}`
          });

          remainingQty -= deductQty;
        }
      }

      toast.success(`Đã xuất kho thành công cho chuyến xe #${delivery.delivery_id}`);
      fetchData(); // Reload data
    } catch (error) {
      toast.error('Lỗi xuất kho: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <Truck className="h-8 w-8" /> Soạn hàng & Xuất kho
      </h1>

      <div className="grid gap-6">
        {deliveries.length > 0 ? deliveries.map(delivery => (
          <Card key={delivery.delivery_id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Chuyến xe #{delivery.delivery_id}</CardTitle>
                  <CardDescription>Shipper: {delivery.shipper_name} - Ngày: {new Date(delivery.delivery_date).toLocaleDateString()}</CardDescription>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">WAITING</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Tổng hợp hàng cần soạn:</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {aggregateItems(delivery).map(item => (
                    <li key={item.id} className="text-sm">
                      <span className="font-medium">{item.name}</span>: {item.quantity}
                    </li>
                  ))}
                </ul>
              </div>
              <Button 
                onClick={() => handleDispatch(delivery)} 
                // Xóa disabled, luôn cho thao tác
                className="w-full sm:w-auto"
              >
                {processingId === delivery.delivery_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Xác nhận Xuất kho (Auto FEFO)
              </Button>
            </CardContent>
          </Card>
        )) : (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed text-muted-foreground">
            <AlertCircle className="mx-auto h-10 w-10 mb-3 opacity-50" />
            Không có chuyến xe nào đang chờ xuất kho.
          </div>
        )}
      </div>
    </div>
  );
}