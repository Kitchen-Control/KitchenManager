import React from 'react';
import { Badge } from '../ui/badge';
import { ORDER_STATUS, DELIVERY_STATUS, BATCH_STATUS } from '../../data/constants';

export function StatusBadge({ status, type = 'order' }) {
  const statusMap = {
    order: ORDER_STATUS,
    delivery: DELIVERY_STATUS,
    batch: BATCH_STATUS,
  };

  const statusConfig = statusMap[type]?.[status];

  if (!statusConfig) {
    return <Badge variant="outline">{status}</Badge>;
  }

  return (
    <Badge className={`border ${statusConfig.class}`} variant="outline">
      {statusConfig.label}
    </Badge>
  );
}
