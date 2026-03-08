import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { CalendarDays, Loader2, Plus } from 'lucide-react';
import { getProductionPlans, createProductionPlan } from '../../data/api';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

export default function Plans() {
  const [plans, setPlans] = useState([]);
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
      // Reload plans
      const data = await getProductionPlans();
      setPlans(data?.details ? [data] : Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Lỗi tạo kế hoạch: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const data = await getProductionPlans();
        const rawPlans = data?.details ? [data] : Array.isArray(data) ? data : [];
        setPlans([...rawPlans].sort((a, b) => b.planId - a.planId));
      } catch (error) {
        setPlans([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Kế hoạch Sản xuất</h1>
      <div className="grid gap-6 md:grid-cols-2">
        {plans.length > 0 ? plans.map((plan) => (
          <Card key={plan.planId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" /> Kế hoạch ngày {plan.planDate ? new Date(plan.planDate).toLocaleDateString() : 'N/A'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {plan.details?.map((detail) => (
                  <div key={detail.planDetailId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{detail.productName}</p>
                      <p className="text-sm text-muted-foreground">Số lượng: {detail.quantity}</p>
                      <p className="text-sm text-muted-foreground">Ghi chú: {detail.note}</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      Đang thực hiện
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )) : (
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