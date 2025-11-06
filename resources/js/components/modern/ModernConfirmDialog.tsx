import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModernButton } from './ModernButton';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'success';

interface ModernConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
  onConfirm: () => void;
  onCancel?: () => void;
}

const confirmConfig = {
  danger: {
    icon: XCircle,
    color: '#EF4444',
    variant: 'delete' as const,
  },
  warning: {
    icon: AlertTriangle,
    color: '#F59E0B',
    variant: 'edit' as const,
  },
  info: {
    icon: Info,
    color: '#3E9AF4',
    variant: 'primary' as const,
  },
  success: {
    icon: CheckCircle,
    color: '#10B981',
    variant: 'add' as const,
  },
};

export const ModernConfirmDialog: React.FC<ModernConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  onConfirm,
  onCancel,
}) => {
  const config = confirmConfig[type];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-600 pl-15">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 mt-4">
          <ModernButton
            type="button"
            variant="toggle"
            onClick={handleCancel}
          >
            {cancelText}
          </ModernButton>
          <ModernButton
            type="button"
            variant={config.variant}
            onClick={handleConfirm}
          >
            {confirmText}
          </ModernButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
