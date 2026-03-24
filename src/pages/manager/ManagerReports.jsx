import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAllWasteLogs,
  getRevenueByStore,
  getLiveOrderStatusToday,
  getReceiptsByStatus,
  fetchOrders,
  getDamagedOrCanceledOrders,
  getTopOrderedProducts,
  getLogBatchesByStatus,
} from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import {
  BarChart3,
  Trash2,
  RefreshCw,
  ArrowLeft,
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Data states
  const [wasteLogs, setWasteLogs] = useState([]);
  const [storeRevenue, setStoreRevenue] = useState([]);
  const [liveStatus, setLiveStatus] = useState({});
  const [allOrders, setAllOrders] = useState([]);
  const [completedReceipts, setCompletedReceipts] = useState([]);
  const [damagedOrders, setDamagedOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [waitingToCancel, setWaitingToCancel] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [waste, revenue, status, orders, receipts, damaged, top, expiring] = await Promise.all([
        getAllWasteLogs().catch(() => []),
        getRevenueByStore(month, year).catch(() => []),
        getLiveOrderStatusToday().catch(() => ({})),
        fetchOrders().catch(() => []),
        getReceiptsByStatus('COMPLETED').catch(() => []),
        getDamagedOrCanceledOrders(0, 50).catch(() => ({ content: [] })),
        getTopOrderedProducts(10).catch(() => []),
        getLogBatchesByStatus('WAITING_TO_CANCEL').catch(() => []),
      ]);

      setWasteLogs(Array.isArray(waste) ? waste.sort((a, b) => (b.waste_id || 0) - (a.waste_id || 0)) : []);
      setStoreRevenue(Array.isArray(revenue) ? revenue.sort((a, b) => b.totalRevenue - a.totalRevenue) : []);
      setLiveStatus(status || {});
      setAllOrders(Array.isArray(orders) ? orders : []);
      setCompletedReceipts(Array.isArray(receipts) ? receipts : []);
      setDamagedOrders(Array.isArray(damaged?.content) ? damaged.content : []);
      setTopProducts(Array.isArray(top) ? top : []);
      setWaitingToCancel(Array.isArray(expiring) ? expiring : []);
    } catch (e) {
      toast.error('Lỗi tải báo cáo: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Derived metrics
  const totalRevenue = storeRevenue.reduce((s, r) => s + (r.totalRevenue || 0), 0);
  const doneToday = liveStatus.DONE || 0;
  const damagedToday = (liveStatus.DAMAGED || 0) + (liveStatus.CANCELED || 0);
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
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Hoàn thành hôm nay" value={doneToday} icon={CheckCircle2} iconClass="text-green-600" desc="Đơn DONE" />
            <StatCard title="Hỏng / Hủy hôm nay" value={damagedToday} icon={XCircle} iconClass="text-red-500" desc="Cần kiểm soát chất lượng" />
            <StatCard title="Giá trị tháng này" value={`${totalRevenue.toLocaleString()} đ`} icon={DollarSign} iconClass="text-indigo-600" desc="Tổng giá trị đơn nội bộ" />
            <StatCard title="Lô chờ hủy" value={waitingToCancel.length} icon={Trash2} iconClass="text-orange-600" desc="WAITING_TO_CANCEL" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Live status today */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" /> Trạng thái vận hành hôm nay
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(liveStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                      <span className="text-sm font-medium text-slate-600">{STATUS_LABELS[status] || status}</span>
                      <Badge variant={status === 'DONE' ? 'default' : 'outline'}>{count} đơn</Badge>
                    </div>
                  ))}
                  {Object.keys(liveStatus).length === 0 && (
                    <p className="text-center text-sm text-muted-foreground italic py-6">Chưa có dữ liệu hôm nay</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" /> Top sản phẩm đặt nhiều nhất
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topProducts.slice(0, 7).map((p, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                        <span className="text-sm font-medium">{p.productName}</span>
                      </div>
                      <Badge variant="secondary">{p.totalQuantity} {p.unit}</Badge>
                    </div>
                  ))}
                  {topProducts.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground italic py-6">Chưa có dữ liệu</p>
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
            <CardHeader>
              <CardTitle>Thống kê theo cửa hàng (Tháng này)</CardTitle>
              <CardDescription>Giá trị đơn hàng nội bộ và tỷ lệ đóng góp</CardDescription>
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
                    {storeRevenue.map((store, idx) => {
                      const percent = totalRevenue > 0 ? ((store.totalRevenue / totalRevenue) * 100).toFixed(1) : '0.0';
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
                    {storeRevenue.length === 0 && (
                      <tr><td colSpan={3} className="text-center py-10 text-muted-foreground italic">Chưa có dữ liệu tháng này</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: Delivery Performance ─── */}
        <TabsContent value="delivery" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 mb-2">
            <StatCard title="Tổng phiếu xuất kho" value={completedReceipts.length} icon={Package} iconClass="text-green-600" desc="Receipts COMPLETED" />
            <StatCard title="Tổng đơn hàng" value={allOrders.length} icon={Truck} iconClass="text-blue-600" desc="Toàn hệ thống" />
            <StatCard title="TB lần giao/đơn" value={avgDeliveriesPerOrder} icon={TrendingUp} iconClass="text-indigo-600" desc="Cao → Nhiều lô giao nhỏ" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <StatCard title="Giao thiếu (PARTIAL)" value={partialCount} icon={AlertTriangle} iconClass="text-orange-500" desc="Đơn giao không đủ số lượng" />
            <StatCard title="Đơn bổ sung tạo ra" value={supplementCount} icon={Package} iconClass="text-purple-600" desc="SUPPLEMENT orders created" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" /> Đơn hỏng / Bị hủy (gần đây)
              </CardTitle>
              <CardDescription>
                Nhận diện cửa hàng có tỷ lệ đơn thiếu/hỏng cao để điều chỉnh kế hoạch
              </CardDescription>
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
                    {damagedOrders.slice(0, 20).map((o) => (
                      <tr key={o.orderId || o.order_id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-mono text-indigo-600">#{o.orderId || o.order_id}</td>
                        <td className="px-6 py-3">{o.storeName || o.store_name || '—'}</td>
                        <td className="px-6 py-3">
                          <Badge variant={o.status === 'DAMAGED' ? 'destructive' : 'outline'} className="text-xs">
                            {STATUS_LABELS[o.status] || o.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {o.comment || o.note || '—'}
                        </td>
                      </tr>
                    ))}
                    {damagedOrders.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-10 text-muted-foreground italic">Không có đơn hỏng/hủy gần đây</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 4: Waste & Quality ─── */}
        <TabsContent value="waste" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 mb-2">
            <StatCard title="Tổng bản ghi hao hụt" value={wasteLogs.length} icon={Trash2} iconClass="text-red-500" desc="Từ waste_logs" />
            <StatCard title="Tổng SL hủy" value={totalWasteQty} icon={TrendingDown} iconClass="text-red-600" desc="Đơn vị tổng số lượng" />
            <StatCard title="Lô chờ hủy hiện tại" value={waitingToCancel.length} icon={AlertTriangle} iconClass="text-orange-600" desc="WAITING_TO_CANCEL" />
          </div>

          {waitingToCancel.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader>
                <CardTitle className="text-orange-700 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Cảnh báo: Lô hàng chờ xuất hủy
                </CardTitle>
                <CardDescription>Thủ kho cần tiến hành xuất hủy các lô này trong Danh mục Xuất hủy</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-orange-100/50 text-orange-800 uppercase text-xs font-bold border-y border-orange-200">
                      <tr>
                        <th className="px-6 py-3">Lô #</th>
                        <th className="px-6 py-3">Sản phẩm</th>
                        <th className="px-6 py-3 text-right">Số lượng</th>
                        <th className="px-6 py-3 text-right">Hết hạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-100">
                      {waitingToCancel.map(b => (
                        <tr key={b.batch_id} className="hover:bg-orange-50">
                          <td className="px-6 py-3 font-mono text-orange-700">#{b.batch_id}</td>
                          <td className="px-6 py-3 font-medium">{b.product_name}</td>
                          <td className="px-6 py-3 text-right font-bold text-red-700">{b.quantity}</td>
                          <td className="px-6 py-3 text-right text-red-600 text-xs">
                            {b.expiry_date ? format(new Date(b.expiry_date), 'dd/MM/yyyy') : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Nhật ký Hao hụt chi tiết (Waste Log)</CardTitle>
              <CardDescription>Toàn bộ ghi nhận hàng hỏng và xuất hủy</CardDescription>
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
                    {wasteLogs.map((log, i) => (
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
                    {wasteLogs.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-10 text-muted-foreground italic">Chưa có hao hụt ghi nhận</td></tr>
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
