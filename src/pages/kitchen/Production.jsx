import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProductionPlans, createProLogBatch, updateLogBatchStatus, getAllLogBatches } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
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
  const [batchForm, setBatchForm] = useState({ quantity: '', productionDate: '' });
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
    setBatchForm({ quantity: '', productionDate: today });
    setDialogOpen(true);
  };

  const handleCreateBatch = async () => {
    if (!batchForm.quantity || !batchForm.productionDate) {
      toast.error('Vui lòng nhập đủ thông tin');
      return;
    }
    
    const planId = Number(selectedDetail.planId || selectedDetail.plan_id);
    const productId = Number(selectedDetail.productId || selectedDetail.product_id);

    if (isNaN(planId) || isNaN(productId) || Number(batchForm.quantity) <= 0) {
      console.error('Validation failed:', { planId, productId, quantity: batchForm.quantity });
      toast.error('Vui lòng nhập số lượng hợp lệ');
      return;
    }

    // Comprehensive payload to handle various backend expectations
    const payload = {
      planId: planId,
      productId: productId,
      plan_id: planId,
      product_id: productId,
      quantity: Number(batchForm.quantity),
      productionDate: batchForm.productionDate,
      expiryDate: null, 
      status: 'PROCESSING',
      type: 'PRODUCTION',
    };

    console.log('Final creation payload:', payload);

    setIsSubmitting(true);
    try {
      await createProLogBatch(payload);
      toast.success(`Đã tạo lô sản xuất cho: ${selectedDetail.productName}`);
      setDialogOpen(false);
      fetchPlans();
      navigate('/kitchen/batches/PROCESSING');
    } catch (error) {
      toast.error('Lỗi tạo lô: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteBatch = async (batchId) => {
    try {
      await updateLogBatchStatus(batchId, 'WAITING_TO_CONFIRM');
      toast.success('Đã hoàn thành lô! Đang chờ Kho xác nhận nhập kho.');
      fetchPlans();
    } catch (error) {
      toast.error('Lỗi cập nhật lô: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800';
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
          <h1 className="text-3xl font-bold tracking-tight">Thực thi Sản xuất</h1>
          <p className="text-muted-foreground font-medium">Theo dõi kế hoạch và tạo lô sản phẩm</p>
        </div>
        <Button variant="outline" onClick={fetchPlans} disabled={isLoading}>
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
              <CardHeader className="bg-orange-50/30">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Kế hoạch #{plan.planId}</CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium italic">
                        <Calendar className="h-3 w-3" />
                        {plan.startDate ? new Date(plan.startDate).toLocaleDateString('vi-VN') : 'N/A'} - {plan.endDate ? new Date(plan.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <Badge className={getStatusColor(plan.status)}>
                    {plan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {(plan.details || []).map(detail => {
                    const detailBatches = batches.filter(b => b.planId === plan.planId && b.product_id === detail.productId);
                    return (
                      <div key={detail.planDetailId} className="p-4 bg-white hover:bg-orange-50/10 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div className="space-y-1">
                            <p className="font-bold text-gray-800">{detail.productName}</p>
                            <p className="text-sm">
                              Mục tiêu: <span className="font-bold text-orange-600">{detail.quantity}</span>
                            </p>
                          </div>
                          <Button 
                            onClick={() => openDialog(detail, plan.planId)} 
                            size="sm" 
                            className="bg-orange-500 hover:bg-orange-600 shadow-sm"
                          >
                            <Plus className="mr-2 h-4 w-4" /> Tạo Lô Mới
                          </Button>
                        </div>

                        {detailBatches.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {detailBatches.map(batch => (
                              <div key={batch.batch_id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border text-sm">
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="font-mono bg-white border tracking-tighter">#{batch.batch_id}</Badge>
                                  <span className="font-medium text-gray-700">SL: {batch.quantity}</span>
                                  <Badge className={
                                    batch.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                    batch.status === 'WAITING_TO_CONFIRM' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                    'bg-green-100 text-green-800 border-green-200'
                                  }>
                                    {batch.status === 'PROCESSING' ? 'ĐANG NẤU' : 
                                     batch.status === 'WAITING_TO_CONFIRM' ? 'CHỜ KHO' : 'HOÀN THÀNH'}
                                  </Badge>
                                </div>
                                {batch.status === 'PROCESSING' && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => handleCompleteBatch(batch.batch_id)} 
                                    className="h-8 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 bg-white"
                                  >
                                    Hoàn thành lô
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
            <DialogTitle className="text-xl font-bold text-orange-600">Bắt đầu lô sản xuất</DialogTitle>
            <DialogDescription className="font-medium">
              Sản phẩm: <span className="text-foreground">{selectedDetail?.productName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="font-semibold text-gray-700">Số lượng (đơn vị) *</Label>
              <Input 
                type="number" 
                placeholder="Nhập số lượng..."
                value={batchForm.quantity} 
                onChange={e => setBatchForm({ ...batchForm, quantity: e.target.value })} 
                className="focus-visible:ring-orange-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-gray-700">Ngày sản xuất *</Label>
              <Input 
                type="date" 
                value={batchForm.productionDate} 
                onChange={e => setBatchForm({ ...batchForm, productionDate: e.target.value })}
                className="focus-visible:ring-orange-500 font-medium"
              />
            </div>
            <div className="p-3 bg-orange-50 text-orange-800 rounded-lg text-xs leading-relaxed border border-orange-100 font-medium">
              Lô sản xuất sẽ được tạo với trạng thái ban đầu là <strong>ĐANG NẤU</strong>. Hãy nhớ cập nhật trạng thái khi hoàn thành để chuyển sang Kho xác nhận.
            </div>
          </div>
          <Button onClick={handleCreateBatch} disabled={isSubmitting} className="w-full bg-orange-500 hover:bg-orange-600 py-6 text-base font-bold">
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckSquare className="mr-2 h-5 w-5" />}
            Bắt đầu nấu ngay
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}