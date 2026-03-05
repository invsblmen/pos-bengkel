import React, { useState, useRef, useEffect } from 'react';
import { IconChevronDown, IconPlus, IconSearch, IconX } from '@tabler/icons-react';

export default function Autocomplete({
    label,
    value,
    onChange,
    options = [],
    displayField = 'name',
    searchFields = ['name'],
    placeholder = 'Ketik untuk mencari...',
    onCreateNew,
    createLabel = 'Buat Baru',
    errors,
    required = false,
    disabled = false,
    getOptionDisabled = null,
    renderOption = null,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    // Get selected option display text
    const selectedOption = options.find(opt => opt.id === value);
    const displayText = selectedOption
        ? (typeof displayField === 'function' ? displayField(selectedOption) : selectedOption[displayField])
        : '';

    // Filter options based on search term
    const filteredOptions = searchTerm
        ? options.filter(option => {
            const searchLower = searchTerm.toLowerCase();
            return searchFields.some(field => {
                const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], option);
                return fieldValue?.toString().toLowerCase().includes(searchLower);
            });
        })
        : options;

    // Handle click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
                    handleSelect(filteredOptions[highlightedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setSearchTerm('');
                break;
        }
    };

    const handleSelect = (option) => {
        // Check if option is disabled
        if (getOptionDisabled && getOptionDisabled(option)) {
            return;
        }
        onChange(option.id);
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
    };

    const handleClear = () => {
        onChange('');
        setSearchTerm('');
        inputRef.current?.focus();
    };

    const handleCreateNew = () => {
        if (onCreateNew) {
            onCreateNew(searchTerm);
            setIsOpen(false);
            setSearchTerm('');
        }
    };

    return (
        <div className="relative z-50" ref={wrapperRef}>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label} {required && <span className="text-red-500">*</span>}
            </label>

            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={isOpen ? searchTerm : (displayText || '')}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`block w-full rounded-xl border ${
                        errors ? 'border-red-500' : 'border-gray-300'
                    } bg-white px-4 py-2.5 pr-20 text-gray-900 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100`}
                />

                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                        >
                            <IconX size={16} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        disabled={disabled}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                    >
                        <IconChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {errors && <p className="mt-1 text-sm text-red-600">{errors}</p>}

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {filteredOptions.length > 0 ? (
                        <div className="py-1">
                            {filteredOptions.map((option, index) => {
                                const isDisabled = getOptionDisabled ? getOptionDisabled(option) : false;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => handleSelect(option)}
                                        disabled={isDisabled}
                                        className={`w-full px-4 py-2 text-left text-sm transition ${
                                            isDisabled
                                                ? 'cursor-not-allowed opacity-60 bg-gray-50 dark:bg-gray-900'
                                                : index === highlightedIndex
                                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                : value === option.id
                                                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                                                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {renderOption ? (
                                            renderOption(option, isDisabled)
                                        ) : (
                                            typeof displayField === 'function'
                                                ? displayField(option)
                                                : option[displayField]
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                                <IconSearch size={16} />
                                <span>Tidak ditemukan</span>
                            </div>
                        </div>
                    )}

                    {/* Create New Button */}
                    {onCreateNew && searchTerm && (
                        <div className="border-t border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={handleCreateNew}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                            >
                                <IconPlus size={16} />
                                <span>{createLabel}: "{searchTerm}"</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
