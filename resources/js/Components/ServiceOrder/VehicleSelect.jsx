import React, { useState, useRef, useEffect } from "react";
import {
    IconCar,
    IconSearch,
    IconCheck,
    IconChevronDown,
} from "@tabler/icons-react";
import QuickCreateVehicleModal from "@/Components/Dashboard/QuickCreateVehicleModal";

export default function VehicleSelect({
    vehicles = [],
    customers = [],
    selected,
    onSelect,
    placeholder = "Pilih kendaraan...",
    error,
    label,
    getOptionDisabled,
    renderOption,
    onVehicleAdded,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Filter vehicles by search
    const filteredVehicles = vehicles.filter(
        (vehicle) =>
            vehicle.plate_number.toLowerCase().includes(search.toLowerCase()) ||
            vehicle.brand.toLowerCase().includes(search.toLowerCase()) ||
            vehicle.model.toLowerCase().includes(search.toLowerCase())
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

    const handleSelect = (vehicle) => {
        onSelect(vehicle.id);
        setIsOpen(false);
        setSearch("");
    };

    const handleAddVehicleSuccess = (newVehicle) => {
        setShowAddModal(false);
        onSelect(newVehicle.id);
        onVehicleAdded?.(newVehicle);
    };

    return (
        <>
            <div ref={containerRef} className="relative">
                {/* Label */}
                {label && (
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {label}
                    </label>
                )}

                {/* Select Button with Add */}
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
                            <IconCar
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
                                        {selected.formatted_plate_number || selected.plate_number}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        {selected.brand} {selected.model}
                                    </p>
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

                    {/* Add Vehicle Button */}
                    <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="h-12 w-12 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700
                            text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/30
                            flex items-center justify-center transition-colors"
                        title="Tambah kendaraan baru"
                    >
                        <IconCar size={20} />
                    </button>
                </div>

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
                                    placeholder="Cari plat/brand/model..."
                                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Vehicle List */}
                        <div className="max-h-60 overflow-y-auto scrollbar-thin">
                            {filteredVehicles.length > 0 ? (
                                <ul>
                                    {filteredVehicles.map((vehicle) => {
                                        const isDisabled = getOptionDisabled?.(vehicle) || false;
                                        return (
                                            <li key={vehicle.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        !isDisabled && handleSelect(vehicle)
                                                    }
                                                    disabled={isDisabled}
                                                    className={`
                                                        w-full flex items-center gap-3 px-4 py-3 text-left
                                                        transition-colors
                                                        ${
                                                            isDisabled
                                                                ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800"
                                                                : selected?.id === vehicle.id
                                                                ? "bg-primary-50 dark:bg-primary-950/30"
                                                                : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                                        }
                                                    `}
                                                >
                                                    <div
                                                        className={`
                                                        w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                                                        ${
                                                            selected?.id === vehicle.id
                                                                ? "bg-primary-500 text-white"
                                                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                                        }
                                                    `}
                                                    >
                                                        {selected?.id === vehicle.id ? (
                                                            <IconCheck size={16} />
                                                        ) : (
                                                            <IconCar size={16} />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        {renderOption ? (
                                                            renderOption(vehicle, isDisabled)
                                                        ) : (
                                                            <>
                                                                <p className={`text-sm font-medium truncate ${
                                                                    isDisabled
                                                                        ? "text-slate-400 dark:text-slate-500"
                                                                        : "text-slate-800 dark:text-slate-200"
                                                                }`}>
                                                                    {vehicle.formatted_plate_number || vehicle.plate_number}
                                                                </p>
                                                                <p className={`text-xs truncate ${
                                                                    isDisabled
                                                                        ? "text-slate-400 dark:text-slate-500"
                                                                        : "text-slate-500 dark:text-slate-400"
                                                                }`}>
                                                                    {vehicle.brand} {vehicle.model} • {vehicle.year}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                                    <IconCar
                                        size={24}
                                        className="mx-auto mb-2 opacity-50"
                                    />
                                    <p className="text-sm">
                                        Kendaraan tidak ditemukan
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsOpen(false);
                                            setShowAddModal(true);
                                        }}
                                        className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-medium"
                                    >
                                        + Tambah kendaraan baru
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Vehicle Modal */}
            <QuickCreateVehicleModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                customers={customers}
                onSuccess={handleAddVehicleSuccess}
            />
        </>
    );
}
