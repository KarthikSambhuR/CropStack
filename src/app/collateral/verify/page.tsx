'use client';

import React, { useState } from 'react';
import {
    Search,
    Shield,
    CheckCircle2,
    Clock,
    XCircle,
    Loader2,
    BadgeCheck,
    Unlock,
    AlertTriangle,
    Landmark,
    User,
    Mail,
    Package,
    Wheat,
    CalendarDays,
    ArrowLeft,
    FileText,
    Warehouse
} from 'lucide-react';
import Link from 'next/link';
import { db, collection, query, where, getDocs } from '@/lib/firebase';
import { Collateral } from '@/lib/supabase';

type CollateralResult = Collateral;

function getStatusInfo(status: string) {
    switch (status) {
        case 'pending':
            return { label: 'Pending Verification', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: Clock, desc: 'This collateral has been submitted but not yet verified by a bank.' };
        case 'verified':
            return { label: 'Verified', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', icon: BadgeCheck, desc: 'This collateral has been verified and is ready for loan processing.' };
        case 'active':
            return { label: 'Active Loan', color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: Shield, desc: 'An active loan is backed by this crop collateral.' };
        case 'released':
            return { label: 'Released', color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: Unlock, desc: 'The loan has been settled and the crop has been released.' };
        case 'defaulted':
            return { label: 'Defaulted', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: XCircle, desc: 'The borrower has defaulted on the loan.' };
        default:
            return { label: status, color: '#94a3b8', bg: '#f8fafc', icon: Clock, desc: '' };
    }
}

export default function VerifyCollateral() {
    const [searchId, setSearchId] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<CollateralResult | null>(null);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchId.trim().toUpperCase();
        if (!trimmed) return;

        setLoading(true);
        setResult(null);
        setError('');
        setSearched(true);

        try {
            const q = query(
                collection(db, 'collaterals'),
                where('collateral_id', '==', trimmed)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setError('No collateral found with this ID. Please check the ID and try again.');
            } else {
                const doc = snapshot.docs[0];
                setResult({ id: doc.id, ...doc.data() } as CollateralResult);
            }
        } catch (err) {
            console.error('Search error:', err);
            setError('An error occurred while searching. Please try again.');
        }

        setLoading(false);
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
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

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f0fdf4 100%)'
        }}>
            {/* Navbar */}
            <nav style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1.25rem 2.5rem', borderBottom: '1px solid var(--border-soft)',
                background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)'
            }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
                    <div style={{ width: '36px', height: '36px', background: 'var(--primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)' }}>
                        <Warehouse size={20} color="white" />
                    </div>
                    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--secondary)', letterSpacing: '-0.04em' }}>CropStack</span>
                </Link>
                <Link href="/" style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem'
                }}>
                    <ArrowLeft size={16} /> Back to Home
                </Link>
            </nav>

            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 2rem' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '24px',
                        background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 1.5rem',
                        border: '2px solid rgba(99,102,241,0.1)'
                    }}>
                        <Shield size={40} color="#6366f1" />
                    </div>
                    <h1 style={{
                        fontSize: '2.5rem', fontWeight: 900, color: 'var(--secondary)',
                        letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '0.75rem'
                    }}>
                        Collateral <span style={{ color: '#6366f1' }}>Verification</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.5 }}>
                        Banks and financial institutions can verify crop collateral authenticity by entering the Collateral ID.
                    </p>
                </div>

                {/* Search Form */}
                <form onSubmit={handleSearch} style={{ marginBottom: '2rem' }}>
                    <div style={{
                        display: 'flex', gap: '0.75rem',
                        padding: '0.5rem', borderRadius: '20px',
                        background: 'white', border: '2px solid var(--border-soft)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                        transition: 'all 0.3s'
                    }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={20} style={{
                                position: 'absolute', left: '1.25rem', top: '50%',
                                transform: 'translateY(-50%)', color: 'var(--text-soft)'
                            }} />
                            <input
                                type="text"
                                placeholder="Enter Collateral ID (e.g. COL-A8K3M2N7)"
                                value={searchId}
                                onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                                style={{
                                    width: '100%', padding: '1rem 1rem 1rem 3.25rem',
                                    border: 'none', outline: 'none', fontSize: '1.05rem',
                                    fontWeight: 700, fontFamily: 'monospace', color: 'var(--secondary)',
                                    background: 'transparent', letterSpacing: '1.5px'
                                }}
                            />
                        </div>
                        <button type="submit" disabled={loading || !searchId.trim()} style={{
                            padding: '0 2rem', borderRadius: '14px', border: 'none',
                            background: '#6366f1', color: 'white', fontWeight: 800,
                            fontSize: '0.95rem', cursor: loading ? 'wait' : 'pointer',
                            opacity: !searchId.trim() ? 0.5 : 1,
                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}>
                            {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={18} />}
                            Verify
                        </button>
                    </div>
                </form>

                {/* Results */}
                {loading && (
                    <div style={{
                        textAlign: 'center', padding: '4rem',
                        background: 'white', borderRadius: '24px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
                    }}>
                        <Loader2 size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
                        <p style={{ color: 'var(--text-soft)', fontWeight: 600 }}>Searching collateral records...</p>
                    </div>
                )}

                {!loading && searched && error && (
                    <div style={{
                        textAlign: 'center', padding: '4rem',
                        background: 'white', borderRadius: '24px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                        border: '1px solid rgba(239,68,68,0.1)'
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto 1.5rem'
                        }}>
                            <AlertTriangle size={28} color="#ef4444" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--secondary)', marginBottom: '0.5rem' }}>
                            No Record Found
                        </h3>
                        <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem' }}>{error}</p>
                    </div>
                )}

                {!loading && result && (
                    <div style={{
                        background: 'white', borderRadius: '24px',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
                        overflow: 'hidden'
                    }}>
                        {/* Status Banner */}
                        {(() => {
                            const statusInfo = getStatusInfo(result.status);
                            const StatusIcon = statusInfo.icon;
                            return (
                                <div style={{
                                    padding: '1.5rem 2.5rem',
                                    background: statusInfo.bg,
                                    borderBottom: `2px solid ${statusInfo.color}20`,
                                    display: 'flex', alignItems: 'center', gap: '1rem'
                                }}>
                                    <StatusIcon size={24} color={statusInfo.color} />
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{
                                                fontSize: '0.95rem', fontWeight: 800, color: statusInfo.color,
                                                textTransform: 'uppercase', letterSpacing: '0.5px'
                                            }}>
                                                {statusInfo.label}
                                            </span>
                                            <CheckCircle2 size={16} color={statusInfo.color} />
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', fontWeight: 500 }}>{statusInfo.desc}</p>
                                    </div>
                                </div>
                            );
                        })()}

                        <div style={{ padding: '2.5rem' }}>
                            {/* Collateral ID */}
                            <div style={{
                                padding: '1.5rem', textAlign: 'center', marginBottom: '2rem',
                                background: 'rgba(99,102,241,0.03)', borderRadius: '16px',
                                border: '2px dashed rgba(99,102,241,0.15)'
                            }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>
                                    Collateral Verification ID
                                </p>
                                <p style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'monospace', color: '#6366f1', letterSpacing: '3px' }}>
                                    {result.collateral_id}
                                </p>
                            </div>

                            {/* Details Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                {/* Applicant Information */}
                                <div style={{
                                    padding: '1.75rem', borderRadius: '16px',
                                    background: 'var(--bg-main)', border: '1px solid var(--border-soft)'
                                }}>
                                    <h4 style={{
                                        fontSize: '0.75rem', fontWeight: 800, color: '#6366f1',
                                        textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.25rem'
                                    }}>
                                        Applicant Information
                                    </h4>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <User size={16} color="#6366f1" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Full Name</p>
                                                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--secondary)' }}>{result.seller_name}</p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Mail size={16} color="#6366f1" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Email</p>
                                                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--secondary)' }}>{result.seller_email}</p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <CalendarDays size={16} color="#6366f1" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Date of Pledge</p>
                                                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--secondary)' }}>{formatDate(result.created_at)}</p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)' }}>{formatTime(result.created_at)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Crop Details */}
                                <div style={{
                                    padding: '1.75rem', borderRadius: '16px',
                                    background: 'var(--bg-main)', border: '1px solid var(--border-soft)'
                                }}>
                                    <h4 style={{
                                        fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)',
                                        textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.25rem'
                                    }}>
                                        Crop Details
                                    </h4>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Wheat size={16} color="var(--primary)" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Crop Name</p>
                                                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--secondary)' }}>{result.crop_name}</p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Package size={16} color="var(--primary)" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Category & Quantity</p>
                                                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--secondary)' }}>
                                                    {result.crop_category} · {result.crop_quantity} {result.crop_unit}
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FileText size={16} color="var(--primary)" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Price per Unit</p>
                                                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--secondary)' }}>
                                                    ₹{result.crop_price_per_unit.toFixed(2)} / {result.crop_unit}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div style={{
                                padding: '2rem', borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.85))',
                                color: 'white'
                            }}>
                                <h4 style={{
                                    fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)',
                                    textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem'
                                }}>
                                    Financial Summary
                                </h4>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                            Crop Total Value
                                        </p>
                                        <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white' }}>
                                            ₹{result.crop_total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                            Loan Requested
                                        </p>
                                        <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#818cf8' }}>
                                            ₹{result.loan_amount_requested.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                            Loan-to-Value Ratio
                                        </p>
                                        <p style={{ fontSize: '1.75rem', fontWeight: 900, color: result.loan_amount_requested / result.crop_total_value > 0.8 ? '#fca5a5' : '#86efac' }}>
                                            {((result.loan_amount_requested / result.crop_total_value) * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Verification Badge */}
                            <div style={{
                                marginTop: '1.5rem', padding: '1.25rem 1.5rem', borderRadius: '12px',
                                background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)',
                                display: 'flex', alignItems: 'center', gap: '1rem'
                            }}>
                                <CheckCircle2 size={20} color="var(--primary)" />
                                <div>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--secondary)' }}>
                                        Verified by CropStack
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)' }}>
                                        This crop collateral record is authentic and registered on the CropStack platform.
                                        Verified on {formatDate(new Date().toISOString())}.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Section (shown when not searched yet) */}
                {!searched && !loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginTop: '2rem' }}>
                        <div style={{
                            padding: '2rem', borderRadius: '20px', background: 'white',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.04)', textAlign: 'center'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '14px',
                                background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', margin: '0 auto 1rem'
                            }}>
                                <Search size={22} color="#6366f1" />
                            </div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--secondary)' }}>Enter ID</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: 1.5 }}>
                                Enter the Collateral ID from the farmer's receipt document.
                            </p>
                        </div>

                        <div style={{
                            padding: '2rem', borderRadius: '20px', background: 'white',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.04)', textAlign: 'center'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '14px',
                                background: 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', margin: '0 auto 1rem'
                            }}>
                                <BadgeCheck size={22} color="#10b981" />
                            </div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--secondary)' }}>Instant Verification</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: 1.5 }}>
                                Get instant access to crop details, farmer info, and loan amount.
                            </p>
                        </div>

                        <div style={{
                            padding: '2rem', borderRadius: '20px', background: 'white',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.04)', textAlign: 'center'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '14px',
                                background: 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', margin: '0 auto 1rem'
                            }}>
                                <Shield size={22} color="#f59e0b" />
                            </div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--secondary)' }}>Tamper-Proof</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: 1.5 }}>
                                Records are digitally secured and cannot be altered or duplicated.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
