'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Collateral } from '@/lib/supabase';
import { db, collection, query, where, orderBy, getDocs } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { generateCollateralReceiptPdf } from '@/lib/pdfReceipt';
import {
    Landmark,
    Loader2,
    Download,
    Copy,
    CheckCircle2,
    Clock,
    Shield,
    AlertTriangle,
    ArrowRight,
    Plus,
    FileText,
    BadgeCheck,
    XCircle,
    Unlock
} from 'lucide-react';
import Link from 'next/link';

type CollateralItem = Collateral;

function getStatusInfo(status: string) {
    switch (status) {
        case 'pending':
            return { label: 'Pending Verification', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: Clock };
        case 'verified':
            return { label: 'Verified', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', icon: BadgeCheck };
        case 'active':
            return { label: 'Active Loan', color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: Shield };
        case 'released':
            return { label: 'Released', color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: Unlock };
        case 'defaulted':
            return { label: 'Defaulted', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: XCircle };
        default:
            return { label: status, color: '#94a3b8', bg: '#f8fafc', icon: Clock };
    }
}

export default function MyLoans() {
    const { user, profile } = useAuth();
    const { t } = useLanguage();
    const [collaterals, setCollaterals] = useState<CollateralItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        const fetchCollaterals = async () => {
            if (!user) return;
            try {
                const q = query(
                    collection(db, 'collaterals'),
                    where('seller_id', '==', user.uid),
                    orderBy('created_at', 'desc')
                );
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollateralItem));
                setCollaterals(data);
            } catch (err) {
                console.error('Error fetching collaterals:', err);
            }
            setLoading(false);
        };

        fetchCollaterals();
    }, [user]);

    const handleCopy = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDownloadReceipt = (col: CollateralItem) => {
        generateCollateralReceiptPdf({
            collateralId: col.collateral_id,
            sellerName: col.seller_name,
            sellerEmail: col.seller_email,
            cropName: col.crop_name,
            cropCategory: col.crop_category,
            cropQuantity: col.crop_quantity,
            cropUnit: col.crop_unit,
            cropPricePerUnit: col.crop_price_per_unit,
            cropTotalValue: col.crop_total_value,
            loanAmountRequested: col.loan_amount_requested,
            date: col.created_at,
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

    // Calculate stats
    const totalCollateralValue = collaterals.reduce((acc, c) => acc + c.crop_total_value, 0);
    const totalLoanRequested = collaterals.reduce((acc, c) => acc + c.loan_amount_requested, 0);
    const activeCount = collaterals.filter(c => c.status === 'pending' || c.status === 'verified' || c.status === 'active').length;

    return (
        <DashboardLayout role="seller">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', color: 'var(--secondary)', fontWeight: 900, letterSpacing: '-0.03em' }}>My Loans</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Track your crop collaterals and loan applications</p>
                </div>
                <Link href="/seller/products/new" className="btn-modern" style={{
                    height: '48px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: '#6366f1', color: 'white', border: 'none', borderRadius: '14px',
                    fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none'
                }}>
                    <Plus size={18} /> New Collateral
                </Link>
            </div>

            {/* Stats Cards */}
            {!loading && collaterals.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
                    <div className="card-white" style={{ padding: '1.5rem', borderLeft: '4px solid #6366f1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Total Collateral Value</span>
                            <Shield size={18} color="#6366f1" />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--secondary)' }}>{t('currency_symbol')}{totalCollateralValue.toFixed(2)}</h2>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-soft)' }}>Across {collaterals.length} pledges</p>
                    </div>

                    <div className="card-white" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Total Loan Requested</span>
                            <Landmark size={18} color="var(--primary)" />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--secondary)' }}>{t('currency_symbol')}{totalLoanRequested.toFixed(2)}</h2>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-soft)' }}>Sum of all loan requests</p>
                    </div>

                    <div className="card-white" style={{ padding: '1.5rem', background: '#6366f1', color: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Active Pledges</span>
                            <BadgeCheck size={18} color="rgba(255,255,255,0.7)" />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white' }}>{activeCount}</h2>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Currently pledged crops</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6rem', flexDirection: 'column', gap: '1rem' }}>
                    <Loader2 size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: 'var(--text-soft)', fontWeight: 600 }}>Loading your loans...</p>
                </div>
            ) : collaterals.length === 0 ? (
                <div className="card-white" style={{ textAlign: 'center', padding: '6rem' }}>
                    <div style={{
                        width: '80px', height: '80px',
                        background: 'rgba(99,102,241,0.08)', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem'
                    }}>
                        <Landmark size={36} color="#6366f1" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No loan collaterals yet</h3>
                    <p style={{ color: 'var(--text-soft)', fontSize: '0.95rem', marginBottom: '2.5rem', maxWidth: '400px', margin: '0 auto 2.5rem' }}>
                        Pledge a crop as collateral to apply for a loan. Your crop will be secured and not listed on the market.
                    </p>
                    <Link href="/seller/products/new" className="btn-modern" style={{
                        height: '48px', padding: '0 2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        background: '#6366f1', color: 'white', border: 'none', borderRadius: '14px',
                        fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none'
                    }}>
                        <Plus size={18} /> Pledge a Crop
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {collaterals.map((col) => {
                        const statusInfo = getStatusInfo(col.status);
                        const StatusIcon = statusInfo.icon;

                        return (
                            <div key={col.id} className="card-white" style={{ padding: '2rem', transition: 'all 0.2s' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    {/* Left: Crop info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                            <div style={{
                                                width: '48px', height: '48px', borderRadius: '14px',
                                                background: statusInfo.bg, display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', flexShrink: 0
                                            }}>
                                                <StatusIcon size={22} color={statusInfo.color} />
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--secondary)' }}>{col.crop_name}</h3>
                                                    <span style={{
                                                        fontSize: '0.65rem', fontWeight: 800, padding: '0.25rem 0.6rem',
                                                        borderRadius: '100px', background: statusInfo.bg, color: statusInfo.color,
                                                        textTransform: 'uppercase', letterSpacing: '0.5px'
                                                    }}>
                                                        {statusInfo.label}
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', fontWeight: 600 }}>
                                                    {col.crop_category} · {col.crop_quantity} {col.crop_unit} · Pledged {formatDate(col.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Collateral ID */}
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.5rem 1rem', borderRadius: '10px',
                                            background: 'rgba(99,102,241,0.04)',
                                            border: '1.5px dashed rgba(99,102,241,0.2)'
                                        }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)' }}>ID:</span>
                                            <span style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '0.95rem', color: '#6366f1', letterSpacing: '1px' }}>
                                                {col.collateral_id}
                                            </span>
                                            <button onClick={() => handleCopy(col.collateral_id)} style={{
                                                background: copiedId === col.collateral_id ? 'var(--success-soft)' : 'rgba(99,102,241,0.08)',
                                                border: 'none', borderRadius: '6px', padding: '0.3rem',
                                                cursor: 'pointer', color: copiedId === col.collateral_id ? 'var(--success)' : '#6366f1',
                                                display: 'flex', alignItems: 'center', transition: 'all 0.2s'
                                            }}>
                                                {copiedId === col.collateral_id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right: Amounts + Actions */}
                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                                        <div>
                                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Crop Value</p>
                                            <p style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--secondary)' }}>{t('currency_symbol')}{col.crop_total_value.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>Loan Requested</p>
                                            <p style={{ fontSize: '1.375rem', fontWeight: 900, color: '#6366f1' }}>{t('currency_symbol')}{col.loan_amount_requested.toFixed(2)}</p>
                                        </div>
                                        <button onClick={() => handleDownloadReceipt(col)} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                                            padding: '0.5rem 1rem', borderRadius: '10px',
                                            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
                                            cursor: 'pointer', color: '#6366f1', fontWeight: 700, fontSize: '0.8rem',
                                            transition: 'all 0.2s'
                                        }}>
                                            <Download size={14} /> Receipt
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
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
