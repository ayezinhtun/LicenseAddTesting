import React from "react";
import { motion } from "framer-motion";
import { ChevronDown, DivideIcon as LucideIcon } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  icon?: LucideIcon;
  className?: string;
  helperText?: string;
  multiple?: boolean;
  animate?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  error,
  disabled = false,
  required = false,
  icon: Icon,
  className = "",
  helperText,
  multiple = false,
  animate = true,
}) => {
  const selectClasses = `
    block w-full rounded-lg border-gray-300 shadow-sm
    focus:border-blue-500 focus:ring-blue-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    ${Icon ? "pl-10" : "pl-3"} pr-10 py-2.5
    ${error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""}
    appearance-none bg-white
    transition-all duration-200
  `;

  const selectElement = (
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

        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          multiple={multiple}
          className={selectClasses}
        >
          {placeholder && !multiple && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
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
        {selectElement}
      </motion.div>
    );
  }

  return selectElement;
};
