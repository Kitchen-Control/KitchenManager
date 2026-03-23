import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, PackageCheck, ClipboardList, CheckCircle2, Package, RefreshCw, Truck, MapPin, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchOrders, getOrdersByStatus, getReceiptsByStatus, getReceiptsByOrderId, createReceipt, updateReceiptStatus, updateOrderStatus, getFefoSuggestion, confirmAllocation, getInventories, getOrderById } from '../../data/api';
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
  const [orderDetailsCache, setOrderDetailsCache] = useState({}); // { orderId: order_details[] }
  
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
      // 1. Fetch all orders and inventories
      const [allFetchedOrders, invData] = await Promise.all([
        fetchOrders().catch(() => []),
        getInventories().catch(() => []),
      ]);
      
      setInventories(invData || []);

      // 2. De-duplicate orders by ID
      const uniqueOrdersMap = new Map();
      (allFetchedOrders || []).forEach(o => {
        if (o && o.order_id) uniqueOrdersMap.set(o.order_id, o);
      });
      const relevantOrders = Array.from(uniqueOrdersMap.values()).sort((a, b) => b.order_id - a.order_id);
      setAllOrders(relevantOrders);

      // 3. Fetch receipts per relevant order (to avoid failing /status/DRAFT endpoint)
      console.log(`Mapping receipts for ${relevantOrders.length} orders...`);
      const receiptsPerOrder = await Promise.all(
        relevantOrders
          .filter(o => ['WAITING', 'PROCESSING', 'PICKING', 'PARTIAL_DELIVERED', 'DISPATCHED', 'DELIVERING'].includes(o.status))
          .map(async (o) => {
            try {
              const res = await getReceiptsByOrderId(o.order_id);
              const receipts = Array.isArray(res) ? res : [];
              if (receipts.length > 0) {
                console.log(`Order #${o.order_id} has ${receipts.length} receipts`);
              }
              return { orderId: o.order_id, receipts };
            } catch (e) {
              console.warn(`Error fetching receipts for order #${o.order_id}:`, e.message);
              return { orderId: o.order_id, receipts: [] };
            }
          })
      );

      const newOrderReceipts = {};
      receiptsPerOrder.forEach(({ orderId, receipts }) => {
        if (orderId) newOrderReceipts[orderId] = receipts;
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

  const toggleOrderDetails = async (order) => {
    if (expandedOrder === order.order_id) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(order.order_id);
      // Lazy-load order details if not already loaded or empty from list API
      const cached = orderDetailsCache[order.order_id];
      const hasDetails = (order.order_details || []).length > 0;
      if (!hasDetails && !cached) {
        try {
          const fullOrder = await getOrderById(order.order_id);
          if (fullOrder) {
            setOrderDetailsCache(prev => ({
              ...prev,
              [order.order_id]: fullOrder.order_details || []
            }));
          }
        } catch (e) {
          console.error('Lỗi tải chi tiết đơn:', e);
        }
      }
    }
  };

  const handleCreateReceipt = async (order) => {
    if (!confirm(`Tạo Phiếu Xuất Kho cho đơn hàng #${order.order_id}?\nPhiếu sẽ ở trạng thái DRAFT (Đang soạn).`)) return;
    setProcessingOrderId(order.order_id);
    try {
      const receipt = await createReceipt(order.order_id, `Phiếu xuất cho đơn #${order.order_id}`);
      
      // Update local state immediately for SNAPPY UI
      if (receipt) {
        setOrderReceipts(prev => ({
          ...prev,
          [order.order_id]: [...(prev[order.order_id] || []), receipt]
        }));
      }

      toast.success(`Đã tạo Phiếu Xuất #${receipt?.receipt_id || ''} dạng DRAFT.`);
      await fetchData(); 
      setActiveTab('draft'); // Move to Tab 3 automatically
    } catch (error) {
      toast.error('Lỗi tạo phiếu xuất: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleConfirmReceipt = async (receipt) => {
    if (!confirm(`Xác nhận xuất kho cho Phiếu #${receipt.receipt_id}?\nHành động này sẽ trừ tồn kho thực tế.`)) return;
    setProcessingOrderId(`receipt-${receipt.receipt_id}`);
    try {
      await updateReceiptStatus(receipt.receipt_id, 'COMPLETED');
      toast.success(`Đã xác nhận xuất kho cho Phiếu #${receipt.receipt_id}!`);
      await fetchData();
      setActiveTab('dispatched'); // Move to Tab 4 automatically
    } catch (error) {
      toast.error('Lỗi xác nhận xuất kho: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleCancelReceipt = async (receipt) => {
    if (!confirm(`Hủy Phiếu Xuất #${receipt.receipt_id}?`)) return;
    setProcessingOrderId(`receipt-${receipt.receipt_id}`);
    try {
      await updateReceiptStatus(receipt.receipt_id, 'CANCELED');
      toast.success('Đã hủy phiếu xuất.');
      await fetchData();
    } catch (error) {
      toast.error('Lỗi hủy phiếu: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleOpenAllocation = async (order) => {
    // Enrich order with cached or lazy-fetched details before opening modal
    let enrichedOrder = {
      ...order,
      order_details: (order.order_details || []).length > 0
        ? order.order_details
        : (orderDetailsCache[order.order_id] || [])
    };

    // If still empty, fetch now
    if (enrichedOrder.order_details.length === 0) {
      try {
        const fullOrder = await getOrderById(order.order_id);
        if (fullOrder) {
          enrichedOrder = { ...order, order_details: fullOrder.order_details || [] };
          setOrderDetailsCache(prev => ({ ...prev, [order.order_id]: fullOrder.order_details || [] }));
        }
      } catch (e) {
        console.error('Lỗi tải chi tiết đơn:', e);
      }
    }

    setAllocationModal({
      isOpen: true,
      order: enrichedOrder,
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
      // Flow 1 Step 2: DUYỆT ĐƠN -> confirmAllocation implicitly moves it to PROCESSING
      // We no longer call updateOrderStatus here to avoid 500 status conflicts/locks
      
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
      // Flow 1 Step 2: Trường hợp B - Từ chối đơn -> Update orders.status: WAITING -> CANCELED
      // Optionally attach 'reason' as comment if backend allows
      await updateOrderStatus(order.order_id, 'CANCELED', order.store_id);
      toast.success('Đã từ chối đơn hàng');
      await fetchData();
    } catch (error) {
      toast.error('Lỗi: ' + error.message);
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
    if (actionType === 'ready') return 'COMPLETED';
    if (actionType === 'completed') return 'DELIVERED/DONE';
    return status;
  };

  // 1. Duyệt đơn: Only WAITING
  const waitingConfirmationOrders = allOrders.filter(o => o.status === 'WAITING');

  // 2. Soạn hàng: PROCESSING but NO DRAFT receipts and NO COMPLETED receipts
  // (We want them to stay here until they have a receipt being worked on)
  const pickingOrders = allOrders.filter(o => {
    // Include PICKING status explicitly as mentioned by the user
    if (o.status !== 'PROCESSING' && o.status !== 'PARTIAL_DELIVERED' && o.status !== 'PICKING') return false;
    const receipts = orderReceipts[o.order_id] || [];
    // If it has a DRAFT or COMPLETED receipt, it moves to the next stages
    return !receipts.some(r => r.status === 'DRAFT' || r.status === 'COMPLETED');
  });

  // 3. Phiếu tạm: PROCESSING and HAS at least one DRAFT receipt
  const draftReceiptOrders = allOrders.filter(o => {
    const receipts = orderReceipts[o.order_id] || [];
    return receipts.some(r => r.status === 'DRAFT');
  });

  // 4. Xuất kho: HAS at least one COMPLETED receipt
  // or is already further in the flow
  const readyOrDoneOrders = allOrders.filter(o => {
    const receipts = orderReceipts[o.order_id] || [];
    const hasCompleted = receipts.some(r => r.status === 'COMPLETED');
    
    // We show it in 'Xuất kho' if it has completed (exported) receipts. 
    return hasCompleted || o.status === 'DISPATCHED' || o.status === 'DELIVERING' || o.status === 'DONE';
  });

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
                    {(() => {
                      // Use cache if order.order_details is empty (list API may omit them)
                      const effectiveDetails = (order.order_details || []).length > 0
                        ? order.order_details
                        : (orderDetailsCache[order.order_id] || []);
                      
                      if (effectiveDetails.length === 0) {
                        return <p className="text-sm text-muted-foreground italic">Đang tải sản phẩm...</p>;
                      }
                      
                      return effectiveDetails.map(detail => {
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
                      });})()}
                  </div>

                  <div className="pt-2">
                    {actionType === 'waiting' && (
                      <div className="flex gap-2 mt-4">
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
                      <Button onClick={(e) => { e.stopPropagation(); handleCreateReceipt(order); }} disabled={isProcessing} className="w-full bg-purple-600 hover:bg-purple-700">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                        Tạo Phiếu Xuất Kho (DRAFT)
                      </Button>
                    )}
                    {actionType === 'draft' && (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold border-b pb-1">Phiếu xuất liên quan (DRAFT):</p>
                        {(orderReceipts[order.order_id] || [])
                          .filter(r => r.status === 'DRAFT')
                          .map(receipt => (
                            <div key={receipt.receipt_id} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-700">Phiếu #{receipt.receipt_id}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{receipt.receipt_code}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={(e) => { e.stopPropagation(); handleCancelReceipt(receipt); }}
                                  disabled={String(processingOrderId).startsWith('receipt-')}
                                  className="text-red-500 border-red-100 h-8 text-xs"
                                >
                                  Hủy
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={(e) => { e.stopPropagation(); handleConfirmReceipt(receipt); }}
                                  disabled={String(processingOrderId).startsWith('receipt-')}
                                  className="bg-orange-600 hover:bg-orange-700 h-8 text-xs"
                                >
                                  {processingOrderId === `receipt-${receipt.receipt_id}` ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                  Xác nhận xuất kho (READY)
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                    {actionType === 'ready' && (
                      <div className="w-full p-2 bg-blue-50 text-blue-700 text-xs text-center rounded border border-blue-200 flex items-center justify-center gap-2 font-medium">
                        <Truck className="h-4 w-4" /> Đã sẵn sàng giao hàng (COMPLETED)
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
            2. Picking (Soạn hàng) {pickingOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700">{pickingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="draft" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            3. Draft (Phiếu tạm) {draftReceiptOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">{draftReceiptOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dispatched" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            4. Completed (Xuất kho) {readyOrDoneOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">{readyOrDoneOrders.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waiting" className="mt-0">
          {renderOrderList(waitingConfirmationOrders, 'waiting')}
        </TabsContent>
        <TabsContent value="picking" className="mt-0">
          {renderOrderList(pickingOrders, 'picking')}
        </TabsContent>
        <TabsContent value="draft" className="mt-0">
          {renderOrderList(draftReceiptOrders, 'draft')}
        </TabsContent>
        <TabsContent value="dispatched" className="mt-0">
          {renderOrderList(readyOrDoneOrders, 'ready')}
        </TabsContent>
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
                const isFulfilled = totalAllocated >= detail.quantity;

                return (
                  <div key={detail.order_detail_id} className={`border rounded-xl p-4 space-y-4 ${isFulfilled ? 'bg-green-50/30 border-green-100' : 'bg-slate-50/50'}`}>
                    <div className="flex justify-between items-center border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg text-slate-800">{detail.product_name}</span>
                        <Badge variant={isFulfilled ? "default" : "outline"} className={isFulfilled ? "bg-green-600 hover:bg-green-700" : "bg-white"}>
                          Đã chọn: {totalAllocated} / {detail.quantity}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 max-h-[250px] overflow-y-auto pr-2">
                      {availableBatches.length === 0 ? (
                        <p className="text-xs text-red-500 font-bold italic">⚠️ Hết hàng trong kho!</p>
                      ) : (
                        availableBatches.map(batch => {
                          const allocated = allocationModal.manualAllocations[detail.order_detail_id]?.[batch.batch_id] || 0;
                          return (
                            <div key={batch.batch_id} className={`flex items-center justify-between p-3 rounded-lg border shadow-sm transition-all ${allocated > 0 ? 'bg-green-50 border-green-200 ring-1 ring-green-200' : 'bg-white'}`}>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">Lô #{batch.batch_id}</span>
                                <span className="text-[10px] text-muted-foreground uppercase font-black">HSD: {batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString('vi-VN') : 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground font-medium">Lấy:</span>
                                  <Input 
                                    type="number" 
                                    min="0"
                                    max={batch.quantity}
                                    className={`w-20 h-8 text-right font-bold ${allocated > 0 ? 'text-green-700 border-green-300' : ''}`}
                                    placeholder="0"
                                    value={allocated || ''} 
                                    onChange={(e) => handleUpdateManualAllocation(detail.order_detail_id, batch.batch_id, e.target.value, batch.quantity)}
                                  />
                                </div>
                                <div className="text-right flex flex-col min-w-[3rem]">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tồn:</span>
                                  <span className="text-sm font-black">{batch.quantity} {detail.unit || 'SP'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
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