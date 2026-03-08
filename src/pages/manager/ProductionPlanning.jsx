import React, { useState, useEffect } from 'react';
import { getProducts, getProductionPlans, createProductionPlan } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Calendar, Plus, Trash2, Loader2, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductionPlanning() {
  const [products, setProducts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
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
      setProducts((prodData || []).filter(p => p.product_type === 'FINISHED_PRODUCT'));
      setPlans(planData || []);
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
        status: 'OPEN',
        note: formData.note,
        details: formData.details.map(d => ({
          productId: Number(d.productId),
          quantity: Number(d.quantity),
          note: d.note || ''
        }))
      };

      await createProductionPlan(payload);
      
      toast.success('Tạo kế hoạch sản xuất thành công!');
      setIsOpen(false);
      setFormData({ startDate: '', endDate: '', note: '', details: [] });
      loadData();
    } catch (error) {
      toast.error(error.message || 'Lỗi tạo kế hoạch');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center min-h-[200px]"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kế hoạch sản xuất</h1>
          <p className="text-muted-foreground">Lập kế hoạch cho bếp trung tâm (Flow 2)</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Calendar className="mr-2 h-4 w-4" /> Tạo kế hoạch mới</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Tạo Kế hoạch Sản xuất</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ngày bắt đầu</Label>
                  <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Ngày kết thúc</Label>
                  <Input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Input placeholder="Ghi chú tổng quát..." value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
              </div>

              <div className="mt-4 space-y-4">
                <h4 className="font-semibold flex items-center justify-between border-b pb-2">
                  Danh sách Sản phẩm Cần làm
                  <Button variant="outline" size="sm" onClick={addDetailRow}><Plus className="h-4 w-4 mr-1" /> Thêm món</Button>
                </h4>
                
                {formData.details.length === 0 && <p className="text-sm text-center text-muted-foreground">Chưa có sản phẩm nào được chọn.</p>}
                
                {formData.details.map((detail, index) => (
                  <div key={index} className="flex gap-2 items-center bg-muted/30 p-2 rounded">
                    <Select value={detail.productId} onValueChange={v => updateDetail(index, 'productId', v)}>
                      <SelectTrigger className="w-[200px]"><SelectValue placeholder="Chọn thành phẩm..." /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.product_id} value={String(p.product_id)}>{p.product_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="1" placeholder="SL" className="w-24" value={detail.quantity} onChange={e => updateDetail(index, 'quantity', e.target.value)} />
                    <Input placeholder="Ghi chú thêm..." className="flex-1" value={detail.note} onChange={e => updateDetail(index, 'note', e.target.value)} />
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeDetailRow(index)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Hủy</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Xác nhận tạo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Danh sách kế hoạch</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Chưa có kế hoạch nào.</p>
          ) : (
            <div className="space-y-4">
              {plans.map((plan, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <ListChecks className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">Kế hoạch #{plan.planId}</h4>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span>Lập ngày: {new Date(plan.planDate).toLocaleDateString()}</span>
                        <span>(Từ {plan.startDate} đến {plan.endDate})</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      plan.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      plan.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                      plan.status === 'IN_PROGRESS' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {plan.status || 'OPEN'}
                    </span>
                    <p className="text-sm font-medium mt-2">{plan.details?.length || 0} mục tiêu</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
