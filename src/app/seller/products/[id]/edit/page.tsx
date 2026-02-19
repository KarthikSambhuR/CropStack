'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { db, doc, getDoc, updateDoc } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
    Package,
    Upload,
    CheckCircle2,
    Loader2,
    ArrowLeft,
    ShieldCheck,
    Sprout,
    Globe
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function EditProduct() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const params = useParams();
    const productId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price_per_unit: '',
        quantity_available: '',
        category: 'Grains',
        unit: 'quintal (q)',
        image_url: ''
    });

    const categories = ['Grains', 'Rice', 'Wheat', 'Pulses', 'Legumes', 'Spices', 'Seeds'];
    const units = ['kg', 'quintal (q)', 'bag (50kg)', 'ton', 'metric ton'];

    useEffect(() => {
        const fetchProduct = async () => {
            if (!productId) return;
            try {
                const docSnap = await getDoc(doc(db, 'products', productId));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFormData({
                        name: data.name || '',
                        description: data.description || '',
                        price_per_unit: data.price_per_unit?.toString() || '',
                        quantity_available: data.quantity_available?.toString() || '',
                        category: data.category || 'Grains',
                        unit: data.unit || 'quintal (q)',
                        image_url: data.image_url || ''
                    });
                }
            } catch (err) {
                console.error('Error fetching product:', err);
                alert('Could not load product data.');
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [productId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await updateDoc(doc(db, 'products', productId), {
                name: formData.name,
                description: formData.description || null,
                category: formData.category,
                unit: formData.unit,
                image_url: formData.image_url || null,
                price_per_unit: parseFloat(formData.price_per_unit),
                quantity_available: parseFloat(formData.quantity_available),
                updated_at: new Date().toISOString(),
            });

            window.location.href = '/seller/products';
        } catch (err: any) {
            console.error('Update error:', err);
            alert('Could not update your crop: ' + (err.message || 'Something went wrong.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout role="seller">
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10rem' }}>
                    <Loader2 size={48} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="seller">
            <Link href="/seller/products" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '2.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                <ArrowLeft size={16} /> {t('back_to')} {t('products')}
            </Link>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
                <div className="card-white" style={{ padding: '3.5rem' }}>
                    <div style={{ marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '1.875rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Edit Crop</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Update your crop details below.</p>
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
                            style={{ height: '56px', fontSize: '1rem', marginTop: '1.5rem' }}
                            disabled={submitting}
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : <>Save Changes</>}
                        </button>
                    </form>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card-white" style={{ padding: '2.5rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ width: '40px', height: '40px', background: 'var(--primary-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <ShieldCheck size={20} color="var(--primary)" />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>Quality Checked</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: 1.4 }}>Your listing will be reviewed to ensure buyers get accurate information about your crops.</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', background: 'var(--success-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Sprout size={20} color="var(--success)" />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>Live Stock Tracking</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: 1.4 }}>Your stock levels update automatically when buyers place orders.</p>
                            </div>
                        </div>
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
