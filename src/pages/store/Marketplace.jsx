import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts } from '../../data/api';
import { useCart } from '../../contexts/CartContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Loader2, ShoppingCart, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const { addToCart, items } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const allProductsData = await getProducts();
        const productsData = (allProductsData || []).filter(p => p.product_type === 'FINISHED_PRODUCT');
        setProducts(productsData || []);
      } catch (error) {
        toast.error('Lỗi tải dữ liệu: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleQuantityChange = (productId, delta) => {
    setQuantities(prev => {
      const current = prev[productId] || 1;
      const newValue = Math.max(1, current + delta);
      return { ...prev, [productId]: newValue };
    });
  };

  const handleAddToCart = (product) => {
    const quantity = quantities[product.product_id] || 1;
    const available = product.available_stock || 0;

    if (quantity > available) {
      toast.error(`Chỉ còn ${available} ${product.unit} khả dụng.`);
      return;
    }

    addToCart(product, quantity);
    toast.success(`Đã thêm ${quantity} ${product.product_name} vào giỏ`);
    setQuantities(prev => ({ ...prev, [product.product_id]: 1 })); // Reset quantity
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Đặt hàng</h1>
          <p className="text-muted-foreground mt-1">Chọn sản phẩm cần nhập cho cửa hàng</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {products.length} sản phẩm
          </Badge>
          <Button 
            onClick={() => navigate('/store/cart')}
            className="relative"
            variant={items.length > 0 ? 'default' : 'outline'}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Giỏ hàng
            {items.length > 0 && (
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
                {items.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map(product => {
          const available = product.available_stock || 0;
          const quantity = quantities[product.product_id] || 1;

          return (
            <Card key={product.product_id} className="flex flex-col h-full hover:shadow-md transition-shadow">
              <CardHeader className="p-0">
                <div className="aspect-video w-full bg-muted flex items-center justify-center text-4xl rounded-t-lg">
                  {product.image || '📦'}
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg line-clamp-2">{product.product_name}</CardTitle>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Đơn vị: {product.unit}</span>
                  <span className={`font-medium ${available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Sẵn có: {available}
                  </span>
                </div>
                <div className="font-semibold text-primary">
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price || 0)}
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 gap-2">
                <div className="flex items-center border rounded-md">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => handleQuantityChange(product.product_id, -1)} disabled={quantity <= 1}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input 
                    type="number" 
                    className="h-8 w-12 border-0 text-center focus-visible:ring-0 p-0" 
                    value={quantity} 
                    onChange={(e) => setQuantities({...quantities, [product.product_id]: Number(e.target.value)})}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => handleQuantityChange(product.product_id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button className="flex-1" onClick={() => handleAddToCart(product)}>
                  <ShoppingCart className="mr-2 h-4 w-4" /> Thêm
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      
      {products.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Không tìm thấy sản phẩm nào (FINISHED_PRODUCT). Vui lòng kiểm tra lại dữ liệu đầu vào.
        </div>
      )}
    </div>
  );
}