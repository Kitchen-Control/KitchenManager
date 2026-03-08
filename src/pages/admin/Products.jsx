import React, { useState, useEffect } from 'react';
import { getProducts, createProduct } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Plus, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [formData, setFormData] = useState({
    productName: '',
    productType: '',
    unit: '',
    shelfLifeDay: '',
    price: ''
  });

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const data = await getProducts();
      setProducts((data || []).sort((a, b) => b.product_id - a.product_id));
    } catch (error) {
      toast.error('Lỗi tải sản phẩm: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreate = async () => {
    if (!formData.productName || !formData.productType || !formData.unit || !formData.shelfLifeDay || !formData.price) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setIsSubmitting(true);
    try {
      await createProduct({
        productName: formData.productName,
        productType: formData.productType,
        unit: formData.unit,
        shelfLifeDay: Number(formData.shelfLifeDay),
        price: Number(formData.price)
      });
      toast.success('Thêm sản phẩm thành công');
      setIsOpen(false);
      setFormData({ productName: '', productType: '', unit: '', shelfLifeDay: '', price: '' });
      fetchProducts();
    } catch (error) {
      toast.error('Lỗi thêm sản phẩm: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý Sản phẩm</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Thêm Sản phẩm</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Thêm sản phẩm mới</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Tên sản phẩm" value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} />
              
              <Select onValueChange={v => setFormData({...formData, productType: v})} value={formData.productType}>
                <SelectTrigger><SelectValue placeholder="Loại sản phẩm" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RAW_MATERIAL">Nguyên liệu thô</SelectItem>
                  <SelectItem value="SEMI_FINISHED">Bán thành phẩm</SelectItem>
                  <SelectItem value="FINISHED_PRODUCT">Thành phẩm</SelectItem>
                </SelectContent>
              </Select>

              <Input placeholder="Đơn vị tính (kg, cái...)" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
              <Input type="number" placeholder="Hạn sử dụng (ngày)" value={formData.shelfLifeDay} onChange={e => setFormData({...formData, shelfLifeDay: e.target.value})} />
              <Input type="number" placeholder="Giá bán (VNĐ)" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />

              <Button onClick={handleCreate} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Xác nhận'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <Card key={product.product_id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{product.product_name}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{product.unit}</div>
              <p className="text-xs text-muted-foreground">{product.product_type}</p>
              <p className="text-xs text-muted-foreground mt-1">HSD: {product.shelf_life_days} ngày</p>
              <p className="text-xs font-semibold mt-1">Giá: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price || 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}