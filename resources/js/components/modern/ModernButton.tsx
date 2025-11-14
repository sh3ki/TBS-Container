import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'add' | 'edit' | 'delete' | 'toggle' | 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ModernButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  add: 'bg-[#10B981] hover:bg-[#059669] text-white',
  edit: 'bg-[#F59E0B] hover:bg-[#D97706] text-white',
  delete: 'bg-[#EF4444] hover:bg-[#DC2626] text-white',
  toggle: 'bg-[#6B7280] hover:bg-[#4B5563] text-white',
  primary: 'bg-[#3E9AF4] hover:bg-[#2563EB] text-white',
  secondary: 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export const ModernButton: React.FC<ModernButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed';
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : icon ? (
        <span className="flex items-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
