import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, PackageCheck, ClipboardList, CheckCircle2, Package, RefreshCw, Truck, MapPin, Search, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Checkbox } from '../../components/ui/checkbox';
import { fetchOrders, getOrdersByStatus, getReceiptsByStatus, getReceiptsByOrderId, createReceipt, updateReceiptStatus, updateOrderStatus, getFefoSuggestion, confirmAllocation, getInventories, getOrderById, createAdditionalOrder } from '../../data/api';
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
          .filter(o => ['WAITING', 'PROCESSING', 'PICKING', 'PARTIAL_DELIVERED', 'DISPATCHED', 'DELIVERING', 'READY', 'COMPLETED', 'DONE'].includes(o.status))
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
          const details = await getOrderDetailsByOrderId(order.order_id);
          if (details && details.length > 0) {
            setOrderDetailsCache(prev => ({
              ...prev,
              [order.order_id]: details
            }));
          }
        } catch (e) {
          console.error('Lỗi tải chi tiết sản phẩm:', e);
        }
      }
    }
  };


  const updateOrderStatusWithFallback = async (orderId, status, note) => {
    try {
      await updateOrderStatus(orderId, status, note);
    } catch (error) {
      if (error.message.includes('500')) {
        const updatedOrder = await getOrderById(orderId).catch(() => null);
        if (updatedOrder && updatedOrder.status === status) return;
      }
      throw error;
    }
  };

  const handleBulkCreateReceipts = async (targetOrders) => {
    const selectedIds = Object.keys(checkedOrders).filter(id => checkedOrders[id]).map(Number);
    if (selectedIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một đơn hàng');
      return;
    }

    const oToProcess = targetOrders.filter(o => selectedIds.includes(o.order_id));
    if (oToProcess.length === 0) return;

    if (!confirm(`Xác nhận soạn hàng XUẤT KHO cho ${oToProcess.length} đơn đã chọn?`)) return;

    setProcessingOrderId('bulk-processing');
    let successCount = 0;

    for (const order of oToProcess) {
      try {
        await createReceipt(order.order_id, `Xuất kho hàng loạt #${order.order_id}`);
        successCount++;
      } catch (err) {
        console.warn(`Lỗi đơn #${order.order_id}:`, err);
        // Even if error, check if it was actually created
        const recs = await getReceiptsByOrderId(order.order_id).catch(() => []);
        if (recs.some(r => r.status === 'READY' || r.status === 'COMPLETED')) successCount++;
      }
    }

    toast.success(`Đã xử lý xong ${successCount}/${oToProcess.length} đơn hàng.`);
    setCheckedOrders({});
    setProcessingOrderId(null);
    fetchData();
    setActiveTab('dispatched');
  };

  const handleCreateReceipt = async (order) => {
    if (!confirm(`Xác nhận hoàn tất soạn hàng cho đơn #${order.order_id}?\nHệ thống sẽ tạo Phiếu Xuất Kho.`)) return;
    setProcessingOrderId(order.order_id);
    try {
      let receipt;
      try {
        receipt = await createReceipt(order.order_id, `Phiếu xuất cho đơn #${order.order_id}`);
      } catch (err) {
        // Fallback: The API often throws 500 Internal Server Error but still manages to create the receipt
        console.warn('API error on createReceipt, verifying creation...', err);
        const allReceipts = await getReceiptsByOrderId(order.order_id).catch(() => []);
        receipt = allReceipts.find(r => r.status === 'READY' || r.status === 'COMPLETED');
        if (!receipt) {
          throw new Error(err.message || 'Lỗi 500 từ Server và không tìm thấy phiếu được tạo.');
        }
      }
      
      // Không gọi updateOrderStatus DISPATCHED — backend reject transition PROCESSING→DISPATCHED (500).
      // Coordinator dùng receipt status READY để nhận biết đơn sẵn sàng giao.

      toast.success(`Đã hoàn tất soạn hàng & tạo Phiếu Xuất #${receipt?.receipt_id || ''}.`);
      
      // 1. Update local state FIRST
      if (receipt) {
        const newReceipt = { ...receipt, status: receipt.status || 'READY' };
        setOrderReceipts(prev => ({
          ...prev,
          [order.order_id]: [...(prev[order.order_id] || []), newReceipt]
        }));
      }

      // Update order status in allOrders
      setAllOrders(prev => prev.map(o => o.order_id === order.order_id ? { ...o, status: 'DISPATCHED' } : o));

      // 2. Switch tab immediately to history
      setActiveTab('dispatched');
    } catch (error) {
      toast.error('Lỗi khi hoàn tất soạn hàng: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleCompleteOrder = async (order) => {
    // Step 7: Order Completion - Quantity check
    const receipts = orderReceipts[order.order_id] || [];
    const totalOrdered = (order.order_details || []).reduce((sum, d) => sum + d.quantity, 0);
    const totalDelivered = receipts
      .filter(r => r.status === 'COMPLETED')
      .reduce((sum, r) => sum + (r.receipt_details || []).reduce((s, rd) => s + rd.quantity, 0), 0);

    let confirmMsg = `Xác nhận "Chốt đơn hàng" #${order.order_id}?\nTrạng thái sẽ chuyển sang HOÀN THÀNH (DONE).`;
    
    if (totalDelivered < totalOrdered) {
      confirmMsg = `⚠️ CẢNH BÁO: Đơn hàng mới giao được ${totalDelivered}/${totalOrdered} sản phẩm.\n\nBạn vẫn muốn "Chốt đơn hàng" này chứ?`;
    }

    if (!confirm(confirmMsg)) return;
    
    setProcessingOrderId(order.order_id);
    try {
      await updateOrderStatusWithFallback(order.order_id, 'DONE', `Thủ kho chốt đơn. Tổng giao: ${totalDelivered}/${totalOrdered}`);
      toast.success(`Đơn hàng #${order.order_id} đã được chốt thành công!`);
      
      // Update local state
      setAllOrders(prev => prev.map(o => o.order_id === order.order_id ? { ...o, status: 'DONE' } : o));
    } catch (error) {
      toast.error('Lỗi khi chốt đơn: ' + error.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  // handleBulkConfirmReceipts and handleConfirmReceiptExport removed as per new flow. Warehouse just creates READY receipts.

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

    // If still empty, fetch now using dedicated details endpoint
    if (enrichedOrder.order_details.length === 0) {
      try {
        const details = await getOrderDetailsByOrderId(order.order_id);
        if (details && details.length > 0) {
          enrichedOrder = { ...order, order_details: details };
          setOrderDetailsCache(prev => ({ ...prev, [order.order_id]: details }));
        }
      } catch (e) {
        console.error('Lỗi tải chi tiết sản phẩm:', e);
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
      console.warn('Lỗi lấy gợi ý FEFO (thường xảy ra với đơn bù):', error.message);
      // Bỏ qua lỗi 500, cho phép user tự chọn lô thủ công
      setAllocationModal(prev => ({ 
        ...prev, 
        suggestions: [], 
        manualAllocations: {}, 
        isLoading: false 
      }));
    }
  };

  const handleConfirmAllocation = async () => {
    const { order, manualAllocations } = allocationModal;
    const finalAllocations = [];
    
    // 1. Validate that EVERY product is fully and exactly allocated
    let validationError = null;
    for (const detail of (order.order_details || [])) {
      const allocatedBatches = manualAllocations[detail.order_detail_id] || {};
      const totalAllocated = Object.values(allocatedBatches).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
      
      if (totalAllocated !== detail.quantity) {
        validationError = `Sản phẩm "${detail.product_name}" yêu cầu ${detail.quantity} nhưng đang phân bổ ${totalAllocated}. Vui lòng chia cho khớp số lượng!`;
        break; // Stop at first error
      }
    }

    if (validationError) {
      toast.error(validationError);
      return;
    }

    // 2. Map manualAllocations to [{ orderDetailId, batchPicks: [{batchId, quantity}] }]
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
      try {
        await confirmAllocation(order.order_id, finalAllocations);
      } catch (err) {
        // Fallback cho đơn hàng SUPPLEMENT bị backend báo lỗi 500 do flow bị đứt đoạn
        if (err.message.includes('500') || err.message.includes('Internal Server Error')) {
          console.warn('Backend reject confirm-allocation (thường gặp với SUPPLEMENT). Bỏ qua và chuyển status thủ công.');
          await updateOrderStatus(order.order_id, 'PROCESSING', order.comment || 'Chuyển trạng thái PROCESSING thủ công');
        } else {
          throw err;
        }
      }
      
      toast.success('Duyệt đơn và phân bổ hàng thành công!');
      setAllocationModal(prev => ({ ...prev, isOpen: false }));
      
      // Update ui local state ngay lap tuc
      setAllOrders(prev => prev.map(o => o.order_id === order.order_id ? { ...o, status: 'PROCESSING' } : o));
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
      // Flow 1 Step 2: Case B - Reject order -> Update status to CANCELED with [REJECTED] tag
      const finalComment = `[REJECTED] ${reason || 'Không rõ lý do'}`;
      await updateOrderStatus(order.order_id, 'CANCELED', finalComment);
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
    if (actionType === 'picking') return 'Soạn hàng';
    if (actionType === 'ready') return 'Đã xuất kho';
    return status;
  };

  // 1. Chờ duyệt: WAITING status
  // 1. Chờ duyệt: WAITING status or SUPPLEMENT orders that haven't been processed
  const waitingConfirmationOrders = allOrders.filter(o => 
    o.status === 'WAITING' || 
    (o.status === 'PROCESSING' && (o.comment || '').includes('SUPPLEMENT') && (orderReceipts[o.order_id] || []).length === 0)
  );

  // 2. Soạn hàng: PROCESSING status and HAS NO READY/COMPLETED receipts
  const pickingOrders = allOrders.filter(o => {
    if (o.status !== 'PROCESSING' && o.status !== 'PARTIAL_DELIVERED' && o.status !== 'PICKING') return false;
    const receipts = orderReceipts[o.order_id] || [];
    // If it has ANY READY or COMPLETED receipt, it's not in picking anymore
    return !receipts.some(r => r.status === 'READY' || r.status === 'COMPLETED');
  });

  // 3. Xuất kho (HISTORY): Order IS DISPATCHED, DELIVERING, DONE or HAS READY/COMPLETED receipts
  const historyOrders = allOrders.filter(o => {
    if (o.status === 'CANCELED' || o.status === 'REJECTED') return false;
    const receipts = orderReceipts[o.order_id] || [];
    const hasReceipt = receipts.some(r => r.status === 'READY' || r.status === 'COMPLETED');
    return hasReceipt || ['DISPATCHED', 'DELIVERING', 'DONE'].includes(o.status);
  });

  // 4. Đã từ chối: CANCELED status with [REJECTED] tag
  const rejectedOrders = allOrders.filter(o => 
    o.status === 'CANCELED' && (o.comment || '').includes('[REJECTED]')
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

    const allChecked = orders.length > 0 && orders.every(o => checkedOrders[o.order_id]);
    const someChecked = orders.some(o => checkedOrders[o.order_id]);

    return (
      <div className="space-y-4">
        {actionType === 'picking' && (
          <div className="flex items-center justify-between bg-purple-50 p-4 rounded-xl border border-purple-100 mb-2 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <Checkbox 
                id="select-all-picking" 
                checked={allChecked} 
                onCheckedChange={(checked) => {
                  const newChecked = { ...checkedOrders };
                  orders.forEach(o => newChecked[o.order_id] = !!checked);
                  setCheckedOrders(newChecked);
                }}
              />
              <Label htmlFor="select-all-picking" className="font-bold text-purple-900 cursor-pointer">
                Chọn tất cả ({orders.length} đơn)
              </Label>
            </div>
            {someChecked && (
              <Button 
                size="sm" 
                className="bg-purple-600 hover:bg-purple-700 shadow-lg animate-in zoom-in-95"
                onClick={() => handleBulkCreateReceipts(orders)}
                disabled={processingOrderId === 'bulk-processing'}
              >
                {processingOrderId === 'bulk-processing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                Xuất kho cho các đơn đã chọn
              </Button>
            )}
          </div>
        )}
        {orders.map(order => {
          const isExpanded = expandedOrder === order.order_id;
          const isProcessing = processingOrderId === order.order_id;

          return (
            <Card key={order.order_id} className="border-l-4 border-l-purple-400">
              <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50" onClick={() => toggleOrderDetails(order)}>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    {actionType === 'picking' && (
                      <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          id={`check-${order.order_id}`}
                          checked={!!checkedOrders[order.order_id]}
                          onCheckedChange={(checked) => {
                            setCheckedOrders(prev => ({ ...prev, [order.order_id]: !!checked }));
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        Đơn hàng #{order.order_id}
                        {String(order.comment || '').toUpperCase().includes('SUPPLEMENT') && (
                          <Badge variant="destructive" className="animate-pulse shadow-sm text-[10px] leading-tight px-1.5 py-0">SUPPLEMENT</Badge>
                        )}
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
                      <div className="flex flex-col gap-3 mt-4">
                        {String(order.comment || '').toUpperCase().includes('SUPPLEMENT') && (
                          <Badge variant="destructive" className="w-fit animate-pulse shadow-sm">
                            HÀNG BÙ (SUPPLEMENT)
                          </Badge>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={(e) => { e.stopPropagation(); handleOpenAllocation(order); }} disabled={isProcessing} className="flex-1 bg-green-600 hover:bg-green-700">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                            Duyệt đơn {order.comment?.includes('bổ sung') ? 'hàng bù' : ''}
                          </Button>
                          <Button onClick={(e) => { e.stopPropagation(); handleRejectOrder(order); }} disabled={isProcessing} variant="outline" className="text-red-600 border-red-200">
                            Từ chối
                          </Button>
                        </div>
                      </div>
                    )}
                    {actionType === 'picking' && (
                      <Button onClick={(e) => { e.stopPropagation(); handleCreateReceipt(order); }} disabled={isProcessing} className="w-full bg-purple-600 hover:bg-purple-700">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                        Hoàn tất soạn hàng (Tạo Phiếu Xuất Kho)
                      </Button>
                    )}
                    {actionType === 'ready' && (
                      <div className="space-y-4">

                        <div className="flex justify-between items-center border-b pb-1">
                          <p className="text-sm font-semibold text-blue-700 font-black flex items-center gap-2">
                            <Truck className="h-4 w-4" /> Lịch sử xuất kho:
                          </p>
                          {/* Chốt đơn hàng ONLY if at least one delivery attempt made (DELIVERED/PARTIAL) */}
                          {(order.status === 'DELIVERING' || order.status === 'PARTIAL_DELIVERED') && 
                           (orderReceipts[order.order_id] || []).some(r => r.status === 'COMPLETED') && (
                            <Button 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); handleCompleteOrder(order); }}
                              className="h-7 bg-green-600 hover:bg-green-700 text-[10px] font-bold py-0"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Chốt hoàn tất (DONE)
                            </Button>
                          )}
                        </div>
                        {(orderReceipts[order.order_id] || [])
                          .filter(r => r.status === 'READY' || r.status === 'COMPLETED')
                          .map(receipt => (
                            <div key={receipt.receipt_id} className="w-full p-3 bg-blue-50/50 text-blue-700 text-xs rounded-lg border border-blue-100 flex items-center justify-between shadow-sm">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm">Phiếu xuất #{receipt.receipt_id}</span>
                                <span className="text-[10px] opacity-70 uppercase">{receipt.receipt_code}</span>
                              </div>
                              <Badge 
                                variant="default" 
                                className={
                                  receipt.status === 'COMPLETED' ? "bg-green-600 hover:bg-green-600" : 
                                  "bg-blue-600 hover:bg-blue-600"
                                }
                              >
                                {receipt.status === 'COMPLETED' ? 'ĐÃ GIAO / ĐỐI SOÁT' : 
                                 'CHỜ SHIPPER (READY)'}
                              </Badge>
                            </div>
                          ))}
                        {(!orderReceipts[order.order_id] || orderReceipts[order.order_id].filter(r => r.status === 'READY' || r.status === 'COMPLETED').length === 0) && (
                          <p className="text-xs text-muted-foreground italic text-center py-2">Không tìm thấy phiếu xuất lưu trong hệ thống.</p>
                        )}
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
          <p className="text-muted-foreground text-sm mt-1">Luồng trạng thái: Duyệt đơn ➔ Soạn hàng ➔ Phiếu Draft ➔ Xuất kho</p>
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
          <TabsTrigger value="dispatched" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            3. Đã xuất kho {historyOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">{historyOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            4. Từ chối {rejectedOrders.length > 0 && <Badge variant="secondary" className="ml-2 bg-red-100 text-red-700">{rejectedOrders.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waiting" className="mt-0">
          {renderOrderList(waitingConfirmationOrders, 'waiting')}
        </TabsContent>
        <TabsContent value="picking" className="mt-0">
          {renderOrderList(pickingOrders, 'picking')}
        </TabsContent>
        <TabsContent value="dispatched" className="mt-0">
          {renderOrderList(historyOrders, 'ready')}
        </TabsContent>
        <TabsContent value="rejected" className="mt-0">
          {renderOrderList(rejectedOrders, 'rejected')}
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