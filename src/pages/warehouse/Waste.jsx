import React, { useState, useEffect } from 'react';
import {
  getLogBatchesByStatus,
  expireBatch,
  createWasteLog,
} from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { Loader2, Trash2, AlertOctagon, Package, RefreshCw, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Waste() {
  const [expiredItems, setExpiredItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [checkedItems, setCheckedItems] = useState({});

  const fetchExpiredGoods = async () => {
    setIsLoading(true);
    setCheckedItems({});
    try {
      const data = await getLogBatchesByStatus('WAITING_TO_CANCEL');
      setExpiredItems(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiredGoods();
  }, []);

  const handleDisposeSingle = async (item) => {
    if (!confirm(`Xác nhận tiêu hủy ${item.quantity} ${item.product_name} (Lô #${item.batch_id})?`)) return;
    await disposeItem(item);
  };

  const disposeItem = async (item) => {
    setProcessingIds(prev => new Set([...prev, item.batch_id]));
    try {
      // 1. Call the dedicated /expire endpoint — marks DAMAGED + creates WASTE report for Manager
      await expireBatch(item.batch_id);

      // 2. Also log to waste_logs table for operational tracking
      await createWasteLog({
        productId: item.product_id,
        batchId: item.batch_id,
        quantity: Number(item.quantity),
        wasteType: 'EXPIRED',
        note: `Thủ kho xác nhận xuất hủy hàng hết hạn - Lô #${item.batch_id}`,
      }).catch(err => console.warn('Waste log secondary failed:', err));

      return true;
    } catch (error) {
      toast.error(`Lỗi tiêu hủy lô #${item.batch_id}: ` + error.message);
      return false;
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(item.batch_id);
        return next;
      });
    }
  };

  const handleBulkDispose = async () => {
    const selectedItems = expiredItems.filter(item => checkedItems[item.batch_id]);
    if (selectedItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất một lô để xuất hủy.');
      return;
    }
    if (!confirm(`Xác nhận tiêu hủy ${selectedItems.length} lô hàng đã chọn?`)) return;

    let successCount = 0;
    for (const item of selectedItems) {
      const ok = await disposeItem(item);
      if (ok) successCount++;
    }

    if (successCount > 0) {
      toast.success(`Đã hoàn tất xuất hủy ${successCount}/${selectedItems.length} lô hàng!`);
      fetchExpiredGoods();
    }
  };

  const allChecked = expiredItems.length > 0 && expiredItems.every(i => checkedItems[i.batch_id]);
  const someChecked = expiredItems.some(i => checkedItems[i.batch_id]);
  const selectedCount = Object.values(checkedItems).filter(Boolean).length;

  const toggleAll = (checked) => {
    const next = {};
    expiredItems.forEach(i => { next[i.batch_id] = !!checked; });
    setCheckedItems(next);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-red-500" />
        <p className="text-muted-foreground">Đang tải danh sách chờ xuất hủy...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-600 flex items-center gap-2">
            <Trash2 className="h-8 w-8" /> Xuất hủy hàng hết hạn
          </h1>
          <p className="text-muted-foreground mt-1">
            Danh sách các lô hàng đã quá hạn sử dụng ({expiredItems.length} lô đang chờ xử lý).
          </p>
        </div>
        <Button variant="outline" onClick={fetchExpiredGoods} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Làm mới
        </Button>
      </div>

      {expiredItems.length > 0 ? (
        <>
          {/* Toolbar: select all + bulk action */}
          <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl p-4 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <Checkbox
                id="select-all-waste"
                checked={allChecked}
                onCheckedChange={toggleAll}
              />
              <Label htmlFor="select-all-waste" className="font-bold text-red-900 cursor-pointer">
                Chọn tất cả ({expiredItems.length} lô)
              </Label>
              {selectedCount > 0 && (
                <Badge variant="destructive">{selectedCount} đã chọn</Badge>
              )}
            </div>
            {someChecked && (
              <Button
                variant="destructive"
                onClick={handleBulkDispose}
                className="shadow-lg animate-in zoom-in-95"
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                Hoàn tất Xuất hủy ({selectedCount} lô đã chọn)
              </Button>
            )}
          </div>

          {/* Batch list */}
          <div className="grid gap-4">
            {expiredItems.map((item) => {
              const isProcessing = processingIds.has(item.batch_id);
              return (
                <Card key={item.batch_id} className="border-red-200 bg-red-50/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-4">
                      <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          id={`check-batch-${item.batch_id}`}
                          checked={!!checkedItems[item.batch_id]}
                          onCheckedChange={(checked) =>
                            setCheckedItems(prev => ({ ...prev, [item.batch_id]: !!checked }))
                          }
                          disabled={isProcessing}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg font-bold text-red-700">
                              {item.product_name}
                            </CardTitle>
                            <CardDescription>Mã lô: #{item.batch_id}</CardDescription>
                          </div>
                          <AlertOctagon className="h-6 w-6 text-red-500 flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center ml-10">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Số lượng cần hủy:{' '}
                          <span className="text-lg font-bold text-red-700">{item.quantity}</span>
                        </p>
                        <p className="text-sm text-red-600 font-medium">
                          Hết hạn:{' '}
                          {item.expiry_date
                            ? format(new Date(item.expiry_date), 'dd/MM/yyyy')
                            : 'N/A'}
                        </p>
                        {item.production_date && (
                          <p className="text-xs text-muted-foreground">
                            Ngày SX: {format(new Date(item.production_date), 'dd/MM/yyyy')}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="destructive"
                        onClick={() => handleDisposeSingle(item)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        {isProcessing ? 'Đang xử lý...' : 'Xác nhận Tiêu hủy'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-dashed">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-green-700 mb-1">Không có hàng đang chờ hủy</h3>
          <p className="text-muted-foreground text-sm">
            Các lô hàng hết hạn sẽ xuất hiện ở đây sau khi hệ thống tự động quét (00:01 hàng ngày).
          </p>
        </div>
      )}
    </div>
  );
}