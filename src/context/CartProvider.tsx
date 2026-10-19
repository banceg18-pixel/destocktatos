"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { calculateDeliveryFee, type DeliveryMethod } from "@/lib/delivery";
import { offerUnitEuros } from "@/lib/offers";
import { useError } from "@/context/PopUpProvider";
import { validateCoupon } from "@/services/loyalty";
import type { CartItem, ShippingAddress, AppliedCoupon } from "@/types/cart";

export type { CartItem, ShippingAddress, AppliedCoupon } from "@/types/cart";

export type AddToCartInput = Omit<CartItem, "quantity">;

interface CartContextValue {
  cart: CartItem[];
  addToCart: (item: AddToCartInput) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  termsAccepted: boolean;
  cookieConsentShown: boolean;
  showCookieConsent: () => void;
  hideCookieConsent: () => void;
  acceptTerms: () => void;
  rejectTerms: () => void;
  resetCookieConsent: () => void;
  userId: string | null;
  deliveryMethod: DeliveryMethod | null;
  deliveryDistance: number;
  deliveryFee: number;
  includeOldItemPickup: boolean;
  setDeliveryMethod: (m: DeliveryMethod | null) => void;
  setDeliveryDistance: (d: number) => void;
  setIncludeOldItemPickup: (v: boolean) => void;
  resetDeliveryMethod: () => void;
  calculateTotalWithDelivery: () => number;
  isPickupInStore: boolean;
  setIsPickupInStore: (v: boolean) => void;
  shippingAddress: ShippingAddress | null;
  setShippingAddress: (a: ShippingAddress | null) => void;
  isShippingAddressValid: () => boolean;
  appliedCoupon: AppliedCoupon | null;
  couponLoading: boolean;
  /** Renvoie le message d'erreur à afficher sous le champ, ou null si le code est appliqué. */
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => void;
  getTotalWithDiscount: () => number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

/**
 * Panier client : persistance localStorage (stockage nécessaire au service), consentement
 * réservé à la mesure d'audience, frais de livraison calculés à l'affichage
 * (le backend recalcule tout lors de la création de la commande).
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [consentHidden, setConsentHidden] = useState(true);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | null>(null);
  const [deliveryDistance, setDeliveryDistance] = useState(0);
  const [includeOldItemPickup, setIncludeOldItemPickup] = useState(false);
  const [isPickupInStore, setIsPickupInStore] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const { setError } = useError();
  const setErrorRef = useRef(setError);

  // Les mises à jour faites au montage (session, consentement, panier enregistré) passent en
  // transition : elles ne doivent pas interrompre l'hydratation de la page, qui se termine d'abord
  // (sinon React peut abandonner le HTML serveur sur un appareil ou un serveur très sollicité).
  useEffect(() => {
    startTransition(() => setUserId(status === "authenticated" && session?.user ? (session.user.email ?? null) : null));
  }, [session, status]);

  useEffect(() => {
    if (status === "loading") return;
    startTransition(() => {
      try {
        const consent = localStorage.getItem("cookieConsent");
        if (consent === "accepted") {
          setTermsAccepted(true);
          setConsentHidden(true);
        } else if (consent === "rejected") {
          setTermsAccepted(false);
          setConsentHidden(true);
        } else {
          setConsentHidden(false);
        }
        setConsentLoaded(true);
      } catch {
        setErrorRef.current("Impossible d'accéder au localStorage");
        setConsentLoaded(true);
        setConsentHidden(false);
      }
    });
  }, [status]);

  // Le panier est conservé sur l'appareil quel que soit le choix sur les cookies : c'est un
  // stockage strictement nécessaire au service demandé (le consentement ne vise que la mesure
  // d'audience).
  const [cartLoaded, setCartLoaded] = useState(false);
  useEffect(() => {
    startTransition(() => {
      try {
        const stored = localStorage.getItem("cart");
        if (stored) setCart(JSON.parse(stored));
      } catch {
        try {
          localStorage.removeItem("cart");
        } catch {
          /* stockage indisponible : panier en mémoire seulement */
        }
      }
      setCartLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      localStorage.setItem("cart", JSON.stringify(cart));
    } catch {
      /* stockage plein ou indisponible : le panier reste en mémoire */
    }
  }, [cart, cartLoaded]);

  const deliveryFee = useMemo(() => {
    if (isPickupInStore || !deliveryMethod || deliveryDistance <= 0) return 0;
    try {
      return calculateDeliveryFee(deliveryMethod, includeOldItemPickup);
    } catch {
      setErrorRef.current("Impossible de calculer les frais de livraison");
      return 0;
    }
  }, [deliveryMethod, deliveryDistance, includeOldItemPickup, isPickupInStore]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  // Même calcul que le serveur : prix de vente, puis l'offre -10 % au-delà de 1 000 € (en centimes).
  const totalPrice = cart.reduce((sum, item) => sum + Math.round(offerUnitEuros(item.promotionPrix || item.prix) * 100) * item.quantity, 0) / 100;

  const calculateTotalWithDelivery = useCallback(() => Math.max(0, totalPrice - (appliedCoupon?.discount || 0) + deliveryFee), [totalPrice, deliveryFee, appliedCoupon]);
  const getTotalWithDiscount = useCallback(() => Math.max(0, totalPrice - (appliedCoupon?.discount || 0)), [totalPrice, appliedCoupon]);

  const applyCoupon = async (code: string): Promise<string | null> => {
    if (!code.trim()) return "Saisissez le code de réduction, par exemple BIENVENUE10.";
    if (status !== "authenticated") return "Connectez-vous à votre compte pour utiliser un code de réduction.";
    setCouponLoading(true);
    try {
      const result = await validateCoupon(code.trim(), totalPrice);
      if (!result.ok) return result.error || "Ce code n'est pas valable : vérifiez l'orthographe.";
      setAppliedCoupon({
        coupon_id: result.data.coupon_id,
        code: result.data.couponCode,
        discount: result.data.discount,
        message: result.data.message,
      });
      return null;
    } catch {
      return "Le code n'a pas pu être vérifié. Réessayez dans un instant.";
    } finally {
      setCouponLoading(false);
    }
  };

  const removeFromCart = (id: string) => setCart((items) => items.filter((i) => i._id !== id));

  const isShippingAddressValid = useCallback(
    () =>
      !!shippingAddress &&
      !!(
        shippingAddress.fullName?.trim() &&
        shippingAddress.address?.trim() &&
        shippingAddress.city?.trim() &&
        shippingAddress.postalCode?.trim() &&
        shippingAddress.phone?.trim()
      ),
    [shippingAddress],
  );

  const resetDeliveryMethod = useCallback(() => {
    setDeliveryMethod(null);
    setIncludeOldItemPickup(false);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart: (item) => {
          if (consentLoaded && !termsAccepted && localStorage.getItem("cookieConsent") !== "accepted" && localStorage.getItem("cookieConsent") !== "rejected") {
            setConsentHidden(false);
          }
          setCart((items) =>
            items.find((i) => i._id === item._id) ? items.map((i) => (i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i)) : [...items, { ...item, quantity: 1 }],
          );
        },
        removeFromCart,
        updateQuantity: (id, quantity) => {
          if (quantity < 1) removeFromCart(id);
          else setCart((items) => items.map((i) => (i._id === id ? { ...i, quantity } : i)));
        },
        clearCart: () => {
          setCart([]);
          setAppliedCoupon(null);
        },
        totalItems,
        totalPrice,
        termsAccepted,
        cookieConsentShown: !consentLoaded || consentHidden,
        showCookieConsent: () => setConsentHidden(false),
        hideCookieConsent: () => setConsentHidden(true),
        acceptTerms: () => {
          setTermsAccepted(true);
          setConsentHidden(true);
          localStorage.setItem("cookieConsent", "accepted");
        },
        rejectTerms: () => {
          setTermsAccepted(false);
          setConsentHidden(true);
          localStorage.setItem("cookieConsent", "rejected");
        },
        resetCookieConsent: () => {
          try {
            localStorage.removeItem("cookieConsent");
            setTermsAccepted(false);
            setConsentHidden(false);
            setConsentLoaded(true);
          } catch {
            setErrorRef.current("Impossible de réinitialiser les préférences");
          }
        },
        userId,
        deliveryMethod,
        deliveryDistance,
        deliveryFee,
        includeOldItemPickup,
        setDeliveryMethod,
        setDeliveryDistance,
        setIncludeOldItemPickup,
        resetDeliveryMethod,
        calculateTotalWithDelivery,
        isPickupInStore,
        setIsPickupInStore,
        shippingAddress,
        setShippingAddress,
        isShippingAddressValid,
        appliedCoupon,
        couponLoading,
        applyCoupon,
        removeCoupon: () => setAppliedCoupon(null),
        getTotalWithDiscount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
