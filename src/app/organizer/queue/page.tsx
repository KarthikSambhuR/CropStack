'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Search, Loader2, QrCode, ArrowRight, Warehouse, CheckCircle2, XCircle, Clock, Package, User, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db, collection, query, where, getDocs, orderBy, doc, updateDoc, addDoc, getDoc } from '@/lib/firebase';
import { Order } from '@/lib/supabase';

type PendingOrder = Order & {
    buyer_name: string;
    product_name: string;
    seller_id: string;
    unit?: string;
};

export default function OrganizerQueue() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);
    const [tab, setTab] = useState<'pending' | 'approved' | 'completed'>('pending');

    const fetchData = useCallback(async () => {
        try {
            // Fetch all orders from Firestore (all statuses for different tabs)
            const ordersQuery = query(
                collection(db, 'orders'),
                orderBy('created_at', 'desc')
            );
            const snapshot = await getDocs(ordersQuery);
            const allOrders: PendingOrder[] = [];

            for (const d of snapshot.docs) {
                const data = d.data();
                let buyerName = data.buyer_name || 'Unknown Buyer';
                let productName = data.product_name || 'Unknown Product';
                let sellerId = data.seller_id || '';
                let unit = '';

                // If buyer_name is missing, fetch it
                if (!data.buyer_name && data.buyer_id) {
                    try {
                        const buyerSnap = await getDoc(doc(db, 'profiles', data.buyer_id));
                        if (buyerSnap.exists()) {
                            buyerName = buyerSnap.data().full_name || 'Unknown Buyer';
                        }
                    } catch { }
                }

                // If product_name is missing, fetch it
                if (!data.product_name && data.product_id) {
                    try {
                        const productSnap = await getDoc(doc(db, 'products', data.product_id));
                        if (productSnap.exists()) {
                            productName = productSnap.data().name || 'Unknown Product';
                            sellerId = productSnap.data().seller_id || sellerId;
                            unit = productSnap.data().unit || '';
                        }
                    } catch { }
                }

                allOrders.push({
                    id: d.id,
                    buyer_id: data.buyer_id,
                    product_id: data.product_id,
                    quantity: data.quantity,
                    total_price: data.total_price,
                    status: data.status,
                    pickup_code: data.pickup_code || null,
                    reservation_expiry: data.reservation_expiry || null,
                    created_at: data.created_at,
                    buyer_name: buyerName,
                    product_name: productName,
                    seller_id: sellerId || data.seller_id || '',
                    unit: unit,
                });
            }

            setOrders(allOrders);
        } catch (err) {
            console.error('Failed to fetch queue data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleApprove = async (order: PendingOrder) => {
        if (processing) return;
        setProcessing(order.id);
        try {
            // Update order status to 'approved'
            await updateDoc(doc(db, 'orders', order.id), {
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: user?.email || 'organizer',
            });
            await fetchData();
        } catch (err) {
            console.error('Approval failed:', err);
            alert('Failed to approve order.');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (order: PendingOrder) => {
        if (processing) return;
        if (!confirm(`Are you sure you want to reject this order from ${order.buyer_name}?`)) return;
        setProcessing(order.id);
        try {
            // 1. Update order status to 'cancelled'
            await updateDoc(doc(db, 'orders', order.id), {
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancelled_by: user?.email || 'organizer',
            });

            // 2. Restore stock to the product
            const productSnap = await getDoc(doc(db, 'products', order.product_id));
            if (productSnap.exists()) {
                const currentQty = productSnap.data().quantity_available || 0;
                await updateDoc(doc(db, 'products', order.product_id), {
                    quantity_available: currentQty + order.quantity,
                });
            }

            await fetchData();
        } catch (err) {
            console.error('Rejection failed:', err);
            alert('Failed to reject order.');
        } finally {
            setProcessing(null);
        }
    };

    const handleComplete = async (order: PendingOrder) => {
        if (processing) return;
        setProcessing(order.id);
        try {
            // 1. Mark the order as completed
            await updateDoc(doc(db, 'orders', order.id), {
                status: 'completed',
                completed_at: new Date().toISOString(),
            });

            // 2. Release the held transaction so seller gets paid
            const txQuery = query(
                collection(db, 'transactions'),
                where('order_id', '==', order.id),
                where('status', '==', 'held')
            );
            const txSnap = await getDocs(txQuery);
            for (const txDoc of txSnap.docs) {
                await updateDoc(txDoc.ref, {
                    status: 'released',
                    released_at: new Date().toISOString(),
                });
            }

            await fetchData();
        } catch (err) {
            console.error('Complete failed:', err);
            alert('Failed to complete order.');
        } finally {
            setProcessing(null);
        }
    };

    const pendingOrders = orders.filter(o => o.status === 'pending');
    const approvedOrders = orders.filter(o => o.status === 'approved' || o.status === 'reserved');
    const completedOrders = orders.filter(o => o.status === 'completed');

    const displayedOrders = tab === 'pending' ? pendingOrders : tab === 'approved' ? approvedOrders : completedOrders;

    const filteredOrders = displayedOrders.filter(o =>
        o.pickup_code?.toUpperCase().includes(searchTerm.toUpperCase()) ||
        o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTimeAgo = (isoStr: string): string => {
        if (!isoStr) return 'Unknown';
        const diff = Date.now() - new Date(isoStr).getTime();
        const secs = Math.floor(diff / 1000);
        if (secs < 60) return `${secs}s ago`;
        const mins = Math.floor(secs / 60);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <DashboardLayout role="organizer">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.05em' }}>
                    Pickup <span style={{ color: 'var(--primary)' }}>Queue.</span>
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                    Review, approve, and manage incoming orders from buyers.
                </p>
            </div>

            {/* Stats Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card-white" style={{ padding: '1.25rem', cursor: 'pointer', borderLeft: tab === 'pending' ? '4px solid var(--warning)' : '4px solid transparent', transition: 'all 0.2s' }} onClick={() => setTab('pending')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Pending Approval</span>
                        <AlertTriangle size={16} color="var(--warning)" />
                    </div>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 900, color: pendingOrders.length > 0 ? 'var(--warning)' : 'var(--secondary)' }}>{pendingOrders.length}</h3>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Need your review</p>
                </div>
                <div className="card-white" style={{ padding: '1.25rem', cursor: 'pointer', borderLeft: tab === 'approved' ? '4px solid var(--success)' : '4px solid transparent', transition: 'all 0.2s' }} onClick={() => setTab('approved')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Approved</span>
                        <CheckCircle2 size={16} color="var(--success)" />
                    </div>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--success)' }}>{approvedOrders.length}</h3>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Awaiting buyer payment</p>
                </div>
                <div className="card-white" style={{ padding: '1.25rem', cursor: 'pointer', borderLeft: tab === 'completed' ? '4px solid var(--primary)' : '4px solid transparent', transition: 'all 0.2s' }} onClick={() => setTab('completed')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Completed</span>
                        <Package size={16} color="var(--primary)" />
                    </div>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)' }}>{completedOrders.length}</h3>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Paid & picked up</p>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Loader2 size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : (
                <div className="card-white" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ position: 'relative', width: '320px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)' }} />
                            <input
                                type="text"
                                className="input-modern"
                                placeholder="Search by name, PIN, or product..."
                                style={{ paddingLeft: '2.75rem', height: '44px', fontSize: '0.85rem' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)' }}>Auto-refresh • 5s</span>
                        </div>
                    </div>

                    {filteredOrders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '5rem', background: 'var(--bg-main)', borderRadius: '20px', border: '1px dashed var(--border)' }}>
                            <Warehouse size={48} color="#94a3b8" style={{ marginBottom: '1.25rem', opacity: 0.4 }} />
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--secondary)' }}>
                                {tab === 'pending' ? 'No Pending Orders' : tab === 'approved' ? 'No Approved Orders' : 'No Completed Orders'}
                            </h4>
                            <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', fontWeight: 500, marginTop: '0.5rem' }}>
                                {tab === 'pending' ? 'New buyer orders will appear here for your approval.' : tab === 'approved' ? 'Approved orders awaiting buyer payment will show here.' : 'Completed transactions will be listed here.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {filteredOrders.map((order) => (
                                <div key={order.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '1.25rem 1.5rem', background: '#fafbfc', borderRadius: '16px',
                                    border: `1px solid ${order.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'var(--border-soft)'}`,
                                    transition: 'all 0.2s',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1 }}>
                                        {/* Pickup Code */}
                                        <div style={{
                                            fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px',
                                            background: 'var(--primary-soft)', padding: '0.5rem 0.875rem',
                                            borderRadius: '10px', fontSize: '0.85rem', fontFamily: 'monospace',
                                            border: '1px solid rgba(5, 150, 105, 0.1)', minWidth: '90px', textAlign: 'center',
                                        }}>
                                            {order.pickup_code || '—'}
                                        </div>

                                        {/* Order Info */}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--secondary)' }}>{order.product_name}</p>
                                                <span className={`badge-clean ${order.status === 'pending' ? 'badge-pending' : order.status === 'completed' ? 'badge-success' : 'badge-success'}`} style={{ fontSize: '0.55rem', padding: '0.2rem 0.5rem' }}>
                                                    {order.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    <User size={12} /> {order.buyer_name}
                                                </span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                    {order.quantity} {order.unit || t('unit_q')}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-soft)' }}>
                                                    <Clock size={11} /> {getTimeAgo(order.created_at)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Price */}
                                        <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--secondary)', minWidth: '110px', textAlign: 'right' }}>
                                            {t('currency_symbol')}{order.total_price.toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1.25rem' }}>
                                        {order.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleApprove(order)}
                                                    className="btn-modern btn-primary-modern"
                                                    style={{ height: '38px', padding: '0 1rem', borderRadius: '10px', fontSize: '0.8rem', gap: '0.375rem' }}
                                                    disabled={!!processing}
                                                >
                                                    {processing === order.id ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><CheckCircle2 size={14} /> Approve</>}
                                                </button>
                                                <button
                                                    onClick={() => handleReject(order)}
                                                    className="btn-modern"
                                                    style={{
                                                        height: '38px', padding: '0 1rem', borderRadius: '10px', fontSize: '0.8rem',
                                                        background: 'white', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)',
                                                        cursor: 'pointer', gap: '0.375rem', display: 'flex', alignItems: 'center',
                                                    }}
                                                    disabled={!!processing}
                                                >
                                                    <XCircle size={14} /> Reject
                                                </button>
                                            </>
                                        )}
                                        {order.status === 'approved' && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700 }}>
                                                <Clock size={14} /> Awaiting Payment
                                            </span>
                                        )}
                                        {order.status === 'reserved' && (
                                            <button
                                                onClick={() => handleComplete(order)}
                                                className="btn-modern btn-primary-modern"
                                                style={{ height: '38px', padding: '0 1rem', borderRadius: '10px', fontSize: '0.8rem', gap: '0.375rem' }}
                                                disabled={!!processing}
                                            >
                                                {processing === order.id ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><Package size={14} /> Mark Picked Up</>}
                                            </button>
                                        )}
                                        {order.status === 'completed' && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700 }}>
                                                <CheckCircle2 size={14} /> Done
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </DashboardLayout>
    );
}
