import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getProductionPlans,
  getMaterialRequirements,
  getInventories,
  getAllTransactions,
  createTransaction,
  updateProductionPlanStatus
} from "../../data/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowLeft, AlertCircle, CheckCircle2, PackageCheck, Send } from "lucide-react";

export default function MaterialAllocationPage() {
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [dispatchingId, setDispatchingId] = useState(null);
  const [allocations, setAllocations] = useState({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  const getInvQuantity = (inv) => inv.quantity ?? inv.batch?.inventory?.quantity ?? inv.batch?.quantity ?? 0;
  const getInvExpiryDate = (inv) => inv.expiryDate ?? inv.batch?.expiryDate ?? inv.batch?.inventory?.expiryDate;

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // 1. Lấy song song Plans, Inventories và Transactions
      const [allPlans, invData, allTxs] = await Promise.all([
        getProductionPlans(),
        getInventories(),
        getAllTransactions().catch(err => {
          console.warn("Không tải được lịch sử xuất kho:", err);
          return [];
        })
      ]);

      const waitingPlans = (allPlans || []).filter(p => p.status?.toUpperCase() === "WAITING");
      // Lọc sẵn các giao dịch XUẤT KHO liên quan đến Kế hoạch để dễ tính toán
      const exportTxs = (allTxs || []).filter(tx => tx.type === "EXPORT" && tx.note?.startsWith("Production Plan"));

      // 2. Map dữ liệu định mức và đối chiếu với Transactions
      const plansWithReqs = await Promise.all(
        waitingPlans.map(async (plan) => {
          const reqs = await getMaterialRequirements(plan.planId).catch(err => {
            console.warn(`Plan ${plan.planId} chưa có định mức:`, err);
            return [];
          });

          const processedReqs = reqs.map(req => {
            // Lọc các lần xuất kho của đúng Kế hoạch này và đúng Mã nguyên liệu này
            const relatedTxs = exportTxs.filter(tx =>
              tx.productId === req.productId &&
              tx.note === `Production Plan ${plan.planId}`
            );

            // Cộng dồn xem đã xuất được bao nhiêu rồi
            const exportedQty = relatedTxs.reduce((sum, tx) => sum + tx.quantity, 0);
            // Số lượng cần xuất thêm = Định mức ban đầu - Đã xuất
            const remainingQty = Math.max(0, req.totalRequiredQuantity - exportedQty);
            const isCompleted = exportedQty >= req.totalRequiredQuantity;

            return { ...req, exportedQty, remainingQty, isCompleted };
          });

          return { ...plan, materials: processedReqs || [] };
        })
      );

      // 3. Tách kế hoạch: chia làm 2 phần — chưa xuất đủ và đã xuất đủ (chờ dispatch)
      const activePlans = plansWithReqs.filter(plan => {
        if (plan.materials.length === 0) return false;
        return true; // giữ lại tất cả, kể cả kế hoạch đã đủ ng.liệu (chuẩn bị dispatch)
      });

      setPlans(activePlans);

      const availableInvs = (invData || [])
        .filter(inv => getInvQuantity(inv) > 0)
        .sort((a, b) => new Date(getInvExpiryDate(a)) - new Date(getInvExpiryDate(b)));
      setInventories(availableInvs);

    } catch (error) {
      toast.error("Lỗi khi tải dữ liệu: " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalAllocated = (planId, productId) => {
    const prefix = `${planId}-${productId}-`;
    return Object.keys(allocations)
      .filter(key => key.startsWith(prefix))
      .reduce((sum, key) => sum + (parseFloat(allocations[key]) || 0), 0);
  };

  const handleInputChange = (planId, productId, batchId, value, maxAvailable) => {
    const key = `${planId}-${productId}-${batchId}`;
    let val = value === "" ? "" : parseFloat(value);

    if (val !== "" && val < 0) val = 0;
    if (val !== "" && val > maxAvailable) val = maxAvailable;

    setAllocations(prev => ({ ...prev, [key]: val }));
  };

  const handleExportSingleMaterial = async (planId, req) => {
    const allocatedQty = getTotalAllocated(planId, req.productId);
    // So sánh với số lượng CẦN THÊM (remainingQty) chứ không phải tổng yêu cầu nữa
    if (allocatedQty <= 0) {
      toast.warning(`Vui lòng nhập số lượng cho ${req.productName}`);
      return;
    }
    if (allocatedQty < req.remainingQty) {
      toast.error(`Chưa xuất đủ số lượng yêu cầu (Cần thêm ${req.remainingQty} ${req.unit})`);
      return;
    }

    const transactionsToCreate = [];
    const prefix = `${planId}-${req.productId}-`;
    Object.keys(allocations).forEach(key => {
      if (key.startsWith(prefix)) {
        const qty = parseFloat(allocations[key]);
        if (qty > 0) {
          const [, , batchId] = key.split("-");
          transactionsToCreate.push({
            productId: req.productId,
            batchId: Number(batchId),
            type: "EXPORT",
            quantity: qty,
            note: `Production Plan ${planId}`
          });
        }
      }
    });

    const processId = `${planId}-${req.productId}`;
    try {
      setSubmittingId(processId);
      toast.loading(`Đang xuất kho ${req.productName}...`, { id: processId });

      for (const tx of transactionsToCreate) {
        await createTransaction(tx);
      }

      toast.success(`Đã xuất kho ${req.productName} thành công!`, { id: processId });
      setAllocations(prev => {
        const newAlloc = { ...prev };
        Object.keys(newAlloc).forEach(k => {
          if (k.startsWith(prefix)) delete newAlloc[k];
        });
        return newAlloc;
      });

      // Fetch lại Data. Nếu nguyên liệu này là cái cuối cùng của Plan, Plan sẽ tự động biến mất!
      fetchInitialData();
    } catch (error) {
      toast.error(`Lỗi xuất kho ${req.productName}: ` + error.message, { id: processId });
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDispatchPlan = async (planId) => {
    if (!confirm(`Xác nhận gửi toàn bộ nguyên liệu của Kế hoạch #${planId} cho Bếp?\nKế hoạch sẽ chuyển sang trạng thái "Đã xuất nguyên liệu".`)) return;
    setDispatchingId(planId);
    try {
      await updateProductionPlanStatus(planId, 'DISPATCHED');
      toast.success(`Đã gửi nguyên liệu cho Bếp! Kế hoạch #${planId} chuyển sang DISPATCHED.`);
      fetchInitialData();
    } catch (error) {
      toast.error('Lỗi khi dispatch kế hoạch: ' + error.message);
    } finally {
      setDispatchingId(null);
    }
  };

  if (loading) return <div className="flex h-screen justify-center items-center"><Loader2 className="animate-spin w-10 h-10 text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Cấp phát Nguyên liệu Hàng loạt</h1>
          <p className="text-gray-500 text-sm">Quản lý xuất kho theo từng nguyên liệu của các Kế hoạch</p>
        </div>
      </header>

      {plans.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3 opacity-50" />
          Tất cả Kế hoạch WAITING đều đã được cấp phát đủ nguyên liệu!
        </Card>
      ) : (
        plans.map(plan => (
          <Card key={plan.planId} className="border-2 shadow-sm border-blue-100 mb-8">
            <CardHeader className="bg-blue-50/50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Kế hoạch #{plan.planId}</CardTitle>
                {(() => {
                  const allDone = plan.materials.every(m => m.isCompleted);
                  return allDone ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">Đã xuất đủ — chờ gửi Bếp</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">Đang cấp phát</Badge>
                  );
                })()}
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {plan.materials.map(req => {
                // UI 1: NẾU ĐÃ HOÀN THÀNH XUẤT KHO CHO NGUYÊN LIỆU NÀY
                if (req.isCompleted) {
                  return (
                    <div key={req.productId} className="p-4 border border-green-300 bg-green-50/50 rounded-lg shadow-inner flex flex-col md:flex-row justify-between items-center gap-2">
                      <div className="font-bold text-green-800 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> {req.productName}
                      </div>
                      <div className="font-semibold text-green-700 text-sm">
                        Đã xuất đủ {req.totalRequiredQuantity} {req.unit} (Hoàn thành)
                      </div>
                    </div>
                  );
                }

                // UI 2: NẾU CHƯA XUẤT HOẶC MỚI XUẤT ĐƯỢC 1 PHẦN
                const relevantInvs = inventories.filter(inv =>
                  (inv.product_name || "").toLowerCase() === (req.productName || "").toLowerCase()
                );

                const totalAllocated = getTotalAllocated(plan.planId, req.productId);
                const isEnough = totalAllocated >= req.remainingQty;
                const isSubmittingThis = submittingId === `${plan.planId}-${req.productId}`;

                return (
                  <div key={req.productId} className="p-4 border rounded-lg bg-white shadow-inner">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
                      <div className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        {req.productName}
                      </div>
                      <div className="text-sm font-medium bg-blue-50 px-3 py-1.5 rounded text-blue-800 border border-blue-200 flex items-center gap-2">
                        <span>Cần xuất thêm: <strong className="text-base">{req.remainingQty} {req.unit}</strong></span>
                        <span className="text-xs text-blue-600/70 ml-1 border-l border-blue-200 pl-2">
                          (Định mức: {req.totalRequiredQuantity} - Đã xuất: {req.exportedQty})
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {relevantInvs.length > 0 ? (
                        relevantInvs.map((inv) => {
                          const actualQty = getInvQuantity(inv);
                          const expiryDate = getInvExpiryDate(inv);
                          return (
                            <div key={inv.batch?.batchId || inv.inventoryId} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded border border-slate-200">
                              <span>
                                Lô <b>{inv.batch?.batchId}</b> (HSD: {expiryDate ? new Date(expiryDate).toLocaleDateString("vi-VN") : "N/A"}) - Tồn kho: <b className="text-base text-gray-700">{actualQty}</b>
                              </span>
                              <Input
                                type="number"
                                placeholder="0.0"
                                className="w-24 h-8 bg-white border-gray-300 text-right"
                                disabled={isSubmittingThis}
                                value={allocations[`${plan.planId}-${req.productId}-${inv.batch?.batchId}`] ?? ""}
                                onChange={(e) => handleInputChange(
                                  plan.planId, req.productId, inv.batch?.batchId, e.target.value, actualQty
                                )}
                              />
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-rose-500 text-sm flex items-center gap-1 bg-rose-50 p-2 rounded border border-rose-100">
                          <AlertCircle className="w-4 h-4" /> Hết hàng trong kho (Cần nhập thêm)
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-4 border-t">
                      <div className={`text-sm font-bold flex items-center gap-2 ${isEnough ? 'text-green-600' : 'text-orange-500'}`}>
                        {isEnough && <PackageCheck className="w-4 h-4" />}
                        Đã chọn đợt này: {totalAllocated} / {req.remainingQty} {req.unit}
                      </div>

                      <Button
                        onClick={() => handleExportSingleMaterial(plan.planId, req)}
                        disabled={isSubmittingThis || relevantInvs.length === 0}
                        className={isEnough ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
                      >
                        {isSubmittingThis ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang xuất...</>
                        ) : (
                          <><Send className="w-4 h-4 mr-2" /> Xuất {req.productName}</>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Nút Dispatch: chỉ hiện khi TẤT CẢ nguyên liệu đã được xuất đủ */}
              {plan.materials.every(m => m.isCompleted) && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-green-800 text-base"> Đã xuất đủ toàn bộ nguyên liệu</p>
                    <p className="text-sm text-green-700 mt-0.5">Nhấn nút bên phải để thông báo cho Bếp tiếp nhận kế hoạch sản xuất.</p>
                  </div>
                  <Button
                    onClick={() => handleDispatchPlan(plan.planId)}
                    disabled={dispatchingId === plan.planId}
                    className="bg-green-600 hover:bg-green-700 whitespace-nowrap shadow-md"
                  >
                    {dispatchingId === plan.planId ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang gửi...</>
                    ) : (
                      <><Send className="w-4 h-4 mr-2" /> Gửi nguyên liệu cho Bếp</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}