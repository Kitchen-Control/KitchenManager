import React, { useState, useEffect } from 'react';
import { getProducts, getRecipes, createRecipe } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Loader2, ChefHat, BookOpen, PlusCircle, AlertCircle, Trash2, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';

export default function Recipes() {
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    recipeName: '',
    yieldQuantity: 1,
    description: '',
    recipeDetails: []
  });

  const fetchData = async () => {
    try {
      const [productsData, recipesData] = await Promise.all([
        getProducts(),
        getRecipes()
      ]);
      
      const finishedProducts = (productsData || []).filter(p => p.productType !== 'RAW_MATERIAL' && p.product_type !== 'RAW_MATERIAL');
      const rawMaterialsData = (productsData || []).filter(p => p.productType === 'RAW_MATERIAL' || p.product_type === 'RAW_MATERIAL');
      
      setProducts(finishedProducts);
      setRawMaterials(rawMaterialsData);
      setRecipes(recipesData || []);
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi tải dữ liệu: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateRecipe = (product) => {
    setSelectedProduct(product);
    setRecipeForm({
      recipeName: `${product.productName || product.product_name} Recipe`,
      yieldQuantity: 1,
      description: '',
      recipeDetails: [{ rawMaterialId: '', quantity: '' }]
    });
    setIsDialogOpen(true);
  };

  const handleAddIngredient = () => {
    setRecipeForm({
      ...recipeForm,
      recipeDetails: [...recipeForm.recipeDetails, { rawMaterialId: '', quantity: '' }]
    });
  };

  const handleRemoveIngredient = (index) => {
    const newDetails = [...recipeForm.recipeDetails];
    newDetails.splice(index, 1);
    setRecipeForm({ ...recipeForm, recipeDetails: newDetails });
  };

  const handleIngredientChange = (index, field, value) => {
    const newDetails = [...recipeForm.recipeDetails];
    newDetails[index][field] = value;
    setRecipeForm({ ...recipeForm, recipeDetails: newDetails });
  };

  const handleSubmitRecipe = async () => {
    if (!recipeForm.recipeName.trim() || !recipeForm.yieldQuantity || recipeForm.recipeDetails.length === 0) {
      toast.error('Vui lòng điền đầy đủ thông tin cơ bản');
      return;
    }

    const invalidDetails = recipeForm.recipeDetails.some(d => !d.rawMaterialId || !d.quantity || Number(d.quantity) <= 0);
    if (invalidDetails) {
      toast.error('Vui lòng chọn nguyên liệu và điền số lượng hợp lệ cho tất cả thành phần');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        productId: selectedProduct.productId || selectedProduct.product_id,
        recipeName: recipeForm.recipeName.trim(),
        yieldQuantity: Number(recipeForm.yieldQuantity),
        description: recipeForm.description.trim(),
        recipeDetails: recipeForm.recipeDetails.map(d => ({
          rawMaterialId: Number(d.rawMaterialId),
          quantity: Number(d.quantity)
        }))
      };

      await createRecipe(payload);
      toast.success('Thêm công thức thành công');
      setIsDialogOpen(false);
      fetchData(); // Refresh data
    } catch (error) {
      toast.error('Lỗi khi thêm công thức: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center p-16 gap-4"><Loader2 className="animate-spin h-8 w-8 text-primary" /><p className="text-muted-foreground">Đang tải dữ liệu...</p></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý Công thức</h1>
        <p className="text-muted-foreground">Sản phẩm tạo ở Quản lý sản phẩm sẽ xuất hiện tại đây. Thêm công thức cho sản phẩm chưa có.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const pId = product.productId || product.product_id;
          const pName = product.productName || product.product_name;
          const pType = product.productType || product.product_type || product.type;

          const recipe = recipes.find(r => r.productId === pId || r.product?.productId === pId || r.product_id === pId || r.product_name === pName || (r.product && r.product.product_id === pId));

          return (
            <Card key={pId} className={`transition-all border-l-4 ${recipe ? 'border-l-green-500' : 'border-l-orange-500 hover:shadow-md'}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className={`p-2 rounded-lg ${recipe ? 'bg-green-100' : 'bg-orange-100'}`}>
                      <ChefHat className={`h-6 w-6 ${recipe ? 'text-green-600' : 'text-orange-600'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{pName}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        Loại: <Badge variant="outline">{pType}</Badge>
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
                            <span className="font-medium">{detail.quantity} {detail.unit || ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 gap-3 bg-orange-50/50 rounded-lg border border-dashed border-orange-200">
                    <AlertCircle className="h-8 w-8 text-orange-400 opacity-50" />
                    <p className="text-sm text-center text-orange-800 px-4">Sản phẩm này chưa thể đưa vào sản xuất vì thiếu công thức.</p>
                    <Button onClick={() => handleOpenCreateRecipe(product)} className="bg-orange-500 hover:bg-orange-600 w-full max-w-[200px] mt-2 shadow-sm">
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

      {/* Dialog Thêm Công thức */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mới Tạo công thức cho {selectedProduct?.productName || selectedProduct?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tên công thức</label>
                <Input placeholder="Ví dụ: Công thức chuẩn" value={recipeForm.recipeName} onChange={e => setRecipeForm({...recipeForm, recipeName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sản lượng dự kiến</label>
                <Input type="number" min="0.1" step="0.1" placeholder="Sản lượng tạo ra" value={recipeForm.yieldQuantity} onChange={e => setRecipeForm({...recipeForm, yieldQuantity: e.target.value})} />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Mô tả các bước thực hiện</label>
              <Input placeholder="Mô tả các bước..." value={recipeForm.description} onChange={e => setRecipeForm({...recipeForm, description: e.target.value})} />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Thành phần nguyên liệu</label>
                <Button variant="outline" size="sm" onClick={handleAddIngredient}>
                  <Plus className="h-4 w-4 mr-1" /> Thêm nguyên liệu
                </Button>
              </div>
              
              {recipeForm.recipeDetails.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4 border rounded bg-slate-50">Chưa có nguyên liệu nào.</div>
              ) : (
                <div className="space-y-3 border rounded p-4 bg-slate-50">
                  {recipeForm.recipeDetails.map((detail, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Select value={detail.rawMaterialId.toString()} onValueChange={v => handleIngredientChange(index, 'rawMaterialId', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn nguyên liệu" />
                          </SelectTrigger>
                          <SelectContent>
                            {rawMaterials.map(rm => (
                              <SelectItem key={rm.product_id} value={(rm.product_id || rm.productId).toString()}>
                                {rm.product_name || rm.productName} ({rm.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[120px]">
                        <Input type="number" min="0.01" step="0.01" placeholder="Số lượng" value={detail.quantity} onChange={e => handleIngredientChange(index, 'quantity', e.target.value)} />
                      </div>
                      <Button variant="ghost" size="icon" className="text-red-500 shrink-0" onClick={() => handleRemoveIngredient(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSubmitRecipe} className="w-full mt-4" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              {isSubmitting ? 'Đang lưu...' : 'Lưu công thức'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}