import React, { useState } from 'react';
import { Card, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Plus, Minus, ShoppingCart, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ProductCard({ product, availableStock, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);
  const isOutOfStock = availableStock <= 0;
  const isLowStock = availableStock > 0 && availableStock <= 10;

  const handleQuantityChange = (delta) => {
    const newQuantity = Math.max(1, Math.min(quantity + delta, availableStock));
    setQuantity(newQuantity);
  };

  const handleAdd = () => {
    if (quantity > 0 && quantity <= availableStock) {
      onAddToCart(product, quantity);
      setQuantity(1);
    }
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-200',
      isOutOfStock ? 'opacity-60' : 'card-hover'
    )}>
      <CardContent className="p-0">
        <div className="relative aspect-square bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
          <span className="text-6xl">{product.image || '🍞'}</span>
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Badge variant="destructive" className="text-sm">
                Hết hàng
              </Badge>
            </div>
          )}
          {isLowStock && !isOutOfStock && (
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className="status-warning text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Còn {availableStock}
              </Badge>
            </div>
          )}
        </div>
        <div className="p-4 space-y-2">
          <h3 className="font-semibold line-clamp-1">{product.product_name}</h3>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">
              {product.price?.toLocaleString('vi-VN')}đ
            </span>
            <span className="text-sm text-muted-foreground">
              / {product.unit}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Tồn kho: <span className="font-medium">{availableStock}</span> {product.unit}
          </p>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex gap-2">
        <div className="flex items-center gap-1 flex-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => handleQuantityChange(-1)}
            disabled={isOutOfStock || quantity <= 1}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={1}
            max={availableStock}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, availableStock)))}
            className="h-9 text-center"
            disabled={isOutOfStock}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => handleQuantityChange(1)}
            disabled={isOutOfStock || quantity >= availableStock}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={handleAdd}
          disabled={isOutOfStock}
          className="h-9"
        >
          <ShoppingCart className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
