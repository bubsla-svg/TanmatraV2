"use client";

import React, { useState } from "react";

interface SafeImageProps {
  src: string;
  alt: string;
  aspectRatio?: string; // e.g. '16/9', '4/3', '1/1'
  className?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  aspectRatio = "16/9",
  className = "",
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`relative overflow-hidden bg-neutral-900 rounded-2xl ${className}`}
      style={{ aspectRatio }}
    >
      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900" />
      )}

      {/* Fallback Placeholder */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 p-4 text-center">
          <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium tracking-wide">Tanmatra Culinary Image</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className={`w-full h-full object-cover object-center transition-opacity duration-500 ease-out ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
    </div>
  );
};
