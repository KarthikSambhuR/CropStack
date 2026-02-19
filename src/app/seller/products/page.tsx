'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Product } from '@/lib/supabase';
import { db, collection, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Plus, Edit, Trash2, ExternalLink, Loader2, Info, Package, MoreHorizontal, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function MyProducts() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            if (!user) return;
            try {
                const q = query(
                    collection(db, 'products'),
                    where('seller_id', '==', user.uid),
                    orderBy('created_at', 'desc')
                );
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
                setProducts(data);
            } catch (err) {
                console.error('Error fetching products:', err);
            }
            setLoading(false);
        };

        fetchProducts();
    }, [user]);

    const toggleStatus = async (productId: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, 'products', productId), { is_active: !currentStatus });
            setProducts(products.map(p => p.id === productId ? { ...p, is_active: !currentStatus } : p));
        } catch (err) {
            console.error('Error toggling status:', err);
        }
    };

    const handleDelete = async (productId: string) => {
        if (!confirm('Are you sure you want to delete this crop listing?')) return;
        try {
            await deleteDoc(doc(db, 'products', productId));
            setProducts(products.filter(p => p.id !== productId));
        } catch (err) {
            console.error('Error deleting product:', err);
            alert('Failed to delete product.');
        }
    };

    return (
        <DashboardLayout role="seller">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', color: 'var(--secondary)' }}>{t('products')}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>View and manage all your crop listings.</p>
                </div>
                <Link href="/seller/products/new" className="btn-modern btn-primary-modern" style={{ height: '48px', padding: '0 1.5rem' }}>
                    <Plus size={18} /> {t('inventory')}
                </Link>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: '400px', borderRadius: '16px' }}></div>)}
                </div>
            ) : products.length === 0 ? (
                <div className="card-white" style={{ textAlign: 'center', padding: '6rem' }}>
                    <div style={{ width: '64px', height: '64px', background: 'var(--bg-main)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Package size={32} color="var(--text-soft)" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No crops listed yet</h3>
                    <p style={{ color: 'var(--text-soft)', fontSize: '0.95rem', marginBottom: '2.5rem' }}>Add your first crop to start selling.</p>
                    <Link href="/seller/products/new" className="btn-modern btn-primary-modern" style={{ height: '48px', padding: '0 2rem' }}>
                        Add Crop
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {products.map((product) => (
                        <div key={product.id} className="card-white" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ position: 'relative', height: '200px' }}>
                                <img
                                    src={product.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800'}
                                    alt={product.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                                    <span className={`badge-clean ${product.is_active ? 'badge-success' : 'badge-error'}`} style={{ background: 'white', border: '1px solid var(--border)' }}>
                                        {product.is_active ? 'LISTED' : 'HIDDEN'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>{product.category}</span>
                                        <h3 style={{ fontSize: '1.125rem', marginTop: '0.25rem' }}>{product.name}</h3>
                                    </div>
                                    <button style={{ background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer' }}>
                                        <MoreHorizontal size={20} />
                                    </button>
                                </div>

                                <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-soft)' }}>Price</span>
                                        <span style={{ fontWeight: 800, color: 'var(--secondary)' }}>{t('currency_symbol')}{product.price_per_unit} / {product.unit}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-soft)' }}>Stock</span>
                                        <span style={{ fontWeight: 800, color: 'var(--secondary)' }}>{product.quantity_available} {product.unit}</span>
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => toggleStatus(product.id, product.is_active)}
                                        className="btn-modern btn-secondary-modern"
                                        style={{ flex: 1, fontSize: '0.8rem', height: '40px' }}
                                    >
                                        {product.is_active ? 'Hide' : 'Show'}
                                    </button>
                                    <Link href={`/seller/products/${product.id}/edit`} className="btn-modern btn-secondary-modern" style={{ padding: '0', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Edit size={16} />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(product.id)}
                                        className="btn-modern btn-secondary-modern"
                                        style={{ padding: '0', width: '40px', height: '40px', color: 'var(--error)' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
