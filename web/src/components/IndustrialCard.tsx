import React from 'react';

interface IndustrialCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddingClasses: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function IndustrialCard({
  children,
  className = '',
  hover = false,
  padding = 'md',
  onClick,
}: IndustrialCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl border border-industrial-pale bg-white
        shadow-industrial
        transition-all duration-200
        ${hover ? 'hover:shadow-industrial-md hover:border-industrial-light/50 cursor-pointer' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
