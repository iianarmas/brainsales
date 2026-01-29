"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { ProductWithRole } from "@/types/product";

const STORAGE_KEY = "brainsales_current_product_id";

interface ProductContextType {
  currentProduct: ProductWithRole | null;
  products: ProductWithRole[];
  loading: boolean;
  error: string | null;
  setCurrentProduct: (productId: string) => void;
  refreshProducts: () => Promise<void>;
  isProductAdmin: boolean;
  isSuperAdmin: boolean;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: ReactNode }) {
  const { session, user } = useAuth();
  const [currentProduct, setCurrentProductState] = useState<ProductWithRole | null>(null);
  const [products, setProducts] = useState<ProductWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  // Fetch user's products
  const fetchProducts = useCallback(async () => {
    if (!session?.access_token) {
      setProducts([]);
      setCurrentProductState(null);
      setLoading(false);
      return;
    }

    // Only show loading on initial fetch, not on token refresh re-fetches
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/products", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }

      const data = await response.json();
      const fetchedProducts: ProductWithRole[] = data.products || [];
      setProducts(fetchedProducts);

      // Determine which product to select
      if (fetchedProducts.length > 0) {
        // Try to restore from localStorage
        const savedProductId = localStorage.getItem(STORAGE_KEY);
        const savedProduct = savedProductId
          ? fetchedProducts.find((p) => p.id === savedProductId)
          : null;

        if (savedProduct) {
          setCurrentProductState(savedProduct);
        } else {
          // Use default product or first product
          const defaultProduct = fetchedProducts.find((p) => p.is_default) || fetchedProducts[0];
          setCurrentProductState(defaultProduct);
          localStorage.setItem(STORAGE_KEY, defaultProduct.id);
        }
      } else {
        setCurrentProductState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch products");
      setProducts([]);
      setCurrentProductState(null);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [session?.access_token]);

  // Fetch products when auth changes
  useEffect(() => {
    if (user) {
      fetchProducts();
    } else {
      setProducts([]);
      setCurrentProductState(null);
      setLoading(false);
    }
  }, [user, fetchProducts]);

  // Set current product
  const setCurrentProduct = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (product) {
        setCurrentProductState(product);
        localStorage.setItem(STORAGE_KEY, productId);
      }
    },
    [products]
  );

  // Refresh products (manual refresh)
  const refreshProducts = useCallback(async () => {
    await fetchProducts();
  }, [fetchProducts]);

  // Computed properties
  const isProductAdmin =
    currentProduct?.role === "admin" || currentProduct?.role === "super_admin";
  const isSuperAdmin = currentProduct?.role === "super_admin";

  return (
    <ProductContext.Provider
      value={{
        currentProduct,
        products,
        loading,
        error,
        setCurrentProduct,
        refreshProducts,
        isProductAdmin,
        isSuperAdmin,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error("useProduct must be used within a ProductProvider");
  }
  return context;
}
