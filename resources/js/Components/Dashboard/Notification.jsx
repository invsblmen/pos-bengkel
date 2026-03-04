import React, { useState, useEffect, useRef } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Link, usePage } from '@inertiajs/react'
import { IconBell, IconDots, IconCircleCheck, IconCircleCheckFilled, IconAlertCircle, IconShoppingCart } from '@tabler/icons-react'
export default function Notification() {
    const { lowStockAlerts, notifications } = usePage().props;
    const alerts = lowStockAlerts?.items || [];
    const purchaseNotifications = notifications?.items || [];
    const unreadCount = (lowStockAlerts?.count || 0) + (notifications?.count || 0);

    const getAction = (notification) => {
        if (notification.purchase_id) {
            return {
                label: 'Lihat Pembelian',
                href: route('part-purchases.show', notification.purchase_id),
                className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
            };
        }

        if (notification.sale_id) {
            return {
                label: 'Lihat Part Sale',
                href: route('part-sales.show', notification.sale_id),
                className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
            };
        }

        return null;
    };

    // define state isMobile
    const [isMobile, setIsMobile] = useState(false);
    // define state isOpen
    const [isOpen, setIsOpen] = useState(false);
    // define ref notification
    const notificationRef = useRef(null);

    // define method handleClickOutside
    const handleClickOutside = (event) => {
        if (notificationRef.current && !notificationRef.current.contains(event.target)) {
            setIsOpen(false);
        }
    };

    // define useEffect
    useEffect(() => {
        // define handle resize window
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        // define event listener
        window.addEventListener('resize', handleResize);

        // add event listener
        window.addEventListener("mousedown", handleClickOutside);

        // call handle resize window
        handleResize();

        // remove event listener
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousedown', handleClickOutside);
        };
    })

    return (
        <>
            {isMobile === false ?
                <Menu className='relative z-50' as="div">
                    <Menu.Button className='flex items-center rounded-md group p-2'>
                        {unreadCount > 0 && (
                            <div className='absolute text-[8px] font-semibold border border-rose-500/40 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 top-0 -right-2 rounded-md px-1.5 py-0.5 group-hover:scale-125 duration-300 ease-in'>
                                {unreadCount}
                            </div>
                        )}
                        <IconBell strokeWidth={1.5} size={18} className='text-gray-700 dark:text-gray-400' />
                    </Menu.Button>
                    <Transition
                        enter="transition duration-100 ease-out"
                        enterFrom="transform scale-95 opacity-0"
                        enterTo="transform scale-100 opacity-100"
                        leave="transition duration-75 ease-out"
                        leaveFrom="transform scale-100 opacity-100"
                        leaveTo="transform scale-95 opacity-0"
                    >
                        <Menu.Items className='absolute rounded-lg w-[500px] border md:right-0 z-[100] bg-white dark:bg-gray-950 dark:border-gray-900'>
                            <div className='flex justify-between items-center gap-2 p-4 border-b dark:border-gray-900'>
                                <div className='text-lg font-bold text-gray-700 dark:text-gray-200'>Notifikasi</div>
                                <IconDots className='text-gray-500 dark:text-gray-200' size={24} />
                            </div>
                            <div className='p-4'>
                                <div className='flex flex-col gap-2 items-start h-60 overflow-y-auto'>
                                    {purchaseNotifications.length === 0 && alerts.length === 0 && (
                                        <div className='text-sm text-gray-500 dark:text-gray-400'>Tidak ada notifikasi</div>
                                    )}
                                    {purchaseNotifications.map((notification) => {
                                        const action = getAction(notification);
                                        const Wrapper = action ? Link : 'div';
                                        const wrapperProps = action ? { href: action.href } : {};

                                        return (
                                        <Wrapper
                                            key={notification.id}
                                            {...wrapperProps}
                                            className='flex items-center justify-between w-full p-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-900'
                                        >
                                            <div className='flex items-center gap-4'>
                                                <IconShoppingCart size={20} className='text-amber-500' />
                                                <div>
                                                    <div className='font-semibold text-sm text-gray-700 dark:text-gray-200'>
                                                        {notification.title}
                                                        {notification.created_at && (
                                                            <sup className='text-xs font-mono text-gray-400 ml-1'>{notification.created_at}</sup>
                                                        )}
                                                    </div>
                                                    <div className='text-gray-500 text-sm'>
                                                        {notification.message}
                                                        {notification.reference && (
                                                            <span className='text-gray-400'> · Ref: {notification.reference}</span>
                                                        )}
                                                    </div>
                                                    {action && (
                                                        <div className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold mt-1 ${action.className}`}>
                                                            {action.label}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {notification.read_at ? (
                                                <IconCircleCheckFilled size={20} strokeWidth={1.5} className='text-gray-500 dark:text-gray-400' />
                                            ) : (
                                                <IconCircleCheck size={20} strokeWidth={1.5} className='text-gray-500 dark:text-gray-400' />
                                            )}
                                        </Wrapper>
                                        );
                                    })}
                                    {alerts.map((alert) => (
                                        <div className='flex items-center justify-between w-full p-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-900' key={alert.id}>
                                            <div className='flex items-center gap-4'>
                                                <IconAlertCircle size={20} className='text-rose-500' />
                                                <div>
                                                    <div className='font-semibold text-sm text-gray-700 dark:text-gray-200'>
                                                        Stok Minim <sup className='text-xs font-mono text-gray-400 ml-1'>{alert.created_at}</sup>
                                                    </div>
                                                    <div className='text-gray-500 text-sm'>
                                                        {alert.part?.name || 'Part'} ({alert.current_stock}/{alert.minimal_stock})
                                                    </div>
                                                </div>
                                            </div>
                                            {alert.is_read ? (
                                                <IconCircleCheckFilled size={20} strokeWidth={1.5} className='text-gray-500 dark:text-gray-400' />
                                            ) : (
                                                <IconCircleCheck size={20} strokeWidth={1.5} className='text-gray-500 dark:text-gray-400' />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className='mt-3 flex items-center justify-between'>
                                    <Link className='text-sm font-medium text-primary-600 hover:text-primary-700' href={route('parts.low-stock')}>Stok minimal ({lowStockAlerts?.total_count || lowStockAlerts?.count || 0})</Link>
                                    <Link className='text-sm font-medium text-primary-600 hover:text-primary-700' href={route('notifications.index')}>Kelola notifikasi</Link>
                                </div>
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>
                :
                <div ref={notificationRef}>
                    <button className='flex items-center rounded-md group p-2 relative' onClick={() => setIsOpen(!isOpen)}>
                        {unreadCount > 0 && (
                            <div className='absolute text-[8px] font-semibold border border-rose-500/40 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 top-0 -right-2 rounded-md px-1.5 py-0.5 group-hover:scale-125 duration-300 ease-in'>
                                {unreadCount}
                            </div>
                        )}
                        <IconBell strokeWidth={1.5} size={18} className='text-gray-500 dark:text-gray-400' />
                    </button>
                    <div className={`${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full'} fixed top-0 right-0 z-50 w-[300px] h-full transition-all duration-300 transform border-l bg-white dark:bg-gray-950 dark:border-gray-900`}>
                        <div className='flex justify-between items-center gap-2 p-4 border-b mt-2 dark:border-gray-900 '>
                            <div className='text-base font-bold text-gray-500 dark:text-gray-400 '>Notifications</div>
                            <IconDots className='text-gray-500 dark:text-gray-400' size={24} />
                        </div>
                        <div className='p-4'>
                            <div className='flex flex-col gap-2 items-start overflow-y-auto h-screen'>
                                {purchaseNotifications.length === 0 && alerts.length === 0 && (
                                    <div className='text-sm text-gray-500 dark:text-gray-400'>Tidak ada notifikasi</div>
                                )}
                                {purchaseNotifications.map((notification) => {
                                    const action = getAction(notification);
                                    const Wrapper = action ? Link : 'div';
                                    const wrapperProps = action ? { href: action.href } : {};

                                    return (
                                    <Wrapper
                                        key={notification.id}
                                        {...wrapperProps}
                                        className='flex items-center justify-between w-full p-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-900'
                                    >
                                        <div className='flex items-center gap-4'>
                                            <IconShoppingCart size={18} className='text-amber-500' />
                                            <div className='w-full'>
                                                <div className='font-semibold text-sm line-clamp-1 text-gray-700 dark:text-gray-200'>
                                                    {notification.title}
                                                    {notification.created_at && (
                                                        <sup className='text-xs font-mono text-gray-400 ml-1'>{notification.created_at}</sup>
                                                    )}
                                                </div>
                                                <div className='text-gray-500 text-sm line-clamp-1 max-w-[155px]'>
                                                    {notification.message}
                                                    {notification.reference && (
                                                        <span className='text-gray-400'> · Ref: {notification.reference}</span>
                                                    )}
                                                </div>
                                                {action && (
                                                    <div className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold mt-1 ${action.className}`}>
                                                        {action.label}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {notification.read_at ? (
                                            <IconCircleCheckFilled size={20} strokeWidth={1.5} className='text-gray-500 dark:text-gray-400' />
                                        ) : (
                                            <IconCircleCheck size={20} strokeWidth={1.5} className='text-gray-500 dark:text-gray-400' />
                                        )}
                                    </Wrapper>
                                    );
                                })}
                                {alerts.map((alert) => (
                                    <div className='flex items-center justify-between w-full p-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-900' key={alert.id}>
                                        <div className='flex items-center gap-4'>
                                            <IconAlertCircle size={18} className='text-rose-500' />
                                            <div className='w-full'>
                                                <div className='font-semibold text-sm line-clamp-1 text-gray-700 dark:text-gray-200'>
                                                    Stok Minim <sup className='text-xs font-mono text-gray-400 ml-1'>{alert.created_at}</sup>
                                                </div>
                                                <div className='text-gray-500 text-sm line-clamp-1 max-w-[155px]'>
                                                    {alert.part?.name || 'Part'} ({alert.current_stock}/{alert.minimal_stock})
                                                </div>
                                            </div>
                                        </div>
                                        {alert.is_read ? (
                                            <IconCircleCheckFilled size={20} strokeWidth={1.5} className='text-gray-500 dark:text-gray-400' />
                                        ) : (
                                            <IconCircleCheck size={20} strokeWidth={1.5} className='text-gray-500 dark:text-gray-400' />
                                        )}
                                    </div>
                                ))}
                                <div className='flex items-center justify-between w-full py-2'>
                                    <Link className='text-sm font-medium text-primary-600 hover:text-primary-700' href={route('parts.low-stock')}>Stok minimal ({lowStockAlerts?.total_count || lowStockAlerts?.count || 0})</Link>
                                    <Link className='text-sm font-medium text-primary-600 hover:text-primary-700' href={route('notifications.index')}>Kelola notifikasi</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            }
        </>
    )
}
