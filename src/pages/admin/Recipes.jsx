import React, { useState, useEffect } from 'react';
import { getProducts, getRecipes } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Loader2, ChefHat, BookOpen, PlusCircle, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

export default function Recipes() {
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsData, recipesData] = await Promise.all([
          getProducts(),
          getRecipes()
        ]);
        
        // Filter out RAW_MATERIAL since they don't need recipes
        const finishedProducts = (productsData || []).filter(p => p.productType !== 'RAW_MATERIAL' && p.product_type !== 'RAW_MATERIAL');
        setProducts(finishedProducts);
        setRecipes(recipesData || []);
      } catch (error) {
        console.error(error);
        toast.error('Lỗi khi tải dữ liệu: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) return <div className="flex flex-col items-center justify-center p-16 gap-4"><Loader2 className="animate-spin h-8 w-8 text-primary" /><p className="text-muted-foreground">Đang tải dữ liệu...</p></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý Công thức</h1>
        <p className="text-muted-foreground">Sản phẩm tạo ở Quản lý sản phẩm sẽ xuất hiện tại đây. Thêm công thức cho sản phẩm chưa có.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          // Check if this product has a recipe
          // Note: Based on Swagger, recipe has productId or product object.
          const recipe = recipes.find(r => r.productId === product.productId || r.product?.productId === product.productId || r.product_name === product.productName);

          return (
            <Card key={product.productId} className={`transition-all border-l-4 ${recipe ? 'border-l-green-500' : 'border-l-orange-500 hover:shadow-md'}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className={`p-2 rounded-lg ${recipe ? 'bg-green-100' : 'bg-orange-100'}`}>
                      <ChefHat className={`h-6 w-6 ${recipe ? 'text-green-600' : 'text-orange-600'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{product.productName}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        Loại: <Badge variant="outline">{product.productType || product.product_type}</Badge>
                      </CardDescription>
                    </div>
                  </div>
                  {recipe ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Đã có công thức</Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-600 border-orange-200">Chưa có công thức</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {recipe ? (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-medium text-slate-700">{recipe.recipeName}</span>
                      <span className="text-xs text-muted-foreground">Sản lượng: {recipe.yieldQuantity}</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{recipe.description}</p>
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 mb-2">
                        <BookOpen className="h-3 w-3" /> Nguyên liệu:
                      </h4>
                      <ul className="text-xs space-y-1.5 list-none">
                        {recipe.recipeDetails?.map((detail) => (
                          <li key={detail.recipeDetailId} className="flex justify-between">
                            <span className="text-slate-600">• {detail.rawMaterialName}</span>
                            <span className="font-medium">{detail.quantity} {detail.unit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 gap-3 bg-orange-50/50 rounded-lg border border-dashed border-orange-200">
                    <AlertCircle className="h-8 w-8 text-orange-400 opacity-50" />
                    <p className="text-sm text-center text-orange-800 px-4">Sản phẩm này chưa thể đưa vào sản xuất vì thiếu công thức.</p>
                    <Button onClick={() => toast.info('Chức năng Thêm Công thức (POST /recipes) đang được hoàn thiện.')} className="bg-orange-500 hover:bg-orange-600 w-full max-w-[200px] mt-2 shadow-sm">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Thêm công thức
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {products.length === 0 && (
        <div className="text-center py-16 bg-slate-50 rounded-xl border-dashed border-2">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Chưa có sản phẩm nào</h3>
          <p className="text-muted-foreground">Hãy vào Quản lý sản phẩm để tạo sản phẩm mới (chọn loại ngoài Nguyên vật liệu).</p>
        </div>
      )}
    </div>
  );
}