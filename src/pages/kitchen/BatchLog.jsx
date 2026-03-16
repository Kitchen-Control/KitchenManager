import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllLogBatches, updateLogBatchStatus, getProductionPlans, updateProductionPlanStatus } from '../../data/api';
import { BATCH_STATUS, ROLE_ID } from '../../data/constants';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Loader2, Package, History, RefreshCw, Clock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function BatchLog({ status: propStatus }) {
  const { user } = useAuth();
  const { status: urlStatus } = useParams();
  const effectiveStatus = propStatus || urlStatus;
  const [batches, setBatches] = useState([]);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const [batchData, planData] = await Promise.all([
        getAllLogBatches(),
        getProductionPlans()
      ]);
      // Only production type batches for kitchen
      const kitchenBatches = (batchData || []).filter(b => b.type === 'PRODUCTION');
      setBatches(kitchenBatches.sort((a, b) => b.batch_id - a.batch_id));
      setLoading(false);
    } catch (error) {
      toast.error('Lỗi tải danh sách lô: ' + error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [effectiveStatus]);

  const getStatusBadge = (status) => {
    const config = BATCH_STATUS[status] || { label: status, color: 'gray', class: 'bg-gray-100 text-gray-800' };
    return (
      <Badge className={config.class}>
        {config.label}
      </Badge>
    );
  };

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

    const actionText = newStatus === 'WAITING_TO_CONFIRM' ? 'Hoàn thành' : 
                       (newStatus === 'CANCEL' ? 'Hủy/Báo hỏng' : newStatus);

    if (!confirm(`Xác nhận ${actionText} cho ${selectedBatches.length} lô đã chọn?`)) return;

    setLoading(true);
    try {
      // Find plans affected
      const affectedPlans = [...new Set(selectedBatches.map(id => {
        const b = batches.find(x => x.batch_id === id);
        return b?.plan_id || b?.planId;
      }))].filter(Boolean);

      await Promise.all(selectedBatches.map(id => updateLogBatchStatus(id, newStatus)));
      toast.success(`Cập nhật thành công ${selectedBatches.length} lô!`);
      
      // Sync plan statuses
      for (const pid of affectedPlans) {
        await checkAndUpdatePlanStatus(pid);
      }

      setSelectedBatches([]);
      await fetchBatches();
    } catch (error) {
      toast.error('Lỗi cập nhật hàng loạt: ' + error.message);
    } finally {
      setLoading(false);
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

    // Group by plan
    const plansMap = items.reduce((acc, b) => {
      const pid = b.plan_id || b.planId || 'NO_PLAN';
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(b);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        {selectedBatches.length > 0 && (
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
                <input 
                  type="checkbox" 
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={planBatches.every(b => selectedBatches.includes(b.batch_id))}
                  onChange={() => toggleSelectAllInPlan(planId, planBatches)}
                />
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
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        checked={selectedBatches.includes(batch.batch_id)}
                        onChange={() => toggleBatchSelection(batch.batch_id)}
                      />
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
                       {['PROCESSING', 'WAITING_TO_CONFIRM'].includes(batch.status) && (
                         <Button 
                           size="sm" 
                           variant="ghost" 
                           onClick={() => handleUpdateStatus(batch.batch_id, 'WAITING_TO_CANCEL')}
                           className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                         >Hủy / Báo hỏng</Button>
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

  const getCalculatedPlanStatus = (plan, planBatches) => {
    const apiStatus = String(plan.status || '').toUpperCase();
    if (apiStatus === 'DONE') return 'DONE';

    const pDetails = plan.details || plan.productionPlanDetails || [];
    if (pDetails.length === 0) return plan.status || 'PROCESSING';

    const terminalStatuses = ['DONE', 'DAMAGED', 'CANCELLED', 'EXPIRED', 'WAITING_TO_CONFIRM', 'WAITING_TO_CANCEL'];
    const currentPlanId = Number(plan.planId || plan.plan_id);
    const planBatchesForThisPlan = planBatches.filter(b => Number(b.planId || b.plan_id) === currentPlanId);

    if (planBatchesForThisPlan.length === 0) return plan.status || 'PROCESSING';

    const allBatchesFinished = planBatchesForThisPlan.every(b => {
      const s = String(b.status || '').toUpperCase();
      const isTerminal = terminalStatuses.includes(s);
      // console.log(`Batch #${b.batch_id} status ${s} is terminal? ${isTerminal}`);
      return isTerminal;
    });

    const allProductsStarted = pDetails.every(detail => {
      const dpid = Number(detail.productId || detail.product_id);
      const isStarted = planBatchesForThisPlan.some(b => Number(b.productId || b.product_id) === dpid);
      // console.log(`Product ${detail.productName} (#${dpid}) is started? ${isStarted}`);
      return isStarted;
    });

    if (allBatchesFinished && allProductsStarted) {
      // Check for mixed results
      const hasIssues = planBatchesForThisPlan.some(b => 
        ['DAMAGED', 'CANCELLED', 'WAITING_TO_CANCEL'].includes(String(b.status || '').toUpperCase())
      );
      return hasIssues ? 'COMPLETE_ONE_SECTION' : 'DONE';
    }
    return plan.status || 'PROCESSING';
  };

  const checkAndUpdatePlanStatus = async (planId) => {
    if (!planId) return;
    try {
      const [allPlans, allBatches] = await Promise.all([
        getProductionPlans(),
        getAllLogBatches()
      ]);

      let plan = allPlans.find(p => p.planId === planId);
      if (!plan || plan.status === 'DONE') return;

      const calcStatus = getCalculatedPlanStatus(plan, allBatches);

      if (calcStatus === 'DONE' || calcStatus === 'COMPLETE_ONE_SECTION') {
        try {
          await updateProductionPlanStatus(planId, calcStatus);
          toast.info(`Kế hoạch #${planId} đã hoàn tất và chuyển sang trạng thái ${calcStatus}!`);
        } catch (updateErr) {
          console.error('API update status failed:', updateErr);
        }
      }
    } catch (error) {
      console.error('Error checking plan status:', error);
    }
  };

  const handleUpdateStatus = async (batchId, newStatus) => {
    const statusLabels = {
      'WAITING_TO_CANCEL': 'Yêu cầu Hủy',
      'CANCEL': 'Hủy / Hỏng',
      'DAMAGED': 'Báo Hỏng',
      'DONE': 'Nhập kho',
      'WAITING_TO_CONFIRM': 'Hoàn thành sản xuất'
    };

    if (!confirm(`Xác nhận ${statusLabels[newStatus]} cho lô #${batchId}?`)) return;

    try {
      await updateLogBatchStatus(batchId, newStatus);
      toast.success('Cập nhật trạng thái thành công!');

      // Check if plan should be DONE
      const terminalStatuses = ['DONE', 'DAMAGED', 'CANCEL', 'CANCELLED', 'EXPIRED', 'WAITING_TO_CONFIRM', 'WAITING_TO_CANCEL'];
      if (terminalStatuses.includes(newStatus)) {
        const batch = batches.find(b => b.batch_id === batchId);
        if (batch && (batch.planId || batch.plan_id)) {
          await checkAndUpdatePlanStatus(batch.planId || batch.plan_id);
        }
      }

      fetchBatches();
    } catch (error) {
      toast.error('Lỗi cập nhật: ' + error.message);
    }
  };

  const statusConfig = BATCH_STATUS[effectiveStatus] || { label: effectiveStatus };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border-l-8 border-l-orange-500 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3 text-orange-600 uppercase">
              {statusConfig.label}
            </h1>
            <p className="text-muted-foreground font-bold text-[10px] uppercase opacity-70 tracking-widest italic">Management &raquo; Status &raquo; {effectiveStatus}</p>
          </div>
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
