'use client';

import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
}

export function ImageLightbox({ src, alt = 'Imagem' }: ImageLightboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="group relative cursor-pointer overflow-hidden rounded-lg" onClick={() => setOpen(true)}>
        <img
          src={src}
          alt={alt}
          className="max-h-48 w-auto rounded-lg object-cover transition duration-200 group-hover:brightness-90"
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition duration-200 group-hover:bg-black/20">
          <ZoomIn className="h-6 w-6 text-white opacity-0 transition duration-200 group-hover:opacity-100" />
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
