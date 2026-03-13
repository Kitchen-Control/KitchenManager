import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProductionPlans, createProLogBatch, updateLogBatchStatus, getAllLogBatches, getOrdersByStatus, updateOrderStatus, updateProductionPlanStatus } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ROLE_ID, BATCH_STATUS } from '../../data/constants';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Loader2, ChefHat, CheckSquare, RefreshCw, Calendar, AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Production() {
  const [plans, setPlans] = useState([]);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({ quantity_batches: '1', productionDate: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const today = new Date().toISOString().split('T')[0];

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const [planData, batchData] = await Promise.all([
        getProductionPlans(),
        getAllLogBatches()
      ]);
      const sorted = Array.isArray(planData) ? [...planData].sort((a, b) => b.planId - a.planId) : [];
      setPlans(sorted);
      setBatches(Array.isArray(batchData) ? batchData : []);
    } catch (error) {
      console.error('Production API error:', error);
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openDialog = (detail, planId) => {
    setSelectedDetail({ ...detail, planId });
    setBatchForm({ quantity_batches: '1', productionDate: today });
    setDialogOpen(true);
  };

  const handleCreateBatch = async () => {
    if (!batchForm.quantity_batches || !batchForm.productionDate) {
      toast.error('Vui lòng nhập đủ thông tin');
      return;
    }

    const planId = Number(selectedDetail.planId || selectedDetail.plan_id);
    const productId = Number(selectedDetail.productId || selectedDetail.product_id);
    const targetQty = Number(selectedDetail.quantity);
    const numBatches = Number(batchForm.quantity_batches);

    if (isNaN(planId) || isNaN(productId) || numBatches <= 0) {
      toast.error('Vui lòng nhập số lượng hợp lệ');
      return;
    }

    // Logic: 1 batch = 1 lot of target quantity
    const totalQuantity = numBatches * targetQty;

    const payload = {
      planId: planId,
      productId: productId,
      plan_id: planId,
      product_id: productId,
      quantity: totalQuantity,
      productionDate: batchForm.productionDate,
      expiryDate: null,
      status: 'PROCESSING',
      type: 'PRODUCTION',
    };

    setIsSubmitting(true);
    try {
      await createProLogBatch(payload);
      toast.success(`Đã tạo lô sản xuất (${numBatches} lô = ${totalQuantity} SP) cho: ${selectedDetail.productName}`);

      // Tự động chuyển trạng thái các đơn hàng WAITTING có chứa sản phẩm này sang PROCESSING
      try {
        const waitingOrders = await getOrdersByStatus('WAITTING');
        const ordersToUpdate = waitingOrders.filter(order =>
          order.order_details?.some(detail => Number(detail.product_id) === productId)
        );

        if (ordersToUpdate.length > 0) {
          await Promise.all(ordersToUpdate.map(order =>
            updateOrderStatus(order.order_id, 'PROCESSING').catch(err => {
              console.error(`Failed to update order #${order.order_id}:`, err);
            })
          ));
        }
      } catch (orderError) {
        console.error('Lỗi tự động cập nhật đơn hàng:', orderError);
      }

      setDialogOpen(false);
      fetchPlans();
      navigate('/kitchen/batches/PROCESSING');
    } catch (error) {
      toast.error('Lỗi tạo lô: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCalculatedPlanStatus = (plan, planBatches) => {
    const apiStatus = String(plan.status || '').toUpperCase();
    if (apiStatus === 'DONE') return 'DONE';

    const pDetails = plan.details || plan.productionPlanDetails || [];
    if (pDetails.length === 0) return plan.status || 'PROCESSING';

    const terminalStatuses = ['DONE', 'DAMAGED', 'CANCLED', 'EXPIRED', 'WAITING_TO_CONFIRM', 'WAITING_TO_CANCLE'];

    const currentPlanId = Number(plan.planId || plan.plan_id);
    const planBatchesForThisPlan = planBatches.filter(b => Number(b.planId || b.plan_id) === currentPlanId);

    if (planBatchesForThisPlan.length === 0) return plan.status || 'PROCESSING';

    const allBatchesFinished = planBatchesForThisPlan.every(b => {
      const s = String(b.status || '').toUpperCase();
      return terminalStatuses.includes(s);
    });

    const allProductsStarted = pDetails.every(detail => {
      const dpid = Number(detail.productId || detail.product_id);
      return planBatchesForThisPlan.some(b => Number(b.productId || b.product_id || b.product_id) === dpid);
    });

    if (allBatchesFinished && allProductsStarted) return 'DONE';
    return plan.status || 'PROCESSING';
  };

  const checkAndUpdatePlanStatus = async (planId) => {
    try {
      const [allPlans, allBatches] = await Promise.all([
        getProductionPlans(),
        getAllLogBatches()
      ]);

      let plan = allPlans.find(p => p.planId === planId);
      if (!plan || plan.status === 'DONE') return;

      const calcStatus = getCalculatedPlanStatus(plan, allBatches);

      if (calcStatus === 'DONE') {
        try {
          await updateProductionPlanStatus(planId, 'DONE');
          toast.info(`Kế hoạch #${planId} đã hoàn tất và chuyển sang trạng thái DONE!`);
        } catch (updateErr) {
          console.error('API update status failed:', updateErr);
        }
        await fetchPlans(); // Re-fetch to update UI
      }
    } catch (error) {
      console.error('Error checking plan status:', error);
    }
  };

  const handleCompleteBatch = async (batchId) => {
    try {
      const batch = batches.find(b => b.batch_id === batchId);
      await updateLogBatchStatus(batchId, 'WAITING_TO_CONFIRM');
      toast.success('Đã hoàn thành lô! Đang chờ Kho xác nhận nhập kho.');
      
      if (batch && (batch.planId || batch.plan_id)) {
        await checkAndUpdatePlanStatus(batch.planId || batch.plan_id);
      }
      
      fetchPlans(); // Re-fetch to update UI
    } catch (error) {
      toast.error('Lỗi cập nhật lô: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DONE': return 'bg-green-100 text-green-800';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800';
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-96">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-orange-600">Thực thi Sản xuất</h1>
          <p className="text-muted-foreground font-medium italic">Theo dõi kế hoạch và nấu theo lô sản phẩm</p>
        </div>
        <Button variant="outline" onClick={fetchPlans} disabled={isLoading} className="border-orange-200 text-orange-700 hover:bg-orange-50">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      <div className="grid gap-6">
        {plans.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/20">
            <ChefHat className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground font-medium">Không có kế hoạch sản xuất nào cần thực hiện</p>
          </div>
        ) : (
          plans.map(plan => (
            <Card key={plan.planId} className="border-l-4 border-l-orange-500 shadow-sm overflow-hidden">
              <CardHeader className="bg-orange-50/50 py-4 border-b">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Kế hoạch #{plan.planId}
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded-full border">
                        <Calendar className="h-3 w-3" />
                        {plan.startDate ? new Date(plan.startDate).toLocaleDateString('vi-VN') : 'N/A'} - {plan.endDate ? new Date(plan.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <Badge className={getStatusColor(getCalculatedPlanStatus(plan, batches))}>
                    {getCalculatedPlanStatus(plan, batches)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {(plan.details || []).map(detail => {
                    const detailBatches = batches.filter(b => b.planId === plan.planId && b.productId === detail.productId);
                    return (
                      <div key={detail.planDetailId} className="p-4 bg-white hover:bg-orange-50/5 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div className="space-y-1">
                            <p className="font-bold text-gray-800 text-base">{detail.productName}</p>
                            <p className="text-sm">
                              Mục tiêu sản xuất: <span className="font-bold text-orange-600 underline">{detail.quantity}</span> SP
                            </p>
                          </div>
                          {getCalculatedPlanStatus(plan, batches) !== 'DONE' ? (
                            <Button
                              onClick={() => openDialog({ ...detail, startDate: plan.startDate, endDate: plan.endDate }, plan.planId)}
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600 shadow-sm font-bold"
                            >
                              <Plus className="mr-2 h-4 w-4" /> Bắt đầu sản xuất
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full border border-green-200 text-sm">
                              <CheckSquare className="h-4 w-4" /> Sản xuất hoàn tất
                            </div>
                          )}
                        </div>

                        {detailBatches.length > 0 && (
                          <div className="space-y-2 mt-2 pl-2 border-l-2 border-orange-100">
                            {detailBatches.map(batch => (
                              <div key={batch.batch_id} className="flex items-center justify-between bg-gray-50/50 p-2.5 rounded-lg border border-dashed text-sm">
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="font-mono bg-white border tracking-tighter shadow-sm text-gray-500">#{batch.batch_id}</Badge>
                                  <span className="font-bold text-gray-700">SL: {batch.quantity}</span>
                                  <Badge className={
                                    batch.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                      batch.status === 'WAITING_TO_CONFIRM' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                        batch.status === 'DONE' ? 'bg-green-100 text-green-800 border-green-200' :
                                          batch.status === 'EXPIRED' || batch.status === 'DAMAGED' ? 'bg-red-100 text-red-800 border-red-200' :
                                            'bg-gray-100 text-gray-800 border-gray-200'
                                  }>
                                    {BATCH_STATUS[batch.status]?.label || batch.status}
                                  </Badge>
                                </div>
                                {batch.status === 'PROCESSING' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCompleteBatch(batch.batch_id)}
                                    className="h-8 text-xs border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 bg-white shadow-sm font-semibold"
                                  >
                                    Hoàn thành
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-orange-600">Bắt đầu sản xuất</DialogTitle>
            <DialogDescription className="font-medium text-gray-500 italic">
              Sản phẩm: <span className="text-foreground not-italic font-bold">{selectedDetail?.productName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-gray-700">Số lượng lô (Lot count) *</Label>
                <span className="text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded border">
                  1 lô = {selectedDetail?.quantity} SP
                </span>
              </div>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                placeholder="Nhập số lô (VD: 1, 2...)"
                value={batchForm.quantity_batches}
                onChange={e => setBatchForm({ ...batchForm, quantity_batches: e.target.value })}
                className="focus-visible:ring-orange-500 font-bold text-lg h-12"
              />
              <div className="flex justify-end pt-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Tổng sản phẩm dự kiến: <span className="text-orange-600 font-bold">{(Number(batchForm.quantity_batches || 0) * Number(selectedDetail?.quantity || 0)).toFixed(0)}</span>
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-gray-700">Ngày sản xuất *</Label>
                <span className="text-[10px] text-muted-foreground">
                  Trong khoảng: {selectedDetail?.startDate && new Date(selectedDetail.startDate).toLocaleDateString('vi-VN')} - {selectedDetail?.endDate && new Date(selectedDetail.endDate).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <Input
                type="date"
                min={selectedDetail?.startDate ? new Date(selectedDetail.startDate).toISOString().split('T')[0] : ''}
                max={selectedDetail?.endDate ? new Date(selectedDetail.endDate).toISOString().split('T')[0] : ''}
                value={batchForm.productionDate}
                onChange={e => setBatchForm({ ...batchForm, productionDate: e.target.value })}
                className="focus-visible:ring-orange-500 font-medium"
              />
              <p className="text-[10px] text-orange-500 font-medium">
                * Bếp được chọn ngày bắt đầu, không được vượt quá ngày kết thúc kế hoạch.
              </p>
            </div>
            <div className="p-3 bg-orange-50 text-orange-800 rounded-lg text-xs leading-relaxed border border-orange-100 font-medium italic">
              Lô sản xuất sẽ được tạo với trạng thái ban đầu là <strong>ĐANG NẤU</strong>. Hệ thống tự động tính toán tổng sản phẩm dựa trên số lô đã nhập.
            </div>
          </div>
          <Button onClick={handleCreateBatch} disabled={isSubmitting} className="w-full bg-orange-500 hover:bg-orange-600 py-6 text-base font-bold shadow-lg">
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ChefHat className="mr-2 h-5 w-5" />}
            Bắt đầu sản xuất ngay
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
