import React, { useState, useEffect } from 'react';
import { getProductsByType, createPurLogBatch, getLogBatchesByStatus, updateLogBatchStatus, getAllLogBatches } from '../../data/api';
import { BATCH_STATUS } from '../../data/constants';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Loader2, ShoppingCart, CheckCircle2, Package, RefreshCw, AlertCircle, History, Warehouse, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function WarehouseProcurement() {
  const [activeTab, setActiveTab] = useState('purchase');
  const [materials, setMaterials] = useState([]);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    productionDate: today,
    expiryDate: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [matData, allBatches] = await Promise.all([
        getProductsByType('RAW_MATERIAL'),
        getAllLogBatches()
      ]);
      setMaterials(matData || []);
      setBatches(Array.isArray(allBatches) ? allBatches : []);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // API trả về mọi lô hàng, Warehouse Procurement chỉ xem lịch sử lô hàng mua ngoài do Flow quy định (chỉ cho warehouse xem PURCHASE)
  const confirmedBatches = batches.filter(b => b.status === 'DONE' && b.type === 'PURCHASE').sort((a,b) => b.batch_id - a.batch_id);

  // Validation logic
  const isQuantityInvalid = formData.quantity !== '' && Number(formData.quantity) <= 0;

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productId || !formData.quantity || !formData.expiryDate) {
      toast.error('Vui lòng điền đủ thông tin');
      return;
    }
    if (isQuantityInvalid) {
      toast.error('Số lượng nhập phải lớn hơn 0');
      return;
    }
    setIsSubmitting(true);
    try {
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
      await createPurLogBatch(payload);
      toast.success('Nhập mua thành công!');
      setFormData({ productId: '', quantity: '', productionDate: today, expiryDate: '' });
      fetchData();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Warehouse className="h-8 w-8 text-green-600" /> Quản lý Nhập Mua Nguyên Liệu
          </h1>
          <p className="text-muted-foreground">Nhập mua nguyên liệu và lịch sử nhập mua</p>
        </div>
        <Button variant="outline" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Làm mới</Button>
      </div>

      <Tabs defaultValue="purchase" onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="purchase">Nhập mua ngoài</TabsTrigger>
          <TabsTrigger value="history">Lịch sử nhập</TabsTrigger>
        </TabsList>



        <TabsContent value="purchase">
          <Card className="max-w-xl mx-auto">
            <CardHeader><CardTitle>Nhập mua Nguyên liệu</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nguyên liệu</Label>
                  <Select onValueChange={(val) => setFormData({ ...formData, productId: val })} value={formData.productId}>
                    <SelectTrigger><SelectValue placeholder="Chọn nguyên liệu..." /></SelectTrigger>
                    <SelectContent>
                      {materials.map(m => <SelectItem key={m.product_id} value={String(m.product_id)}>{m.product_name} ({m.unit})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Số lượng</Label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    value={formData.quantity} 
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    className={isQuantityInvalid ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {isQuantityInvalid && (
                    <p className="text-sm text-red-500">Số lượng không được nhỏ hơn hoặc bằng 0</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ngày nhập</Label>
                    <Input type="date" value={formData.productionDate} onChange={e => setFormData({ ...formData, productionDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hạn sử dụng</Label>
                    <Input type="date" value={formData.expiryDate} min={formData.productionDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4 mr-2" />}
                  Xác nhận Nhập kho
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="grid gap-3">
            {confirmedBatches.slice(0, 20).map(batch => (
              <div key={batch.batch_id} className="p-3 border rounded-lg flex justify-between items-center bg-white">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${batch.type === 'PRODUCTION' ? 'bg-orange-50' : 'bg-green-50'}`}>
                    {batch.type === 'PRODUCTION' ? <Package className="h-4 w-4 text-orange-600" /> : <ShoppingCart className="h-4 w-4 text-green-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">#{batch.batch_id} - {batch.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      SL: {batch.quantity} | Nhập lúc: {new Date(batch.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">ĐÃ NHẬP</Badge>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}