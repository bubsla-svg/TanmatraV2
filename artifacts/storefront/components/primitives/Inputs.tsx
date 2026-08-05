import React from "react";

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextInput: React.FC<TextInputProps> = ({ label, error, className = "", ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-sm font-medium text-[#F5F5F4]">{label}</label>
      <input
        className={`w-full bg-[#171717] border border-white/5 rounded-xl px-4 py-3 text-[#F5F5F4] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all ${
          error ? "border-[#B0655A] focus:ring-[#B0655A]" : ""
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-[#B0655A] mt-1">{error}</span>}
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
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3A3A3]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M16.65 11.325a5.325 5.325 0 11-10.65 0 5.325 5.325 0 0110.65 0z" />
        </svg>
        <input
          className={`w-full bg-[#171717] border border-white/5 rounded-full pl-11 pr-4 py-3 text-[#F5F5F4] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all ${
            error ? "border-[#B0655A]" : ""
          } ${className}`}
          type="search"
          placeholder="Search..."
          {...props}
        />
      </div>
      {error && <span className="text-xs text-[#B0655A] mt-1">{error}</span>}
    </div>
  );
};
