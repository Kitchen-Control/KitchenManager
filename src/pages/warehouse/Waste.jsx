import React, { useState, useEffect } from 'react';
import { getInventories, createTransaction } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, Trash2, AlertOctagon, Package } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Waste() {
  const [expiredItems, setExpiredItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchExpiredGoods = async () => {
    setIsLoading(true);
    try {
      const data = await getInventories();
      // Lọc các sản phẩm đã hết hạn (Expiry Date < Now)
      const now = new Date();
      const expired = (data || []).filter(item => {
        if (!item.expiry_date) return false;
        return new Date(item.expiry_date) < now && item.quantity > 0;
      });
      setExpiredItems(expired);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiredGoods();
  }, []);

  const handleDispose = async (item) => {
    if (!confirm(`Bạn có chắc chắn muốn tiêu hủy ${item.quantity} ${item.product_name} (Lô: ${item.batch?.batchId || item.batch})?`)) return;

    setIsProcessing(true);
    try {
      // Gọi API tạo transaction EXPORT để trừ kho
      await createTransaction({
        productId: item.product_id,
        batchId: item.batch_id || (typeof item.batch === 'object' ? item.batch.batchId : item.batch),
        type: 'EXPORT',
        quantity: Number(item.quantity),
        note: 'Tiêu hủy hàng hết hạn (Waste Disposal)'
      });
      
      toast.success('Đã tiêu hủy thành công!');
      fetchExpiredGoods(); // Reload list
    } catch (error) {
      toast.error('Lỗi khi tiêu hủy: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-red-600 flex items-center gap-2">
          <Trash2 className="h-8 w-8" /> Quản lý Hủy hàng
        </h1>
        <p className="text-muted-foreground">Danh sách các lô hàng đã hết hạn cần được xử lý tiêu hủy.</p>
      </div>

      <div className="grid gap-4">
        {expiredItems.length > 0 ? (
          expiredItems.map((item) => (
            <Card key={item.inventory_id} className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-bold text-red-700">{item.product_name}</CardTitle>
                    <CardDescription>Lô hàng: {item.batch?.batchId || item.batch || 'N/A'}</CardDescription>
                  </div>
                  <AlertOctagon className="h-6 w-6 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mt-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Số lượng tồn: <span className="text-lg font-bold">{item.quantity}</span></p>
                    <p className="text-sm text-red-600 font-medium">
                      Hết hạn ngày: {format(new Date(item.expiry_date), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={() => handleDispose(item)}
                  >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Xác nhận Tiêu hủy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg border border-dashed">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Package className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium">Không có hàng hết hạn</h3>
            <p className="text-muted-foreground">Kho hàng đang ở trạng thái tốt.</p>
          </div>
        )}
      </div>
    </div>
  );
}