import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllLogBatches, updateLogBatchStatus } from '../../data/api'; 
import { BATCH_STATUS } from '../../data/constants';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Loader2, Package, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function BatchLog({ status: propStatus }) {
  const { status: urlStatus } = useParams();
  const effectiveStatus = propStatus || urlStatus;
  const [batches, setBatches] = useState([]);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mảng các trạng thái không cho phép hiện checkbox và bulk update
  const hideCheckboxes = ['WAITING_TO_CONFIRM', 'DONE', 'DAMAGED', 'EXPIRED'].includes(effectiveStatus);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const batchData = await getAllLogBatches();
      const kitchenBatches = (batchData || []).filter(b => b.type === 'PRODUCTION');
      setBatches(kitchenBatches.sort((a, b) => b.batch_id - a.batch_id));
    } catch (error) {
      toast.error('Lỗi tải danh sách lô: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    // Clear selected batches khi đổi tab để tránh lỗi logic
    setSelectedBatches([]); 
  }, [effectiveStatus]);

  const toggleBatchSelection = (batchId) => {
    setSelectedBatches(prev => 
      prev.includes(batchId) ? prev.filter(id => id !== batchId) : [...prev, batchId]
    );
  };

  const toggleSelectAllInPlan = (planId, planBatches) => {
    const planBatchIds = planBatches.map(b => b.batch_id);
    const allSelected = planBatchIds.every(id => selectedBatches.includes(id));
    
    if (allSelected) {
      setSelectedBatches(prev => prev.filter(id => !planBatchIds.includes(id)));
    } else {
      setSelectedBatches(prev => [...new Set([...prev, ...planBatchIds])]);
    }
  };

  const handleBulkUpdate = async (newStatus) => {
    if (selectedBatches.length === 0) {
      toast.error('Vui lòng chọn ít nhất một lô');
      return;
    }

    const actionText = newStatus === 'WAITING_TO_CONFIRM' ? 'Hoàn thành' : 'Hủy/Báo hỏng';
    if (!confirm(`Xác nhận ${actionText} cho ${selectedBatches.length} lô đã chọn?`)) return;

    setLoading(true);
    try {
      await Promise.all(selectedBatches.map(id => updateLogBatchStatus(id, newStatus)));
      toast.success(`Cập nhật thành công ${selectedBatches.length} lô!`);
      setSelectedBatches([]);
      await fetchBatches();
    } catch (error) {
      toast.error('Lỗi cập nhật hàng loạt: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (batchId, newStatus) => {
    const statusLabels = {
      'WAITING_TO_CANCEL': 'Yêu cầu Hủy',
      'WAITING_TO_CONFIRM': 'Hoàn thành sản xuất',
      'DAMAGED': 'Xác nhận Hủy/Hỏng'
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

    const plansMap = items.reduce((acc, b) => {
      const pid = b.plan_id || b.planId || 'NO_PLAN';
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(b);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        {/* Ẩn thanh Bulk Update nếu đang ở các trạng thái không cho phép */}
        {!hideCheckboxes && selectedBatches.length > 0 && (
          <div className="sticky top-4 z-10 bg-orange-600 text-white p-3 rounded-xl shadow-xl flex justify-between items-center animate-in slide-in-from-top duration-300">
            <span className="font-bold text-sm">Đã chọn {selectedBatches.length} lô</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="h-8 text-xs font-bold" onClick={() => handleBulkUpdate('WAITING_TO_CONFIRM')}>Hoàn thành</Button>
              <Button size="sm" variant="destructive" className="h-8 text-xs font-bold" onClick={() => handleBulkUpdate('WAITING_TO_CANCEL')}>Hủy / Báo hỏng</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold text-white border-white hover:bg-orange-700" onClick={() => setSelectedBatches([])}>Bỏ chọn</Button>
            </div>
          </div>
        )}

        {Object.entries(plansMap).map(([planId, planBatches]) => (
          <Card key={planId} className="overflow-hidden border-orange-200 shadow-sm border-l-4 border-l-orange-500">
            <CardHeader className="bg-orange-50/50 py-3 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                {/* Ẩn checkbox "Chọn tất cả" */}
                {!hideCheckboxes && (
                  <input 
                    type="checkbox" 
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    checked={planBatches.every(b => selectedBatches.includes(b.batch_id))}
                    onChange={() => toggleSelectAllInPlan(planId, planBatches)}
                  />
                )}
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  Kế hoạch {planId === 'NO_PLAN' ? '(Không rõ KH)' : `#${planId}`} 
                  <span className="text-xs font-normal text-muted-foreground">({planBatches.length} lô)</span>
                </CardTitle>
              </div>
              <Link to={`/kitchen/production`} className="text-[10px] text-orange-600 font-bold hover:underline py-1 px-2 bg-white rounded border">XEM KẾ HOẠCH</Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {planBatches.map(batch => (
                  <div key={batch.batch_id} className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${selectedBatches.includes(batch.batch_id) ? 'bg-orange-50/30' : ''}`}>
                    <div className="flex items-center gap-4">
                      {/* Ẩn checkbox chọn từng lô */}
                      {!hideCheckboxes && (
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          checked={selectedBatches.includes(batch.batch_id)}
                          onChange={() => toggleBatchSelection(batch.batch_id)}
                        />
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">Lô #{batch.batch_id}</span>
                          <Badge variant="outline" className="text-[10px] py-0">{batch.product_name}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">SL: <span className="font-bold text-foreground">{batch.quantity}</span> • {batch.status}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                       {batch.status === 'PROCESSING' && (
                         <Button 
                           size="sm" 
                           variant="ghost" 
                           onClick={() => handleUpdateStatus(batch.batch_id, 'WAITING_TO_CONFIRM')}
                           className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                         >Hoàn thành</Button>
                       )}
                       {['PROCESSING'].includes(batch.status) && (
                         <Button 
                           size="sm" 
                           variant="ghost" 
                           onClick={() => handleUpdateStatus(batch.batch_id, 'WAITING_TO_CANCEL')}
                           className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                         >Hủy</Button>
                       )}
                       
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const statusConfig = BATCH_STATUS[effectiveStatus] || { label: effectiveStatus };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border-l-8 border-l-orange-500 shadow-sm transition-all duration-300">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3 text-orange-600 uppercase">
            {statusConfig.label}
          </h1>
          <p className="text-muted-foreground font-bold text-[10px] uppercase opacity-70 tracking-widest italic">Management &raquo; Status &raquo; {effectiveStatus}</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-orange-50 transition-colors" onClick={fetchBatches} disabled={loading}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5 text-orange-600" />}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-orange-600" /></div>
      ) : (
        renderBatchItems([effectiveStatus])
      )}
    </div>
  );
}