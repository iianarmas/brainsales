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
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch: products are loaded from localStorage on client only
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Don't render until mounted (avoids SSR/client mismatch from localStorage state)
  // Also don't render if only one product or loading
  if (!mounted || loading || products.length <= 1) {
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
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded transition-colors"
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
          <div className="absolute top-full left-0 mt-1 w-48 bg-surface-elevated border border-border-subtle rounded-lg shadow-lg z-50">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelect(product.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-active first:rounded-t-lg last:rounded-b-lg transition-colors ${product.id === currentProduct?.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/80"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span>{product.name}</span>
                  {product.is_default && (
                    <span className="text-[10px] text-muted-foreground uppercase bg-surface px-1.5 py-0.5 rounded">Default</span>
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
        className="flex items-center gap-2 px-3 py-2 bg-surface border border-border-subtle rounded-lg hover:border-primary/50 transition-all min-w-[160px] shadow-sm"
      >
        <Package className="h-4 w-4 text-primary" />
        <span className="flex-1 text-left text-sm font-semibold text-foreground truncate">
          {currentProduct?.name || "Select Product"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-surface-elevated border border-border-subtle rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-1">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelect(product.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${product.id === currentProduct?.id
                  ? "bg-primary text-white"
                  : "text-foreground/80 hover:bg-surface-active"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span>{product.name}</span>
                  {product.is_default && product.id !== currentProduct?.id && (
                    <span className="text-[10px] opacity-60 uppercase font-bold">Default</span>
                  )}
                </div>
                {product.description && (
                  <p
                    className={`text-[11px] mt-0.5 truncate ${product.id === currentProduct?.id
                      ? "text-white/80"
                      : "text-muted-foreground"
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
