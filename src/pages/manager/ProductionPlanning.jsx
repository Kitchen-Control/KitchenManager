import React, { useState, useEffect } from 'react';
import { getProducts, getProductionPlans, createProductionPlan, getProductionPlanDetails, updateProductionPlan, updateProductionPlanStatus } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { PRODUCTION_PLAN_STATUS } from '../../data/constants';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Calendar, Plus, Trash2, Loader2, ListChecks, Package } from 'lucide-react';

import { toast } from 'sonner';

export default function ProductionPlanning() {
  const [products, setProducts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    planId: null,
    startDate: '',
    endDate: '',
    note: '',
    details: []
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodData, planData] = await Promise.all([
        getProducts().catch(() => []),
        getProductionPlans().catch(() => [])
      ]);
      setProducts((prodData || []).filter(p => p.product_type !== 'RAW_MATERIAL'));

      // Fetch details for each plan if not already included
      const plansWithDetails = await Promise.all((planData || []).map(async (plan) => {
        if (plan.details && plan.details.length > 0) return plan;
        try {
          const details = await getProductionPlanDetails(plan.planId);
          return { ...plan, details };
        } catch (err) {
          return plan;
        }
      }));

      setPlans(plansWithDetails.sort((a, b) => b.planId - a.planId));
    } catch (e) {
      toast.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addDetailRow = () => {
    setFormData(prev => ({
      ...prev,
      details: [...prev.details, { productId: '', quantity: 1, note: '' }]
    }));
  };

  const removeDetailRow = (index) => {
    setFormData(prev => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index)
    }));
  };

  const updateDetail = (index, field, value) => {
    setFormData(prev => {
      const newDetails = [...prev.details];
      newDetails[index][field] = value;
      return { ...prev, details: newDetails };
    });
  };

  const handleSubmit = async () => {
    if (!formData.startDate || !formData.endDate) {
    toast.error('Vui lòng chọn ngày bắt đầu và kết thúc');
    return;
  }

  // Kiểm tra logic ngày tháng
  if (formData.startDate < today) {
    toast.error('Ngày bắt đầu không được nhỏ hơn ngày hôm nay');
    return;
  }

  if (formData.endDate < formData.startDate) {
    toast.error('Ngày kết thúc không được nhỏ hơn ngày bắt đầu');
    return;
  }
    if (formData.details.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 sản phẩm vào kế hoạch');
      return;
    }
    if (formData.details.some(d => !d.productId || d.quantity <= 0)) {
      toast.error('Vui lòng kiểm tra lại thông tin sản phẩm và số lượng');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        planDate: new Date().toISOString().split('T')[0],
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: 'DRAFT',
        note: formData.note,
        details: formData.details.map(d => ({
          productId: Number(d.productId),
          quantity: Number(d.quantity),
          note: d.note || ''
        }))
      };

      if (formData.planId) {
        await updateProductionPlan(formData.planId, payload);
        toast.success('Cập nhật kế hoạch sản xuất thành công!');
      } else {
        await createProductionPlan(payload);
        toast.success('Tạo kế hoạch sản xuất thành công!');
      }

      setIsOpen(false);
      setFormData({ planId: null, startDate: '', endDate: '', note: '', details: [] });
      loadData();
    } catch (error) {
      toast.error(error.message || 'Lỗi tạo kế hoạch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (plan) => {
    setFormData({
      planId: plan.planId,
      startDate: plan.startDate,
      endDate: plan.endDate,
      note: plan.note || '',
      details: plan.details.map(d => ({
        productId: String(d.productId),
        quantity: d.quantity,
        note: d.note || ''
      }))
    });
    setIsOpen(true);
  };

  const handleStatusUpdate = async (planId, newStatus) => {
    try {
      await updateProductionPlanStatus(planId, newStatus);
      toast.success(`Đã cập nhật trạng thái kế hoạch #${planId} thành ${newStatus}`);
      loadData();
    } catch (error) {
      toast.error('Lỗi cập nhật trạng thái: ' + error.message);
    }
  };

  const [expandedPlan, setExpandedPlan] = useState(null);

  if (loading) {
    return <div className="p-6 flex items-center justify-center min-h-[200px]"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kế hoạch sản xuất</h1>
          <p className="text-muted-foreground italic font-medium">Lập kế hoạch và theo dõi tiến độ bếp trung tâm</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700 shadow-md font-bold text-white"><Calendar className="mr-2 h-4 w-4" /> Tạo kế hoạch mới</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle className="text-xl font-bold text-orange-600">{formData.planId ? 'Cập nhật Kế hoạch' : 'Tạo Kế hoạch Sản xuất'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label className="font-bold">Ngày bắt đầu</Label>
    <Input 
      type="date" 
      min={today} // Không cho phép chọn trước ngày hôm nay
      value={formData.startDate} 
      onChange={e => setFormData({ ...formData, startDate: e.target.value })} 
      className="focus:ring-orange-500" 
    />
  </div>
  <div className="space-y-2">
    <Label className="font-bold">Ngày kết thúc</Label>
    <Input 
      type="date" 
      min={formData.startDate || today} // Không cho phép chọn trước ngày bắt đầu
      value={formData.endDate} 
      onChange={e => setFormData({ ...formData, endDate: e.target.value })} 
      className="focus:ring-orange-500" 
    />
  </div>
</div>
              <div className="space-y-2">
                <Label className="font-bold">Ghi chú</Label>
                <Input placeholder="Ghi chú tổng quát cho kế hoạch này..." value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
              </div>

              <div className="mt-4 space-y-4">
                <h4 className="font-bold text-gray-800 flex items-center justify-between border-b pb-2 uppercase text-xs tracking-wider">
                  Danh sách Sản phẩm Cần làm
                  <Button variant="outline" size="sm" onClick={addDetailRow} className="text-xs border-orange-200 text-orange-600 hover:bg-orange-50"><Plus className="h-3 w-3 mr-1" /> Thêm món</Button>
                </h4>

                {formData.details.length === 0 && <p className="text-sm text-center text-muted-foreground py-4 border border-dashed rounded italic">Chưa có sản phẩm nào được chọn.</p>}

                {formData.details.map((detail, index) => (
                  <div key={index} className="flex gap-2 items-center bg-muted/20 p-2.5 rounded-lg border">
                    <Select value={detail.productId} onValueChange={v => updateDetail(index, 'productId', v)}>
                      <SelectTrigger className="w-[200px] border-orange-100 font-medium"><SelectValue placeholder="Chọn thành phẩm..." /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.product_id} value={String(p.product_id)}>{p.product_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="1" placeholder="SL" className="w-24 font-bold" value={detail.quantity} onChange={e => updateDetail(index, 'quantity', e.target.value)} />
                    <Input placeholder="Ghi chú món..." className="flex-1" value={detail.note} onChange={e => updateDetail(index, 'note', e.target.value)} />
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-red-50" onClick={() => removeDetailRow(index)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Hủy</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (formData.planId ? 'Lưu thay đổi' : 'Xác nhận tạo kế hoạch')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>

      <Card className="shadow-sm border-none bg-gray-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-gray-700 flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-orange-500" />
            Lịch sử kế hoạch sản xuất
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground font-medium">Chưa có kế hoạch sản xuất nào.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan, i) => (
                <div key={i} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:border-orange-200 transition-all">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-orange-50/5"
                    onClick={() => setExpandedPlan(expandedPlan === plan.planId ? null : plan.planId)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${plan.status === 'DONE' ? 'bg-green-50' : 'bg-orange-50'}`}>
                        <ListChecks className={`h-6 w-6 ${plan.status === 'DONE' ? 'text-green-600' : 'text-orange-600'}`} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">Kế hoạch #{plan.planId}</h4>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5 font-medium italic">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Ngày: {new Date(plan.planDate).toLocaleDateString('vi-VN')}</span>
                          <span>Chu kỳ: {plan.startDate} &raquo; {plan.endDate}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <Badge className={`${
                          plan.status === 'DONE' ? 'bg-green-100 text-green-800 border-green-200' :
                          plan.status === 'COMPLETE_ONE_SECTION' ? 'bg-teal-100 text-teal-800 border-teal-200' :
                          plan.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          plan.status === 'WAITING' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          plan.status === 'DRAFT' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                          plan.status === 'CANCEL' || plan.status === 'CANCELLED' ? 'bg-red-100 text-red-800 border-red-200' :
                            'bg-orange-100 text-orange-800 border-orange-200'
                          } border tracking-tighter text-[10px] font-black px-3`}>
                          {PRODUCTION_PLAN_STATUS[plan.status]?.label || plan.status}
                        </Badge>
                        <p className="text-[10px] font-bold mt-1.5 uppercase text-muted-foreground tracking-widest">{plan.details?.length || 0} Sản phẩm</p>
                      </div>
                      <Plus className={`h-5 w-5 text-muted-foreground transition-transform ${expandedPlan === plan.planId ? 'rotate-45' : ''}`} />
                    </div>
                  </div>

                  {expandedPlan === plan.planId && (
                    <div className="px-4 pb-4 bg-gray-50/30 border-t animate-in slide-in-from-top-2 duration-200">
                      <div className="pt-4 space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-l-4 border-orange-500 pl-2">Chi tiết sản phẩm</p>
                        <div className="grid gap-2">
                          {plan.details?.map((detail, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-700 text-sm">{detail.productName}</span>
                                <span className="text-[11px] text-muted-foreground font-medium italic">{detail.note || 'Không có ghi chú thêm'}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs font-medium text-gray-500">Mục tiêu:</span>
                                <span className="font-black text-orange-600 text-base">{detail.quantity}</span>
                                <span className="text-xs font-bold text-gray-400 uppercase">{detail.unit || 'SP'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {plan.note && (
                          <div className="mt-3 p-3 bg-white rounded-lg border border-dashed text-xs text-muted-foreground italic">
                            <strong>Ghi chú kế hoạch:</strong> {plan.note}
                          </div>
                        )}
                        
                        {plan.status === 'DRAFT' && (
                          <div className="mt-4 flex gap-2 justify-end pt-2 border-t">
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(plan); }}>
                              Sửa chi tiết
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleStatusUpdate(plan.planId, 'CANCEL'); }}>
                              Hủy kế hoạch
                            </Button>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white font-bold" onClick={(e) => { e.stopPropagation(); handleStatusUpdate(plan.planId, 'WAITING'); }}>
                              Duyệt kế hoạch
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

