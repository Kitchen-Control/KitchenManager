import React, { useState, useEffect } from 'react';
import { getProductsByType, getProducts, createBatch } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, ShoppingCart, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function KitchenProcurement() {
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    productionDate: today,
    expiryDate: '',
  });

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        // Lấy nguyên liệu thô để mua
        const data = await getProductsByType('RAW_MATERIAL');
        setMaterials(data || []);
      } catch (error) {
        toast.error('Lỗi tải danh sách nguyên liệu: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMaterials();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productId || !formData.quantity || !formData.expiryDate) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    if (Number(formData.quantity) <= 0) {
      toast.error('Số lượng phải lớn hơn 0');
      return;
    }

    // Cảnh báo HSD sắp hết
    const expiry = new Date(formData.expiryDate);
    const now = new Date();
    const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);
    if (diffDays < 3) {
      if (!confirm('Cảnh báo: Nguyên liệu này sắp hết hạn (dưới 3 ngày). Bạn có chắc chắn muốn nhập?')) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // POST /log-batches: purchase batch, planId null, status DONE
      const productId = Number(formData.productId);
      const payload = {
        productId: productId,
        product_id: productId,
        quantity: Number(formData.quantity),
        productionDate: formData.productionDate,
        expiryDate: formData.expiryDate,
        type: 'PURCHASE',
        status: 'DONE',
        planId: null,
        plan_id: null
      };

      await createBatch(payload);

      toast.success('Nhập kho thành công! Tồn kho đã được cập nhật.');
      setFormData({
        productId: '',
        quantity: '',
        productionDate: today,
        expiryDate: '',
      });
    } catch (error) {
      toast.error('Lỗi nhập kho: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-96">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ShoppingCart className="h-6 w-6 text-green-600" /> Nhập mua Nguyên liệu
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ghi nhận lô nguyên liệu mua từ nhà cung cấp. Tồn kho sẽ được cập nhật tự động.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Chọn nguyên liệu */}
            <div className="space-y-2">
              <Label htmlFor="productId">Nguyên liệu <span className="text-red-500">*</span></Label>
              <Select
                onValueChange={(val) => setFormData({ ...formData, productId: val })}
                value={formData.productId}
              >
                <SelectTrigger id="productId">
                  <SelectValue placeholder="-- Chọn nguyên liệu --" />
                </SelectTrigger>
                <SelectContent>
                  {materials.length === 0 ? (
                    <SelectItem value="_empty" disabled>Không có nguyên liệu</SelectItem>
                  ) : (
                    materials.map(m => (
                      <SelectItem key={m.product_id} value={String(m.product_id)}>
                        {m.product_name} ({m.unit})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Số lượng */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Số lượng nhập <span className="text-red-500">*</span></Label>
              <Input
                id="quantity"
                type="number"
                min="0.1"
                step="0.1"
                placeholder="0.0"
                value={formData.quantity}
                onChange={e => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>

            {/* Ngày mua & HSD */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productionDate">Ngày mua / Nhập kho</Label>
                <Input
                  id="productionDate"
                  type="date"
                  value={formData.productionDate}
                  onChange={e => setFormData({ ...formData, productionDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Hạn sử dụng (HSD) <span className="text-red-500">*</span></Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  min={formData.productionDate || today}
                  onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
            </div>

            {/* Info banner */}
            <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-md flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Lô hàng mua sẽ được tạo với trạng thái <strong>DONE</strong> và hệ thống tự động
                tạo giao dịch IMPORT, cộng số lượng vào kho.
              </span>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</>
                : <><ShoppingCart className="mr-2 h-4 w-4" /> Xác nhận Nhập kho</>
              }
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}