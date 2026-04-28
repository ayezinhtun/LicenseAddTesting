import { useEffect, useRef, useState } from "react";

interface MultiSelectProps {
    options: string[];
    value: string[];        // selected values
    onChange: (values: string[]) => void;
    placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
    options, value, onChange, placeholder = "Select..."
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const toggleOption = (option: string) => {
        if (value.includes(option)) {
            onChange(value.filter(v => v !== option));
        } else {
            onChange([...value, option]);
        }
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md bg-white text-left text-sm"
            >
                <div className="flex flex-wrap gap-1">
                    {value.length === 0 ? (
                        <span className="text-gray-500">{placeholder}</span>
                    ) : (
                        value.slice(0, 2).map(project => (
                            <span key={project} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                {project}
                            </span>
                        ))
                    )}
                    {value.length > 2 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            +{value.length - 2}
                        </span>
                    )}
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-10 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg">
                    {options.map((option) => (
                        <label
                            key={option}
                            className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={value.includes(option)}
                                onChange={() => toggleOption(option)}
                                className="mr-2"
                            />
                            <span className="text-sm">{option}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};