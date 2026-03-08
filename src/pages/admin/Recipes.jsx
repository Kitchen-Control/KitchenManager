import React, { useState, useEffect } from 'react';
import { getRecipes } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Loader2, ChefHat, BookOpen } from 'lucide-react';

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const data = await getRecipes();
        setRecipes(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecipes();
  }, []);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý Công thức</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => (
          <Card key={recipe.id} className="hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <ChefHat className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{recipe.recipeName}</CardTitle>
                <p className="text-sm text-muted-foreground">Sản lượng: {recipe.yieldQuantity}</p>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{recipe.description}</p>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Nguyên liệu:
                </h4>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  {recipe.recipeDetails?.map((detail) => (
                    <li key={detail.recipeDetailId}>
                      {detail.rawMaterialName}: {detail.quantity} {detail.unit}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}