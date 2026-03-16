import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  BarChart3, 
  Trash2, 
  Calendar, 
  Download, 
  ChevronRight, 
  FileText, 
  TrendingDown,
  Loader2,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAllTransactions } from '../../data/api';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Reports() {
  const navigate = useNavigate();
  const [wasteData, setWasteData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalItems: 0, totalWasteValue: 0 });

  const loadData = async () => {
    setLoading(true);
    try {
      const txs = await getAllTransactions();
      // Filter for WASTE/DAMAGED transactions
      // In this project, EXPORT with specific notes or type can indicate waste. 
      // Flow 4 says DAMAGED status in log_batches is the end of lifecycle.
      const wasteOnly = (txs || []).filter(t => 
        t.type === 'EXPORT' && 
        (t.note?.toLowerCase().includes('hủy') || t.note?.toLowerCase().includes('waste'))
      );
      
      setWasteData(wasteOnly.sort((a, b) => b.transactionId - a.transactionId));
      
      // Calculate summary stats
      const total = wasteOnly.length;
      // Value calculation would need price, which might be missing in transaction object.
      // We'll show quantity for now.
      const totalQty = wasteOnly.reduce((sum, item) => sum + (item.quantity || 0), 0);
      
      setStats({ totalItems: total, totalQuantity: totalQty });
    } catch (e) {
      toast.error('Lỗi khi tải báo cáo: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Báo cáo Thiệt hại & Hao phí</h1>
            <p className="text-muted-foreground mt-1">Tổng hợp dữ liệu hàng hỏng, hết hạn (Flow 4)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Làm mới
          </Button>
          <Button className="bg-slate-800 hover:bg-slate-900">
            <Download className="mr-2 h-4 w-4" /> Xuất Báo cáo
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-red-50 border-red-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-600 font-medium">Số vụ tiêu hủy</CardDescription>
            <CardTitle className="text-3xl text-red-700">{stats.totalItems}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-red-600 gap-1">
              <TrendingDown className="h-4 w-4" />
              <span>Ghi nhận từ lịch sử giao dịch</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-slate-600">Tổng sản lượng hủy</CardDescription>
            <CardTitle className="text-3xl text-slate-700">{stats.totalQuantity || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-slate-500 gap-1">
              <BarChart3 className="h-4 w-4" />
              <span>Theo đơn vị sản phẩm</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-600 font-medium">Báo cáo gần nhất</CardDescription>
            <CardTitle className="text-xl text-blue-700">
              {wasteData.length > 0 ? format(new Date(wasteData[0].createdAt), 'dd/MM/yyyy') : 'N/A'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-blue-500 gap-1">
              <Calendar className="h-4 w-4" />
              <span>Cập nhật tự động</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chi tiết các lô hàng đã hủy</CardTitle>
          <CardDescription>Danh sách chi tiết các lần xuất hủy vật lý tại kho</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold border-y">
                <tr>
                  <th className="px-6 py-4">Mã GD</th>
                  <th className="px-6 py-4">Ngày hủy</th>
                  <th className="px-6 py-4">Sản phẩm</th>
                  <th className="px-6 py-4">Mã Lô</th>
                  <th className="px-6 py-4 text-right">Số lượng</th>
                  <th className="px-6 py-4">Lý do/Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : wasteData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">
                      Chưa có dữ liệu hao phí nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  wasteData.map((item) => (
                    <tr key={item.transactionId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-400">#{item.transactionId}</td>
                      <td className="px-6 py-4">
                        {item.createdAt ? format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">{item.productName || item.product?.productName}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">#{item.batchId || item.batch?.batchId}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">
                        -{item.quantity}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs italic">
                        {item.note || 'Không có ghi chú'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
