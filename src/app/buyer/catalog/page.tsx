'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Product } from '@/lib/supabase';
import { db, collection, query, where, orderBy, getDocs } from '@/lib/firebase';
import { Search, Filter, ShoppingCart, Loader2, ArrowRight, Star, Clock, Info, LayoutGrid, List, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function Catalog() {
    const { t } = useLanguage();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');

    useEffect(() => {
        const fetchProducts = async () => {
            const cropCategories = ['Grains', 'Rice', 'Wheat', 'Legumes', 'Pulses'];

            try {
                let q;
                if (categoryFilter !== 'All') {
                    q = query(
                        collection(db, 'products'),
                        where('is_active', '==', true),
                        where('category', '==', categoryFilter),
                        orderBy('created_at', 'desc')
                    );
                } else {
                    q = query(
                        collection(db, 'products'),
                        where('is_active', '==', true),
                        orderBy('created_at', 'desc')
                    );
                }

                const snapshot = await getDocs(q);
                const allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));

                // Client-side filters for category list and quantity
                const filtered = allProducts.filter(p =>
                    cropCategories.includes(p.category) && p.quantity_available > 0
                );
                setProducts(filtered);
            } catch (err) {
                console.error('Error fetching catalog:', err);
            }
            setLoading(false);
        };

        fetchProducts();
    }, [categoryFilter]);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const categories = ['All', 'Grains', 'Rice', 'Wheat', 'Pulses', 'Legumes'];

    return (
        <DashboardLayout role="buyer">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', color: 'var(--secondary)' }}>{t('catalog')}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Enterprise crop storage exchange node</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem', background: '#f1f5f9', borderRadius: '10px' }}>
                    <button style={{ padding: '0.5rem 1rem', border: 'none', background: 'white', color: 'var(--secondary)', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', boxShadow: 'var(--shadow-sm)' }}>{t('spot')}</button>
                    <button style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', color: 'var(--text-soft)', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem' }}>{t('futures')}</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)' }} />
                    <input
                        type="text"
                        className="input-modern"
                        placeholder={t('search_placeholder')}
                        style={{ paddingLeft: '2.75rem', height: '48px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="btn-modern btn-secondary-modern" style={{ height: '48px', padding: '0 1.25rem' }}>
                    <Filter size={18} />
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '2rem' }}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className="btn-modern"
                        style={{
                            padding: '0.5rem 1.25rem',
                            fontSize: '0.85rem',
                            borderRadius: '100px',
                            background: categoryFilter === cat ? 'var(--secondary)' : 'white',
                            color: categoryFilter === cat ? 'white' : 'var(--text-muted)',
                            border: `1px solid ${categoryFilter === cat ? 'var(--secondary)' : 'var(--border)'}`,
                            boxShadow: categoryFilter === cat ? 'var(--shadow-md)' : 'none'
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="shimmer" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }}></div>)}
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="card-white" style={{ textAlign: 'center', padding: '5rem' }}>
                    <Info size={40} color="var(--text-soft)" style={{ marginBottom: '1rem' }} />
                    <h3>No storage lots found</h3>
                    <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem' }}>Try adjusting your filters or search keywords.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {filteredProducts.map((product) => (
                        <Link
                            href={`/buyer/products/${product.id}`}
                            key={product.id}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            <div className="card-white" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ position: 'relative', height: '200px' }}>
                                    <img
                                        src={product.image_url || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=800'}
                                        alt={product.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                                        <div className="badge-clean badge-success" style={{ background: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Star size={12} fill="var(--success)" /> {t('verified')}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>{product.category}</span>
                                            <h3 style={{ fontSize: '1.125rem', marginTop: '0.25rem' }}>{product.name}</h3>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--secondary)', lineHeight: 1 }}>{t('currency_symbol')}{product.price_per_unit}</p>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>{t('price_per')} {product.unit}</p>
                                        </div>
                                    </div>

                                    <div style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            <Warehouse size={16} color="var(--primary)" /> Slot ID: {product.id.slice(0, 6).toUpperCase()}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: 800 }}>
                                            {product.quantity_available} {product.unit} {t('available_qty')}
                                        </div>
                                    </div>

                                    <button className="btn-modern btn-primary-modern" style={{ width: '100%', height: '44px' }}>
                                        {t('buy')} <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
