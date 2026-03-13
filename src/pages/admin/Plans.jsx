import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { CalendarDays, Loader2, Plus, RefreshCw } from 'lucide-react';
import { getProductionPlans, createProductionPlan, getOrdersByStatus, getAllLogBatches } from '../../data/api';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { BATCH_STATUS } from '../../data/constants';
import { toast } from 'sonner';

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [batches, setBatches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    planDate: '',
    startDate: '',
    endDate: '',
    note: '',
    details: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const [plansData, batchesData, waitingOrders, processingOrders] = await Promise.all([
        getProductionPlans(),
        getAllLogBatches(),
        getOrdersByStatus('WAITING'),
        getOrdersByStatus('PROCESSING')
      ]);

      const rawPlans = plansData?.details ? [plansData] : Array.isArray(plansData) ? plansData : [];
      setPlans([...rawPlans].sort((a, b) => b.planId - a.planId));
      setBatches(Array.isArray(batchesData) ? batchesData : []);
      setOrders([...(waitingOrders || []), ...(processingOrders || [])]);
    } catch (error) {
      console.error('Fetch error:', error);
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.planDate || !formData.startDate || !formData.endDate) {
      toast.error('Vui lòng nhập đầy đủ thông tin ngày.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createProductionPlan({
        planDate: formData.planDate,
        startDate: formData.startDate,
        endDate: formData.endDate,
        note: formData.note,
        details: formData.details
      });
      toast.success('Tạo kế hoạch sản xuất thành công!');
      setShowForm(false);
      setFormData({ planDate: '', startDate: '', endDate: '', note: '', details: [] });
      fetchPlans();
    } catch (error) {
      toast.error('Lỗi tạo kế hoạch: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">Kế hoạch Sản xuất</h1>
        <Button onClick={fetchPlans} variant="outline" size="sm" className="h-9">
          <RefreshCw className="mr-2 h-4 w-4" /> Làm mới
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {plans.length > 0 ? plans.map((plan) => {
          // Robust check if Plan is actually DONE
          const currentPlanId = Number(plan.planId || plan.plan_id);
          const planBatches = batches.filter(b => Number(b.plan_id || b.planId) === currentPlanId);

          const terminalStatuses = ['DONE', 'DAMAGED', 'CANCLED', 'EXPIRED', 'WAITING_TO_CONFIRM', 'WAITING_TO_CANCLE'];

          const allBatchesFinished = planBatches.length > 0 && planBatches.every(b => {
            const s = String(b.status || '').toUpperCase();
            return terminalStatuses.includes(s);
          });

          const pDetails = plan.details || plan.productionPlanDetails || [];
          const allProductsStarted = pDetails.length > 0 && pDetails.every(detail => {
            const dpId = Number(detail.productId || detail.product_id);
            return planBatches.some(b => Number(b.product_id || b.productId) === dpId);
          });

          const isActuallyDone = allBatchesFinished && allProductsStarted;
          const apiStatus = String(plan.status || '').toUpperCase();
          const displayStatus = (apiStatus === 'DONE' || isActuallyDone) ? 'DONE' : (plan.status || 'PROCESSING');

          return (
            <Card key={currentPlanId} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4 bg-muted/20 border-b">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-4 w-4 text-orange-600" /> Kế hoạch ngày {plan.planDate ? new Date(plan.planDate).toLocaleDateString('vi-VN') : 'N/A'}
                  </CardTitle>
                  <Badge className={`uppercase text-[10px] ${displayStatus === 'DONE' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'
                    }`}>
                    {displayStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 bg-white">
                <div className="space-y-4">
                  {pDetails.map((detail) => {
                    const detailPid = Number(detail.productId || detail.product_id);
                    // Associated orders for this product
                    const associatedOrders = orders.filter(o =>
                      o.order_details?.some(od => Number(od.productId || od.product_id) === detailPid)
                    );

                    // Batches for this specific item in this plan
                    const detailBatches = planBatches.filter(b => Number(b.product_id || b.productId) === detailPid);

                    return (
                      <div key={detail.planDetailId} className="p-3 border rounded-lg bg-gray-50/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-800">{detail.productName}</p>
                            <p className="text-xs text-muted-foreground mr-4">Mục tiêu: <span className="font-bold text-orange-600">{detail.quantity}</span> SP</p>
                          </div>
                          {detailBatches.length > 0 ? (
                            <div className="flex gap-1 flex-wrap justify-end">
                              {detailBatches.map(b => (
                                <Badge key={b.batch_id} variant="outline" className={`text-[9px] px-1 py-0 h-4 border-dashed ${b.status === 'DONE' ? 'border-green-500 text-green-700' : 'border-blue-400 text-blue-600'
                                  }`}>
                                  Lô #{b.batch_id}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Chưa nấu</span>
                          )}
                        </div>

                        {/* Associated Orders Section */}
                        {associatedOrders.length > 0 && (
                          <div className="pt-2 border-t border-dashed">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1">Đơn hàng cần đáp ứng:</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {associatedOrders.map(o => (
                                <span key={o.order_id} className="text-[10px] bg-white border px-1.5 py-0.5 rounded font-medium shadow-sm">
                                  #{o.order_id}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Không có kế hoạch sản xuất nào.
          </div>
        )}
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg h-64 text-muted-foreground">
          {!showForm ? (
            <Button variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> Tạo kế hoạch mới
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-md">
              <div>
                <label className="text-sm font-medium">Ngày kế hoạch</label>
                <Input type="date" name="planDate" value={formData.planDate} onChange={handleFormChange} required />
              </div>
              <div>
                <label className="text-sm font-medium">Ngày bắt đầu</label>
                <Input type="date" name="startDate" value={formData.startDate} onChange={handleFormChange} required />
              </div>
              <div>
                <label className="text-sm font-medium">Ngày kết thúc</label>
                <Input type="date" name="endDate" value={formData.endDate} onChange={handleFormChange} required />
              </div>
              <div>
                <label className="text-sm font-medium">Ghi chú</label>
                <Input type="text" name="note" value={formData.note} onChange={handleFormChange} />
              </div>
              {/* Có thể bổ sung thêm phần chọn sản phẩm và số lượng cho details nếu cần */}
              <Button type="submit" className="w-full mt-2">
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Tạo kế hoạch'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="w-full">Hủy</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}