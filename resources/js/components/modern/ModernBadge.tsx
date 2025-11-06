import React from 'react';
import { colors } from '@/lib/colors';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface ModernBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  success: {
    bg: '#ECFDF5',
    text: colors.status.success,
    border: colors.status.success,
  },
  warning: {
    bg: '#FFFBEB',
    text: colors.status.warning,
    border: colors.status.warning,
  },
  error: {
    bg: '#FEF2F2',
    text: colors.status.error,
    border: colors.status.error,
  },
  info: {
    bg: '#EFF6FF',
    text: colors.status.info,
    border: colors.status.info,
  },
  default: {
    bg: colors.secondary,
    text: colors.text.secondary,
    border: colors.tertiary,
  },
};

export const ModernBadge: React.FC<ModernBadgeProps> = ({
  children,
  variant = 'default',
  icon,
  className = '',
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${className}`}
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        borderColor: styles.border,
      }}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </span>
  );
};
