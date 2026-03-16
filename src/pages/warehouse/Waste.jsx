import React, { useState, useEffect } from 'react';
import { getLogBatchesByStatus, updateLogBatchStatus, createTransaction, getProductionPlans, updateProductionPlanStatus, getAllLogBatches } from '../../data/api';
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
      // Flow 4: Look for batches in WAITING_TO_CANCEL status
      const data = await getLogBatchesByStatus('WAITING_TO_CANCEL');
      setExpiredItems(data || []);
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
    if (!confirm(`Bạn có chắc chắn muốn tiêu hủy ${item.quantity} ${item.product_name} (Lô: ${item.batch_id})?`)) return;

    setIsProcessing(true);
    try {
      // 1. Update status to DAMAGED
      await updateLogBatchStatus(item.batch_id, 'DAMAGED');

      // 2. Create EXPORT transaction to officially clear from inventory
      await createTransaction({
        productId: item.product_id,
        batchId: item.batch_id,
        type: 'EXPORT',
        quantity: Number(item.quantity),
        note: 'Xác nhận tiêu hủy hàng hết hạn (Waste Disposal - Flow 4)'
      });

      // 3. Update Plan Status if needed
      if (item.plan_id || item.planId) {
        const planId = Number(item.plan_id || item.planId);
        try {
          const [allPlans, allBatches] = await Promise.all([
            getProductionPlans(),
            getAllLogBatches()
          ]);
          const plan = allPlans.find(p => p.planId === planId);
          if (plan && plan.status !== 'DONE') {
            // Re-use logic to check if all batches are finished
            const terminalStatuses = ['DONE', 'DAMAGED', 'CANCELLED', 'EXPIRED', 'WAITING_TO_CONFIRM', 'WAITING_TO_CANCEL'];
            const pDetails = plan.details || plan.productionPlanDetails || [];
            const planBatches = allBatches.filter(b => Number(b.planId || b.plan_id) === planId);
            
            const allBatchesFinished = planBatches.length > 0 && planBatches.every(b => terminalStatuses.includes(String(b.status || '').toUpperCase()));
            const allProductsStarted = pDetails.every(detail => 
              planBatches.some(b => Number(b.productId || b.product_id) === Number(detail.productId || detail.product_id))
            );

            if (allBatchesFinished && allProductsStarted) {
              await updateProductionPlanStatus(planId, 'DONE');
            }
          }
        } catch (planErr) {
          console.error('Plan status sync failed in Waste:', planErr);
        }
      }
      
      toast.success('Đã xác nhận tiêu hủy thành công!');
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
                    <CardDescription>Mã lô: #{item.batch_id}</CardDescription>
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
            <h3 className="text-lg font-medium">Không có hàng đang chờ hủy</h3>
            <p className="text-muted-foreground">Các lô hàng hết hạn sẽ xuất hiện ở đây sau khi hệ thống tự động quét.</p>
          </div>
        )}
      </div>
    </div>
  );
}