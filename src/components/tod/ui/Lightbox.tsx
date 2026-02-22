'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Download } from 'lucide-react'

interface LightboxProps {
    src: string
    isOpen: boolean
    onClose: () => void
}

export function Lightbox({ src, isOpen, onClose }: LightboxProps) {
    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 md:p-10"
                onClick={onClose}
            >
                <div className="absolute top-4 right-4 flex items-center gap-3 z-[1001]">
                    <a
                        href={src}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-full text-white transition-colors"
                        title="Download image"
                    >
                        <Download size={20} />
                    </a>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-full text-white transition-colors"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative max-w-full max-h-full"
                    onClick={(e) => e.stopPropagation()}
                >
                    <img
                        src={src}
                        alt="Zoomed"
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                    />
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
