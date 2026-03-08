import React from 'react';
import { Card, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, Package, ChefHat, CalendarDays, BarChart3, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: 'Quản lý Người dùng',
      description: 'Thêm, sửa, xóa tài khoản nhân viên.',
      icon: <Users className="h-8 w-8 text-blue-500" />,
      path: '/admin/users',
      color: 'bg-blue-50'
    },
    {
      title: 'Quản lý Sản phẩm',
      description: 'Danh sách sản phẩm và nguyên liệu.',
      icon: <Package className="h-8 w-8 text-green-500" />,
      path: '/admin/products',
      color: 'bg-green-50'
    },
    {
      title: 'Quản lý Công thức',
      description: 'Thiết lập định lượng cho món ăn.',
      icon: <ChefHat className="h-8 w-8 text-orange-500" />,
      path: '/admin/recipes',
      color: 'bg-orange-50'
    },
    {
      title: 'Kế hoạch Sản xuất',
      description: 'Lên lịch sản xuất cho bếp.',
      icon: <CalendarDays className="h-8 w-8 text-purple-500" />,
      path: '/admin/plans',
      color: 'bg-purple-50'
    },
    {
      title: 'Báo cáo Thống kê',
      description: 'Xem doanh thu và hiệu quả hoạt động.',
      icon: <BarChart3 className="h-8 w-8 text-indigo-500" />,
      path: '/admin/reports',
      color: 'bg-indigo-50'
    },
    {
      title: 'Cài đặt Hệ thống',
      description: 'Cấu hình chung.',
      icon: <Settings className="h-8 w-8 text-gray-500" />,
      path: '/admin/settings',
      color: 'bg-gray-50'
    }
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight">Quản trị Hệ thống</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {menuItems.map((item, index) => (
          <Card key={index} className={`cursor-pointer hover:shadow-lg transition-all ${item.color}`} onClick={() => navigate(item.path)}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 bg-white rounded-full shadow-sm">{item.icon}</div>
              <div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}