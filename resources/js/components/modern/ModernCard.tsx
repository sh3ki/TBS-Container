import React from 'react';
import { colors } from '@/lib/colors';

interface ModernCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const ModernCard: React.FC<ModernCardProps> = ({
  children,
  title,
  subtitle,
  icon,
  className = '',
  headerAction,
}) => {
  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}
      style={{
        backgroundColor: colors.main,
        borderColor: colors.card.border,
        boxShadow: colors.card.shadow,
      }}
    >
      {(title || icon || headerAction) && (
        <div 
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{
            backgroundColor: colors.brand.primary,
            color: colors.main,
          }}
        >
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex items-center justify-center">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-white">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-white/80 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerAction && (
            <div className="flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};
