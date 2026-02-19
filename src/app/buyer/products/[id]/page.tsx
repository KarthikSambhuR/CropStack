'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Product } from '@/lib/supabase';
import { db, doc, getDoc, addDoc, updateDoc, collection } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    ShoppingCart,
    ShieldCheck,
    Info,
    Loader2,
    Warehouse,
    TrendingUp,
    CheckCircle2,
    Lock,
    Globe,
    Package,
    MapPin,
    AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

export default function ProductDetail() {
    const { id } = useParams() as { id: string };
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const [product, setProduct] = useState<Product | null>(null);
    const [sellerName, setSellerName] = useState<string>('Verified Seller');
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [reserving, setReserving] = useState(false);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const productSnap = await getDoc(doc(db, 'products', id));
                if (productSnap.exists()) {
                    const productData = { id: productSnap.id, ...productSnap.data() } as Product;
                    setProduct(productData);

                    // Fetch seller name
                    try {
                        const sellerSnap = await getDoc(doc(db, 'profiles', productData.seller_id));
                        if (sellerSnap.exists()) {
                            setSellerName(sellerSnap.data().full_name || 'Verified Seller');
                        }
                    } catch { }
                }
            } catch (err) {
                console.error('Error fetching product:', err);
            }
            setLoading(false);
        };

        fetchProduct();
    }, [id]);

    const handleReserve = async () => {
        if (!user || !product) return;

        // 1. Initial local validation
        if (quantity <= 0) {
            alert('Please enter a valid amount.');
            return;
        }

        setReserving(true);

        try {
            // 2. Real-time stock re-check from Firestore
            const productRef = doc(db, 'products', id);
            const productSnap = await getDoc(productRef);

            if (!productSnap.exists()) {
                alert('Product no longer available.');
                setReserving(false);
                return;
            }

            const latestPrice = productSnap.data().price_per_unit;
            const latestQty = productSnap.data().quantity_available || 0;

            if (quantity > latestQty) {
                alert(`Sorry, only ${latestQty} ${product.unit} available now. Stock has been updated.`);
                setProduct({ ...product, quantity_available: latestQty, price_per_unit: latestPrice });
                setReserving(false);
                return;
            }

            const pickup_code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const subtotal = latestPrice * quantity;
            const reservationFee = subtotal * 0.05; // 5% non-refundable fee
            const now = new Date().toISOString();

            // Fetch buyer name for organizer display
            let buyerName = 'Buyer';
            try {
                const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
                if (profileSnap.exists()) {
                    buyerName = profileSnap.data().full_name || 'Buyer';
                }
            } catch { }

            try {
                // 1. Create the order with status 'pending' — awaits organizer approval
                const orderRef = await addDoc(collection(db, 'orders'), {
                    buyer_id: user.uid,
                    product_id: product.id,
                    seller_id: product.seller_id,
                    quantity: quantity,
                    total_price: subtotal,
                    reservation_fee: reservationFee,
                    status: 'pending',
                    fee_paid: true,
                    pickup_code,
                    buyer_name: buyerName,
                    product_name: product.name,
                    reservation_expiry: null,
                    created_at: now,
                });

                // 2. Deduct stock immediately to prevent overbooking
                const newQty = Math.max(0, latestQty - quantity);
                await updateDoc(doc(db, 'products', product.id), {
                    quantity_available: newQty,
                });

                // 4. Update order to show success or redirect
                router.push(`/buyer/orders/${orderRef.id}`);
            } catch (err: any) {
                console.error('Order failed:', err);
                alert(err.message || 'Failed to place order. Please try again.');
            }
        } catch (err) {
            console.error('Reservation validation failed:', err);
            alert('Could not validate stock. Please try again.');
        } finally {
            setReserving(false);
        }
    };

    if (loading) return (
        <DashboardLayout role="buyer">
            <div className="shimmer" style={{ height: '600px', borderRadius: '24px' }}></div>
        </DashboardLayout>
    );

    if (!product) return (
        <DashboardLayout role="buyer">
            <div className="card-white" style={{ textAlign: 'center', padding: '5rem' }}>
                <Package size={48} color="var(--text-soft)" style={{ marginBottom: '1rem' }} />
                <h2 style={{ marginBottom: '0.5rem' }}>Product Not Found</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>This crop listing may have been removed.</p>
                <Link href="/buyer/catalog" className="btn-modern btn-primary-modern">Browse Catalog</Link>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout role="buyer">
            <Link href="/buyer/catalog" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '2.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                <ArrowLeft size={16} /> {t('back_to')} {t('catalog')}
            </Link>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '2.5rem' }}>
                <div className="card-white" style={{ padding: '3rem' }}>
                    <div style={{ display: 'flex', gap: '3rem', marginBottom: '3rem' }}>
                        <div style={{ width: '320px', height: '320px', borderRadius: '20px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                            <img src={product.image_url || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b'} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <span className="badge-clean badge-success" style={{ background: 'var(--success-soft)' }}>
                                    <ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Verified Listing
                                </span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-soft)' }}>ID: {product.id.slice(0, 8)}</span>
                            </div>
                            <h1 style={{ fontSize: '2.5rem', color: 'var(--secondary)', marginBottom: '1rem' }}>{product.name}</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                                {product.description || `Fresh ${product.category?.toLowerCase()} sourced directly from verified farmers. Quality guaranteed with secure pickup at your nearest warehouse.`}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div style={{ padding: '1.25rem', background: 'var(--bg-main)', borderRadius: '16px', border: '1px solid var(--border-soft)' }}>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Sold By</p>
                                    <p style={{ fontWeight: 800, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Globe size={16} color="var(--primary)" /> {sellerName}
                                    </p>
                                </div>
                                <div style={{ padding: '1.25rem', background: 'var(--bg-main)', borderRadius: '16px', border: '1px solid var(--border-soft)' }}>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Category</p>
                                    <p style={{ fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <TrendingUp size={16} /> {product.category}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '2.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>How It Works</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <ShoppingCart size={24} color="var(--primary)" />
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Reserve Online</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select quantity and reserve instantly.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <Lock size={24} color="var(--primary)" />
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Funds Secured</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment held safely until pickup.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <MapPin size={24} color="var(--primary)" />
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Pickup & Verify</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Show pickup code at the warehouse.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sticky Order Panel */}
                <div style={{ position: 'sticky', top: '90px' }}>
                    <div className="card-white" style={{ padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>Place Order</h3>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Price / {product.unit}</span>
                                <span style={{ fontWeight: 800, color: 'var(--secondary)', fontSize: '1.25rem' }}>{t('currency_symbol')}{product.price_per_unit.toFixed(2)}</span>
                            </div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Quantity ({product.unit})</label>
                            <input
                                type="number"
                                className="input-modern"
                                min="1"
                                max={product.quantity_available}
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                style={{ height: '48px', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 700 }}
                            />
                            <p style={{
                                fontSize: '0.75rem',
                                color: quantity > product.quantity_available ? 'var(--error)' : (product.quantity_available > 0 ? 'var(--success)' : 'var(--error)'),
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                marginTop: '0.5rem'
                            }}>
                                {quantity > product.quantity_available ? (
                                    <><AlertTriangle size={14} /> Insufficient stock available</>
                                ) : (
                                    product.quantity_available > 0
                                        ? `${product.quantity_available} ${product.unit} available`
                                        : 'Out of stock'
                                )}
                            </p>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Subtotal</span>
                                <span style={{ fontWeight: 600 }}>{t('currency_symbol')}{(product.price_per_unit * quantity).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--primary)' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reservation Fee (5%)</span>
                                <span style={{ fontWeight: 800 }}>{t('currency_symbol')}{(product.price_per_unit * quantity * 0.05).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px dashed var(--border-soft)', paddingTop: '1rem' }}>
                                <span style={{ color: 'var(--secondary)', fontWeight: 800 }}>Total Purchase</span>
                                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--secondary)', lineHeight: 1 }}>{t('currency_symbol')}{(product.price_per_unit * quantity).toFixed(2)}</span>
                            </div>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-soft)', marginTop: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                                * Reservation fee is non-refundable
                            </p>
                        </div>

                        <button
                            className="btn-modern btn-primary-modern"
                            style={{ width: '100%', height: '56px', fontSize: '1rem' }}
                            onClick={handleReserve}
                            disabled={reserving || quantity <= 0 || quantity > product.quantity_available || product.quantity_available <= 0}
                        >
                            {reserving ? <Loader2 className="animate-spin" size={20} /> : <><Lock size={18} /> Reserve Now</>}
                        </button>

                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', display: 'flex', gap: '0.75rem' }}>
                            <Info size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                Funds are held securely until you pick up your order at the warehouse using your pickup code. The seller receives payment only after successful handover.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
