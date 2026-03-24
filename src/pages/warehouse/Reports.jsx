import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { 
  BarChart3, 
  Trash2, 
  Calendar, 
  Download, 
  TrendingDown,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Store,
  Truck,
  Package,
  AlertTriangle,
  History,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  getAllWasteLogs, 
  getRevenueByStore, 
  getLiveOrderStatusToday,
  getOrderVolume,
  getReceiptsByStatus
} from '../../data/api';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Reports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // States for different reports
  const [wasteLogs, setWasteLogs] = useState([]);
  const [storeStats, setStoreStats] = useState([]);
  const [liveStatus, setLiveStatus] = useState({});
  const [performance, setPerformance] = useState({ avgVisits: 0 });

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const [waste, stores, status, receipts] = await Promise.all([
        getAllWasteLogs().catch(() => []),
        getRevenueByStore(currentMonth, currentYear).catch(() => []),
        getLiveOrderStatusToday().catch(() => ({})),
        getReceiptsByStatus('COMPLETED').catch(() => []) // To calculate efficiency
      ]);

      setWasteLogs(waste.sort((a, b) => b.wasteId - a.wasteId));
      setStoreStats(stores.sort((a, b) => b.totalRevenue - a.totalRevenue));
      setLiveStatus(status);

      // Simple Efficiency Calculation: (Count Receipts / Total Orders) - Simplified for demo
      // In real scenario, would need total orders count for the same period
      const totalOrdersToday = Object.values(status).reduce((a, b) => a + b, 0) || 10; 
      const efficiency = receipts.length / totalOrdersToday;
      setPerformance({ avgVisits: efficiency.toFixed(2) });

    } catch (e) {
      toast.error('Lỗi khi tải dữ liệu báo cáo: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && wasteLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Đang tổng hợp báo cáo...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Báo cáo & Đối soát Kho</h1>
            <p className="text-muted-foreground mt-1">Số liệu thực tế về đơn hàng, hiệu suất và hao hụt (Step 7)</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={loadData} disabled={loading} className="flex-1 md:flex-none">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Làm mới
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 flex-1 md:flex-none">
            <Download className="mr-2 h-4 w-4" /> Xuất PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px] mb-6">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="waste">Hao hụt</TabsTrigger>
          <TabsTrigger value="stores">Cửa hàng</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">Đơn thành công (Hôm nay)</CardDescription>
                <CardTitle className="text-3xl text-blue-700">{liveStatus.DONE || 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-blue-600 gap-1">
                  <TrendingUp className="h-3 w-3" /> <span>Đã chốt DONE</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">Số lần giao/Đơn (Avg)</CardDescription>
                <CardTitle className="text-3xl text-orange-700">{performance.avgVisits}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-orange-600 gap-1">
                  <Truck className="h-3 w-3" /> <span>Hiệu suất vận chuyển</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">Đơn Hỏng/Hủy</CardDescription>
                <CardTitle className="text-3xl text-red-700">{(liveStatus.DAMAGED || 0) + (liveStatus.CANCELED || 0)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-red-600 gap-1">
                  <AlertTriangle className="h-3 w-3" /> <span>Cần kiểm soát chất lượng</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">Giá trị xuất kho (Tháng)</CardDescription>
                <CardTitle className="text-2xl text-green-700">
                  {storeStats.reduce((sum, s) => sum + s.totalRevenue, 0).toLocaleString()} <span className="text-sm">VNĐ</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-green-600 gap-1">
                  <DollarSign className="h-3 w-3" /> <span>Giá vốn nội bộ</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-600" /> Trạng thái vận hành hôm nay
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(liveStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                      <span className="text-sm font-medium text-slate-600">{status}</span>
                      <Badge variant={status === 'DONE' ? 'success' : 'outline'}>{count} đơn</Badge>
                    </div>
                  ))}
                  {Object.keys(liveStatus).length === 0 && (
                    <p className="text-center text-sm text-muted-foreground italic">Chưa có dữ liệu vận hành hôm nay</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" /> Cảnh báo hao hụt (Waste Logs mới)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {wasteLogs.slice(0, 5).map(log => (
                    <div key={log.wasteId} className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 border border-red-100">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-red-900">{log.productName}</span>
                        <span className="text-[10px] text-red-600">{log.wasteType} - #{log.orderId}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-red-700">-{log.quantity}</span>
                        <p className="text-[9px] text-slate-400">{format(new Date(log.createdAt), 'dd/MM HH:mm')}</p>
                      </div>
                    </div>
                  ))}
                  {wasteLogs.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-10">Không có hao hụt ghi nhận gần đây</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="waste" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nhật ký Hao hụt Chi tiết</CardTitle>
              <CardDescription>Toàn bộ danh sách hàng hỏng (DAMAGED_SHIPPING) và hủy từ Waste Logs API</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold border-y">
                    <tr>
                      <th className="px-6 py-4">Sản phẩm</th>
                      <th className="px-6 py-4">Đơn hàng</th>
                      <th className="px-6 py-4">Lý do (Type)</th>
                      <th className="px-6 py-4 text-right">Số lượng</th>
                      <th className="px-6 py-4 text-right">Ngày ghi nhận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {wasteLogs.map((log) => (
                      <tr key={log.wasteId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{log.productName}</td>
                        <td className="px-6 py-4 text-indigo-600">#{log.orderId}</td>
                        <td className="px-6 py-4 text-xs">
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100">{log.wasteType}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-red-600">-{log.quantity}</td>
                        <td className="px-6 py-4 text-right text-slate-500 text-xs">
                          {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hiệu năng Cửa hàng (Tháng này)</CardTitle>
              <CardDescription>Xếp hạng doanh số nội bộ và tần suất đặt hàng</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold border-y">
                    <tr>
                      <th className="px-6 py-4">Cửa hàng</th>
                      <th className="px-6 py-4 text-right">Tổng giá trị đơn (VNĐ)</th>
                      <th className="px-6 py-4 text-right">Tỷ lệ đóng góp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {storeStats.map((store, idx) => {
                      const total = storeStats.reduce((sum, s) => sum + s.totalRevenue, 0);
                      const percent = ((store.totalRevenue / total) * 100).toFixed(1);
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </div>
                            <span className="font-medium text-slate-800">{store.storeName}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-indigo-700">
                            {store.totalRevenue.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-indigo-500 h-full" style={{ width: `${percent}%` }}></div>
                              </div>
                              <span className="text-xs font-bold text-slate-500">{percent}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
