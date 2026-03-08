import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProductionPlans } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  ChefHat,
  Factory,
  ShoppingCart,
  BookOpen,
  ArrowRight,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export default function KitchenDashboard() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProductionPlans()
      .then(data => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const activePlans = plans.filter(p => p.status === 'ACTIVE' || p.status === 'IN_PROGRESS');
  const pendingPlans = plans.filter(p => p.status !== 'COMPLETED');

  const menuItems = [
    {
      title: 'Thực thi Sản xuất',
      description: 'Nhận kế hoạch từ Manager, tạo lô sản xuất theo công thức.',
      icon: <Factory className="h-8 w-8 text-orange-500" />,
      path: '/kitchen/production',
      color: 'bg-orange-50 hover:bg-orange-100',
      count: pendingPlans.length,
      countLabel: 'kế hoạch chờ',
    },
    {
      title: 'Công thức (Recipes)',
      description: 'Tra cứu công thức nấu ăn và danh sách nguyên liệu cần dùng.',
      icon: <BookOpen className="h-8 w-8 text-blue-500" />,
      path: '/kitchen/recipes',
      color: 'bg-blue-50 hover:bg-blue-100',
    },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ChefHat className="h-7 w-7 text-orange-500" /> Bếp Trung Tâm
        </h1>
        <p className="text-muted-foreground">Quản lý các hoạt động tại Bếp</p>
      </div>

      {/* Menu nhanh */}
      <div className="grid gap-4 md:grid-cols-3">
        {menuItems.map((item, idx) => (
          <Card
            key={idx}
            className={`cursor-pointer transition-all ${item.color} border`}
            onClick={() => navigate(item.path)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  {item.icon}
                </div>
                {item.count != null && item.count > 0 && (
                  <Badge className="bg-orange-500 text-white">{item.count} {item.countLabel}</Badge>
                )}
              </div>
              <CardTitle className="text-base mt-2">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kế hoạch sản xuất gần đây */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Kế hoạch Sản xuất</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/kitchen/production')}>
            Xem tất cả <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mb-3 opacity-30" />
              <p>Chưa có kế hoạch sản xuất nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.slice(0, 4).map(plan => (
                <div
                  key={plan.planId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                  onClick={() => navigate('/kitchen/production')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                      <Factory className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">Kế hoạch #{plan.planId}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {plan.startDate ? new Date(plan.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                        {' → '}
                        {plan.endDate ? new Date(plan.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {(plan.details || []).length} SP
                    </Badge>
                    <Badge className={
                      plan.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      plan.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }>
                      {plan.status || 'N/A'}
                    </Badge>
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
