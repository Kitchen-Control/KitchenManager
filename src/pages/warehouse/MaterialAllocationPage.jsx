import React, { useEffect, useState } from "react";
import {
  getProductionPlans,
  getMaterialRequirements,
  getRawMaterialInventories,
  createTransaction,
} from "../../data/api";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

export default function MaterialAllocationPage() {
  const [plans, setPlans] = useState([]);
  const [inventories, setInventories] = useState([]);
  
  // SỬA: Dùng key phẳng "planId|productId|batchId" để tránh lỗi đè dữ liệu
  const [allocations, setAllocations] = useState({});
  const [editedMaterials, setEditedMaterials] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const planData = await getProductionPlans();
      const waitingPlans = planData.filter(p => p.status?.toUpperCase() === "WAITING");

      const plansWithReq = await Promise.all(
        waitingPlans.map(async (plan) => {
          const materials = await getMaterialRequirements(plan.planId);
          return {
            ...plan,
            materials: (materials || []).map(m => ({
              productId: m.productId,
              productName: m.productName,
              requiredQty: m.totalRequiredQuantity,
              unit: m.unit
            }))
          };
        })
      );
      setPlans(plansWithReq);

      const invData = await getRawMaterialInventories();
      const invMap = {};
      invData.forEach(inv => {
        const pId = inv.product_id || inv.productId;
        if (!pId) return;
        if (!invMap[pId]) {
          invMap[pId] = { productId: pId, productName: inv.product_name, batches: [] };
        }
        invMap[pId].batches.push({
          batchId: inv.batch_id,
          quantity: inv.quantity,
          expiryDate: inv.expiry_date
        });
      });
      setInventories(Object.values(invMap));
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Hàm tính tổng đơn giản và chính xác
  const getAllocatedSum = (planId, productId) => {
    let total = 0;
    const targetPlanId = String(planId);
    const targetProductId = String(productId);

    Object.keys(allocations).forEach(key => {
      const parts = key.split('|');
      // parts[0] là planId, parts[1] là productId
      if (parts[0] === targetPlanId && parts[1] === targetProductId) {
        const val = parseFloat(allocations[key]);
        if (!isNaN(val)) {
          total += val;
        }
      }
    });
    return total;
  };

  const handleConfirm = async (plan) => {
    try {
      const transactions = [];

      for (const m of plan.materials) {
        const editKey = `${plan.planId}|${m.productId}`;
        const required = parseFloat(editedMaterials[editKey]) || m.requiredQty;
        const total = getAllocatedSum(plan.planId, m.productId);

        // Kiểm tra logic: Nếu tổng cấp phát < nhu cầu thì chặn lại
        if (total < required) {
          toast.error(`${m.productName} chưa đủ số lượng! (Cần: ${required}, Đã chọn: ${total})`);
          return;
        }

        // Gom các lô hàng có số lượng > 0
        const prefix = `${plan.planId}|${m.productId}|`;
        Object.keys(allocations).forEach(key => {
          if (key.startsWith(prefix)) {
            const qty = parseFloat(allocations[key]);
            if (qty > 0) {
              const parts = key.split('|'); // [planId, productId, batchId]
              transactions.push({
                productId: Number(parts[1]), // Đảm bảo là Number
                batchId: Number(parts[2]),   // Đảm bảo là Number
                quantity: qty,               // Số thực (0.5)
                type: "EXPORT",              // Nghiệp vụ xuất kho sản xuất
                note: `Cấp phát cho Plan #${plan.planId}`
              });
            }
          }
        });
      }

      if (transactions.length === 0) {
        return toast.error("Vui lòng nhập số lượng vào các ô lô hàng!");
      }

      // Gọi API POST tuần tự
      const toastId = toast.loading("Đang thực hiện giao dịch kho...");
      for (const tx of transactions) {
        await createTransaction(tx);
      }
      
      toast.success(`Xác nhận thành công cho Plan #${plan.planId}`, { id: toastId });
      
      // Reset và load lại dữ liệu mới nhất
      setAllocations({});
      fetchData(); 
    } catch (err) {
      toast.error("Lỗi khi nạp dữ liệu vào API: " + err.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {plans.map(plan => (
        <Card key={plan.planId}>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>Plan #{plan.planId}</span>
              <Badge variant="outline">{plan.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {plan.materials.map(mat => {
              const inventory = inventories.find(i => String(i.productId) === String(mat.productId));
              const currentTotal = getAllocatedSum(plan.planId, mat.productId);
              const editKey = `${plan.planId}|${mat.productId}`;

              return (
                <div key={mat.productId} className="border p-4 rounded-xl bg-slate-50/50">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-lg text-slate-700">{mat.productName}</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        className="w-24 bg-white h-9"
                        value={editedMaterials[editKey] ?? mat.requiredQty}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                          setEditedMaterials(prev => ({ ...prev, [editKey]: val }));
                        }}
                      />
                      <span className="text-sm font-medium">/ {mat.requiredQty} {mat.unit}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {inventory?.batches.map(batch => {
                      const batchKey = `${plan.planId}|${mat.productId}|${batch.batchId}`;
                      return (
                        <div key={batch.batchId} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm text-sm">
                          <span>Lô <b>{batch.batchId}</b> (Tồn: {batch.quantity})</span>
                          <Input
  type="number"
  step="0.5"
  className="w-32 h-8"
  placeholder="0.0"
  // Tạo key bằng cách ép kiểu String thủ công cho chắc chắn
  value={allocations[`${String(plan.planId)}|${String(mat.productId)}|${String(batch.batchId)}`] ?? ""}
  onChange={(e) => {
    const val = e.target.value; 
    const key = `${String(plan.planId)}|${String(mat.productId)}|${String(batch.batchId)}`;
    
    setAllocations(prev => ({
      ...prev,
      [key]: val 
    }));
  }}
/>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className={`mt-3 text-right font-bold ${currentTotal >= (editedMaterials[editKey] ?? mat.requiredQty) ? "text-green-600" : "text-red-500"}`}>
                    Đã chọn: {currentTotal} {mat.unit}
                  </div>
                </div>
              );
            })}
            <Button className="w-full h-12 text-lg" onClick={() => handleConfirm(plan)}>Xác nhận Cấp phát</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}