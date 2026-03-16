import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getDeliveriesByShipperId } from '../../data/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { MapPin, Navigation, Loader2, Home } from 'lucide-react';
import { toast } from 'sonner';
import { geocodeAddress, FALLBACK_COORDINATES } from '../../lib/geocoding';

// Fix for Leaflet default marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom markers
const kitchenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const storeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to auto-center map
function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function DeliveryMap() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [coords, setCoords] = useState({}); // { store_name: {lat, lng} }
  const [mapCenter, setMapCenter] = useState([10.8231, 106.6297]); // Default: HCMC

  const kitchenPos = FALLBACK_COORDINATES['Bếp Trung Tâm'];

  useEffect(() => {
    if (user?.user_id) {
      getDeliveriesByShipperId(user.user_id)
        .then(async (data) => {
          const activeDeliveries = (data || []).filter(d => d.status === 'PROCESSING');
          setDeliveries(activeDeliveries);
          
          // Geocode store addresses
          const newCoords = { ...FALLBACK_COORDINATES };
          for (const delivery of activeDeliveries) {
            for (const order of (delivery.orders || [])) {
              if (order.store_name && !newCoords[order.store_name]) {
                const result = await geocodeAddress(order.store_name);
                if (result) {
                  newCoords[order.store_name] = result;
                }
              }
            }
          }
          setCoords(newCoords);
          
          // Center on first store if available
          if (activeDeliveries.length > 0 && activeDeliveries[0].orders?.length > 0) {
            const firstStore = activeDeliveries[0].orders[0].store_name;
            if (newCoords[firstStore]) {
              setMapCenter([newCoords[firstStore].lat, newCoords[firstStore].lng]);
            }
          }
        })
        .catch(err => toast.error('Lỗi tải lộ trình: ' + err.message))
        .finally(() => setIsLoading(false));
    }
  }, [user]);

  const openGoogleMaps = (address) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Đang tải bản đồ lộ trình...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
          <MapPin className="h-6 w-6 text-blue-600" />
          Bản đồ giao hàng
        </h1>
        {deliveries.length > 0 && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {deliveries.length} chuyến đang đi
          </Badge>
        )}
      </div>

      {deliveries.length === 0 ? (
        <Card className="border-dashed py-12">
          <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
            <Navigation className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">Bạn không có chuyến xe nào đang thực hiện.</p>
            <p className="text-sm">Hãy vào "Chuyến đi của tôi" để nhận chuyến.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px]">
          {/* Lộ trình chi tiết */}
          <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2">
            {deliveries.map(delivery => (
              <Card key={delivery.delivery_id} className="border-l-4 border-l-blue-500 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Chuyến #{delivery.delivery_id}</span>
                    <Badge className="bg-blue-600">ĐANG GIAO</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="relative border-l-2 border-dashed border-slate-200 ml-4 py-2 space-y-8">
                    {/* Bếp trung tâm */}
                    <div className="relative pl-8">
                      <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-green-500 ring-4 ring-white shadow-sm" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Xuất phát</span>
                        <span className="font-bold text-slate-800">Bếp Trung Tâm</span>
                        <span className="text-xs text-muted-foreground">Kho tổng hợp</span>
                      </div>
                    </div>

                    {/* Các điểm giao */}
                    {delivery.orders?.map((order, index) => (
                      <div 
                        key={order.order_id} 
                        className="relative pl-8 group cursor-pointer"
                        onClick={() => {
                          const pos = coords[order.store_name];
                          if (pos) setMapCenter([pos.lat, pos.lng]);
                        }}
                      >
                        <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-blue-500 ring-4 ring-white shadow-sm group-hover:scale-125 transition-transform" />
                        <div className="flex flex-col space-y-1">
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Điểm {index + 1}</span>
                          <span className="font-bold text-slate-800">{order.store_name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] font-normal">#{order.order_id}</Badge>
                            <span className="text-xs text-muted-foreground">{order.orderDetails?.length || 0} sản phẩm</span>
                          </div>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 text-blue-600 justify-start"
                            onClick={(e) => { e.stopPropagation(); openGoogleMaps(order.store_name); }}
                          >
                            <Navigation className="h-3 w-3 mr-1" /> Chỉ đường (G-Maps)
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Bản đồ */}
          <Card className="lg:col-span-2 overflow-hidden shadow-md border-slate-200 relative">
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              style={{ height: '100%', width: '100%', zIndex: 1 }}
              className="animate-in fade-in duration-500"
            >
              <ChangeView center={mapCenter} zoom={13} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Marker Bếp */}
              <Marker position={[kitchenPos.lat, kitchenPos.lng]} icon={kitchenIcon}>
                <Popup className="custom-popup">
                  <div className="p-1">
                    <p className="font-bold text-green-700">Bếp Trung Tâm</p>
                    <p className="text-xs">Điểm xuất phát chuyến hàng</p>
                  </div>
                </Popup>
              </Marker>

              {/* Markers Cửa hàng */}
              {Object.entries(coords).map(([name, pos]) => (
                name !== 'Bếp Trung Tâm' && (
                  <Marker 
                    key={name} 
                    position={[pos.lat, pos.lng]} 
                    icon={storeIcon}
                  >
                    <Popup>
                      <div className="p-1 space-y-1">
                        <p className="font-bold text-blue-700">{name}</p>
                        <p className="text-xs italic">{pos.display_name || 'Địa chỉ đang giao'}</p>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="w-full mt-2 h-7 text-[10px]"
                          onClick={() => openGoogleMaps(name)}
                        >
                          Mở Google Maps
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
            
            {/* Overlay gợi dẫn */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border text-xs space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="font-medium text-slate-700">Điểm xuất phát (Bếp)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="font-medium text-slate-700">Điểm giao hàng (Cửa hàng)</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Internal Badge component if not imported
function Badge({ children, className, variant = "default" }) {
  const variants = {
    default: "bg-slate-900 text-slate-50",
    secondary: "bg-slate-100 text-slate-900",
    outline: "border border-slate-200 text-slate-950",
    destructive: "bg-red-500 text-slate-50"
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}