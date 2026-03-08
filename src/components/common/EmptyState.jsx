import React from 'react';
import { Package } from 'lucide-react';
import { Button } from '../ui/button';

export function EmptyState({ 
  icon: Icon = Package, 
  title = 'Không có dữ liệu', 
  description,
  action,
  actionLabel 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && actionLabel && (
        <Button onClick={action}>{actionLabel}</Button>
      )}
    </div>
  );
}
