"use client";

import { useProduct } from "@/context/ProductContext";
import { ChevronDown, Package } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface ProductSwitcherProps {
  className?: string;
  variant?: "default" | "compact";
}

export function ProductSwitcher({
  className = "",
  variant = "default",
}: ProductSwitcherProps) {
  const { currentProduct, products, setCurrentProduct, loading } = useProduct();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Don't render if only one product or loading
  if (loading || products.length <= 1) {
    return null;
  }

  const handleSelect = (productId: string) => {
    setCurrentProduct(productId);
    setIsOpen(false);
  };

  if (variant === "compact") {
    return (
      <div ref={dropdownRef} className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
        >
          <Package className="h-4 w-4" />
          <span className="max-w-[100px] truncate">
            {currentProduct?.name || "Select Product"}
          </span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelect(product.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                  product.id === currentProduct?.id
                    ? "bg-[#502c85]/10 text-[#502c85] font-medium"
                    : "text-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{product.name}</span>
                  {product.is_default && (
                    <span className="text-xs text-gray-400">Default</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors min-w-[160px]"
      >
        <Package className="h-4 w-4 text-[#502c85]" />
        <span className="flex-1 text-left text-sm font-medium text-gray-700 truncate">
          {currentProduct?.name || "Select Product"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-1">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelect(product.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  product.id === currentProduct?.id
                    ? "bg-[#502c85] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{product.name}</span>
                  {product.is_default && product.id !== currentProduct?.id && (
                    <span className="text-xs opacity-60">Default</span>
                  )}
                </div>
                {product.description && (
                  <p
                    className={`text-xs mt-0.5 truncate ${
                      product.id === currentProduct?.id
                        ? "text-white/70"
                        : "text-gray-500"
                    }`}
                  >
                    {product.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
