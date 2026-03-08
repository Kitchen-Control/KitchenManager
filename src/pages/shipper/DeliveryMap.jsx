import React, { useState, useEffect } from 'react';
import { getDeliveriesByShipperId } from '../../data/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DeliveryMap() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.user_id) {
      getDeliveriesByShipperId(user.user_id)
        .then(data => setDeliveries((data || []).filter(d => d.status === 'PROCESSING')))
        .catch(err => toast.error('Lỗi tải lộ trình: ' + err.message))
        .finally(() => setIsLoading(false));
    }
  }, [user]);

  const openGoogleMaps = (address) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <MapPin className="h-6 w-6 text-primary" /> Bản đồ giao hàng
      </h1>

      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Bạn không có chuyến xe nào đang thực hiện.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {deliveries.map(delivery => (
            <Card key={delivery.delivery_id} className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle>Lộ trình chuyến #{delivery.delivery_id}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <div className="relative border-l-2 border-dashed border-gray-300 ml-4 my-2 space-y-8 pb-2">
                  {/* Điểm xuất phát */}
                  <div className="relative pl-8">
                    <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-green-500 ring-4 ring-white" />
                    <h3 className="font-semibold">Bếp Trung Tâm</h3>
                    <p className="text-sm text-muted-foreground">Kho xuất hàng</p>
                  </div>

                  {/* Các điểm giao */}
                  {delivery.orders?.map((order, index) => (
                    <div key={order.order_id} className="relative pl-8">
                      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-blue-500 ring-4 ring-white" />
                      <h3 className="font-semibold">{order.store_name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">Đơn hàng #{order.order_id}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => openGoogleMaps(order.store_name)} // Dùng tên store làm địa chỉ tạm
                      >
                        <Navigation className="h-3 w-3" /> Chỉ đường
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}