"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback, useMemo } from "react";
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

const PRODUCTS_CACHE_KEY = "brainsales_products_cache";

const getInitialProducts = (): ProductWithRole[] => {
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(PRODUCTS_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn("Failed to load products from cache", e);
    }
  }
  return [];
};

const getInitialCurrentProduct = (initialProducts: ProductWithRole[]): ProductWithRole | null => {
  if (typeof window !== "undefined") {
    try {
      const savedProductId = localStorage.getItem(STORAGE_KEY);
      if (savedProductId && initialProducts.length > 0) {
        return initialProducts.find((p: ProductWithRole) => p.id === savedProductId) || null;
      }
    } catch (e) {
      console.warn("Failed to load current product from cache", e);
    }
  }
  return null;
};

export function ProductProvider({ children }: { children: ReactNode }) {
  const { session, user } = useAuth();

  // Synchronous cache initialization
  const [products, setProducts] = useState<ProductWithRole[]>(getInitialProducts);

  const [currentProduct, setCurrentProductState] = useState<ProductWithRole | null>(() =>
    getInitialCurrentProduct(products)
  );

  const [loading, setLoading] = useState(!products.length);
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

      // Only update state if data changed to avoid re-renders
      if (JSON.stringify(products) !== JSON.stringify(fetchedProducts)) {
        setProducts(fetchedProducts);
        localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(fetchedProducts));
      }

      // Determine which product to select
      if (fetchedProducts.length > 0) {
        // Try to restore from localStorage
        const savedProductId = localStorage.getItem(STORAGE_KEY);
        const savedProduct = savedProductId
          ? fetchedProducts.find((p) => p.id === savedProductId)
          : null;

        const resolvedProduct = savedProduct || fetchedProducts.find((p) => p.is_default) || fetchedProducts[0];

        // Deep equality check for current product to avoid redundant re-renders
        if (JSON.stringify(currentProduct) !== JSON.stringify(resolvedProduct)) {
          setCurrentProductState(resolvedProduct);
          localStorage.setItem(STORAGE_KEY, resolvedProduct.id);
        }
      } else {
        if (currentProduct !== null) {
          setCurrentProductState(null);
          localStorage.removeItem(STORAGE_KEY);
        }
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

  const lastFetchRef = useRef<number>(0);

  // Fetch products when auth changes
  useEffect(() => {
    if (user) {
      const now = Date.now();
      // Only fetch if cache is stale (> 60s) or we have no products
      if (products.length === 0 || now - lastFetchRef.current > 60000) {
        fetchProducts().then(() => {
          lastFetchRef.current = Date.now();
        });
      }
    } else {
      setProducts([]);
      setCurrentProductState(null);
      setLoading(false);
    }
  }, [user, fetchProducts, products.length]);

  // Refresh products when window regains focus (handles deletions in admin panel)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      // Only re-fetch if tab becomes visible AND we haven't fetched in the last 60 seconds
      if (document.visibilityState === 'visible' && user && hasLoadedRef.current) {
        if (now - lastFetchRef.current > 60000) {
          fetchProducts().then(() => {
            lastFetchRef.current = Date.now();
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  const value = useMemo(() => ({
    currentProduct,
    products,
    loading,
    error,
    setCurrentProduct,
    refreshProducts,
    isProductAdmin,
    isSuperAdmin,
  }), [
    currentProduct,
    products,
    loading,
    error,
    setCurrentProduct,
    refreshProducts,
    isProductAdmin,
    isSuperAdmin
  ]);

  return (
    <ProductContext.Provider value={value}>
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
