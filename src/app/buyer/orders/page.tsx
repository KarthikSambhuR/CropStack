'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Order, Product } from '@/lib/supabase';
import { db, collection, query, where, orderBy, getDocs, doc, getDoc, addDoc, updateDoc } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
    Clock,
    CheckCircle2,
    ArrowRight,
    Search,
    Filter,
    History,
    Package,
    Calendar,
    ChevronRight,
    ArrowUpRight,
    QrCode,
    CreditCard,
    Loader2,
    AlertTriangle,
    XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

type OrderWithProduct = Order & { products: Product };

export default function ActiveStock() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [orders, setOrders] = useState<OrderWithProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [paying, setPaying] = useState<string | null>(null);

    const fetchOrders = async () => {
        if (!user) return;
        try {
            const q = query(
                collection(db, 'orders'),
                where('buyer_id', '==', user.uid),
                orderBy('created_at', 'desc')
            );
            const snapshot = await getDocs(q);
            const ordersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));

            // Fetch associated products
            const ordersWithProducts: OrderWithProduct[] = await Promise.all(
                ordersData.map(async (order) => {
                    const productSnap = await getDoc(doc(db, 'products', order.product_id));
                    const product = productSnap.exists()
                        ? { id: productSnap.id, ...productSnap.data() } as Product
                        : { id: order.product_id, name: 'Unknown', category: '', price_per_unit: 0, quantity_available: 0, unit: '', seller_id: '', description: null, image_url: null, is_active: false, created_at: '' } as Product;
                    return { ...order, products: product };
                })
            );

            setOrders(ordersWithProducts);
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
    }, [user]);

    const handlePay = async (order: OrderWithProduct) => {
        if (paying) return;

        if (!confirm(`Confirm payment of ${t('currency_symbol')}${order.total_price.toFixed(2)} for ${order.products.name}?`)) return;

        setPaying(order.id);
        try {
            const now = new Date().toISOString();
            const reservation_expiry = new Date();
            reservation_expiry.setDate(reservation_expiry.getDate() + 7);

            // 1. Update order status to 'reserved' (paid, awaiting pickup)
            await updateDoc(doc(db, 'orders', order.id), {
                status: 'reserved',
                paid_at: now,
                reservation_expiry: reservation_expiry.toISOString(),
            });

            // 2. Create a held transaction for the seller
            const sellerId = (order as any).seller_id || order.products.seller_id;
            await addDoc(collection(db, 'transactions'), {
                seller_id: sellerId,
                order_id: order.id,
                amount: order.total_price,
                status: 'held',
                available_at: reservation_expiry.toISOString(),
                created_at: now,
            });

            // Refresh orders
            await fetchOrders();
        } catch (err) {
            console.error('Payment failed:', err);
            alert('Payment failed. Please try again.');
        } finally {
            setPaying(null);
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'pending':
                return { icon: <Clock size={14} />, class: 'badge-pending', label: 'PENDING APPROVAL', color: 'var(--warning)' };
            case 'approved':
                return { icon: <CreditCard size={14} />, class: 'badge-pending', label: 'PAY NOW', color: 'var(--warning)' };
            case 'reserved':
                return { icon: <Package size={14} />, class: 'badge-success', label: 'PAID • PICKUP READY', color: 'var(--primary)' };
            case 'completed':
                return { icon: <CheckCircle2 size={14} />, class: 'badge-success', label: 'COMPLETED', color: 'var(--success)' };
            case 'cancelled':
                return { icon: <XCircle size={14} />, class: 'badge-error', label: 'CANCELLED', color: 'var(--error)' };
            default:
                return { icon: <Clock size={14} />, class: 'badge-pending', label: status.toUpperCase(), color: 'var(--text-muted)' };
        }
    };

    const filteredOrders = orders.filter(o =>
        o.products.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.id.includes(searchTerm)
    );

    return (
        <DashboardLayout role="buyer">
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '1.875rem' }}>{t('orders')}</h1>
                <p style={{ color: 'var(--text-muted)' }}>Track and manage all your orders.</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)' }} />
                    <input
                        type="text"
                        className="input-modern"
                        placeholder="Search order number or crop name..."
                        style={{ paddingLeft: '2.75rem', height: '48px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="btn-modern btn-secondary-modern" style={{ height: '48px' }}>
                    <Filter size={18} /> Filters
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: '100px', borderRadius: '16px' }}></div>)}
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="card-white" style={{ textAlign: 'center', padding: '6rem' }}>
                    <div style={{ width: '64px', height: '64px', background: 'var(--bg-main)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <History size={32} color="var(--text-soft)" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No orders yet</h3>
                    <p style={{ color: 'var(--text-soft)', fontSize: '0.95rem', marginBottom: '2.5rem' }}>Browse crops and place your first order.</p>
                    <Link href="/buyer/catalog" className="btn-modern btn-primary-modern">Browse Crops</Link>
                </div>
            ) : (
                <div className="card-white" style={{ overflow: 'hidden' }}>
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>CROP</th>
                                <th>QUANTITY</th>
                                <th>AMOUNT</th>
                                <th>STATUS</th>
                                <th style={{ textAlign: 'right' }}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order) => {
                                const statusInfo = getStatusInfo(order.status);
                                return (
                                    <tr key={order.id}>
                                        <td>
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                <div style={{ width: '40px', height: '40px', background: 'var(--primary-soft)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <QrCode size={18} color="var(--primary)" />
                                                </div>
                                                <div>
                                                    <p style={{ fontWeight: 800, color: 'var(--secondary)' }}>{order.products.name}</p>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600 }}>#{order.id.slice(0, 8).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                <Package size={14} /> {order.quantity} {order.products.unit || t('unit_q')}
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', marginTop: '0.25rem' }}>Product: {order.product_id.slice(0, 6)}</p>
                                        </td>
                                        <td>
                                            <p style={{ fontWeight: 800, fontSize: '1rem' }}>{t('currency_symbol')}{order.total_price.toFixed(2)}</p>
                                            <p style={{ fontSize: '0.75rem', color: statusInfo.color, fontWeight: 700 }}>
                                                {order.status === 'pending' ? 'UNPAID' : order.status === 'approved' ? 'UNPAID' : 'PAID'}
                                            </p>
                                        </td>
                                        <td>
                                            <span className={`badge-clean ${statusInfo.class}`}>
                                                {statusInfo.icon}
                                                {statusInfo.label}
                                            </span>
                                            {order.status === 'pending' && (
                                                <p style={{ fontSize: '0.65rem', color: 'var(--text-soft)', marginTop: '0.25rem', fontWeight: 500 }}>
                                                    Waiting for organizer
                                                </p>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {order.status === 'approved' ? (
                                                <button
                                                    className="btn-modern btn-primary-modern"
                                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem', gap: '0.375rem' }}
                                                    onClick={() => handlePay(order)}
                                                    disabled={!!paying}
                                                >
                                                    {paying === order.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><CreditCard size={14} /> Pay Now</>}
                                                </button>
                                            ) : (
                                                <Link href={`/buyer/orders/${order.id}`} className="btn-modern btn-secondary-modern" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                                                    View Receipt <ChevronRight size={14} />
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </DashboardLayout>
    );
}
