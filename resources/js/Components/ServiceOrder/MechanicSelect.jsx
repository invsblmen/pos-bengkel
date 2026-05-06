import React, { useState, useRef, useEffect } from "react";
import {
    IconUser,
    IconSearch,
    IconCheck,
    IconChevronDown,
    IconEye,
    IconX,
} from "@tabler/icons-react";

export default function MechanicSelect({
    mechanics = [],
    selected,
    onSelect,
    onClear,
    placeholder = "Pilih mekanik...",
    error,
    label,
    clearButtonPlacement = "inline",
    onViewDetails,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Filter mechanics by search
    const filteredMechanics = mechanics.filter(
        (mechanic) =>
            mechanic.name.toLowerCase().includes(search.toLowerCase()) ||
            (mechanic.specialization && mechanic.specialization.toLowerCase().includes(search.toLowerCase()))
    );

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus search on open
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (mechanic) => {
        onSelect(mechanic.id);
        setIsOpen(false);
        setSearch("");
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {label}
                </label>
            )}

            {/* Select Button */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        flex-1 h-12 px-4 rounded-xl text-left
                        flex items-center gap-3
                        border-2 transition-all duration-200
                        ${
                            isOpen
                                ? "border-primary-500 ring-4 ring-primary-500/20"
                                : error
                                ? "border-danger-500"
                                : "border-slate-200 dark:border-slate-700"
                        }
                        bg-white dark:bg-slate-900
                    `}
                >
                    <div
                        className={`
                        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${
                            selected
                                ? "bg-primary-100 dark:bg-primary-900/50"
                                : "bg-slate-100 dark:bg-slate-800"
                        }
                    `}
                    >
                        <IconUser
                            size={18}
                            className={
                                selected
                                    ? "text-primary-600 dark:text-primary-400"
                                    : "text-slate-400"
                            }
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        {selected ? (
                            <>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {selected.name}
                                </p>
                                {selected.specialization && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        {selected.specialization}
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-slate-400 dark:text-slate-500">
                                {placeholder}
                            </p>
                        )}
                    </div>
                    <IconChevronDown
                        size={18}
                        className={`text-slate-400 transition-transform ${
                            isOpen ? "rotate-180" : ""
                        }`}
                    />
                </button>

                {selected && (onViewDetails || onClear) && clearButtonPlacement === "inline" && (
                    <div className="flex items-center gap-2">
                        {onViewDetails && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewDetails(selected);
                                }}
                                className="h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700
                                    text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700
                                    dark:hover:bg-slate-800 dark:hover:border-slate-600 dark:hover:text-slate-300
                                    flex items-center gap-2 transition-colors"
                                title="Lihat detail mekanik"
                            >
                                <IconEye size={18} />
                                <span className="text-xs font-medium">Detail</span>
                            </button>
                        )}
                        {onClear && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClear();
                                }}
                                className="h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700
                                    text-slate-500 hover:bg-danger-50 hover:border-danger-300 hover:text-danger-600
                                    dark:hover:bg-danger-950/30 dark:hover:border-danger-700 dark:hover:text-danger-500
                                    flex items-center gap-2 transition-colors"
                                title="Batalkan pilihan mekanik"
                            >
                                <IconX size={18} />
                                <span className="text-xs font-medium">Batalkan pilihan</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {selected && (onViewDetails || onClear) && clearButtonPlacement === "below" && (
                <div className="mt-2 flex items-center gap-2">
                    {onViewDetails && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewDetails(selected);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
                            title="Lihat detail mekanik"
                        >
                            <IconEye size={14} />
                            <span>Detail</span>
                        </button>
                    )}
                    {onClear && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                            className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-danger-600"
                            title="Batalkan pilihan mekanik"
                        >
                            <IconX size={14} />
                            <span>Batalkan pilihan</span>
                        </button>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <p className="mt-1 text-xs text-danger-500">{error}</p>
            )}

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-50 animate-slide-up overflow-hidden">
                    {/* Search */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="relative">
                            <IconSearch
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama/spesialisasi..."
                                className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Mechanic List */}
                    <div className="max-h-60 overflow-y-auto scrollbar-thin">
                        {filteredMechanics.length > 0 ? (
                            <ul>
                                {filteredMechanics.map((mechanic) => (
                                    <li key={mechanic.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(mechanic)}
                                            className={`
                                                w-full flex items-center gap-3 px-4 py-3 text-left
                                                transition-colors
                                                ${
                                                    selected?.id === mechanic.id
                                                        ? "bg-primary-50 dark:bg-primary-950/30"
                                                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                                }
                                            `}
                                        >
                                            <div
                                                className={`
                                                w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                                                ${
                                                    selected?.id === mechanic.id
                                                        ? "bg-primary-500 text-white"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                                }
                                            `}
                                            >
                                                {selected?.id === mechanic.id ? (
                                                    <IconCheck size={16} />
                                                ) : (
                                                    <IconUser size={16} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate text-slate-800 dark:text-slate-200">
                                                    {mechanic.name}
                                                </p>
                                                {mechanic.specialization && (
                                                    <p className="text-xs truncate text-slate-500 dark:text-slate-400">
                                                        {mechanic.specialization}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                                <IconUser
                                    size={24}
                                    className="mx-auto mb-2 opacity-50"
                                />
                                <p className="text-sm">
                                    Mekanik tidak ditemukan
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
