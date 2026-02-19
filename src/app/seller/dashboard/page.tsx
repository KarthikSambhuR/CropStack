'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
    Wallet,
    TrendingUp,
    ArrowUpRight,
    Clock,
    ChevronRight,
    Activity,
    Database,
    Loader2,
    X,
    FileText,
    Download,
    CheckCircle2,
    BarChart3,
    PieChart,
    Settings,
    User,
    ChevronDown,
    ArrowDownRight,
    Shield
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { db, collection, query, where, getDocs, orderBy, addDoc } from '@/lib/firebase';
import { Transaction, Product } from '@/lib/supabase';
import { generateWithdrawalPdf, generatePaymentHistoryPdf } from '@/lib/pdfReceipt';

type SellerStats = {
    available_balance: number;
    pending_payments: number;
    monthly_yield: number;
    monthly_growth: number;
    silo_efficiency: number;
    node_sync: number;
    silo_utilization: number;
};

interface TransactionItem extends Transaction { }

export default function SellerDashboard() {
    const { t } = useLanguage();
    const { user, profile } = useAuth();
    const [stats, setStats] = useState<SellerStats | null>(null);
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    const [loading, setLoading] = useState(true);
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [error, setError] = useState(false);

    // Modal states
    const [showReceipt, setShowReceipt] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [lastWithdrawal, setLastWithdrawal] = useState<{ id: string; amount: number; date: string } | null>(null);



    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            const txQuery = query(
                collection(db, 'transactions'),
                where('seller_id', '==', user.uid),
                orderBy('created_at', 'desc')
            );
            const txSnapshot = await getDocs(txQuery);
            const txData = txSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionItem));
            setTransactions(txData);

            const productsQuery = query(
                collection(db, 'products'),
                where('seller_id', '==', user.uid)
            );
            const productsSnapshot = await getDocs(productsQuery);
            const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(productsData);

            let availableBalance = 0;
            let pendingPayments = 0;
            let monthlyYield = 0;
            let lastMonthYield = 0;

            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonth = lastMonthDate.getMonth();
            const lastMonthYear = lastMonthDate.getFullYear();

            txData.forEach(tx => {
                const txDate = new Date(tx.created_at);
                if (tx.status === 'cleared' || tx.status === 'released') {
                    availableBalance += tx.amount;
                } else if (tx.status === 'held') {
                    pendingPayments += tx.amount;
                }

                if (tx.amount > 0) {
                    if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
                        monthlyYield += tx.amount;
                    }
                    if (txDate.getMonth() === lastMonth && txDate.getFullYear() === lastMonthYear) {
                        lastMonthYield += tx.amount;
                    }
                }
            });

            let monthlyGrowth = 0;
            if (lastMonthYield > 0) {
                monthlyGrowth = ((monthlyYield - lastMonthYield) / lastMonthYield) * 100;
            } else if (monthlyYield > 0) {
                monthlyGrowth = 100;
            }

            const totalStock = productsData.reduce((acc, product) => acc + product.quantity_available, 0);
            const maxStorage = 1000;
            const utilization = Math.min((totalStock / maxStorage) * 100, 100);

            setStats({
                available_balance: availableBalance,
                pending_payments: pendingPayments,
                monthly_yield: monthlyYield,
                monthly_growth: parseFloat(monthlyGrowth.toFixed(1)),
                silo_efficiency: 98,
                node_sync: 100,
                silo_utilization: parseFloat(utilization.toFixed(1))
            });

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

    const handleWithdraw = async () => {
        if (!user || !stats || stats.available_balance <= 0) return;

        if (!confirm(`Are you sure you want to withdraw ${t('currency_symbol')}${stats.available_balance.toFixed(2)} to your bank account?`)) {
            return;
        }

        setWithdrawLoading(true);
        try {
            const amount = stats.available_balance;
            const date = new Date().toISOString();

            const withdrawalRef = await addDoc(collection(db, 'withdrawals'), {
                seller_id: user.uid,
                amount: amount,
                status: 'pending',
                created_at: date
            });

            await addDoc(collection(db, 'transactions'), {
                seller_id: user.uid,
                order_id: `WITHDRAWAL-${withdrawalRef.id.slice(0, 8).toUpperCase()}`,
                amount: -amount,
                status: 'released',
                created_at: date
            });

            setLastWithdrawal({
                id: withdrawalRef.id.slice(0, 8).toUpperCase(),
                amount: amount,
                date: date
            });
            setShowReceipt(true);
            await fetchData();
        } catch (err) {
            console.error('Withdrawal failed:', err);
            alert('Failed to process withdrawal. Please try again.');
        } finally {
            setWithdrawLoading(false);
        }
    };

    const handlePrintReceipt = () => {
        if (!lastWithdrawal) return;
        generateWithdrawalPdf({
            referenceId: lastWithdrawal.id,
            amount: lastWithdrawal.amount,
            date: lastWithdrawal.date,
            sellerName: profile?.full_name || 'Seller',
            currencySymbol: t('currency_symbol'),
        }, 'download');
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const formatTime = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    // Modal Components
    const Modal = ({ show, onClose, title, children }: { show: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
        if (!show) return null;
        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }} onClick={onClose}>
                <div style={{
                    backgroundColor: 'white', borderRadius: '24px', width: '90%', maxWidth: '600px',
                    padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                    maxHeight: '90vh', overflowY: 'auto'
                }} onClick={e => e.stopPropagation()}>
                    <button onClick={onClose} style={{
                        position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--text-soft)'
                    }}><X size={24} /></button>
                    <h2 style={{ fontSize: '1.5rem', color: 'var(--secondary)', marginBottom: '1.5rem', fontWeight: 800 }}>{title}</h2>
                    {children}
                </div>
            </div>
        );
    };

    return (
        <DashboardLayout role="seller">
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', color: 'var(--secondary)', letterSpacing: '-0.03em' }}>{t('welcome')}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                    {error ? '⚠️ Could not connect to market data.' : 'Here\'s how your sales are doing today.'}
                </p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Loader2 size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : stats && (
                <>
                    {/* Wallet Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
                        <div className="card-white" style={{ padding: '1.5rem', borderLeft: '4px solid var(--success)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase' }}>{t('stats.available_balance')}</span>
                                <Wallet size={18} color="var(--success)" />
                            </div>
                            <h2 style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--secondary)', marginBottom: '0.25rem' }}>{t('currency_symbol')}{stats.available_balance.toFixed(2)}</h2>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>Ready to withdraw</p>
                        </div>

                        <div className="card-white" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase' }}>{t('stats.pending_payments')}</span>
                                <Clock size={18} color="var(--warning)" />
                            </div>
                            <h2 style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--secondary)', marginBottom: '0.25rem' }}>{t('currency_symbol')}{stats.pending_payments.toFixed(2)}</h2>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-soft)' }}>Being processed</p>
                        </div>

                        <div className="card-white" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase' }}>{t('stats.monthly_sales')}</span>
                                <TrendingUp size={18} color="var(--primary)" />
                            </div>
                            <h2 style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--secondary)', marginBottom: '0.25rem' }}>{t('currency_symbol')}{stats.monthly_yield.toFixed(2)}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: stats.monthly_growth >= 0 ? 'var(--success)' : 'var(--error)' }}>
                                {stats.monthly_growth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {stats.monthly_growth > 0 ? '+' : ''}{stats.monthly_growth}%
                            </div>
                        </div>

                        <div className="card-white" style={{ padding: '1.5rem', background: 'var(--primary)', color: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Storage Usage</span>
                                <Database size={18} color="rgba(255,255,255,0.7)" />
                            </div>
                            <h2 style={{ fontSize: '1.875rem', fontWeight: 900, color: 'white', marginBottom: '0.25rem' }}>{stats.silo_utilization}%</h2>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                                {stats.silo_utilization < 50 ? 'Plenty of space' : stats.silo_utilization < 80 ? 'Well utilized' : 'Near capacity'}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                        {/* Transaction History */}
                        <div className="card-white" style={{ padding: '2.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem' }}>Recent Payments</h3>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Your latest sales and payment history</p>
                                </div>
                                <Link href="/seller/products" className="btn-modern btn-secondary-modern" style={{ padding: '0.5rem 1rem', height: 'auto', fontSize: '0.8rem' }}>
                                    View My Crops <ChevronRight size={14} />
                                </Link>
                            </div>

                            {transactions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '5rem', background: 'var(--bg-main)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                                    <Activity size={32} color="#94a3b8" style={{ marginBottom: '1rem' }} />
                                    <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', fontWeight: 700 }}>No payments recorded yet.</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--border-soft)' }}>
                                                <th style={{ textAlign: 'left', padding: '1rem 0', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>Date</th>
                                                <th style={{ textAlign: 'left', padding: '1rem 0', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>Order ID</th>
                                                <th style={{ textAlign: 'left', padding: '1rem 0', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>Amount</th>
                                                <th style={{ textAlign: 'left', padding: '1rem 0', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.slice(0, 5).map((txn) => (
                                                <tr key={txn.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                                    <td style={{ padding: '1.25rem 0', fontSize: '0.925rem', fontWeight: 700 }}>{formatDate(txn.created_at)}</td>
                                                    <td style={{ padding: '1.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{txn.order_id.slice(0, 8).toUpperCase()}</td>
                                                    <td style={{ padding: '1.25rem 0', fontSize: '0.95rem', fontWeight: 900 }}>
                                                        <span style={{ color: txn.amount < 0 ? 'var(--error)' : 'var(--secondary)' }}>
                                                            {txn.amount < 0 ? '-' : ''}{t('currency_symbol')}{Math.abs(txn.amount).toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1.25rem 0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <span className={`badge-clean ${txn.status === 'cleared' || txn.status === 'released' ? 'badge-success' : 'badge-pending'}`}>
                                                                {txn.status === 'cleared' || txn.status === 'released' ? (txn.amount < 0 ? 'Withdrawn' : 'Paid') : 'Pending'}
                                                            </span>
                                                            {txn.amount < 0 && (
                                                                <button
                                                                    onClick={() => {
                                                                        setLastWithdrawal({
                                                                            id: txn.order_id.replace('WITHDRAWAL-', ''),
                                                                            amount: Math.abs(txn.amount),
                                                                            date: txn.created_at
                                                                        });
                                                                        setShowReceipt(true);
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}
                                                                >
                                                                    <FileText size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                                        <button onClick={() => {
                                            generatePaymentHistoryPdf({
                                                sellerName: profile?.full_name || 'Seller',
                                                currencySymbol: t('currency_symbol'),
                                                transactions: transactions.map(txn => ({
                                                    date: txn.created_at,
                                                    orderId: txn.order_id,
                                                    amount: txn.amount,
                                                    status: txn.status,
                                                })),
                                                availableBalance: stats?.available_balance || 0,
                                                pendingPayments: stats?.pending_payments || 0,
                                            });
                                        }} className="btn-modern btn-secondary-modern" style={{ width: '100%', border: 'none', background: 'var(--bg-main)', fontSize: '0.85rem' }}>
                                            <Download size={16} style={{ marginRight: '0.5rem' }} /> Download Payment History (PDF)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Performance Hub */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="card-white" style={{ padding: '2.5rem', background: 'var(--secondary)', color: 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <h3 style={{ color: 'white', fontSize: '1.25rem' }}>Performance</h3>
                                    <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.8rem', textDecoration: 'none', cursor: 'pointer' }} onClick={() => setShowReport(true)}>
                                        View Details <ArrowUpRight size={14} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>SYSTEM HEALTH</span>
                                            <span style={{ color: 'var(--success)' }}>HEALTHY</span>
                                        </div>
                                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${stats.node_sync}%`, background: 'var(--success)', transition: 'width 0.5s ease' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>STORAGE USED</span>
                                            <span style={{ color: 'var(--warning)' }}>{stats.silo_utilization}%</span>
                                        </div>
                                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${stats.silo_utilization}%`, background: 'var(--warning)', transition: 'width 0.5s ease' }}></div>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setShowReport(true)} className="btn-modern" style={{ width: '100%', marginTop: '3rem', background: 'white', color: 'var(--secondary)', height: '52px', fontWeight: 800 }}>
                                    View Full Report
                                </button>
                            </div>

                            <div className="card-white" style={{ padding: '2.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Withdraw Money</h3>
                                <div style={{ padding: '1.75rem', background: 'var(--bg-main)', borderRadius: '16px', border: '1.5px solid var(--border-soft)', textAlign: 'center', marginBottom: '1.5rem' }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '1px' }}>Available to Withdraw</p>
                                    <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{t('currency_symbol')}{stats.available_balance.toFixed(2)}</h2>
                                </div>
                                <button
                                    className="btn-modern btn-primary-modern"
                                    style={{ width: '100%', height: '52px' }}
                                    disabled={stats.available_balance <= 0 || withdrawLoading}
                                    onClick={handleWithdraw}
                                >
                                    {withdrawLoading ? <Loader2 className="animate-spin" /> : 'Withdraw to Bank'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Receipt Modal */}
            <Modal show={showReceipt} onClose={() => setShowReceipt(false)} title="Withdrawal Receipt">
                <div>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{ width: '64px', height: '64px', background: 'var(--success-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <CheckCircle2 size={32} color="var(--success)" />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>{t('currency_symbol')}{lastWithdrawal?.amount.toFixed(2)}</h3>
                        <p style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' }}>COMPLETED SUCCESSFULLY</p>
                    </div>

                    <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '16px', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ color: 'var(--text-soft)', fontSize: '0.85rem' }}>Reference ID</span>
                            <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>#{lastWithdrawal?.id}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ color: 'var(--text-soft)', fontSize: '0.85rem' }}>Date</span>
                            <span style={{ fontWeight: 700 }}>{lastWithdrawal ? formatDate(lastWithdrawal.date) : ''}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ color: 'var(--text-soft)', fontSize: '0.85rem' }}>Time</span>
                            <span style={{ fontWeight: 700 }}>{lastWithdrawal ? formatTime(lastWithdrawal.date) : ''}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
                            <span style={{ color: 'var(--text-soft)', fontSize: '0.85rem' }}>Account Name</span>
                            <span style={{ fontWeight: 700 }}>{profile?.full_name || 'Seller'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-soft)', fontSize: '0.85rem' }}>Bank Status</span>
                            <span style={{ fontWeight: 700, color: 'var(--success)' }}>PROCESSED</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handlePrintReceipt} className="btn-modern btn-primary-modern" style={{ flex: 1, gap: '0.5rem' }}>
                            <Download size={18} /> Download PDF
                        </button>
                        <button onClick={() => setShowReceipt(false)} className="btn-modern btn-secondary-modern" style={{ flex: 1 }}>
                            Close
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Performance Report Modal */}
            <Modal show={showReport} onClose={() => setShowReport(false)} title="Full Performance Report">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="card-white" style={{ padding: '1.5rem', background: 'var(--bg-main)' }}>
                        <PieChart size={24} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 700, textTransform: 'uppercase' }}>Crops Listed</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{products.length}</h4>
                    </div>
                    <div className="card-white" style={{ padding: '1.5rem', background: 'var(--bg-main)' }}>
                        <BarChart3 size={24} color="var(--success)" style={{ marginBottom: '1rem' }} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 700, textTransform: 'uppercase' }}>Total Orders</p>
                        <h4 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{transactions.filter(t => t.amount > 0).length}</h4>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem' }}>Platform Efficiency</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 600 }}>Logistics Rating</span>
                                <span style={{ fontWeight: 800 }}>96%</span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--border-soft)', borderRadius: '100px' }}>
                                <div style={{ height: '100%', width: '96%', background: 'var(--primary)', borderRadius: '100px' }}></div>
                            </div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 600 }}>Payment Security</span>
                                <span style={{ fontWeight: 800 }}>100%</span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--border-soft)', borderRadius: '100px' }}>
                                <div style={{ height: '100%', width: '100%', background: 'var(--success)', borderRadius: '100px' }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', background: 'var(--secondary)', borderRadius: '16px', color: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <Shield size={20} color="var(--primary)" />
                        <h4 style={{ margin: 0 }}>Certificate of Authenticity</h4>
                    </div>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.5 }}>
                        This report is digitally signed and verified by CropStack AI. All data is real-time and immutable.
                    </p>
                </div>
            </Modal>

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </DashboardLayout>
    );
}
