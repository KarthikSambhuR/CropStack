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
    Thermometer,
    Droplets,
    Sprout,
    Gauge
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

import { API_BASE } from '@/lib/firebase';

type SellerStats = {
    available_balance: number;
    pending_payments: number;
    monthly_yield: number;
    monthly_growth: number;
    silo_efficiency: number;
    node_sync: number;
    silo_utilization: number;
};

type TransactionItem = {
    id: string;
    order_id: string;
    amount: number;
    status: string;
    created_at: string;
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

export default function SellerDashboard() {
    const { t } = useLanguage();
    const [stats, setStats] = useState<SellerStats | null>(null);
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [sensors, setSensors] = useState<SensorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [sellerRes, sensorRes] = await Promise.all([
                fetch(`${API_BASE}/stats/seller`),
                fetch(`${API_BASE}/sensors`),
            ]);

            if (!sellerRes.ok || !sensorRes.ok) throw new Error('API error');

            const sellerData = await sellerRes.json();
            const sensorData = await sensorRes.json();

            setStats(sellerData.stats);
            setTransactions(sellerData.transactions || []);
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

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    return (
        <DashboardLayout role="seller">
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', color: 'var(--secondary)', letterSpacing: '-0.03em' }}>{t('welcome')}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                    {error ? '⚠️ Could not connect to sensors — showing saved data' : 'Here\'s how your sales are doing today.'}
                </p>
            </div>

            {/* Sensor Strip */}
            {sensors && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {[
                        { label: 'Temperature', value: `${sensors.temperature.toFixed(1)}°C`, icon: Thermometer, color: sensors.temperature > 35 ? 'var(--error)' : 'var(--primary)' },
                        { label: 'Humidity', value: `${sensors.humidity.toFixed(1)}%`, icon: Droplets, color: 'var(--primary)' },
                        { label: 'Soil Moisture', value: `${sensors.soil_moisture.toFixed(1)}%`, icon: Sprout, color: 'var(--warning)' },
                        { label: 'Pressure', value: `${sensors.pressure.toFixed(0)} hPa`, icon: Gauge, color: 'var(--secondary)' },
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--success)' }}>
                                <ArrowUpRight size={14} /> +{stats.monthly_growth}%
                            </div>
                        </div>

                        <div className="card-white" style={{ padding: '1.5rem', background: 'var(--primary)', color: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Storage Usage</span>
                                <Database size={18} color="rgba(255,255,255,0.7)" />
                            </div>
                            <h2 style={{ fontSize: '1.875rem', fontWeight: 900, color: 'white', marginBottom: '0.25rem' }}>{stats.silo_efficiency}%</h2>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Well managed</p>
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
                                                    <td style={{ padding: '1.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{txn.order_id.slice(0, 6).toUpperCase()}</td>
                                                    <td style={{ padding: '1.25rem 0', fontSize: '0.95rem', fontWeight: 900 }}>{t('currency_symbol')}{txn.amount.toFixed(2)}</td>
                                                    <td style={{ padding: '1.25rem 0' }}>
                                                        <span className={`badge-clean ${txn.status === 'cleared' ? 'badge-success' : 'badge-pending'}`}>
                                                            {txn.status === 'cleared' ? 'Paid' : 'Pending'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                                        <button className="btn-modern btn-secondary-modern" style={{ width: '100%', border: 'none', background: 'var(--bg-main)', fontSize: '0.85rem' }}>
                                            Download Payment History (PDF)
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
                                    <Link href="/market" style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.8rem', textDecoration: 'none' }}>View Details <ArrowUpRight size={14} /></Link>
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
                                <button className="btn-modern" style={{ width: '100%', marginTop: '3rem', background: 'white', color: 'var(--secondary)', height: '52px', fontWeight: 800 }}>
                                    View Full Report
                                </button>
                            </div>

                            <div className="card-white" style={{ padding: '2.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Withdraw Money</h3>
                                <div style={{ padding: '1.75rem', background: 'var(--bg-main)', borderRadius: '16px', border: '1.5px solid var(--border-soft)', textAlign: 'center', marginBottom: '1.5rem' }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '1px' }}>Available to Withdraw</p>
                                    <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{t('currency_symbol')}{stats.available_balance.toFixed(2)}</h2>
                                </div>
                                <button className="btn-modern btn-primary-modern" style={{ width: '100%', height: '52px' }} disabled={stats.available_balance === 0}>
                                    Withdraw to Bank
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </DashboardLayout>
    );
}
