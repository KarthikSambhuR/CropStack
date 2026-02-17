'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ShoppingBag, Calendar, TrendingUp, ArrowUpRight, ArrowDownRight, Info, ChevronRight, LayoutGrid, Loader2, Thermometer, Droplets, Sun, Wind } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

import { API_BASE } from '@/lib/firebase';

type MarketItem = {
    name: string;
    price: number;
    change: number;
    volume: string;
    trend: string;
};

type BuyerStats = {
    active_orders: number;
    reservations: number;
    completed: number;
    savings: number;
    order_growth: number;
};

type SensorData = {
    temperature: number;
    humidity: number;
    soil_moisture: number;
    light_intensity: number;
    ph_level: number;
    wind_speed: number;
    rainfall: number;
    co2_level: number;
    pressure: number;
    uv_index: number;
};

export default function BuyerDashboard() {
    const { t } = useLanguage();
    const [stats, setStats] = useState<BuyerStats | null>(null);
    const [chartData, setChartData] = useState<number[]>([]);
    const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
    const [sensors, setSensors] = useState<SensorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [buyerRes, sensorRes] = await Promise.all([
                fetch(`${API_BASE}/stats/buyer`),
                fetch(`${API_BASE}/sensors`),
            ]);

            if (!buyerRes.ok || !sensorRes.ok) throw new Error('API error');

            const buyerData = await buyerRes.json();
            const sensorData = await sensorRes.json();

            setStats(buyerData.stats);
            setChartData(buyerData.chart_data || []);
            setMarketItems(buyerData.market || []);
            setSensors(sensorData.sensors);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const statCards = stats ? [
        { key: 'active_orders', val: String(stats.active_orders), icon: ShoppingBag, color: 'var(--primary)' },
        { key: 'reservations', val: String(stats.reservations).padStart(2, '0'), icon: Calendar, color: 'var(--warning)' },
        { key: 'completed', val: String(stats.completed), unit: 'q', icon: LayoutGrid, color: 'var(--success)' },
        { key: 'savings', val: stats.savings.toLocaleString(), prefix: true, icon: TrendingUp, color: 'var(--secondary)' }
    ] : [];

    return (
        <DashboardLayout role="buyer">
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', color: 'var(--secondary)', letterSpacing: '-0.03em' }}>{t('welcome')}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                    {error ? '⚠️ Could not connect to sensors — showing saved data' : 'Your orders and market overview at a glance.'}
                </p>
            </div>

            {/* Sensor Strip */}
            {sensors && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {[
                        { label: 'Temperature', value: `${sensors.temperature.toFixed(1)}°C`, icon: Thermometer, color: sensors.temperature > 35 ? 'var(--error)' : 'var(--primary)' },
                        { label: 'Humidity', value: `${sensors.humidity.toFixed(1)}%`, icon: Droplets, color: 'var(--primary)' },
                        { label: 'Light', value: `${sensors.light_intensity.toFixed(0)} lux`, icon: Sun, color: 'var(--warning)' },
                        { label: 'Wind', value: `${sensors.wind_speed.toFixed(1)} km/h`, icon: Wind, color: 'var(--secondary)' },
                    ].map((s, i) => (
                        <div key={i} style={{ padding: '0.875rem 1rem', background: '#f8fafc', border: '1px solid var(--border-soft)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <s.icon size={18} color={s.color} />
                            <div>
                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase' }}>{s.label}</p>
                                <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--secondary)' }}>{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Stats Grid */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Loader2 size={32} color="var(--primary)" className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
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
                                    {stat.prefix && t('currency_symbol')}{stat.val}{stat.unit && ` ${t('unit_q')}`}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 700 }}>
                                    <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center' }}>
                                        <ArrowUpRight size={14} /> +{stats?.order_growth || 0}%
                                    </span>
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
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Your buying activity this year</p>
                                </div>
                                <Link href="/buyer/orders" className="btn-modern btn-secondary-modern" style={{ padding: '0.5rem 1rem', height: 'auto', fontSize: '0.8rem' }}>
                                    {t('view_all')} <ChevronRight size={14} />
                                </Link>
                            </div>

                            <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-soft)' }}>
                                {chartData.map((h, i) => (
                                    <div key={i} style={{ flex: 1, position: 'relative' }}>
                                        <div
                                            style={{
                                                height: `${h}%`,
                                                background: i === chartData.length - 2 ? 'var(--primary)' : 'var(--border-soft)',
                                                borderRadius: '6px 6px 0 0',
                                                transition: 'all 0.5s ease'
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', color: 'var(--text-soft)', fontSize: '0.7rem', fontWeight: 800 }}>
                                <span>JAN</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>NOV</span>
                            </div>
                        </div>

                        {/* Market Trends */}
                        <div className="card-white" style={{ padding: '2.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem' }}>{t('market_trends')}</h3>
                                <Info size={16} color="var(--text-soft)" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {marketItems.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#fcfcfc', border: '1px solid var(--border-soft)', borderRadius: '12px' }}>
                                        <div>
                                            <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--secondary)' }}>{item.name}</p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('currency_symbol')}{item.price.toFixed(2)} / {t('unit_q')}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontWeight: 800, color: item.change >= 0 ? 'var(--success)' : 'var(--error)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.125rem' }}>
                                                {item.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {item.change >= 0 ? '+' : ''}{item.change}%
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Link href="/market" className="btn-modern btn-primary-modern" style={{ width: '100%', marginTop: '1.75rem', height: '52px' }}>
                                View All Market Prices
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    );
}
