import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '../ui/sidebar';
import { Button } from '../ui/button';
import {
  ShoppingCart,
  Package,
  History,
  MessageSquare,
  Truck,
  ClipboardList,
  Users,
  Factory,
  Warehouse,
  FileWarning,
  LayoutDashboard,
  BookOpen,
  Calendar,
  BarChart3,
  LogOut,
  ChefHat,
  MapPin,
  Settings,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Timer,
  ArrowDownToLine,
} from 'lucide-react';

const menuByRole = {
  // Admin (Role 1)
  1: [
    { title: 'Bảng điều khiển', url: '/admin', icon: LayoutDashboard },
    { title: 'Quản lý công thức', url: '/admin/recipes', icon: BookOpen },
    { title: 'Quản lý sản phẩm', url: '/admin/products', icon: Package },
    { title: 'Quản lý người dùng', url: '/admin/users', icon: Users },
    { title: 'Báo cáo', url: '/admin/reports', icon: BarChart3 },
    { title: 'Cài đặt', url: '/admin/settings', icon: Settings },
  ],
  // Manager (Role 2)
  2: [
    { title: 'Tổng quan', url: '/manager', icon: LayoutDashboard },
    { title: 'Kế hoạch sản xuất', url: '/manager/planning', icon: ClipboardList },
  ],
  // Store Staff (Role 3)
  3: [
    { title: 'Đặt hàng', url: '/store', icon: ShoppingCart },
    { title: 'Lịch sử đơn hàng', url: '/store/orders', icon: History },
    { title: 'Đánh giá chất lượng', url: '/store/feedback', icon: MessageSquare },
  ],
  // Kitchen Manager (Role 4) - Basic Menu
  4: [
    { title: 'Bảng điều khiển', url: '/kitchen', icon: LayoutDashboard },
    { title: 'Công thức', url: '/kitchen/recipes', icon: BookOpen },
  ],
  // Supply Coordinator (Role 5)
  5: [
    { title: 'Bảng điều khiển', url: '/coordinator', icon: LayoutDashboard },
    { title: 'Gom đơn hàng', url: '/coordinator/orders', icon: ClipboardList },
    { title: 'Quản lý chuyến xe', url: '/coordinator/deliveries', icon: Truck },
  ],
  // Shipper (Role 6)
  6: [
    { title: 'Chuyến hàng của tôi', url: '/shipper', icon: Truck },
    { title: 'Bản đồ giao hàng', url: '/shipper/map', icon: MapPin },
    { title: 'Lịch sử giao hàng', url: '/shipper/history', icon: History },
  ],
  // Warehouse (Role 7)
  7: [
    { title: 'Bảng điều khiển', url: '/warehouse', icon: LayoutDashboard },
    { title: 'Tồn kho', url: '/warehouse/inventory', icon: Package },
    { title: 'Nhập mua Nguyên liệu', url: '/warehouse/procurement', icon: ShoppingCart },
    { title: 'Nhập kho Thành phẩm', url: '/warehouse/inbound', icon: ArrowDownToLine },
    { title: 'Xuất kho', url: '/warehouse/outbound', icon: Truck },
    { title: 'Phân bổ Nguyên liệu', url: '/warehouse/material-allocation', icon: Warehouse },
    { title: 'Hủy hàng', url: '/warehouse/waste', icon: FileWarning },
  ],
};

const kitchenExecutionMenu = [
  { title: 'Thực thi Sản xuất', url: '/kitchen/production', icon: ChefHat },
  { title: 'Chờ xác nhận', url: '/kitchen/batches/WAITING_TO_CONFIRM', icon: AlertTriangle },
  { title: 'Đang sản xuất', url: '/kitchen/batches/PROCESSING', icon: Timer },
  { title: 'Chờ huỷ hàng', url: '/kitchen/batches/WAITING_TO_CANCEL', icon: FileWarning },
];

const kitchenBatchManagementMenu = [
  { title: 'Đã xác nhận', url: '/kitchen/batches/DONE', icon: CheckCircle2 },
  { title: 'Đã hỏng', url: '/kitchen/batches/DAMAGED', icon: AlertCircle },
  { title: 'Đã hết hạn', url: '/kitchen/batches/EXPIRED', icon: AlertTriangle },
];

const roleNames = {
  1: 'Quản trị viên',
  2: 'Quản lý',
  3: 'Nhân viên cửa hàng',
  4: 'Quản lý bếp',
  5: 'Điều phối viên',
  6: 'Nhân viên giao hàng',
  7: 'Thủ kho',
};

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  if (!user) return null;

  const menuItems = menuByRole[Number(user.role_id)] || [];
  const isKitchenManager = Number(user.role_id) === 4;

  const renderMenuItem = (item) => {
    const isActive = location.pathname === item.url;
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.title}
        >
          <NavLink to={item.url}>
            {item.icon && <item.icon className="h-4 w-4" />}
            <span>{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-6 w-6" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">
                Kitchen Control
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                {roleNames[user.role_id]}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            Menu chính
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isKitchenManager && (
          <>
            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] font-black tracking-widest px-2 mb-2">
                Thực thi
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {kitchenExecutionMenu.map(renderMenuItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-4">
              <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] font-black tracking-widest px-2 mb-2">
                Quản lý lô hàng
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {kitchenBatchManagementMenu.map(renderMenuItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex flex-col gap-3">
          {!collapsed && (
            <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {user.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {user.full_name}
                </span>
                {user.store && (
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {user.store.store_name}
                  </span>
                )}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {!collapsed && 'Đăng xuất'}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
