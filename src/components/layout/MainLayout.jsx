import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '../ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '../ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';
import { useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Bell } from 'lucide-react';
import { fetchOrders } from '../../data/api';

const breadcrumbMap = {
  '/store': 'Đặt hàng',
  '/store/orders': 'Lịch sử đơn hàng',
  '/store/feedback': 'Đánh giá chất lượng',
  '/store/cart': 'Giỏ hàng',
  '/manager': 'Tổng quan',
  '/manager/planning': 'Kế hoạch sản xuất',
  '/coordinator': 'Bảng điều khiển',
  '/coordinator/orders': 'Gom đơn hàng',
  '/coordinator/deliveries': 'Quản lý chuyến xe',
  '/kitchen': 'Bảng điều khiển',
  '/kitchen/production': 'Sản xuất',
  '/kitchen/inventory': 'Tồn kho',
  '/kitchen/outbound': 'Xuất kho',
  '/kitchen/procurement': 'Nhập kho',
  '/kitchen/waste': 'Hủy hàng',
  '/kitchen/stock-card': 'Thẻ kho',
  '/kitchen/recipes': 'Xem công thức',
  '/shipper': 'Chuyến hàng của tôi',
  '/shipper/map': 'Bản đồ giao hàng',
  '/admin': 'Bảng điều khiển',
  '/admin/recipes': 'Quản lý công thức',
  '/admin/plans': 'Kế hoạch sản xuất',
  '/admin/products': 'Quản lý sản phẩm',
  '/admin/users': 'Quản lý người dùng',
  '/admin/reports': 'Báo cáo',
  '/admin/settings': 'Cài đặt',
};

const roleHome = {
  1: { name: 'Quản trị', path: '/admin' },
  2: { name: 'Quản lý', path: '/manager' },
  3: { name: 'Cửa hàng', path: '/store' },
  4: { name: 'Bếp', path: '/kitchen' },
  5: { name: 'Điều phối', path: '/coordinator' },
  6: { name: 'Giao hàng', path: '/shipper' },
};

export function MainLayout() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = React.useState(false);

  React.useEffect(() => {
    // Sync orders from backend when layout mounts
    fetchOrders();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse-soft">Đang tải...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const homePath = roleHome[user.role_id]?.path || '/';
  const currentPage = breadcrumbMap[location.pathname] || 'Trang chủ';
  const isHomePage = location.pathname === homePath;

  // Thông báo: backend chưa có API notifications, dùng mảng rỗng
  const userNotifications = [];
  const unreadCount = 0;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={homePath}>
                    {roleHome[user.role_id]?.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {!isHomePage && (
                  <>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{currentPage}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
            
            {/* Notification Center */}
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </Button>
                
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 z-50 bg-white">
                    <div className="p-4 border-b">
                      <h4 className="font-semibold leading-none">Thông báo</h4>
                      <p className="text-sm text-muted-foreground mt-1">Bạn có {unreadCount} thông báo chưa đọc</p>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {userNotifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Không có thông báo nào</div>
                      ) : (
                        userNotifications.map(notification => (
                          <div key={notification.id} className={`p-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer ${!notification.read ? 'bg-muted/20' : ''}`}>
                            <div className="flex items-start gap-3">
                              <div className={`h-2 w-2 mt-2 rounded-full ${!notification.read ? 'bg-primary' : 'bg-transparent'}`} />
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium leading-none">{notification.title}</p>
                                <p className="text-xs text-muted-foreground">{notification.time}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
