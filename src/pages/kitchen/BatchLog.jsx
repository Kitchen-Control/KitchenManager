import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllLogBatches, updateLogBatchStatus } from '../../data/api';
import { BATCH_STATUS } from '../../data/constants';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Loader2, Package, History, RefreshCw, Clock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function BatchLog() {
  const { status: urlStatus } = useParams();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const data = await getAllLogBatches();
      // Only production type batches for kitchen
      const kitchenBatches = (data || []).filter(b => b.type === 'PRODUCTION');
      setBatches(kitchenBatches.sort((a, b) => b.batch_id - a.batch_id));
    } catch (error) {
      toast.error('Lỗi tải danh sách lô: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [urlStatus]);

  const getStatusBadge = (status) => {
    const config = BATCH_STATUS[status] || { label: status, color: 'gray', class: 'bg-gray-100 text-gray-800' };
    return (
      <Badge className={config.class}>
        {config.label}
      </Badge>
    );
  };

  const renderBatchItems = (statusList) => {
    const items = batches.filter(b => statusList.includes(b.status));
    
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed rounded-xl bg-gray-50/50">
          <Package className="h-10 w-10 mb-2 opacity-20" />
          <p className="font-medium text-sm text-center px-4">Không tìm thấy lô hàng nào trong mục này</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {items.map(batch => (
          <Card key={batch.batch_id} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
            <div className={`h-1.5 w-full ${
              batch.status === 'DONE' ? 'bg-green-500' : 
              ['PROCESSING'].includes(batch.status) ? 'bg-blue-500' : 
              ['WAITING_TO_CANCLE', 'CANCLED', 'EXPIRED', 'DAMAGED'].includes(batch.status) ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg tracking-tighter">Lô #{batch.batch_id}</span>
                    <Badge variant="outline" className="font-bold text-xs uppercase px-2 py-0">
                      {batch.product_name}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">
                      Số lượng: <span className="text-foreground font-black">{batch.quantity}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 italic">
                      <Clock className="h-3 w-3" />
                      Sản xuất: {batch.production_date ? new Date(batch.production_date).toLocaleDateString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  {getStatusBadge(batch.status)}
                  <span className="text-[10px] text-muted-foreground font-medium uppercase opacity-60">
                    {new Date(batch.created_at).toLocaleDateString('vi-VN')}
                  </span>
                  
                  {['PROCESSING', 'WAITING_TO_CONFIRM'].includes(batch.status) && (
                    <div className="flex gap-2 mt-2">
                       <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[10px] border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleUpdateStatus(batch.batch_id, 'WAITING_TO_CANCLE')}
                      >
                        Yêu cầu Hủy
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[10px] border-orange-200 text-orange-600 hover:bg-orange-50"
                        onClick={() => handleUpdateStatus(batch.batch_id, 'DAMAGED')}
                      >
                        Báo Hỏng
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const handleUpdateStatus = async (batchId, newStatus) => {
    const statusLabels = {
      'WAITING_TO_CANCLE': 'Yêu cầu Hủy',
      'DAMAGED': 'Báo Hỏng'
    };
    
    if (!confirm(`Xác nhận ${statusLabels[newStatus]} cho lô #${batchId}?`)) return;

    try {
      await updateLogBatchStatus(batchId, newStatus);
      toast.success('Cập nhật trạng thái thành công!');
      fetchBatches();
    } catch (error) {
      toast.error('Lỗi cập nhật: ' + error.message);
    }
  };

  const statusConfig = BATCH_STATUS[urlStatus] || { label: urlStatus };
  
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border-l-8 border-l-orange-500 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-3 text-orange-600 uppercase">
                {statusConfig.label}
              </h1>
              <p className="text-muted-foreground font-bold text-[10px] uppercase opacity-70 tracking-widest italic">Kitchen Management &raquo; Status &raquo; {urlStatus}</p>
            </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-orange-50 transition-colors" onClick={fetchBatches} disabled={loading}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5 text-orange-600" />}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-orange-600" /></div>
      ) : (
        renderBatchItems([urlStatus])
      )}
    </div>
  );
}
