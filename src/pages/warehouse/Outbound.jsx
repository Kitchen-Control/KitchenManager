import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, PackageCheck, ClipboardList, CheckCircle2, Package, RefreshCw, Truck, MapPin, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { getOrdersByStatus, getReceiptsByStatus, createReceipt, updateReceiptStatus, updateOrderStatus, completeOrder, getFefoSuggestion, confirmAllocation, getInventories } from '../../data/api';
import { toast } from 'sonner';

export default function WarehouseOutbound() {
  const [allOrders, setAllOrders] = useState([]);
  const [orderReceipts, setOrderReceipts] = useState({});
  const [orderFills, setOrderFills] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('picking');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [checkedOrders, setCheckedOrders] = useState({}); // { orderId: boolean }
  const [inventories, setInventories] = useState([]);
  
  // Allocation Modal State
  const [allocationModal, setAllocationModal] = useState({
    isOpen: false,
    order: null,
    suggestions: [],
    manualAllocations: {}, // { orderDetailId: { batchId: quantity } }
    isLoading: false,
    isSubmitting: false
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setCheckedOrders({});
    try {
      // 1. Fetch all orders by status in parallel
      const [pOrders, wOrders, dispOrders, delOrders, doneOrders, damagedOrders, canceledOrders, invData] = await Promise.all([
        getOrdersByStatus('PROCESSING').catch(() => []),
        getOrdersByStatus('WAITING').catch(() => []),
        getOrdersByStatus('DISPATCHED').catch(() => []),
        getOrdersByStatus('DELIVERING').catch(() => []),
        getOrdersByStatus('DONE').catch(() => []),
        getOrdersByStatus('DAMAGED').catch(() => []),
        getOrdersByStatus('CANCELED').catch(() => []), // Fixed typo
        getInventories().catch(() => []),
      ]);
      
      setInventories(invData || []);

      // 2. Combine and De-duplicate orders by ID
      // Order of addition matters: WAITING first, then others will OVERWRITE it if same ID exists
      const allFetchedOrders = [
        ...canceledOrders,
        ...damagedOrders,
        ...doneOrders,
        ...delOrders,
        ...wOrders,
        ...pOrders,
        ...dispOrders
      ];
      const uniqueOrdersMap = new Map();
      allFetchedOrders.forEach(o => {
        if (o && o.order_id) {
          uniqueOrdersMap.set(o.order_id, o);
        }
      });
      const relevantOrders = Array.from(uniqueOrdersMap.values()).sort((a, b) => b.order_id - a.order_id);
      setAllOrders(relevantOrders);

      // 3. Fetch receipts in BULK by status instead of N parallel calls
      const [draftReceipts, completedReceipts] = await Promise.all([
        getReceiptsByStatus('DRAFT').catch(() => []),
        getReceiptsByStatus('COMPLETED').catch(() => []),
      ]);

      const newOrderReceipts = {};
      const allRelevantReceipts = [...draftReceipts, ...completedReceipts];
      allRelevantReceipts.forEach(r => {
        if (r.order_id) {
          if (!newOrderReceipts[r.order_id]) newOrderReceipts[r.order_id] = [];
          newOrderReceipts[r.order_id].push(r);
        }
      });
      setOrderReceipts(newOrderReceipts);

      // 4. Process fills from nested order_details
      const newFills = {};
      relevantOrders.forEach(o => {
        (o.order_details || []).forEach(detail => {
          if (Array.isArray(detail.order_detail_fills) && detail.order_detail_fills.length > 0) {
            newFills[detail.order_detail_id] = detail.order_detail_fills;
          }
        });
      });
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
    if (!confirm(`Xác nhận Hoàn tất Xuất kho cho Phiếu #${receipt.receipt_id}?\nHành động này sẽ cập nhật trạng thái phiếu và trừ kho.`)) return;
    setProcessingOrderId(order.order_id);
    try {
      await updateReceiptStatus(receipt.receipt_id, 'COMPLETED');
      toast.success('Xác nhận xuất kho thành công!');
      await fetchData();
    } catch (error) {
      toast.error('Lỗi xác nhận xuất kho: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleConfirmReceipts = async () => {
    const selectedIds = Object.keys(checkedOrders)
      .filter(id => checkedOrders[id])
      .map(id => {
        const r = (orderReceipts[id] || []).find(receipt => receipt.status === 'DRAFT');
        return r ? r.receipt_id : null;
      })
      .filter(Boolean);

    if (selectedIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một đơn có Phiếu Draft');
      return;
    }

    if (!confirm(`Xác nhận Xuất kho cho ${selectedIds.length} phiếu đã chọn?`)) return;

    setIsLoading(true);
    try {
      await updateReceiptStatus(selectedIds, 'COMPLETED');
      toast.success(`Đã xác nhận xuất kho thành công cho ${selectedIds.length} đơn.`);
      setCheckedOrders({});
      await fetchData();
    } catch (error) {
      toast.error('Lỗi xác nhận xuất kho hàng loạt: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatchOrder = async (order) => {
    if (!confirm(`Đánh dấu đơn hàng #${order.order_id} SẴN SÀNG BÀN GIAO?\nShipper sẽ thấy đơn hàng này để Nhận và Giao.`)) return;
    setProcessingOrderId(order.order_id);
    try {
      await updateOrderStatus(order.order_id, 'DISPATCHED', order.store_id);
      toast.success('Đơn hàng đã sẵn sàng bàn giao cho Shipper.');
      await fetchData();
    } catch (error) {
      toast.error('Lỗi cập nhật: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleOpenAllocation = async (order) => {
    setAllocationModal({
      isOpen: true,
      order,
      suggestions: [],
      manualAllocations: {},
      isLoading: true,
      isSubmitting: false
    });
    
    try {
      const fefoData = await getFefoSuggestion(order.order_id);
      // Backend returns FefoSuggestionResponse: { productSuggestions: [...] }
      const suggestions = fefoData?.productSuggestions || [];
      
      const initialAllocations = {};
      suggestions.forEach(prod => {
        if (!initialAllocations[prod.orderDetailId]) {
          initialAllocations[prod.orderDetailId] = {};
        }
        (prod.batchSuggestions || []).forEach(batch => {
          if (batch.suggestedQuantityToPick > 0) {
            initialAllocations[prod.orderDetailId][batch.batchId] = batch.suggestedQuantityToPick;
          }
        });
      });
      
      setAllocationModal(prev => ({
        ...prev,
        suggestions: suggestions,
        manualAllocations: initialAllocations,
        isLoading: false
      }));
    } catch (error) {
      toast.error('Lỗi lấy gợi ý FEFO: ' + error.message);
      setAllocationModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleConfirmAllocation = async () => {
    const { order, manualAllocations } = allocationModal;
    const finalAllocations = [];
    
    // Map manualAllocations to [{ orderDetailId, batchPicks: [{batchId, quantity}] }]
    Object.keys(manualAllocations).forEach(detailId => {
      const batchPicks = [];
      Object.keys(manualAllocations[detailId]).forEach(batchId => {
        if (manualAllocations[detailId][batchId] > 0) {
          batchPicks.push({
            batchId: parseInt(batchId),
            quantity: manualAllocations[detailId][batchId]
          });
        }
      });
      if (batchPicks.length > 0) {
        finalAllocations.push({
          orderDetailId: parseInt(detailId),
          batchPicks
        });
      }
    });

    if (finalAllocations.length === 0) {
      toast.error('Vui lòng phân bổ ít nhất 1 sản phẩm');
      return;
    }

    setAllocationModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await confirmAllocation(order.order_id, finalAllocations);
      toast.success('Duyệt đơn và phân bổ hàng thành công!');
      setAllocationModal(prev => ({ ...prev, isOpen: false }));
      await fetchData();
    } catch (error) {
      toast.error('Lỗi duyệt đơn: ' + error.message);
    } finally {
      setAllocationModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleUpdateManualAllocation = (detailId, batchId, quantity, maxQty) => {
    const qty = Math.min(maxQty, Math.max(0, parseInt(quantity) || 0));
    setAllocationModal(prev => ({
      ...prev,
      manualAllocations: {
        ...prev.manualAllocations,
        [detailId]: {
          ...(prev.manualAllocations[detailId] || {}),
          [batchId]: qty
        }
      }
    }));
  };

  const handleRejectOrder = async (order) => {
    const reason = prompt('Lý do từ chối đơn hàng?');
    if (reason === null) return;
    
    setProcessingOrderId(order.order_id);
    try {
      await updateOrderStatus(order.order_id, 'CANCELED', order.store_id);
      toast.success('Đã từ chối đơn hàng');
      await fetchData();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleCompleteOrder = async (order) => {
    if (!confirm(`Xác nhận HOÀN TẤT XUẤT KHO cho đơn #${order.order_id}?\nĐơn hàng sẽ được chuyển vào mục Lịch sử.`)) return;
    setProcessingOrderId(order.order_id);
    try {
      await completeOrder(order.order_id);
      toast.success('Xuất kho hoàn tất thành công!');
      await fetchData();
    } catch (error) {
      toast.error('Lỗi hoàn tất xuất kho: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const toggleOrderChecked = (e, orderId) => {
    e.stopPropagation();
    setCheckedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleToggleSelectAll = () => {
    const allSelected = draftOrders.length > 0 && draftOrders.every(o => !!checkedOrders[o.order_id]);
    const newChecked = { ...checkedOrders };
    draftOrders.forEach(o => {
      newChecked[o.order_id] = !allSelected;
    });
    setCheckedOrders(newChecked);
  };

  const getDisplayStatusText = (status, actionType) => {
    if (actionType === 'picking') return 'PROCESSING';
    if (actionType === 'draft') return 'DRAFT';
    if (actionType === 'completed') return 'COMPLETED';
    if (actionType === 'dispatched') {
      return status;
    }
    return status;
  };

  // derived data
  const waitingConfirmationOrders = allOrders.filter(o => o.status === 'WAITING');

  const pickingOrders = allOrders.filter(o =>
    o.status === 'PROCESSING' &&
    (!orderReceipts[o.order_id] || !orderReceipts[o.order_id].some(r => r.status === 'DRAFT'))
  );

  const draftOrders = allOrders.filter(o =>
    (orderReceipts[o.order_id] || []).some(r => r.status === 'DRAFT')
  );

  const dispatchedOrders = allOrders.filter(o =>
    o.status === 'DISPATCHED' ||
    (orderReceipts[o.order_id] || []).some(r => r.status === 'COMPLETED')
  );

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
                    <p className="font-semibold text-sm mb-2">{actionType === 'picking' ? 'Danh mục gắp hàng (Picking Guide):' : 'Chi tiết sản phẩm:'}</p>
                    {(order.order_details || []).map(detail => {
                      const fills = orderFills[detail.order_detail_id] || [];
                      return (
                        <div key={detail.order_detail_id} className="border-b pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span className="font-medium text-slate-700">{detail.product_name}</span>
                            <Badge variant="secondary">Tổng S.L: {detail.quantity}</Badge>
                          </div>
                          {actionType === 'picking' && (
                            <div className="pl-4 space-y-1">
                              {fills.length > 0 ? (
                                fills.map(fill => (
                                  <div key={fill.fill_id} className="flex justify-between text-[11px] text-purple-700 bg-purple-50 p-1 rounded px-2">
                                    <span>Lô #{fill.batch_id}</span>
                                    <span className="font-bold">Nhặt: {fill.quantity}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[10px] text-muted-foreground italic">Đang tải thông tin phân bổ lô...</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    {actionType === 'waiting' && (
                      <div className="flex gap-2">
                        <Button onClick={(e) => { e.stopPropagation(); handleOpenAllocation(order); }} disabled={isProcessing} className="flex-1 bg-green-600 hover:bg-green-700">
                          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                          Duyệt đơn
                        </Button>
                        <Button onClick={(e) => { e.stopPropagation(); handleRejectOrder(order); }} disabled={isProcessing} variant="outline" className="text-red-600 border-red-200">
                          Từ chối
                        </Button>
                      </div>
                    )}
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
                        if (r) handleConfirmReceipt(order, r);
                      }} disabled={isProcessing} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                        Xác nhận xuất kho
                      </Button>
                    )}
                    {actionType === 'completed' && (
                      <div className="w-full p-2 bg-blue-50 text-blue-700 text-xs text-center rounded border border-blue-200 flex items-center justify-center gap-2 font-medium">
                        <Truck className="h-4 w-4" /> Đã hoàn tất xuất kho
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
          <p className="text-muted-foreground text-sm mt-1">Luồng trạng thái: Duyệt đơn ➔ Soạn hàng ➔ Phiếu tạm ➔ Xuất kho</p>
        </div>
        <Button variant="outline" onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> Làm mới</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-full h-auto min-h-[40px] mb-6 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          <TabsTrigger value="waiting" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            1. Duyệt đơn {waitingConfirmationOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">{waitingConfirmationOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="picking" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            2. Soạn hàng {pickingOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700">{pickingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="draft" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            3. Phiếu tạm {draftOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-700">{draftOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dispatched" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            4. Xuất kho {dispatchedOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">{dispatchedOrders.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waiting" className="mt-0">
          {renderOrderList(waitingConfirmationOrders, 'waiting')}
        </TabsContent>
        <TabsContent value="picking" className="mt-0">
          {renderOrderList(pickingOrders, 'picking')}
        </TabsContent>
        <TabsContent value="draft" className="mt-0">
          {renderPickingBatches()}

          {draftOrders.length > 0 && (
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground italic">
                {Object.values(checkedOrders).filter(Boolean).length} đơn đã chọn
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleSelectAll}
                  className="text-purple-700 border-purple-200 hover:bg-purple-50"
                >
                  {draftOrders.every(o => !!checkedOrders[o.order_id]) ? 'Bỏ chọn tất cả' : 'Chọn tất cả đơn hàng'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmReceipts}
                  disabled={isLoading || Object.values(checkedOrders).filter(Boolean).length === 0}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Xác nhận xuất kho hàng loạt
                </Button>
              </div>
            </div>
          )}

          {renderOrderList(draftOrders, 'draft')}
        </TabsContent>
        <TabsContent value="dispatched" className="mt-0">{renderOrderList(dispatchedOrders, 'completed')}</TabsContent>
      </Tabs>
      <Dialog open={allocationModal.isOpen} onOpenChange={(open) => setAllocationModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-green-700">
              <PackageCheck className="h-6 w-6" />
              Duyệt Đơn Hàng (#{allocationModal.order?.order_id})
            </DialogTitle>
            <DialogDescription>
              Kiểm tra thông tin sản phẩm và xác nhận duyệt đơn hàng.
            </DialogDescription>
          </DialogHeader>

          {allocationModal.isLoading ? (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-green-600" />
              <p className="text-sm font-medium animate-pulse">Đang lấy gợi ý FEFO từ hệ thống...</p>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {(allocationModal.order?.order_details || []).map(detail => {
                // Robust matching: Try ID first, then Name fallback because OpenAPI spec for InventoryResponse is missing productId
                const availableBatches = inventories.filter(inv => {
                  const idMatch = inv.product_id && detail.product_id && String(inv.product_id) === String(detail.product_id);
                  const nameMatch = inv.product_name && detail.product_name && 
                                   inv.product_name.trim().toLowerCase() === detail.product_name.trim().toLowerCase();
                  return idMatch || nameMatch;
                }).filter(inv => inv.quantity > 0);
                
                const currentAllocation = allocationModal.manualAllocations[detail.order_detail_id] || {};
                const totalAllocated = Object.values(currentAllocation).reduce((a, b) => a + b, 0);

                return (
                  <div key={detail.order_detail_id} className="border rounded-xl p-4 bg-slate-50/50 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg text-slate-800">{detail.product_name}</span>
                        <Badge variant="outline" className="bg-white">Yêu cầu: {detail.quantity}</Badge>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {availableBatches.length === 0 ? (
                        <p className="text-xs text-red-500 font-bold italic">⚠️ Hết hàng trong kho!</p>
                      ) : (
                        availableBatches.map(batch => (
                          <div key={batch.batch_id} className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">Lô #{batch.batch_id}</span>
                              <span className="text-[10px] text-muted-foreground uppercase font-black">HSD: {batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString('vi-VN') : 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Tồn:</span>
                                <span className="text-sm font-black">{batch.quantity} {detail.unit || 'SP'}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="bg-slate-50 p-4 -mx-6 -mb-6 sticky bottom-0 border-t rounded-b-xl">
            <Button variant="ghost" onClick={() => setAllocationModal(prev => ({ ...prev, isOpen: false }))}>Đóng</Button>
            <Button 
              onClick={handleConfirmAllocation} 
              disabled={allocationModal.isSubmitting || allocationModal.isLoading} 
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              {allocationModal.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Xác nhận Duyệt đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}