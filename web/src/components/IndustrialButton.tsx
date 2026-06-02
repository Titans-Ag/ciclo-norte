import React from 'react';
import { Loader2 } from 'lucide-react';

interface IndustrialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<string, string> = {
  primary:
    'bg-industrial-yellow text-industrial-black hover:bg-[#E5B516] active:bg-[#D4A814] shadow-industrial',
  secondary:
    'bg-white text-industrial-black border border-industrial-pale hover:bg-industrial-surface active:bg-[#EBEBEB] shadow-industrial',
  danger:
    'bg-industrial-red text-white hover:bg-[#C82323] active:bg-[#B82020] shadow-industrial',
  ghost:
    'bg-transparent text-industrial-gray hover:bg-industrial-surface active:bg-[#EBEBEB]',
  dark:
    'bg-industrial-black text-white hover:bg-industrial-dark active:bg-[#0F0F0F] shadow-industrial',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export function IndustrialButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: IndustrialButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-lg font-semibold
        transition-all duration-150 ease-out
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {children}
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}
