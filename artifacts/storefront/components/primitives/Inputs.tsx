import React from "react";

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextInput: React.FC<TextInputProps> = ({ label, error, className = "", ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-sm font-medium text-neutral-100">{label}</label>
      <input
        className={`w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all ${
          error ? "border-red-400 focus:ring-red-400" : ""
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
    </div>
  );
};

export const SearchInput: React.FC<Omit<TextInputProps, 'label'> & { label?: string }> = ({
  label = "Search",
  error,
  className = "",
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="sr-only">{label}</label>
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M16.65 11.325a5.325 5.325 0 11-10.65 0 5.325 5.325 0 0110.65 0z" />
        </svg>
        <input
          className={`w-full bg-neutral-900 border border-white/5 rounded-full pl-11 pr-4 py-3 text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all ${
            error ? "border-red-400" : ""
          } ${className}`}
          type="search"
          placeholder="Search..."
          {...props}
        />
      </div>
      {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
    </div>
  );
};
