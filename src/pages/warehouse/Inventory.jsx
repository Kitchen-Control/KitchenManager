import React, { useState, useEffect } from 'react';
import { getInventories, getProducts } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Loader2, Package, AlertTriangle, RefreshCw, History, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Inventory() {
  const navigate = useNavigate();
  const [inventories, setInventories] = useState([]);
  const [filteredInventories, setFilteredInventories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');

  const PRODUCT_TYPES = [
    { value: 'ALL', label: 'Tất cả loại' },
    { value: 'RAW_MATERIAL', label: 'Nguyên vật liệu' },
    { value: 'MAIN', label: 'Món chính' },
    { value: 'SIDE', label: 'Món ăn kèm' },
    { value: 'BEVERAGE', label: 'Đồ uống' },
    { value: 'DESSERT', label: 'Tráng miệng' },
    { value: 'SAUCE', label: 'Nước sốt' },
  ];

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const [inventoryData, productsData] = await Promise.all([
        getInventories(),
        getProducts()
      ]);

      // Create a lookup map for products indexed by name (since ID might be missing in inventory)
      const productMap = {};
      (productsData || []).forEach(p => {
        if (p.product_name) productMap[p.product_name.trim().toLowerCase()] = p;
      });

      // Enrich inventory with product details
      const enriched = (inventoryData || []).map(inv => {
        const nameKey = String(inv.product_name || '').trim().toLowerCase();
        const productInfo = productMap[nameKey];
        
        return {
          ...inv,
          // If ID or Type is missing, take from the products list
          product_id: inv.product_id || productInfo?.product_id || 'N/A',
          product_type: inv.product_type || productInfo?.product_type || 'N/A'
        };
      });

      const sorted = enriched.sort((a, b) => b.inventory_id - a.inventory_id);
      console.log('📦 Enriched Inventory:', sorted.slice(0, 5));
      setInventories(sorted);
      setFilteredInventories(sorted);
    } catch (error) {
      toast.error('Không thể tải dữ liệu tồn kho: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    console.log('🔍 Filtering by:', filterType);
    if (filterType === 'ALL') {
      setFilteredInventories(inventories);
    } else {
      const results = inventories.filter(item => {
        const type = String(item.product_type || '').trim().toUpperCase();
        const target = String(filterType).toUpperCase();
        return type === target;
      });
      console.log(`✅ Filtered results (${filterType}):`, results.length);
      setFilteredInventories(results);
    }
  }, [filterType, inventories]);

  const getExpiryStatus = (dateString) => {
    const expiry = new Date(dateString);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { color: 'text-red-600 bg-red-50', label: 'Đã hết hạn' };
    if (diffDays <= 3) return { color: 'text-orange-600 bg-orange-50', label: 'Sắp hết hạn' };
    return { color: 'text-green-600 bg-green-50', label: 'Còn hạn' };
  };

  const getTypeColor = (type) => {
    const t = String(type || '').toUpperCase();
    if (t === 'RAW_MATERIAL') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (t === 'MAIN') return 'bg-green-100 text-green-700 border-green-200';
    if (t === 'SIDE') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (t === 'BEVERAGE') return 'bg-purple-100 text-purple-700 border-purple-200';
    if (t === 'DESSERT') return 'bg-pink-100 text-pink-700 border-pink-200';
    if (t === 'SAUCE') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Quản lý Tồn kho</h1>
          <p className="text-muted-foreground">Theo dõi số lượng và hạn sử dụng nguyên vật liệu.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Lọc theo loại" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => navigate('/warehouse/inventory-history')} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
            <History className="mr-2 h-4 w-4" /> Lịch sử Nhập/Xuất
          </Button>
          <Button onClick={fetchInventory} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Làm mới
          </Button>
        </div>
      </div>

      <div key={filterType} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredInventories.map((item) => {
          const status = getExpiryStatus(item.expiry_date);
          return (
            <Card key={item.inventory_id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex flex-col">
                  <CardTitle className="text-sm font-medium leading-none">
                    {item.product_name}
                  </CardTitle>
                  <div className="flex gap-1 mt-2">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">#{item.product_id}</Badge>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-semibold ${getTypeColor(item.product_type)}`}>
                      {item.product_type || 'N/A'}
                    </Badge>
                  </div>
                </div>
                <Package className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.quantity} <span className="text-sm font-normal text-muted-foreground">đơn vị</span></div>
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Lô hàng:</span>
                    <span className="font-mono">{item.batch?.batchId || item.batch || 'N/A'}</span>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full w-fit flex items-center gap-1 ${status.color}`}>
                    {status.label === 'Đã hết hạn' && <AlertTriangle className="h-3 w-3" />}
                    {status.label === 'Sắp hết hạn' && <AlertTriangle className="h-3 w-3" />}
                    <span>HSD: {item.expiry_date ? (() => {
                      const d = new Date(item.expiry_date);
                      if (!item.expiry_date.includes('+07:00') && !item.expiry_date.includes('Z')) d.setHours(d.getHours() + 7);
                      return format(d, 'dd/MM/yyyy');
                    })() : 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {filteredInventories.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Không tìm thấy sản phẩm nào trong kho với điều kiện lọc này.
          </div>
        )}
      </div>
    </div>
  );
}