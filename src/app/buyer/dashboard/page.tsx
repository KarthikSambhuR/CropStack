'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ShoppingBag, Calendar, TrendingUp, ArrowUpRight, ArrowDownRight, Info, ChevronRight, LayoutGrid, Loader2, Package, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { db, collection, query, where, getDocs, orderBy } from '@/lib/firebase';
import { Order, Product } from '@/lib/supabase';

type OrderWithProduct = Order & { product_name: string; product_category: string; product_unit: string };

export default function BuyerDashboard() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [orders, setOrders] = useState<OrderWithProduct[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            // Fetch buyer's orders
            const ordersQuery = query(
                collection(db, 'orders'),
                where('buyer_id', '==', user.uid),
                orderBy('created_at', 'desc')
            );
            const ordersSnapshot = await getDocs(ordersQuery);
            const ordersData = ordersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));

            // Fetch all active products for market trends
            const productsQuery = query(
                collection(db, 'products'),
                where('is_active', '==', true)
            );
            const productsSnapshot = await getDocs(productsQuery);
            const productsData = productsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
            setProducts(productsData);

            // Build a product lookup map
            const productMap = new Map<string, Product>();
            productsData.forEach(p => productMap.set(p.id, p));

            // Enrich orders with product info
            const enrichedOrders: OrderWithProduct[] = ordersData.map(order => {
                const product = productMap.get(order.product_id);
                return {
                    ...order,
                    product_name: product?.name || 'Unknown Crop',
                    product_category: product?.category || 'Other',
                    product_unit: product?.unit || t('unit_q'),
                };
            });

            setOrders(enrichedOrders);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        setLoading(true);
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Compute real stats from Firestore data
    const activeOrders = orders.filter(o => o.status === 'reserved' || o.status === 'pending' || o.status === 'approved' || o.status === 'confirmed').length;
    const reservations = orders.filter(o => o.status === 'reserved').length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    const totalSpent = orders.filter(o => o.status === 'reserved' || o.status === 'completed').reduce((sum, o) => sum + (o.total_price || 0), 0);

    // Monthly growth calculation
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    let thisMonthSpend = 0;
    let lastMonthSpend = 0;
    orders.forEach(o => {
        const d = new Date(o.created_at);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) thisMonthSpend += o.total_price;
        if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) lastMonthSpend += o.total_price;
    });

    let orderGrowth = 0;
    if (lastMonthSpend > 0) {
        orderGrowth = ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100;
    } else if (thisMonthSpend > 0) {
        orderGrowth = 100;
    }

    // Build monthly chart data from orders (last 12 months)
    const chartData: number[] = [];
    for (let i = 11; i >= 0; i--) {
        const m = new Date(currentYear, currentMonth - i, 1);
        const monthTotal = orders
            .filter(o => {
                const d = new Date(o.created_at);
                return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
            })
            .reduce((sum, o) => sum + o.total_price, 0);
        chartData.push(monthTotal);
    }
    const maxChart = Math.max(...chartData, 1);
    const chartPercents = chartData.map(v => (v / maxChart) * 100);

    const monthLabels = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const chartMonthLabels: string[] = [];
    for (let i = 11; i >= 0; i--) {
        const m = new Date(currentYear, currentMonth - i, 1);
        chartMonthLabels.push(monthLabels[m.getMonth()]);
    }

    // Market trends: group products by category and show average prices
    const categoryMap = new Map<string, { total: number; count: number; products: Product[] }>();
    products.forEach(p => {
        const cat = p.category || 'Other';
        const entry = categoryMap.get(cat) || { total: 0, count: 0, products: [] };
        entry.total += p.price_per_unit;
        entry.count += 1;
        entry.products.push(p);
        categoryMap.set(cat, entry);
    });

    const marketItems = Array.from(categoryMap.entries()).map(([name, data]) => ({
        name,
        avgPrice: data.total / data.count,
        count: data.count,
        totalStock: data.products.reduce((s, p) => s + p.quantity_available, 0),
        unit: data.products[0]?.unit || t('unit_q'),
    })).slice(0, 5);

    const statCards = [
        { key: 'active_orders', val: String(activeOrders), icon: ShoppingBag, color: 'var(--primary)' },
        { key: 'reservations', val: String(reservations).padStart(2, '0'), icon: Calendar, color: 'var(--warning)' },
        { key: 'completed', val: String(completedOrders), icon: LayoutGrid, color: 'var(--success)' },
        { key: 'savings', val: totalSpent.toLocaleString(), prefix: true, icon: TrendingUp, color: 'var(--secondary)' }
    ];

    return (
        <DashboardLayout role="buyer">
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', color: 'var(--secondary)', letterSpacing: '-0.03em' }}>{t('welcome')}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                    {error ? '⚠️ Could not load data — please try again.' : 'Your orders and market overview at a glance.'}
                </p>
            </div>

            {/* Stats Grid */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Loader2 size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
                        {statCards.map((stat, i) => (
                            <div key={i} className="card-white" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {t('stats.' + stat.key)}
                                    </span>
                                    <div style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                                        <stat.icon size={18} color={stat.color} />
                                    </div>
                                </div>
                                <h2 style={{ fontSize: '1.875rem', color: 'var(--secondary)', marginBottom: '0.25rem', fontWeight: 900 }}>
                                    {stat.prefix && t('currency_symbol')}{stat.val}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700 }}>
                                    <span style={{ color: orderGrowth >= 0 ? 'var(--success)' : 'var(--error)', display: 'flex', alignItems: 'center' }}>
                                        {orderGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                        {orderGrowth > 0 ? '+' : ''}{orderGrowth.toFixed(1)}%
                                    </span>
                                    <span style={{ color: 'var(--text-soft)' }}>vs last month</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                        {/* Activity Chart */}
                        <div className="card-white" style={{ padding: '2.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{t('recent_activity')}</h3>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Your spending over the last 12 months</p>
                                </div>
                                <Link href="/buyer/orders" className="btn-modern btn-secondary-modern" style={{ padding: '0.5rem 1rem', height: 'auto', fontSize: '0.8rem' }}>
                                    {t('view_all')} <ChevronRight size={14} />
                                </Link>
                            </div>

                            <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '0.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-soft)' }}>
                                {chartPercents.map((h, i) => (
                                    <div key={i} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div
                                            style={{
                                                width: '100%',
                                                height: `${Math.max(h, 4)}%`,
                                                background: i === chartPercents.length - 1 ? 'var(--primary)' : 'var(--border-soft)',
                                                borderRadius: '6px 6px 0 0',
                                                transition: 'all 0.5s ease',
                                                position: 'relative',
                                            }}
                                            title={`${t('currency_symbol')}${chartData[i].toFixed(0)}`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', color: 'var(--text-soft)', fontSize: '0.6rem', fontWeight: 800 }}>
                                {chartMonthLabels.filter((_, i) => i % 2 === 0).map((label, i) => (
                                    <span key={i}>{label}</span>
                                ))}
                            </div>
                        </div>

                        {/* Market Overview (from real products) */}
                        <div className="card-white" style={{ padding: '2.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem' }}>{t('market_trends')}</h3>
                                <Info size={16} color="var(--text-soft)" />
                            </div>

                            {marketItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
                                    <Package size={32} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No crops available yet</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {marketItems.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#fcfcfc', border: '1px solid var(--border-soft)', borderRadius: '12px' }}>
                                            <div>
                                                <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--secondary)' }}>{item.name}</p>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    Avg {t('currency_symbol')}{item.avgPrice.toFixed(2)} / {item.unit}
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ fontWeight: 800, color: 'var(--secondary)', fontSize: '0.85rem' }}>
                                                    {item.count} {item.count === 1 ? 'listing' : 'listings'}
                                                </p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                                    <CheckCircle2 size={12} /> {item.totalStock} {item.unit} in stock
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Link href="/buyer/catalog" className="btn-modern btn-primary-modern" style={{ width: '100%', marginTop: '1.75rem', height: '52px' }}>
                                Browse All Crops
                            </Link>
                        </div>
                    </div>

                    {/* Recent Orders */}
                    {orders.length > 0 && (
                        <div className="card-white" style={{ padding: '2.5rem', marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Recent Orders</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your latest crop purchases</p>
                                </div>
                                <Link href="/buyer/orders" className="btn-modern btn-secondary-modern" style={{ padding: '0.5rem 1rem', height: 'auto', fontSize: '0.8rem' }}>
                                    View All <ChevronRight size={14} />
                                </Link>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-soft)' }}>
                                            <th style={{ textAlign: 'left', padding: '1rem 0', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>Crop</th>
                                            <th style={{ textAlign: 'left', padding: '1rem 0', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>Quantity</th>
                                            <th style={{ textAlign: 'left', padding: '1rem 0', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>Amount</th>
                                            <th style={{ textAlign: 'left', padding: '1rem 0', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>Status</th>
                                            <th style={{ textAlign: 'left', padding: '1rem 0', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.slice(0, 5).map((order) => (
                                            <tr key={order.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                                <td style={{ padding: '1.25rem 0' }}>
                                                    <p style={{ fontWeight: 800, fontSize: '0.925rem' }}>{order.product_name}</p>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600 }}>#{order.id.slice(0, 8).toUpperCase()}</p>
                                                </td>
                                                <td style={{ padding: '1.25rem 0', fontSize: '0.9rem', fontWeight: 700 }}>
                                                    {order.quantity} {order.product_unit}
                                                </td>
                                                <td style={{ padding: '1.25rem 0', fontWeight: 900 }}>
                                                    {t('currency_symbol')}{order.total_price.toFixed(2)}
                                                </td>
                                                <td style={{ padding: '1.25rem 0' }}>
                                                    <span className={`badge-clean ${order.status === 'completed' ? 'badge-success' : order.status === 'cancelled' ? 'badge-error' : order.status === 'reserved' ? 'badge-success' : 'badge-pending'}`}>
                                                        {order.status === 'pending' ? 'PENDING' : order.status === 'approved' ? 'APPROVED • PAY NOW' : order.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </DashboardLayout>
    );
}
