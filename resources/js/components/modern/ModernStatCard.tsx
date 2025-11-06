import React from 'react';
import { colors } from '@/lib/colors';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ModernStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  iconBgColor?: string;
}

export const ModernStatCard: React.FC<ModernStatCardProps> = ({
  title,
  value,
  icon,
  trend,
  subtitle,
  iconBgColor = colors.brand.primary,
}) => {
  return (
    <div
      className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow duration-200"
      style={{
        backgroundColor: colors.main,
        borderColor: colors.card.border,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p 
            className="text-sm font-medium mb-1"
            style={{ color: colors.text.secondary }}
          >
            {title}
          </p>
          <p 
            className="text-3xl font-bold mb-2"
            style={{ color: colors.text.primary }}
          >
            {value}
          </p>
          {subtitle && (
            <p 
              className="text-xs"
              style={{ color: colors.text.secondary }}
            >
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4" style={{ color: colors.status.success }} />
              ) : (
                <TrendingDown className="h-4 w-4" style={{ color: colors.status.error }} />
              )}
              <span 
                className="text-sm font-medium"
                style={{ color: trend.isPositive ? colors.status.success : colors.status.error }}
              >
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: `${iconBgColor}20`,
          }}
        >
          <div style={{ color: iconBgColor }}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
};
