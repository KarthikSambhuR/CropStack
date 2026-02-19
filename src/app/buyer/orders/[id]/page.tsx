'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Order, Product } from '@/lib/supabase';
import { db, doc, getDoc, addDoc, updateDoc, collection } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, MapPin, Printer, Download, Loader2, QrCode, ShieldCheck, Info, Package, CreditCard, AlertTriangle } from 'lucide-react';
import { generateBuyerOrderPdf, BuyerReceiptData } from '@/lib/pdfReceipt';
import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

export default function OrderReceipt() {
    const { id } = useParams() as { id: string };
    const { t } = useLanguage();
    const { user } = useAuth();
    const [order, setOrder] = useState<(Order & { products: Product; seller_name: string; seller_id: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);

    const fetchOrder = async () => {
        try {
            const orderSnap = await getDoc(doc(db, 'orders', id));
            if (orderSnap.exists()) {
                const orderData = { id: orderSnap.id, ...orderSnap.data() } as Order;

                // Fetch associated product
                const productSnap = await getDoc(doc(db, 'products', orderData.product_id));
                const productData = productSnap.exists()
                    ? { id: productSnap.id, ...productSnap.data() } as Product
                    : { id: orderData.product_id, name: 'Unknown', category: '', price_per_unit: 0, quantity_available: 0, unit: '', seller_id: '', description: null, image_url: null, is_active: false, created_at: '' } as Product;

                // Fetch seller info
                let sellerName = 'Seller';
                const sellerId = (orderSnap.data() as any).seller_id || productData.seller_id;
                if (sellerId) {
                    try {
                        const sellerSnap = await getDoc(doc(db, 'profiles', sellerId));
                        if (sellerSnap.exists()) {
                            sellerName = sellerSnap.data().full_name || 'Seller';
                        }
                    } catch { }
                }

                setOrder({ ...orderData, products: productData, seller_name: sellerName, seller_id: sellerId });
            }
        } catch (err) {
            console.error('Error fetching order:', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const handlePay = async () => {
        if (!order || paying) return;

        if (!confirm(`Confirm payment of ${t('currency_symbol')}${order.total_price.toFixed(2)} for ${order.products.name}?`)) return;

        setPaying(true);
        try {
            const now = new Date().toISOString();
            const reservation_expiry = new Date();
            reservation_expiry.setDate(reservation_expiry.getDate() + 7);

            // 1. Update order to 'reserved' (paid, awaiting pickup)
            await updateDoc(doc(db, 'orders', order.id), {
                status: 'reserved',
                paid_at: now,
                reservation_expiry: reservation_expiry.toISOString(),
            });

            // 2. Create a held transaction for the seller
            await addDoc(collection(db, 'transactions'), {
                seller_id: order.seller_id,
                order_id: order.id,
                amount: order.total_price,
                status: 'held',
                available_at: reservation_expiry.toISOString(),
                created_at: now,
            });

            // Refresh order data
            await fetchOrder();
        } catch (err) {
            console.error('Payment failed:', err);
            alert('Payment failed. Please try again.');
        } finally {
            setPaying(false);
        }
    };

    if (loading) return (
        <DashboardLayout role="buyer">
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10rem' }}>
                <Loader2 size={48} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </DashboardLayout>
    );

    if (!order) return (
        <DashboardLayout role="buyer">
            <div className="card-white" style={{ textAlign: 'center', padding: '5rem' }}>
                <AlertCircle size={40} color="var(--error)" style={{ marginBottom: '1.5rem' }} />
                <h2>Order Not Found</h2>
                <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 2rem' }}>This order does not exist or has been removed.</p>
                <Link href="/buyer/orders" className="btn-modern btn-primary-modern">View My Orders</Link>
            </div>
        </DashboardLayout>
    );

    const daysRemaining = order.reservation_expiry ? differenceInDays(new Date(order.reservation_expiry), new Date()) : 0;
    const isExpired = daysRemaining <= 0 && order.status === 'reserved';

    const getStatusColor = () => {
        if (order.status === 'completed') return 'badge-success';
        if (order.status === 'cancelled' || isExpired) return 'badge-error';
        if (order.status === 'approved') return 'badge-pending';
        return 'badge-pending';
    };

    const getStatusLabel = () => {
        if (isExpired) return 'EXPIRED';
        if (order.status === 'pending') return 'PENDING APPROVAL';
        if (order.status === 'approved') return 'APPROVED — PAY NOW';
        if (order.status === 'reserved') return 'PAID — PICKUP READY';
        return order.status.toUpperCase();
    };

    return (
        <DashboardLayout role="buyer">
            <Link href="/buyer/orders" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '2.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                <ArrowLeft size={16} /> Back to My Orders
            </Link>

            <div style={{ maxWidth: '900px', margin: '0 auto' }}>

                {/* Status Banner for pending/approved */}
                {(order.status === 'pending' || order.status === 'approved') && (
                    <div style={{
                        marginBottom: '1.5rem', padding: '1.25rem 1.75rem', borderRadius: '16px',
                        background: order.status === 'pending' ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                        border: `1px solid ${order.status === 'pending' ? '#fbbf24' : '#34d399'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {order.status === 'pending' ? <AlertTriangle size={24} color="#b45309" /> : <CheckCircle2 size={24} color="#059669" />}
                            <div>
                                <p style={{ fontWeight: 800, color: order.status === 'pending' ? '#92400e' : '#065f46', fontSize: '0.95rem' }}>
                                    {order.status === 'pending' ? 'Awaiting Organizer Approval' : 'Order Approved — Ready to Pay!'}
                                </p>
                                <p style={{ fontSize: '0.8rem', color: order.status === 'pending' ? '#a16207' : '#047857', fontWeight: 500 }}>
                                    {order.status === 'pending'
                                        ? 'Your order is being reviewed. You\'ll be able to pay once approved.'
                                        : 'The organizer has approved your order. Complete payment to reserve your pickup slot.'}
                                </p>
                            </div>
                        </div>
                        {order.status === 'approved' && (
                            <button
                                className="btn-modern btn-primary-modern"
                                style={{ height: '44px', padding: '0 1.5rem', fontSize: '0.9rem', gap: '0.5rem', flexShrink: 0 }}
                                onClick={handlePay}
                                disabled={paying}
                            >
                                {paying ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><CreditCard size={18} /> Pay {t('currency_symbol')}{order.total_price.toFixed(2)}</>}
                            </button>
                        )}
                    </div>
                )}

                <div className="card-white" style={{ padding: '4rem', overflow: 'hidden', position: 'relative' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3.5rem', borderBottom: '1px solid var(--border-soft)', paddingBottom: '2.5rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
                                <div style={{ padding: '0.4rem', background: 'var(--primary)', borderRadius: '6px' }}>
                                    <ShieldCheck color="white" size={18} />
                                </div>
                                <span style={{ fontWeight: 800, color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Receipt</span>
                            </div>
                            <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{order.products.name}</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Order ID: <strong style={{ color: 'var(--secondary)' }}>#{order.id.slice(0, 12).toUpperCase()}</strong></p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span className={`badge-clean ${getStatusColor()}`} style={{ padding: '0.5rem 1rem' }}>
                                {getStatusLabel()}
                            </span>
                            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-soft)', fontWeight: 700 }}>Ordered on {format(new Date(order.created_at), 'PPP')}</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '3rem' }}>
                        {/* Pickup Details */}
                        <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--secondary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pickup Details</h3>

                            <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                    <div style={{ padding: '1rem', background: 'white', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
                                        <QrCode size={48} color="var(--secondary)" />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.25rem' }}>Pickup Code</p>
                                        <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '3px', lineHeight: 1 }}>{order.pickup_code}</p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                            {order.status === 'pending' || order.status === 'approved'
                                                ? 'Code will be active after payment'
                                                : 'Show this code at the warehouse'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ width: '36px', height: '36px', background: 'white', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Package size={18} color="var(--primary)" />
                                    </div>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Seller: {order.seller_name}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category: {order.products.category}</p>
                                    </div>
                                </div>

                                {order.reservation_expiry && (
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ width: '36px', height: '36px', background: 'white', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Clock size={18} color={isExpired ? 'var(--error)' : 'var(--warning)'} />
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                                {isExpired ? 'Reservation Expired' : 'Pickup Deadline'}
                                            </p>
                                            <p style={{ fontSize: '0.8rem', color: isExpired ? 'var(--error)' : 'var(--text-muted)' }}>
                                                {isExpired
                                                    ? `Expired on ${format(new Date(order.reservation_expiry), 'PPP')}`
                                                    : `${daysRemaining} days remaining — by ${format(new Date(order.reservation_expiry), 'PPP')}`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Step Tracker */}
                                <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-soft)' }}>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', marginBottom: '1rem' }}>Order Progress</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {[
                                            { label: 'Order Placed', done: true },
                                            { label: 'Organizer Approved', done: ['approved', 'reserved', 'completed'].includes(order.status) },
                                            { label: 'Payment Made', done: ['reserved', 'completed'].includes(order.status) },
                                            { label: 'Picked Up', done: order.status === 'completed' },
                                        ].map((step, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                                                    background: step.done ? 'var(--primary)' : '#e2e8f0',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {step.done && <CheckCircle2 size={14} color="white" />}
                                                </div>
                                                <span style={{
                                                    fontSize: '0.85rem', fontWeight: step.done ? 700 : 500,
                                                    color: step.done ? 'var(--secondary)' : 'var(--text-soft)',
                                                }}>{step.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order Value */}
                        <div>
                            <div style={{ background: 'var(--secondary)', padding: '2rem', borderRadius: '16px', color: 'white' }}>
                                <h3 style={{ color: 'white', fontSize: '0.9rem', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Summary</h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{order.products.name}</p>
                                            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>Qty: {order.quantity} {order.products.unit || t('unit_q')}</p>
                                        </div>
                                        <span style={{ fontWeight: 700 }}>{t('currency_symbol')}{order.total_price.toFixed(2)}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                        <span>Price per {order.products.unit || t('unit_q')}</span>
                                        <span>{t('currency_symbol')}{order.products.price_per_unit.toFixed(2)}</span>
                                    </div>

                                    {order.reservation_fee && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--primary-soft)', background: 'rgba(5, 150, 105, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                            <span>Reservation Fee (Non-refundable)</span>
                                            <span>{t('currency_symbol')}{order.reservation_fee.toFixed(2)}</span>
                                        </div>
                                    )}

                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '1.25rem', marginTop: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                                                {order.status === 'pending' || order.status === 'approved' ? 'Remaining Due' : 'Total Paid'}
                                            </p>
                                            <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 900 }}>
                                                {t('currency_symbol')}{(order.total_price - (order.status === 'pending' || order.status === 'approved' ? (order.reservation_fee || 0) : 0)).toFixed(2)}
                                            </h2>
                                        </div>
                                        {(order.status === 'pending' || order.status === 'approved') && order.reservation_fee && (
                                            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: '0.25rem' }}>
                                                (Total: {t('currency_symbol')}{order.total_price.toFixed(2)})
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Pay Button for approved orders */}
                            {order.status === 'approved' && (
                                <button
                                    className="btn-modern btn-primary-modern"
                                    style={{ width: '100%', height: '56px', fontSize: '1rem', marginTop: '1rem', gap: '0.5rem' }}
                                    onClick={handlePay}
                                    disabled={paying}
                                >
                                    {paying ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <><CreditCard size={20} /> Pay Now</>}
                                </button>
                            )}

                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: order.status === 'pending' ? 'rgba(245, 158, 11, 0.08)' : 'var(--success-soft)', borderRadius: '12px', display: 'flex', gap: '0.75rem' }}>
                                <Info size={16} color={order.status === 'pending' ? 'var(--warning)' : 'var(--success)'} style={{ flexShrink: 0 }} />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-main)', lineHeight: 1.4, fontWeight: 500 }}>
                                    {order.status === 'pending'
                                        ? 'Your order is awaiting approval from the warehouse organizer. Once approved, you can complete payment.'
                                        : order.status === 'approved'
                                            ? 'Your order has been approved! Complete payment to secure your pickup slot. The seller receives funds only after pickup.'
                                            : 'Payment is held securely. The seller receives funds only after you pick up the order and confirm receipt.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '3.5rem', borderTop: '1px solid var(--border-soft)', paddingTop: '2.5rem' }}>
                        <button className="btn-modern btn-primary-modern" onClick={() => {
                            const pdfData: BuyerReceiptData = {
                                orderId: order.id,
                                productName: order.products.name,
                                category: order.products.category,
                                quantity: order.quantity,
                                unit: order.products.unit || t('unit_q'),
                                pricePerUnit: order.products.price_per_unit,
                                totalPrice: order.total_price,
                                status: order.status,
                                pickupCode: order.pickup_code || '',
                                sellerName: order.seller_name,
                                buyerName: (order as any).buyer_name || 'Customer',
                                createdAt: order.created_at,
                                paidAt: (order as any).paid_at,
                                reservationExpiry: order.reservation_expiry || undefined,
                                currencySymbol: t('currency_symbol'),
                                reservation_fee: (order as any).reservation_fee,
                            };
                            generateBuyerOrderPdf(pdfData, 'print');
                        }} style={{ height: '44px' }}>
                            <Printer size={16} /> Print Receipt
                        </button>
                        <button className="btn-modern btn-secondary-modern" onClick={() => {
                            const pdfData: BuyerReceiptData = {
                                orderId: order.id,
                                productName: order.products.name,
                                category: order.products.category,
                                quantity: order.quantity,
                                unit: order.products.unit || t('unit_q'),
                                pricePerUnit: order.products.price_per_unit,
                                totalPrice: order.total_price,
                                status: order.status,
                                pickupCode: order.pickup_code || '',
                                sellerName: order.seller_name,
                                buyerName: (order as any).buyer_name || 'Customer',
                                createdAt: order.created_at,
                                paidAt: (order as any).paid_at,
                                reservationExpiry: order.reservation_expiry || undefined,
                                currencySymbol: t('currency_symbol'),
                                reservation_fee: (order as any).reservation_fee,
                            };
                            generateBuyerOrderPdf(pdfData, 'download');
                        }} style={{ height: '44px' }}>
                            <Download size={16} /> Download Receipt
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </DashboardLayout>
    );
}
