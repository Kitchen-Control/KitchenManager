import React, { useState, useEffect } from 'react';
import { 
  getDeliveriesByShipperId, 
  getReceiptsByOrderId 
} from '../../data/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/common/EmptyState';
import { 
  Truck, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw,
  ChevronRight,
  Package,
  MapPin,
  Clock,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ShipperHistory() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderReceipts, setOrderReceipts] = useState({});

  const fetchData = async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const data = await getDeliveriesByShipperId(user.user_id);
      // Filter for past deliveries
      const history = (data || []).filter(d => d.status === 'DONE' || d.status === 'CANCEL' || d.status === 'CANCELED');
      setDeliveries(history.sort((a, b) => b.delivery_id - a.delivery_id));

      // Fetch receipts for these orders to show details if needed
      const receiptMap = {};
      for (const d of history) {
        for (const o of d.orders || []) {
          if (!receiptMap[o.order_id]) {
            const recs = await getReceiptsByOrderId(o.order_id).catch(() => []);
            receiptMap[o.order_id] = recs;
          }
        }
      }
      setOrderReceipts(receiptMap);
    } catch (error) {
      toast.error('Lỗi khi tải lịch sử: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Đang tải lịch sử...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lịch sử giao hàng</h1>
          <p className="text-sm text-muted-foreground">Xem lại các chuyến hàng đã thực hiện</p>
        </div>
        <Button size="icon" variant="outline" onClick={fetchData} className="rounded-full">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          title="Chưa có lịch sử"
          description="Bạn chưa hoàn thành chuyến giao hàng nào."
          icon={History}
        />
      ) : (
        <div className="space-y-4">
          {deliveries.map(delivery => (
            <Card key={delivery.delivery_id} className="overflow-hidden border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="bg-slate-50/50 pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">Chuyến xe #{delivery.delivery_id}</CardTitle>
                      <Badge variant={delivery.status === 'DONE' ? 'success' : 'destructive'} className="uppercase text-[10px]">
                        {delivery.status === 'DONE' ? 'Hoàn tất' : 'Đã hủy'}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {delivery.delivery_date ? format(new Date(delivery.delivery_date), 'dd/MM/yyyy') : 'N/A'}
                    </CardDescription>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {delivery.created_at ? format(new Date(delivery.created_at), 'HH:mm') : ''}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col gap-1 p-2 bg-indigo-50/50 rounded border border-indigo-100">
                      <span className="text-indigo-600 font-bold text-[10px] uppercase">Tổng đơn hàng</span>
                      <span className="text-lg font-black font-mono text-indigo-900">{delivery.orders?.length || 0}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-2 bg-slate-50 rounded border">
                      <span className="text-slate-500 font-bold text-[10px] uppercase">Ghi chú</span>
                      <span className="text-xs italic text-slate-700 truncate">{delivery.note || 'Không có ghi chú'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Package className="h-3 w-3" /> Danh sách điểm giao:
                    </p>
                    {delivery.orders?.map(order => (
                      <div key={order.order_id} className="flex items-center justify-between p-2 rounded-lg border bg-white shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">#{order.order_id} - {order.store_name}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-2 w-2" /> {order.address || 'Giao tại cửa hàng'}
                          </span>
                        </div>
                        <Badge variant="outline" className={
                          order.status === 'DONE' ? 'border-green-200 text-green-700 bg-green-50' : 
                          order.status === 'DAMAGED' ? 'border-red-200 text-red-700 bg-red-50 font-bold' :
                          order.status === 'PARTIAL_DELIVERED' ? 'border-orange-200 text-orange-700 bg-orange-50' : 
                          'border-slate-200 text-slate-700 bg-slate-50'
                        }>
                          {order.status === 'DONE' ? 'HOÀN TẤT' : order.status === 'DAMAGED' ? 'HÀNG HỎNG' : order.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
