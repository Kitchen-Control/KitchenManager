import React from 'react';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';

export function StatsCard({ title, value, icon: Icon, description, trend, className }) {
  return (
    <Card className={cn('card-hover', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <p className={cn(
                'text-xs font-medium',
                trend > 0 ? 'text-success' : 'text-destructive'
              )}>
                {trend > 0 ? '+' : ''}{trend}% so với hôm qua
              </p>
            )}
          </div>
          {Icon && (
            <div className="rounded-lg bg-primary/10 p-3">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
