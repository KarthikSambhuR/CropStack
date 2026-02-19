'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { db, addDoc, collection } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
    Package,
    Upload,
    CheckCircle2,
    Loader2,
    ArrowLeft,
    Info,
    Warehouse,
    ShieldCheck,
    Sprout,
    Globe,
    Landmark,
    ShoppingCart,
    Download,
    X,
    FileText,
    Copy,
    BadgeCheck
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';
import { generateCollateralReceiptPdf } from '@/lib/pdfReceipt';

export default function NewProduct() {
    const { user, profile } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [purpose, setPurpose] = useState<'sell' | 'collateral' | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price_per_unit: '',
        quantity_available: '',
        category: 'Grains',
        unit: 'quintal (q)',
        image_url: '',
        loan_amount: ''
    });

    // Collateral receipt modal
    const [showCollateralReceipt, setShowCollateralReceipt] = useState(false);
    const [collateralData, setCollateralData] = useState<{
        collateral_id: string;
        crop_name: string;
        crop_category: string;
        crop_quantity: number;
        crop_unit: string;
        crop_price_per_unit: number;
        crop_total_value: number;
        loan_amount: number;
        date: string;
        seller_name: string;
        seller_email: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    const categories = ['Grains', 'Rice', 'Wheat', 'Pulses', 'Legumes', 'Spices', 'Seeds'];
    const units = ['kg', 'quintal (q)', 'bag (50kg)', 'ton', 'metric ton'];

    const generateCollateralId = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = 'COL-';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const isCollateral = purpose === 'collateral';
            const pricePerUnit = parseFloat(formData.price_per_unit);
            const quantity = parseFloat(formData.quantity_available);
            const totalValue = pricePerUnit * quantity;

            // Add product to Firestore
            const productRef = await addDoc(collection(db, 'products'), {
                name: formData.name,
                description: formData.description || null,
                category: formData.category,
                unit: formData.unit,
                image_url: formData.image_url || null,
                seller_id: user?.uid,
                price_per_unit: pricePerUnit,
                quantity_available: quantity,
                is_active: !isCollateral, // collateral items are NOT listed on market
                is_collateral: isCollateral,
                loan_amount: isCollateral ? parseFloat(formData.loan_amount) : null,
                created_at: new Date().toISOString(),
            });

            if (isCollateral) {
                const colId = generateCollateralId();
                const loanAmount = parseFloat(formData.loan_amount);
                const date = new Date().toISOString();

                // Create collateral record
                await addDoc(collection(db, 'collaterals'), {
                    collateral_id: colId,
                    seller_id: user?.uid,
                    seller_name: profile?.full_name || 'Unknown',
                    seller_email: user?.email || 'Unknown',
                    product_id: productRef.id,
                    crop_name: formData.name,
                    crop_category: formData.category,
                    crop_quantity: quantity,
                    crop_unit: formData.unit,
                    crop_price_per_unit: pricePerUnit,
                    crop_total_value: totalValue,
                    loan_amount_requested: loanAmount,
                    status: 'pending',
                    created_at: date,
                });

                // Show receipt modal
                setCollateralData({
                    collateral_id: colId,
                    crop_name: formData.name,
                    crop_category: formData.category,
                    crop_quantity: quantity,
                    crop_unit: formData.unit,
                    crop_price_per_unit: pricePerUnit,
                    crop_total_value: totalValue,
                    loan_amount: loanAmount,
                    date: date,
                    seller_name: profile?.full_name || 'Seller',
                    seller_email: user?.email || '',
                });
                setShowCollateralReceipt(true);
                setLoading(false);
                return;
            }

            // For regular sale, redirect to products
            window.location.href = '/seller/products';
            return;
        } catch (err: any) {
            console.error('Submit error:', err);
            alert('Could not add your crop: ' + (err.message || 'Something went wrong.'));
        }

        setLoading(false);
    };

    const handleDownloadReceipt = () => {
        if (!collateralData) return;
        generateCollateralReceiptPdf({
            collateralId: collateralData.collateral_id,
            sellerName: collateralData.seller_name,
            sellerEmail: collateralData.seller_email,
            cropName: collateralData.crop_name,
            cropCategory: collateralData.crop_category,
            cropQuantity: collateralData.crop_quantity,
            cropUnit: collateralData.crop_unit,
            cropPricePerUnit: collateralData.crop_price_per_unit,
            cropTotalValue: collateralData.crop_total_value,
            loanAmountRequested: collateralData.loan_amount,
            date: collateralData.date,
            currencySymbol: t('currency_symbol'),
        }, 'download');
    };

    const handleCopyId = () => {
        if (!collateralData) return;
        navigator.clipboard.writeText(collateralData.collateral_id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Purpose selection screen
    if (!purpose) {
        return (
            <DashboardLayout role="seller">
                <Link href="/seller/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '2.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                    <ArrowLeft size={16} /> {t('back_to')} {t('dashboard')}
                </Link>

                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '2rem', color: 'var(--secondary)', marginBottom: '0.75rem', fontWeight: 900, letterSpacing: '-0.03em' }}>What would you like to do?</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Choose how you want to use your crop</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Sell Option */}
                        <button
                            onClick={() => setPurpose('sell')}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
                                padding: '3rem 2rem', borderRadius: '24px', border: '2px solid var(--border-soft)',
                                background: 'white', cursor: 'pointer', transition: 'all 0.3s ease',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'var(--primary)';
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 32px rgba(5,150,105,0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-soft)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
                            }}
                        >
                            <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ShoppingCart size={36} color="var(--primary)" />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--secondary)', marginBottom: '0.5rem' }}>List for Sale</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-soft)', lineHeight: 1.5 }}>
                                    Add your crop to the marketplace where buyers can discover and purchase it.
                                </p>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '0.4rem 1rem', borderRadius: '100px' }}>
                                Visible on Market
                            </span>
                        </button>

                        {/* Collateral Option */}
                        <button
                            onClick={() => setPurpose('collateral')}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
                                padding: '3rem 2rem', borderRadius: '24px', border: '2px solid var(--border-soft)',
                                background: 'white', cursor: 'pointer', transition: 'all 0.3s ease',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#6366f1';
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 32px rgba(99,102,241,0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-soft)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
                            }}
                        >
                            <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Landmark size={36} color="#6366f1" />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--secondary)', marginBottom: '0.5rem' }}>Use as Loan Collateral</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-soft)', lineHeight: 1.5 }}>
                                    Pledge your crop as collateral to apply for a loan. It will NOT be listed on the market.
                                </p>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.08)', padding: '0.4rem 1rem', borderRadius: '100px' }}>
                                Not Listed on Market
                            </span>
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="seller">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                <button onClick={() => setPurpose(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <ArrowLeft size={16} /> Back
                </button>
                <span style={{
                    fontSize: '0.7rem', fontWeight: 800, padding: '0.35rem 0.75rem', borderRadius: '100px',
                    background: purpose === 'collateral' ? 'rgba(99,102,241,0.08)' : 'var(--primary-soft)',
                    color: purpose === 'collateral' ? '#6366f1' : 'var(--primary)',
                    textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                    {purpose === 'collateral' ? '🏦 Loan Collateral' : '🛒 List for Sale'}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
                <div className="card-white" style={{ padding: '3.5rem' }}>
                    <div style={{ marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '1.875rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>
                            {purpose === 'collateral' ? 'Pledge Crop as Collateral' : t('inventory')}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                            {purpose === 'collateral'
                                ? 'Enter your crop details below to use as collateral for a loan.'
                                : 'Add your crop details below to list it for sale.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Crop Name</label>
                                <input
                                    type="text"
                                    className="input-modern"
                                    placeholder="e.g. Basmati Rice"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</label>
                                <select
                                    className="input-modern"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</label>
                            <textarea
                                className="input-modern"
                                style={{ minHeight: '120px', padding: '1rem', resize: 'vertical' }}
                                placeholder="Describe your crop — quality, grade, harvest date..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selling Unit</label>
                                <select
                                    className="input-modern"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                >
                                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price ({t('currency_symbol')})</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input-modern"
                                    placeholder="0.00"
                                    required
                                    value={formData.price_per_unit}
                                    onChange={(e) => setFormData({ ...formData, price_per_unit: e.target.value })}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quantity Available</label>
                                <input
                                    type="number"
                                    className="input-modern"
                                    placeholder="0"
                                    required
                                    value={formData.quantity_available}
                                    onChange={(e) => setFormData({ ...formData, quantity_available: e.target.value })}
                                />
                            </div>
                        </div>

                        {purpose === 'collateral' && (
                            <div style={{
                                padding: '1.5rem', borderRadius: '16px',
                                background: 'rgba(99,102,241,0.04)',
                                border: '1.5px solid rgba(99,102,241,0.15)'
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.75rem', color: '#6366f1', textTransform: 'uppercase' }}>
                                    <Landmark size={14} /> Loan Amount Requested ({t('currency_symbol')})
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input-modern"
                                    placeholder="Enter the loan amount you need"
                                    required
                                    value={formData.loan_amount}
                                    onChange={(e) => setFormData({ ...formData, loan_amount: e.target.value })}
                                    style={{ borderColor: 'rgba(99,102,241,0.2)' }}
                                />
                                {formData.price_per_unit && formData.quantity_available && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginTop: '0.75rem' }}>
                                        <Info size={12} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                                        Crop total value: <strong>{t('currency_symbol')}{(parseFloat(formData.price_per_unit) * parseFloat(formData.quantity_available)).toFixed(2)}</strong>
                                    </p>
                                )}
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Photo Link (optional)</label>
                            <div style={{ position: 'relative' }}>
                                <Upload size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)' }} />
                                <input
                                    type="url"
                                    className="input-modern"
                                    placeholder="https://images.unsplash.com/..."
                                    style={{ paddingLeft: '2.75rem' }}
                                    value={formData.image_url}
                                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-modern btn-primary-modern"
                            style={{
                                height: '56px', fontSize: '1rem', marginTop: '1.5rem',
                                background: purpose === 'collateral' ? '#6366f1' : undefined
                            }}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> :
                                purpose === 'collateral' ? '🏦 Submit as Collateral' : <>{t('action_publish')}</>
                            }
                        </button>
                    </form>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card-white" style={{ padding: '2.5rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ width: '40px', height: '40px', background: purpose === 'collateral' ? 'rgba(99,102,241,0.08)' : 'var(--primary-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <ShieldCheck size={20} color={purpose === 'collateral' ? '#6366f1' : 'var(--primary)'} />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                                    {purpose === 'collateral' ? 'Secure Verification' : 'Quality Checked'}
                                </h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: 1.4 }}>
                                    {purpose === 'collateral'
                                        ? 'Your collateral gets a unique ID that banks can verify instantly on our platform.'
                                        : 'Your listing will be reviewed to ensure buyers get accurate information about your crops.'}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', background: 'var(--success-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Sprout size={20} color="var(--success)" />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                                    {purpose === 'collateral' ? 'Crop Protected' : 'Live Stock Tracking'}
                                </h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: 1.4 }}>
                                    {purpose === 'collateral'
                                        ? 'Collateral crops are not listed on the market and remain protected until the loan is settled.'
                                        : 'Your stock levels update automatically when buyers place orders.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {purpose === 'collateral' ? (
                        <div className="card-white" style={{ padding: '2.5rem', background: '#6366f1', color: 'white' }}>
                            <h3 style={{ color: 'white', fontSize: '1.125rem', marginBottom: '1.25rem' }}>How Collateral Works</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem', fontWeight: 800 }}>1</div>
                                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>Add your crop and enter the loan amount you need</p>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem', fontWeight: 800 }}>2</div>
                                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>Get a unique Collateral ID and downloadable receipt</p>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem', fontWeight: 800 }}>3</div>
                                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>Take the receipt to your bank for loan verification</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card-white" style={{ padding: '2.5rem', background: 'var(--secondary)', color: 'white' }}>
                            <h3 style={{ color: 'white', fontSize: '1.125rem', marginBottom: '1.25rem' }}>Where Can Buyers Find You?</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem' }}>Your crops will be visible to buyers across all of India.</p>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <Globe size={20} color="var(--primary)" />
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>All India Coverage</p>
                                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>Available in multiple languages for all regions.</p>
                                </div>
                            </div>
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Platform Status</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>EVERYTHING WORKING</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Collateral Receipt Modal */}
            {showCollateralReceipt && collateralData && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => { setShowCollateralReceipt(false); window.location.href = '/seller/loans'; }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '24px', width: '90%', maxWidth: '600px',
                        padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setShowCollateralReceipt(false); window.location.href = '/seller/loans'; }} style={{
                            position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none',
                            cursor: 'pointer', color: 'var(--text-soft)'
                        }}><X size={24} /></button>

                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{
                                width: '72px', height: '72px', borderRadius: '50%',
                                background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', margin: '0 auto 1.5rem'
                            }}>
                                <BadgeCheck size={36} color="#6366f1" />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--secondary)', marginBottom: '0.5rem' }}>
                                Collateral Registered!
                            </h2>
                            <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem' }}>
                                Your crop has been pledged as collateral. Save your ID below.
                            </p>
                        </div>

                        {/* Collateral ID Highlight */}
                        <div style={{
                            padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem',
                            background: 'rgba(99,102,241,0.04)', borderRadius: '16px',
                            border: '2px dashed rgba(99,102,241,0.2)'
                        }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Collateral Verification ID</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'monospace', color: '#6366f1', letterSpacing: '2px' }}>
                                    {collateralData.collateral_id}
                                </h3>
                                <button onClick={handleCopyId} style={{
                                    background: copied ? 'var(--success-soft)' : 'rgba(99,102,241,0.08)',
                                    border: 'none', borderRadius: '8px', padding: '0.5rem',
                                    cursor: 'pointer', color: copied ? 'var(--success)' : '#6366f1',
                                    transition: 'all 0.2s'
                                }}>
                                    {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                                </button>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', marginTop: '0.5rem' }}>
                                Share this ID with your bank for verification
                            </p>
                        </div>

                        {/* Details Grid */}
                        <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '16px', marginBottom: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Crop</span>
                                    <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{collateralData.crop_name}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Category</span>
                                    <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{collateralData.crop_category}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Quantity</span>
                                    <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{collateralData.crop_quantity} {collateralData.crop_unit}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>Total Value</span>
                                    <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('currency_symbol')}{collateralData.crop_total_value.toFixed(2)}</p>
                                </div>
                                <div style={{ gridColumn: 'span 2', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>Loan Amount Requested</span>
                                    <p style={{ fontWeight: 900, fontSize: '1.25rem', color: '#6366f1' }}>{t('currency_symbol')}{collateralData.loan_amount.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={handleDownloadReceipt} className="btn-modern" style={{
                                flex: 1, gap: '0.5rem', height: '52px', fontWeight: 800,
                                background: '#6366f1', color: 'white', border: 'none',
                                borderRadius: '14px', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Download size={18} /> Download Receipt (PDF)
                            </button>
                            <button onClick={() => { setShowCollateralReceipt(false); window.location.href = '/seller/loans'; }} className="btn-modern btn-secondary-modern" style={{ flex: 1, height: '52px' }}>
                                View My Loans
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
