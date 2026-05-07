import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export function SidebarProvider({ children }) {
    const [favorites, setFavorites] = useState(() => {
        const saved = localStorage.getItem('sidebarFavorites');
        return saved ? JSON.parse(saved) : [];
    });

    const [expandedSections, setExpandedSections] = useState(() => {
        const saved = localStorage.getItem('sidebarExpandedSections');
        return saved ? JSON.parse(saved) : [];
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownStates, setDropdownStates] = useState(() => {
        const saved = localStorage.getItem('sidebarDropdownStates');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('sidebarFavorites', JSON.stringify(favorites));
    }, [favorites]);

    useEffect(() => {
        localStorage.setItem('sidebarExpandedSections', JSON.stringify(expandedSections));
    }, [expandedSections]);

    useEffect(() => {
        localStorage.setItem('sidebarDropdownStates', JSON.stringify(dropdownStates));
    }, [dropdownStates]);

    const toggleFavorite = (href) => {
        setFavorites(prev =>
            prev.includes(href)
                ? prev.filter(item => item !== href)
                : [...prev, href]
        );
    };

    const toggleSection = (title) => {
        setExpandedSections(prev =>
            prev.includes(title)
                ? prev.filter(item => item !== title)
                : [...prev, title]
        );
    };

    const isFavorite = (href) => favorites.includes(href);
    const isSectionExpanded = (title) => expandedSections.includes(title);

    const getDropdownState = (key, fallback = false) => {
        return Object.prototype.hasOwnProperty.call(dropdownStates, key)
            ? dropdownStates[key]
            : fallback;
    };

    const setDropdownState = (key, value) => {
        setDropdownStates(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const toggleDropdownState = (key, fallback = false) => {
        setDropdownState(key, !getDropdownState(key, fallback));
    };

    const resetSidebarPreferences = () => {
        setFavorites([]);
        setExpandedSections([]);
        setDropdownStates({});
        setSearchQuery('');

        localStorage.removeItem('sidebarFavorites');
        localStorage.removeItem('sidebarExpandedSections');
        localStorage.removeItem('sidebarDropdownStates');
    };

    return (
        <SidebarContext.Provider
            value={{
                favorites,
                expandedSections,
                dropdownStates,
                searchQuery,
                setSearchQuery,
                toggleFavorite,
                toggleSection,
                isFavorite,
                isSectionExpanded,
                getDropdownState,
                setDropdownState,
                toggleDropdownState,
                resetSidebarPreferences,
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within SidebarProvider');
    }
    return context;
}
