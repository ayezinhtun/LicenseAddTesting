import React, { useState } from "react";
import { motion } from "framer-motion";
import { DivideIcon as LucideIcon, Eye, EyeOff } from "lucide-react";

interface InputProps {
  label?: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "date"
    | "url"
    | "tel"
    | "search";
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  icon?: LucideIcon;
  className?: string;
  helperText?: string;
  autoComplete?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  showPasswordToggle?: boolean;
  animate?: boolean;

  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

export const Input: React.FC<InputProps> = ({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  icon: Icon,
  className = "",
  helperText,
  autoComplete,
  maxLength,
  min,
  max,
  step,
  showPasswordToggle = true,
  animate = true,

  onFocus,
  onBlur,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputType = type === "password" && showPassword ? "text" : type;
  const hasPasswordToggle = type === "password" && showPasswordToggle;

  const inputClasses = `
    block w-full rounded-lg border-gray-300 shadow-sm
    focus:border-blue-500 focus:ring-blue-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    ${Icon ? "pl-10" : "pl-3"} 
    ${hasPasswordToggle ? "pr-10" : "pr-3"} 
    py-2.5
    ${error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}
    ${isFocused ? "ring-2 ring-blue-500 ring-opacity-20" : ""}
    transition-all duration-200
  `;

  const inputElement = (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-4 w-4 text-gray-400" />
          </div>
        )}

        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          min={min}
          max={max}
          step={step}
          className={inputClasses}
        />

        {hasPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {(error || helperText) && (
        <div className="flex items-start space-x-1">
          {error && <p className="text-sm text-red-600 flex-1">{error}</p>}
          {helperText && !error && (
            <p className="text-sm text-gray-500 flex-1">{helperText}</p>
          )}
        </div>
      )}
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {inputElement}
      </motion.div>
    );
  }

  return inputElement;
};
