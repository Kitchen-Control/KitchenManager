import React, { useState, useEffect, useCallback } from 'react';
import { getOrdersByStatus, getOrderDetailFillsByOrderDetailId, getReceiptsByOrderId, createReceipt, confirmReceipt, updateOrderStatus } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Loader2, PackageCheck, ClipboardList, CheckCircle2, ChevronDown, ChevronUp, Package, RefreshCw, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';

export default function WarehouseOutbound() {
  const [allOrders, setAllOrders] = useState([]);
  const [orderReceipts, setOrderReceipts] = useState({});
  const [orderFills, setOrderFills] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('picking');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [checkedOrders, setCheckedOrders] = useState({}); // { orderId: boolean }

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setCheckedOrders({});
    try {
      const [pOrders, delOrders, doneOrders, damagedOrders, canceledOrders] = await Promise.all([
        getOrdersByStatus('PROCESSING').catch(() => []),
        getOrdersByStatus('DELIVERING').catch(() => []),
        getOrdersByStatus('DONE').catch(() => []),
        getOrdersByStatus('DAMAGED').catch(() => []),
        getOrdersByStatus('CANCLED').catch(() => []),
      ]);

      const relevantOrders = [...pOrders, ...delOrders, ...doneOrders, ...damagedOrders, ...canceledOrders]
        .sort((a, b) => b.order_id - a.order_id);
      setAllOrders(relevantOrders);

      const newOrderReceipts = {};
      const receiptPromises = relevantOrders.map(o => 
        getReceiptsByOrderId(o.order_id).then(res => {
          if (Array.isArray(res)) {
            newOrderReceipts[o.order_id] = res;
          }
        }).catch(() => {})
      );

      await Promise.all(receiptPromises);
      setOrderReceipts(newOrderReceipts);

      // Fetch all fills for PROCESSING orders to calculate batches upfront
      const newFills = {};
      const fillPromises = [];
      relevantOrders.forEach(o => {
        if (o.status === 'PROCESSING') {
          (o.order_details || []).forEach(detail => {
            fillPromises.push(
              getOrderDetailFillsByOrderDetailId(detail.order_detail_id).then(fills => {
                if (Array.isArray(fills)) {
                  newFills[detail.order_detail_id] = fills;
                }
              }).catch(() => {})
            );
          });
        }
      });
      await Promise.all(fillPromises);
      setOrderFills(newFills);

    } catch (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleOrderDetails = (order) => {
    if (expandedOrder === order.order_id) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(order.order_id);
    }
  };

  const handleCreateReceipt = async (order) => {
    if (!confirm(`Tạo Phiếu Xuất Kho cho đơn hàng #${order.order_id}?`)) return;
    setProcessingOrderId(order.order_id);
    try {
      const receipt = await createReceipt(order.order_id, `Phiếu xuất cho đơn #${order.order_id}`);
      toast.success(`Đã tạo Phiếu Xuất #${receipt?.receipt_id || ''} (DRAFT)`);
      await fetchData(); // Refresh entirely to move items properly
    } catch (error) {
      toast.error('Lỗi tạo phiếu xuất: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleConfirmReceipt = async (order, receipt) => {
    if (!confirm(`Xác nhận Hoàn tất Xuất kho cho Phiếu #${receipt.receipt_id}?\nHành động này sẽ trừ kho thực tế.`)) return;
    setProcessingOrderId(order.order_id);
    try {
      await confirmReceipt(receipt.receipt_id);
      toast.success('Xuất kho hoàn tất! Đơn đã chuyển sang trạng thái COMPLETED receipts.');
      await fetchData();
    } catch (error) {
      toast.error('Lỗi xác nhận xuất kho: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleDispatchOrder = async (order) => {
    if (!confirm(`Đánh dấu đơn hàng #${order.order_id} đã ĐIỀU PHỐI (DISPATCHED)?\nShipper sẽ thấy đơn hàng này để Nhận và Giao.`)) return;
    setProcessingOrderId(order.order_id);
    try {
      await updateOrderStatus(order.order_id, 'DELIVERING');
      toast.success('Đơn hàng đã được xuất kho và chuyển cho Shipper (DELIVERING).');
      await fetchData();
    } catch (error) {
      toast.error('Lỗi điều phối đơn hàng: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const toggleOrderChecked = (e, orderId) => {
    e.stopPropagation();
    setCheckedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const getDisplayStatusText = (status, actionType) => {
    if (actionType === 'picking') return 'PROCESSING';
    if (actionType === 'draft') return 'DRAFT';
    if (actionType === 'completed') return 'COMPLETED';
    if (actionType === 'dispatched') {
      if (status === 'DELIVERING') return 'DISPATCHED';
      return status; 
    }
    return status;
  };

  // derived data
  const pickingOrders = allOrders.filter(o => o.status === 'PROCESSING' && !(orderReceipts[o.order_id] || []).length);
  const draftOrders = allOrders.filter(o => o.status === 'PROCESSING' && (orderReceipts[o.order_id] || []).some(r => r.status === 'DRAFT') && !(orderReceipts[o.order_id] || []).some(r => r.status === 'COMPLETED'));
  const completedOrders = allOrders.filter(o => o.status === 'PROCESSING' && (orderReceipts[o.order_id] || []).some(r => r.status === 'COMPLETED'));
  const dispatchedOrders = allOrders.filter(o => ['DELIVERING', 'DONE', 'DAMAGED', 'CANCLED'].includes(o.status));

  const renderOrderList = (orders, actionType) => {
    if (orders.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-dashed text-muted-foreground">
          <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Không có đơn hàng nào trong mục này</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {orders.map(order => {
          const isExpanded = expandedOrder === order.order_id;
          const isProcessing = processingOrderId === order.order_id;

          return (
            <Card key={order.order_id} className="border-l-4 border-l-purple-400">
              <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50" onClick={() => toggleOrderDetails(order)}>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    {actionType === 'draft' && (
                      <div className="pt-1">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-yellow-600 rounded cursor-pointer" 
                          checked={!!checkedOrders[order.order_id]} 
                          onChange={(e) => toggleOrderChecked(e, order.order_id)} 
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        Đơn hàng #{order.order_id}
                      </CardTitle>
                      <CardDescription>Cửa hàng: {order.store_name} &bull; Trạng thái: {getDisplayStatusText(order.status, actionType)}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-4 animate-in fade-in slide-in-from-top-1">
                  <div className="space-y-2 bg-gray-50/50 p-3 rounded border">
                    <p className="font-semibold text-sm mb-2">Chi tiết sản phẩm (không hiển thị lô ở đây):</p>
                    {(order.order_details || []).map(detail => (
                      <div key={detail.order_detail_id} className="flex justify-between items-center text-sm border-b pb-1 last:border-0 last:pb-0">
                        <span>{detail.product_name}</span>
                        <Badge variant="secondary">S.L: {detail.quantity}</Badge>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    {actionType === 'picking' && (
                      <Button onClick={(e) => { e.stopPropagation(); handleCreateReceipt(order); }} disabled={isProcessing} className="w-full bg-purple-600">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                        Tạo Phiếu Xuất Kho
                      </Button>
                    )}
                    {actionType === 'draft' && (
                      <Button onClick={(e) => { 
                          e.stopPropagation();
                          const r = orderReceipts[order.order_id].find(r => r.status === 'DRAFT');
                          if(r) handleConfirmReceipt(order, r);
                      }} disabled={isProcessing} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                        Xác nhận xuất kho
                      </Button>
                    )}
                    {actionType === 'completed' && (
                      <Button onClick={(e) => { e.stopPropagation(); handleDispatchOrder(order); }} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Hoàn tất Xuất kho
                      </Button>
                    )}
                    {actionType === 'dispatched' && (
                      <div className="w-full p-2 bg-blue-50 text-blue-700 text-xs text-center rounded border border-blue-200 flex items-center justify-center gap-2 font-medium">
                        <Truck className="h-4 w-4" /> Đã điều phối tới Shipper
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  const renderPickingBatches = () => {
    // Only calculate for orders that are CHECKED in the DRAFT tab
    const selectedOrders = draftOrders.filter(o => checkedOrders[o.order_id]);
    if (selectedOrders.length === 0) return null;

    const batchSummary = {};
    selectedOrders.forEach(order => {
      (order.order_details || []).forEach(detail => {
        const fills = orderFills[detail.order_detail_id] || [];
        fills.forEach(fill => {
          if (!batchSummary[fill.batch_id]) {
            batchSummary[fill.batch_id] = {
              batch_id: fill.batch_id,
              product_name: detail.product_name,
              total_quantity: 0
            };
          }
          batchSummary[fill.batch_id].total_quantity += fill.quantity;
        });
        // If there are no fills yet, we might optionally want to show missing batches,
        // but since warehouse selects orders TO get batches, we'll just show what's there.
      });
    });

    const batchList = Object.values(batchSummary);
    if (batchList.length === 0) return (
      <Card className="mb-6 border-purple-200 bg-purple-50/30">
        <CardContent className="p-4 text-sm italic text-muted-foreground">
          Các đơn hàng đã chọn chưa có phân bổ Lô từ hệ thống.
        </CardContent>
      </Card>
    );

    return (
      <Card className="mb-6 border-purple-200 bg-purple-50/30 shadow-sm animate-in fade-in slide-in-from-top-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            Tổng kiểm kê Lô cần xuất (Dựa trên đơn đã chọn)
          </CardTitle>
          <CardDescription>Số lượng tổng hợp để đi nhặt hàng một lần</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {batchList.map(batch => (
              <div key={batch.batch_id} className="flex items-center gap-3 p-3 border rounded-lg bg-white shadow-sm">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{batch.product_name}</p>
                  <p className="text-xs text-muted-foreground">Lô #{batch.batch_id}</p>
                </div>
                <div className="text-right">
                  <Badge className="bg-purple-600 text-sm px-2 py-1">{batch.total_quantity}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5">tổng</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading && allOrders.length === 0) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Quản lý Xuất kho</h1>
          <p className="text-muted-foreground text-sm mt-1">Luồng trạng thái: Soạn hàng ➔ Draft ➔ Completed ➔ Dispatched</p>
        </div>
        <Button variant="outline" onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> Làm mới</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full md:w-auto h-auto min-h-[40px] mb-6 p-1 bg-slate-100 rounded-lg">
          <TabsTrigger value="picking" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            1. Soạn hàng {pickingOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700">{pickingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="draft" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            2. Draft {draftOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-700">{draftOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="completed" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            3. Completed {completedOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">{completedOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dispatched" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            4. Dispatched {dispatchedOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">{dispatchedOrders.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="picking" className="mt-0">
          {renderOrderList(pickingOrders, 'picking')}
        </TabsContent>
        <TabsContent value="draft" className="mt-0">
          {renderPickingBatches()}
          {renderOrderList(draftOrders, 'draft')}
        </TabsContent>
        <TabsContent value="completed" className="mt-0">{renderOrderList(completedOrders, 'completed')}</TabsContent>
        <TabsContent value="dispatched" className="mt-0">{renderOrderList(dispatchedOrders, 'dispatched')}</TabsContent>
      </Tabs>
    </div>
  );
}