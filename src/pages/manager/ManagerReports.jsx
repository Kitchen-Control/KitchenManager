import React, { useState, useEffect } from 'react';
import {
  getAllWasteLogs,
  getRevenueByStore,
  getLiveOrderStatusToday,
  getReceiptsByStatus,
  fetchOrders,
  getAllStores,
  getProducts,
} from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import {
  RefreshCw,
  Trash2,
  Store,
  Truck,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Box,
  Ban,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

function StatCard({ title, value, icon: Icon, iconClass, desc }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${iconClass}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
      </CardContent>
    </Card>
  );
}

export default function ManagerReports() {
  const [loading, setLoading] = useState(true);

  // Data states
  const [wasteLogs, setWasteLogs] = useState([]);
  const [storeRevenue, setStoreRevenue] = useState([]);
  const [liveStatus, setLiveStatus] = useState({});
  const [allOrders, setAllOrders] = useState([]);
  const [completedReceipts, setCompletedReceipts] = useState([]);
  const [allStores, setAllStores] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  // Filter states for Overview
  const nowForInit = new Date();
  const initMonth = String(nowForInit.getMonth() + 1);
  const initYear = String(nowForInit.getFullYear());

  const [completedFilterMonth, setCompletedFilterMonth] = useState(initMonth);
  const [completedFilterYear, setCompletedFilterYear] = useState(initYear);
  const [damagedFilterMonth, setDamagedFilterMonth] = useState(initMonth);
  const [damagedFilterYear, setDamagedFilterYear] = useState(initYear);
  const [revenueOverviewFilterMonth, setRevenueOverviewFilterMonth] = useState(initMonth);
  const [revenueOverviewFilterYear, setRevenueOverviewFilterYear] = useState(initYear);
  const [topProductFilter, setTopProductFilter] = useState('ALL');

  // Filter states for waste log
  const [wasteFilterProduct, setWasteFilterProduct] = useState('ALL');
  const [wasteFilterType, setWasteFilterType] = useState('ALL');
  const [wasteFilterDate, setWasteFilterDate] = useState('');

  // Filter states for damaged/all orders
  const [damagedFilterOrder, setDamagedFilterOrder] = useState('');
  const [damagedFilterStore, setDamagedFilterStore] = useState('ALL');
  const [damagedFilterStatus, setDamagedFilterStatus] = useState('ALL');

  // Filter states for Store Revenue
  const [revenueFilterStore, setRevenueFilterStore] = useState('ALL');
  const [revenueFilterDate, setRevenueFilterDate] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [waste, revenue, status, orders, receipts, storesData, productsData] = await Promise.all([
        getAllWasteLogs().catch(() => []),
        getRevenueByStore(month, year).catch(() => []),
        getLiveOrderStatusToday().catch(() => ({})),
        fetchOrders().catch(() => []),
        getReceiptsByStatus('COMPLETED').catch(() => []),
        getAllStores().catch(() => []),
        getProducts().catch(() => []),
      ]);

      setWasteLogs(Array.isArray(waste) ? waste.sort((a, b) => (b.waste_id || 0) - (a.waste_id || 0)) : []);
      setStoreRevenue(Array.isArray(revenue) ? revenue.sort((a, b) => b.totalRevenue - a.totalRevenue) : []);
      setLiveStatus(status || {});
      setAllOrders(Array.isArray(orders) ? orders : []);
      setCompletedReceipts(Array.isArray(receipts) ? receipts : []);
      setAllStores(Array.isArray(storesData) ? storesData : []);
      setAllProducts(Array.isArray(productsData) ? productsData : []);
    } catch (e) {
      toast.error('Lỗi tải báo cáo: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Derived metrics
  const totalRevenue = storeRevenue.reduce((s, r) => s + (r.totalRevenue || 0), 0);
  const partialCount = allOrders.filter(o => o.status === 'PARTIAL_DELIVERED').length;
  const supplementCount = allOrders.filter(o =>
    String(o.comment || '').toUpperCase().includes('SUPPLEMENT')
  ).length;
  const avgDeliveriesPerOrder = allOrders.length > 0
    ? (completedReceipts.length / allOrders.length).toFixed(2)
    : '0.00';
  const totalWasteQty = wasteLogs.reduce((s, w) => s + (w.quantity || 0), 0);

  const STATUS_LABELS = {
    WAITING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', DISPATCHED: 'Đã xuất kho',
    DELIVERING: 'Đang giao', PARTIAL_DELIVERED: 'Giao thiếu',
    DONE: 'Hoàn thành', DAMAGED: 'Hư hỏng', CANCELED: 'Đã hủy',
  };

  // Helpers for Overview KPIs
  const getOrderMonthYear = (o) => {
    try {
      if (!o.order_date && !o.orderDate) return { month: null, year: null };
      const d = new Date(o.order_date || o.orderDate);
      return { month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
    } catch { return { month: null, year: null }; }
  };

  const completedOrders = allOrders.filter(o => o.status === 'DONE');
  const completedInMonth = completedOrders.filter(o => {
    const { month, year } = getOrderMonthYear(o);
    return month === completedFilterMonth && year === completedFilterYear;
  }).length;
  const completedInYear = completedOrders.filter(o => {
    const { year } = getOrderMonthYear(o);
    return year === completedFilterYear;
  }).length;

  const damagedOrdersList = allOrders.filter(o => o.status === 'DAMAGED' || o.status === 'CANCELED');
  const damagedInMonth = damagedOrdersList.filter(o => {
    const { month, year } = getOrderMonthYear(o);
    return month === damagedFilterMonth && year === damagedFilterYear;
  }).length;
  const damagedInYear = damagedOrdersList.filter(o => {
    const { year } = getOrderMonthYear(o);
    return year === damagedFilterYear;
  }).length;

  const validRevenueOrders = allOrders.filter(o => o.status !== 'CANCELED');
  const revenueInMonth = validRevenueOrders.filter(o => {
    const { month, year } = getOrderMonthYear(o);
    return month === revenueOverviewFilterMonth && year === revenueOverviewFilterYear;
  }).reduce((s, o) => s + (o.totalPrice || o.total_price || 0), 0);
  
  const revenueInYear = validRevenueOrders.filter(o => {
    const { year } = getOrderMonthYear(o);
    return year === revenueOverviewFilterYear;
  }).reduce((s, o) => s + (o.totalPrice || o.total_price || 0), 0);

  const productSalesMap = {};
  allOrders.forEach(o => {
    if (o.status === 'CANCELED') return;
    (o.order_details || o.orderDetails || []).forEach(od => {
      const pName = od.product_name || od.productName || 'Unknown';
      if (!productSalesMap[pName]) productSalesMap[pName] = 0;
      productSalesMap[pName] += od.quantity;
    });
  });

  const allOrderedProductsOptions = Object.keys(productSalesMap).sort();

  let filteredTopProducts = [];
  if (topProductFilter === 'ALL') {
    filteredTopProducts = Object.keys(productSalesMap)
      .map(pName => ({ productName: pName, totalQuantity: productSalesMap[pName], unit: 'SP' }))
      .sort((a,b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);
  } else {
    filteredTopProducts = [{
      productName: topProductFilter,
      totalQuantity: productSalesMap[topProductFilter] || 0,
      unit: 'SP'
    }];
  }

  const uniqueWasteTypes = Array.from(new Set(wasteLogs.map(l => l.waste_type))).filter(Boolean).sort();
  
  const filteredWasteLogs = wasteLogs.filter(log => {
    const matchProduct = wasteFilterProduct === 'ALL' || log.product_name === wasteFilterProduct;
    const matchType = wasteFilterType === 'ALL' || log.waste_type === wasteFilterType;
    let matchDate = true;
    if (wasteFilterDate && log.created_at) {
      try {
        const logDateStr = format(new Date(log.created_at), 'yyyy-MM-dd');
        matchDate = logDateStr === wasteFilterDate;
      } catch (e) {
        matchDate = false;
      }
    }
    return matchProduct && matchType && matchDate;
  });

  const sortedAllOrders = [...allOrders].sort((a, b) => {
    const idA = a.orderId || a.order_id || 0;
    const idB = b.orderId || b.order_id || 0;
    return idB - idA;
  });

  const filteredAllOrders = sortedAllOrders.filter(o => {
    const orderIdStr = String(o.orderId || o.order_id || '');
    const storeNameStr = o.storeName || o.store_name || '';
    
    const matchOrder = damagedFilterOrder === '' || orderIdStr.includes(damagedFilterOrder);
    const matchStore = damagedFilterStore === 'ALL' || storeNameStr === damagedFilterStore;
    const matchStatus = damagedFilterStatus === 'ALL' || o.status === damagedFilterStatus;
    
    return matchOrder && matchStore && matchStatus;
  });

  const nowFilter = new Date();
  const firstDayOfMonth = format(new Date(nowFilter.getFullYear(), nowFilter.getMonth(), 1), 'yyyy-MM-dd');
  const lastDayOfMonth = format(new Date(nowFilter.getFullYear(), nowFilter.getMonth() + 1, 0), 'yyyy-MM-dd');

  let revenueDenominator = totalRevenue;
  let filteredStoreRevenue = storeRevenue;

  if (revenueFilterDate) {
    const ordersOnDate = allOrders.filter(o => {
      try {
        if (!o.order_date && !o.orderDate) return false;
        const oDate = format(new Date(o.order_date || o.orderDate), 'yyyy-MM-dd');
        return oDate === revenueFilterDate;
      } catch { return false; }
    });

    const storeMap = {};
    let dailyTotal = 0;
    ordersOnDate.forEach(o => {
      const sName = o.storeName || o.store_name || 'Khác';
      const price = o.totalPrice || o.total_price || 0;
      if (!storeMap[sName]) storeMap[sName] = 0;
      if (o.status !== 'CANCELED') {
         storeMap[sName] += price;
         dailyTotal += price;
      }
    });

    filteredStoreRevenue = Object.keys(storeMap).map(sName => ({
      storeName: sName,
      totalRevenue: storeMap[sName]
    })).filter(s => s.totalRevenue > 0).sort((a,b) => b.totalRevenue - a.totalRevenue);
    revenueDenominator = dailyTotal;
  }

  if (revenueFilterStore !== 'ALL') {
    filteredStoreRevenue = filteredStoreRevenue.filter(s => s.storeName === revenueFilterStore);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-muted-foreground animate-pulse">Đang tổng hợp báo cáo...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Báo cáo & Phân tích
            </h1>
            <p className="text-muted-foreground mt-1">Tổng hợp vận hành — đơn hàng, giao hàng, hao hụt</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Làm mới
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="stores">Cửa hàng</TabsTrigger>
          <TabsTrigger value="delivery">Hiệu suất giao</TabsTrigger>
          <TabsTrigger value="waste">Hao hụt</TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: Overview ─── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Thẻ Hoàn thành */}
            <Card className="shadow-sm border-t-4 border-t-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600"/> Đơn hoàn thành</span>
                </CardTitle>
                <div className="flex gap-2 mt-4 text-muted-foreground">
                  <select className="flex-1 text-xs border rounded p-1.5 focus:outline-none" value={completedFilterMonth} onChange={e => setCompletedFilterMonth(e.target.value)}>
                    {Array.from({length:12}, (_,i) => <option key={i+1} value={String(i+1)}>Tháng {i+1}</option>)}
                  </select>
                  <select className="flex-1 text-xs border rounded p-1.5 focus:outline-none" value={completedFilterYear} onChange={e => setCompletedFilterYear(e.target.value)}>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 divide-x">
                  <div>
                    <div className="text-3xl font-bold">{completedInMonth}</div>
                    <p className="text-xs text-muted-foreground mt-1">Trong tháng {completedFilterMonth}</p>
                  </div>
                  <div className="pl-4">
                    <div className="text-3xl font-bold text-slate-700">{completedInYear}</div>
                    <p className="text-xs text-muted-foreground mt-1">Trong năm {completedFilterYear}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Thẻ Hỏng/Hủy */}
            <Card className="shadow-sm border-t-4 border-t-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500"/> Đơn Hỏng / Hủy</span>
                </CardTitle>
                <div className="flex gap-2 mt-4 text-muted-foreground">
                  <select className="flex-1 text-xs border rounded p-1.5 focus:outline-none" value={damagedFilterMonth} onChange={e => setDamagedFilterMonth(e.target.value)}>
                    {Array.from({length:12}, (_,i) => <option key={i+1} value={String(i+1)}>Tháng {i+1}</option>)}
                  </select>
                  <select className="flex-1 text-xs border rounded p-1.5 focus:outline-none" value={damagedFilterYear} onChange={e => setDamagedFilterYear(e.target.value)}>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 divide-x">
                  <div>
                    <div className="text-3xl font-bold">{damagedInMonth}</div>
                    <p className="text-xs text-muted-foreground mt-1">Trong tháng {damagedFilterMonth}</p>
                  </div>
                  <div className="pl-4">
                    <div className="text-3xl font-bold text-slate-700">{damagedInYear}</div>
                    <p className="text-xs text-muted-foreground mt-1">Trong năm {damagedFilterYear}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Thẻ Doanh thu */}
            <Card className="shadow-sm border-t-4 border-t-indigo-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-indigo-600"/> Giá trị đơn (VNĐ)</span>
                </CardTitle>
                <div className="flex gap-2 mt-4 text-muted-foreground">
                  <select className="flex-1 text-xs border rounded p-1.5 focus:outline-none" value={revenueOverviewFilterMonth} onChange={e => setRevenueOverviewFilterMonth(e.target.value)}>
                    {Array.from({length:12}, (_,i) => <option key={i+1} value={String(i+1)}>Tháng {i+1}</option>)}
                  </select>
                  <select className="flex-1 text-xs border rounded p-1.5 focus:outline-none" value={revenueOverviewFilterYear} onChange={e => setRevenueOverviewFilterYear(e.target.value)}>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-end border-b pb-2">
                    <p className="text-xs text-muted-foreground font-medium">Tháng {revenueOverviewFilterMonth}</p>
                    <div className="text-xl font-bold text-indigo-700">{revenueInMonth.toLocaleString()} đ</div>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-xs text-muted-foreground font-medium">Năm {revenueOverviewFilterYear}</p>
                    <div className="text-xl font-bold text-slate-700">{revenueInYear.toLocaleString()} đ</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            {/* Top products */}
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-4 gap-4">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" /> Thống kê số lượng theo sản phẩm
                </CardTitle>
                <div className="flex items-center gap-2">
                   <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none w-full md:w-64" value={topProductFilter} onChange={e => setTopProductFilter(e.target.value)}>
                     <option value="ALL">Top 10 đặt nhiều nhất</option>
                     {allOrderedProductsOptions.map(p => <option key={p} value={p}>{p}</option>)}
                   </select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredTopProducts.map((p, i) => (
                    <div key={p.productName} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        {topProductFilter === 'ALL' && <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center">#{i + 1}</span>}
                        <span className="text-sm font-medium text-slate-700">{p.productName}</span>
                      </div>
                      <Badge variant="secondary" className="px-3 py-1">{p.totalQuantity} {p.unit}</Badge>
                    </div>
                  ))}
                  {filteredTopProducts.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground italic py-6">Chưa có dữ liệu cho sản phẩm này</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── TAB 2: By Store ─── */}
        <TabsContent value="stores" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 mb-2">
            <StatCard title="Tổng cửa hàng" value={storeRevenue.length} icon={Store} iconClass="text-indigo-600" desc="Đang hoạt động tháng này" />
            <StatCard title="Tổng đơn hàng" value={allOrders.length} icon={Package} iconClass="text-blue-600" desc="Toàn hệ thống" />
            <StatCard title="Đơn bổ sung (SUPPLEMENT)" value={supplementCount} icon={TrendingUp} iconClass="text-orange-600" desc="Đơn hàng bù thiếu/hỏng" />
          </div>

          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between pb-4 gap-4">
              <div>
                <CardTitle>Thống kê theo cửa hàng (Tháng này)</CardTitle>
                <CardDescription>Giá trị đơn hàng nội bộ và tỷ lệ đóng góp</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  min={firstDayOfMonth}
                  max={lastDayOfMonth}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  value={revenueFilterDate}
                  onChange={(e) => setRevenueFilterDate(e.target.value)}
                />
                <select
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  value={revenueFilterStore}
                  onChange={(e) => setRevenueFilterStore(e.target.value)}
                >
                  <option value="ALL">Tất cả cửa hàng</option>
                  {allStores.map(s => <option key={s.store_id} value={s.store_name}>{s.store_name}</option>)}
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold border-y">
                    <tr>
                      <th className="px-6 py-4">Cửa hàng</th>
                      <th className="px-6 py-4 text-right">Tổng giá trị (VNĐ)</th>
                      <th className="px-6 py-4 text-right">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredStoreRevenue.map((store, idx) => {
                      const percent = revenueDenominator > 0 ? ((store.totalRevenue / revenueDenominator) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                            <span className="font-medium text-slate-800">{store.storeName}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-indigo-700">
                            {(store.totalRevenue || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-indigo-500 h-full" style={{ width: `${percent}%` }} />
                              </div>
                              <span className="text-xs font-bold text-slate-500">{percent}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStoreRevenue.length === 0 && (
                      <tr><td colSpan={3} className="text-center py-10 text-muted-foreground italic">Không có dữ liệu</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: Delivery Performance ─── */}
        <TabsContent value="delivery" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4 mb-2">
            <StatCard title="Tổng phiếu xuất kho" value={completedReceipts.length} icon={Package} iconClass="text-green-600" desc="Receipts COMPLETED" />
            <StatCard title="Tổng đơn hàng" value={allOrders.length} icon={Truck} iconClass="text-blue-600" desc="Toàn hệ thống" />
            <StatCard title="TB lần giao/đơn" value={avgDeliveriesPerOrder} icon={TrendingUp} iconClass="text-indigo-600" desc="Cao → Nhiều lô giao nhỏ" />
            <StatCard title="Đơn bổ sung" value={supplementCount} icon={Package} iconClass="text-purple-600" desc="SUPPLEMENT orders" />
          </div>

          <h3 className="font-semibold text-lg mt-6 mb-2">Thống kê trạng thái đơn hàng</h3>
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <StatCard title="Chờ xử lý" value={allOrders.filter(o => o.status === 'WAITING').length} icon={Clock} iconClass="text-yellow-500" />
            <StatCard title="Đang xử lý" value={allOrders.filter(o => o.status === 'PROCESSING').length} icon={RefreshCw} iconClass="text-blue-500" />
            <StatCard title="Đã xuất kho" value={allOrders.filter(o => o.status === 'DISPATCHED').length} icon={Box} iconClass="text-indigo-500" />
            <StatCard title="Đang giao" value={allOrders.filter(o => o.status === 'DELIVERING').length} icon={Truck} iconClass="text-cyan-500" />
            
            <StatCard title="Hoàn thành" value={allOrders.filter(o => o.status === 'DONE').length} icon={CheckCircle2} iconClass="text-green-600" />
            <StatCard title="Giao thiếu" value={allOrders.filter(o => o.status === 'PARTIAL_DELIVERED').length} icon={AlertTriangle} iconClass="text-orange-500" />
            <StatCard title="Hư hỏng" value={allOrders.filter(o => o.status === 'DAMAGED').length} icon={XCircle} iconClass="text-red-500" />
            <StatCard title="Đã hủy" value={allOrders.filter(o => o.status === 'CANCELED').length} icon={Ban} iconClass="text-slate-500" />
          </div>

          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between pb-4 gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-500" /> Theo dõi đơn hàng (Gần đây)
                </CardTitle>
                <CardDescription>
                  Theo dõi và lọc tất cả các đơn hàng theo ID, trạng thái, cửa hàng...
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Tìm mã đơn..."
                  className="w-32 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  value={damagedFilterOrder}
                  onChange={(e) => setDamagedFilterOrder(e.target.value)}
                />
                <select
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  value={damagedFilterStore}
                  onChange={(e) => setDamagedFilterStore(e.target.value)}
                >
                  <option value="ALL">Tất cả cửa hàng</option>
                  {allStores.map(s => <option key={s.store_id} value={s.store_name}>{s.store_name}</option>)}
                </select>
                <select
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  value={damagedFilterStatus}
                  onChange={(e) => setDamagedFilterStatus(e.target.value)}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  {Object.keys(STATUS_LABELS).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold border-y">
                    <tr>
                      <th className="px-6 py-4">Đơn</th>
                      <th className="px-6 py-4">Cửa hàng</th>
                      <th className="px-6 py-4">Trạng thái</th>
                      <th className="px-6 py-4">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredAllOrders.slice(0, 50).map((o) => (
                      <tr key={o.orderId || o.order_id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-mono text-indigo-600">#{o.orderId || o.order_id}</td>
                        <td className="px-6 py-3">{o.storeName || o.store_name || '—'}</td>
                        <td className="px-6 py-3">
                          <Badge variant={(o.status === 'DAMAGED' || o.status === 'CANCELED') ? 'destructive' : 'outline'} className="text-xs">
                            {STATUS_LABELS[o.status] || o.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {o.comment || o.note || '—'}
                        </td>
                      </tr>
                    ))}
                    {filteredAllOrders.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-10 text-muted-foreground italic">Không tìm thấy đơn hàng nào phù hợp với bộ lọc</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 4: Waste & Quality ─── */}
        <TabsContent value="waste" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 mb-2">
            <StatCard title="Tổng bản ghi hao hụt" value={wasteLogs.length} icon={Trash2} iconClass="text-red-500" desc="Từ waste_logs" />
            <StatCard title="Tổng SL hủy" value={totalWasteQty} icon={TrendingDown} iconClass="text-red-600" desc="Đơn vị tổng số lượng" />
          </div>

          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between pb-2 gap-4">
              <div>
                <CardTitle>Nhật ký Hao hụt chi tiết (Waste Log)</CardTitle>
                <CardDescription>Toàn bộ ghi nhận hàng hỏng và xuất hủy</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  value={wasteFilterProduct}
                  onChange={(e) => setWasteFilterProduct(e.target.value)}
                >
                  <option value="ALL">Tất cả sản phẩm</option>
                  {allProducts.map(p => (
                    <option key={p.product_id} value={p.product_name}>{p.product_name}</option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  value={wasteFilterType}
                  onChange={(e) => setWasteFilterType(e.target.value)}
                >
                  <option value="ALL">Tất cả loại hao hụt</option>
                  {uniqueWasteTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Ngày:</span>
                  <input
                    type="date"
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                    value={wasteFilterDate}
                    onChange={(e) => setWasteFilterDate(e.target.value)}
                  />
                  {wasteFilterDate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setWasteFilterDate('')}
                      title="Xóa bộ lọc ngày"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold border-y">
                    <tr>
                      <th className="px-6 py-4">Sản phẩm</th>
                      <th className="px-6 py-4">Loại hao hụt</th>
                      <th className="px-6 py-4">Ghi chú</th>
                      <th className="px-6 py-4 text-right">Số lượng</th>
                      <th className="px-6 py-4 text-right">Ngày ghi nhận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredWasteLogs.map((log, i) => (
                      <tr key={log.waste_id || i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-bold text-slate-800">{log.product_name}</td>
                        <td className="px-6 py-3">
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100 text-xs">
                            {log.waste_type}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{log.note || '—'}</td>
                        <td className="px-6 py-3 text-right font-black text-red-600">-{log.quantity}</td>
                        <td className="px-6 py-3 text-right text-slate-500 text-xs">
                          {log.created_at ? format(new Date(log.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                        </td>
                      </tr>
                    ))}
                    {filteredWasteLogs.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-10 text-muted-foreground italic">Không tìm thấy bản ghi hao hụt nào phù hợp với bộ lọc</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
