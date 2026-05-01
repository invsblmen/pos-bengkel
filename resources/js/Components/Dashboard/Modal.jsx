import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export default function Modal({
    children,
    title,
    show = false,
    maxWidth = '2xl',
    closeable = true,
    scrollable = true,
    onClose = () => { },
}) {
    const close = () => {
        if (closeable) {
            onClose();
        }
    };

    const maxWidthClass = {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-lg',
        xl: 'sm:max-w-xl',
        '2xl': 'sm:max-w-2xl',
        '3xl': 'sm:max-w-3xl',
        '4xl': 'sm:max-w-4xl',
        '5xl': 'sm:max-w-5xl',
    }[maxWidth];

    return (
        <Transition show={show} as={Fragment} leave="duration-200">
            <Dialog
                as="div"
                id="modal"
                className="fixed inset-0 flex items-start sm:items-center overflow-hidden px-4 py-10 sm:px-6 sm:py-12 z-50 transform transition-all"
                onClose={close}
            >
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-75"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="absolute inset-0 bg-gray-500/75" />
                </Transition.Child>

                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                    enterTo="opacity-100 translate-y-0 sm:scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                    leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                    <Dialog.Panel
                        className={`mb-10 max-h-[calc(100vh-5rem)] overflow-hidden bg-white dark:bg-gray-950 rounded-lg shadow-xl transform transition-all w-full sm:mx-auto ${maxWidthClass}`}
                    >
                        {title ? (
                            <Dialog.Title className={'border-b px-4 py-3 font-semibold text-base flex items-center gap-2 text-gray-700 dark:border-gray-900 dark:text-gray-300'}>
                                {title}
                            </Dialog.Title>
                        ) : null}
                        <div className={scrollable ? 'max-h-[calc(100vh-9rem)] overflow-y-auto p-4 sm:p-6' : ''}>
                            {children}
                        </div>
                    </Dialog.Panel>
                </Transition.Child>
            </Dialog>
        </Transition>
    );
}
