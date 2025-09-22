import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface ButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  fullWidth?: boolean;
  rounded?: boolean;
  animate?: boolean;
  title?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  fullWidth = false,
  rounded = false,
  animate = true,
  title
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 border';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300 disabled:border-blue-300',
    secondary: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:ring-gray-500 disabled:bg-gray-50 disabled:text-gray-400',
    danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300 disabled:border-red-300',
    ghost: 'bg-transparent text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500',
    success: 'bg-green-600 text-white border-green-600 hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300 disabled:border-green-300',
    warning: 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700 focus:ring-orange-500 disabled:bg-orange-300 disabled:border-orange-300'
  };
  
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  };
  
  const iconSizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6'
  };

  const roundedClass = rounded ? 'rounded-full' : 'rounded-lg';
  const widthClass = fullWidth ? 'w-full' : '';

  const buttonContent = (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${roundedClass} ${widthClass} ${className}`}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon className={`${iconSizeClasses[size]} ${children ? 'mr-2' : ''}`} />
          )}
          {children}
          {Icon && iconPosition === 'right' && (
            <Icon className={`${iconSizeClasses[size]} ${children ? 'ml-2' : ''}`} />
          )}
        </>
      )}
    </button>
  );

  if (animate && !disabled) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.1 }}
      >
        {buttonContent}
      </motion.div>
    );
  }

  return buttonContent;
};