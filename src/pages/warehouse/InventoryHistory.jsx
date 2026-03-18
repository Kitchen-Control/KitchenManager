import React, { useState, useEffect } from 'react';
import { getAllTransactions } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Loader2, ArrowLeft, Download, History, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function InventoryHistory() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getAllTransactions();
      // Sort by transactionId descending to show latest first
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) => b.transactionId - a.transactionId);
      setTransactions(sorted);
    } catch (error) {
      console.error('API Error:', error);
      toast.error('Không thể tải lịch sử giao dịch: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lịch sử Nhập/Xuất</h1>
            <p className="text-muted-foreground">Theo dõi mọi biến động tồn kho thực tế.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchHistory} disabled={isLoading}>
            <History className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button variant="default" className="bg-green-600 hover:bg-green-700">
            <Download className="mr-2 h-4 w-4" /> Xuất Excel
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-bold">Mã GD</th>
                  <th className="px-6 py-4 font-bold">Thời gian</th>
                  <th className="px-6 py-4 font-bold">Sản phẩm</th>
                  <th className="px-6 py-4 font-bold">Lô hàng</th>
                  <th className="px-6 py-4 font-bold text-center">Loại</th>
                  <th className="px-6 py-4 font-bold text-right">Số lượng</th>
                  <th className="px-6 py-4 font-bold">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400 italic">
                      Chưa có dữ liệu giao dịch nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.transactionId} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-400">#{tx.transactionId}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tx.createdAt ? format(new Date(tx.createdAt), 'dd/MM/yyyy HH:mm') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {tx.productName || tx.product?.productName || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="font-mono bg-slate-50">
                          #{tx.batchId || tx.batch?.batchId || 'N/A'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {tx.type === 'IMPORT' ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 gap-1 pr-3">
                            <ArrowDownLeft className="h-3 w-3" /> NHẬP
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 gap-1 pr-3">
                            <ArrowUpRight className="h-3 w-3" /> XUẤT
                          </Badge>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-right font-bold text-base ${tx.type === 'IMPORT' ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.type === 'IMPORT' ? '+' : '-'}{tx.quantity}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate" title={tx.note}>
                        {tx.note || '-'}
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
