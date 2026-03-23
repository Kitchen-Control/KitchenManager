import React, { useEffect, useState } from "react";
import {
  getProductionPlans,
  getProductionPlanDetails,
  getRecipeDetailsByRecipeId,
  getInventories,
  createTransaction
} from "../../data/api";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

export default function MaterialAllocationPage() {
  const [plans, setPlans] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [allocations, setAllocations] = useState({});
  
  useEffect(() => {
    fetchData();
  }, []);

  // ================= FETCH =================
  const fetchData = async () => {
    try {
      // 1. lấy plan WAITING
      const planData = await getProductionPlans();
      const waitingPlans = planData.filter(
  p => p.status?.toUpperCase() === "WAITING"
);

      // 2. load material cho từng plan
      const plansWithReq = await Promise.all(
        waitingPlans.map(async (plan) => {
          const details = await getProductionPlanDetails(plan.planId);

          const recipePromises = details.map(d => {
  const recipeId =
    d.recipeId || d.recipe_id || d.recipe?.recipeId;

  if (!recipeId) {
    console.warn("Missing recipeId:", d);
    return Promise.resolve([]);
  }

  return getRecipeDetailsByRecipeId(recipeId);
});

const recipeResults = await Promise.all(recipePromises);

let reqMap = {};

details.forEach((item, index) => {
  const recipeDetails = recipeResults[index]?.data || recipeResults[index] || [];

  recipeDetails.forEach(r => {
    const productId = r.rawMaterialId;
    console.log("RECIPE RESULTS:", recipeResults);
const productName = r.rawMaterialName;
const qty = r.quantity * item.quantity;

if (!reqMap[productId]) {
  reqMap[productId] = {
    productId,
    productName,
    requiredQty: 0
  };
}

reqMap[productId].requiredQty += qty;
  });
});

          return {
            ...plan,
            materials: Object.values(reqMap)
          };
        })
      );

      setPlans(plansWithReq);

      // 3. inventories
      const invData = await getInventories();
      console.log("ALL PLANS:", planData);
      const invMap = {};

      invData.forEach(inv => {
        if (!invMap[inv.product_id]) {
          invMap[inv.product_id] = {
            productId: inv.product_id,
            productName: inv.product_name,
            batches: []
          };
        }

        invMap[inv.product_id].batches.push({
          batchId: inv.batch_id,
          quantity: inv.quantity,
          expiryDate: inv.expiry_date
        });
      });

      // FEFO
      Object.values(invMap).forEach(i => {
        i.batches.sort(
          (a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)
        );
      });

      setInventories(Object.values(invMap));

    } catch (err) {
      toast.error(err.message);
    }
  };

  // ================= INPUT =================
  const handleChange = (planId, productId, batchId, value, max) => {
    let val = Number(value);
    if (val > max) val = max;
    if (val < 0) val = 0;

    setAllocations(prev => ({
      ...prev,
      [planId]: {
        ...(prev[planId] || {}),
        [productId]: {
          ...((prev[planId] || {})[productId] || {}),
          [batchId]: val
        }
      }
    }));
  };

  const getAllocated = (planId, productId) => {
    const p = allocations[planId]?.[productId] || {};
    return Object.values(p).reduce((s, v) => s + (v || 0), 0);
  };

  // ================= CONFIRM =================
  const handleConfirm = async (plan) => {
    try {
      const planAlloc = allocations[plan.planId] || {};

      // validate
      for (const m of plan.materials) {
        const total = getAllocated(plan.planId, m.productId);
        if (total !== m.requiredQty) {
          toast.error(`${m.productName} chưa đủ`);
          return;
        }
      }

      const requests = [];

      for (const productId in planAlloc) {
        const batches = planAlloc[productId];

        for (const batchId in batches) {
          const qty = batches[batchId];
          if (!qty || qty <= 0) continue;

          requests.push(
            createTransaction({
              productId: Number(productId),
              batchId: Number(batchId),
              quantity: qty,
              type: "EXPORT",
              note: `Production Plan ${plan.planId}`
            })
          );
        }
      }

      await Promise.all(requests);

      toast.success(`Plan ${plan.planId} done`);

    } catch (err) {
      toast.error(err.message);
    }
  };

  // ================= UI =================
  return (
    <div className="p-6 space-y-6">

      {plans.map(plan => (
        <Card key={plan.planId}>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>Plan #{plan.planId}</span>
              <Badge>{plan.status}</Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            {plan.materials.map(mat => {
              const inventory = inventories.find(i => i.productId === mat.productId);
              const allocated = getAllocated(plan.planId, mat.productId);

              return (
                <div key={mat.productId} className="border p-3 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span>{mat.productName}</span>
                    <span>
                      {allocated} / {mat.requiredQty}
                    </span>
                  </div>

                  {inventory?.batches.map(batch => (
                    <div key={batch.batchId} className="flex justify-between mb-2">
                      <span>
                        Batch {batch.batchId} (Tồn {batch.quantity})
                      </span>

                      <Input
                        type="number"
                        className="w-24"
                        onChange={(e) =>
                          handleChange(
                            plan.planId,
                            mat.productId,
                            batch.batchId,
                            e.target.value,
                            batch.quantity
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              );
            })}

            <div className="flex justify-end">
              <Button onClick={() => handleConfirm(plan)}>
                Confirm Plan
              </Button>
            </div>

          </CardContent>
        </Card>
      ))}

    </div>
  );
}