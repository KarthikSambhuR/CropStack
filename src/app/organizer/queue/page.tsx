'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { Search, Loader2, QrCode, ArrowRight, Warehouse, Thermometer, Droplets, Sprout, Wind } from 'lucide-react';

import { API_BASE } from '@/lib/firebase';

type OrderItem = {
    id: string;
    pickup_code: string;
    buyer_name: string;
    product_name: string;
    quantity: number;
    total_price: number;
    product_id: string;
    status: string;
    created_at: string;
};

type SensorData = {
    temperature: number;
    humidity: number;
    soil_moisture: number;
    wind_speed: number;
};

export default function OrganizerQueue() {
    const { t } = useLanguage();
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [sensors, setSensors] = useState<SensorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirming, setConfirming] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const [orgRes, sensorRes] = await Promise.all([
                fetch(`${API_BASE}/orders`),
                fetch(`${API_BASE}/sensors`),
            ]);
            if (!orgRes.ok || !sensorRes.ok) throw new Error('API error');
            const orgData = await orgRes.json();
            const sensorData = await sensorRes.json();
            setOrders(orgData.orders || []);
            setSensors(sensorData.sensors);
        } catch (err) {
            console.error('Failed to fetch queue data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleConfirmPickup = async (order: OrderItem) => {
        if (confirming) return;
        setConfirming(order.id);
        try {
            const res = await fetch(`${API_BASE}/orders/${order.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            if (!res.ok) throw new Error('Failed');
            await fetchData();
        } catch {
            alert('Failed to complete order.');
        } finally {
            setConfirming(null);
        }
    };

    const filteredOrders = orders.filter(o =>
        o.status === 'reserved' && (
            o.pickup_code?.toUpperCase().includes(searchTerm.toUpperCase()) ||
            o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <DashboardLayout role="organizer">
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.05em' }}>Warehouse <span style={{ color: 'var(--primary)' }}>Queue.</span></h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Scan and verify Pickup PINs for outbound release.</p>
            </div>

            {/* Sensor Strip */}
            {sensors && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {[
                        { label: 'Temperature', value: `${sensors.temperature.toFixed(1)}°C`, icon: Thermometer, color: sensors.temperature > 35 ? 'var(--error)' : 'var(--primary)' },
                        { label: 'Humidity', value: `${sensors.humidity.toFixed(1)}%`, icon: Droplets, color: 'var(--primary)' },
                        { label: 'Soil Moisture', value: `${sensors.soil_moisture.toFixed(1)}%`, icon: Sprout, color: 'var(--warning)' },
                        { label: 'Wind Speed', value: `${sensors.wind_speed.toFixed(1)} km/h`, icon: Wind, color: 'var(--secondary)' },
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
                    <Loader2 size={32} color="var(--primary)" className="animate-spin" />
                </div>
            ) : (
                <div className="card-white" style={{ padding: '2.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                        <div style={{ position: 'relative', width: '320px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)' }} />
                            <input
                                type="text"
                                className="input-modern"
                                placeholder="Filter by PIN or Buyer..."
                                style={{ paddingLeft: '2.75rem', height: '48px', fontSize: '0.9rem' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn-modern btn-primary-modern" style={{ height: '48px', padding: '0 1.5rem' }}>
                            <QrCode size={18} /> Launch Scanner
                        </button>
                    </div>

                    {filteredOrders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '6rem', background: 'var(--bg-main)', borderRadius: '24px', border: '1px dashed var(--border)' }}>
                            <Warehouse size={48} color="#94a3b8" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--secondary)' }}>Hub Synchronized</h4>
                            <p style={{ color: 'var(--text-soft)', fontSize: '0.95rem', fontWeight: 500, marginTop: '0.5rem' }}>No active pre-order lots currently scheduled for release.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.75rem' }}>
                            <thead>
                                <tr style={{ color: 'var(--text-soft)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 800 }}>Validation PIN</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 800 }}>Counterparty</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 800 }}>Storage Lot</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 800 }}>Audit Val</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 800 }}>Protocol</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order) => (
                                    <tr key={order.id} style={{ background: 'white', borderRadius: '14px' }}>
                                        <td style={{ padding: '1.5rem 1rem' }}>
                                            <span style={{ fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px', background: 'var(--primary-soft)', padding: '0.625rem 1rem', borderRadius: '10px', fontSize: '1rem', border: '1px solid rgba(5, 150, 105, 0.1)' }}>
                                                {order.pickup_code}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.5rem 1rem' }}>
                                            <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--secondary)' }}>{order.buyer_name || 'Anonymous Node'}</p>
                                        </td>
                                        <td style={{ padding: '1.5rem 1rem' }}>
                                            <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--secondary)' }}>{order.product_name}</p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{order.quantity} {t('unit_q')}</p>
                                        </td>
                                        <td style={{ padding: '1.5rem 1rem' }}>
                                            <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--secondary)' }}>{t('currency_symbol')}{order.total_price.toFixed(2)}</span>
                                        </td>
                                        <td style={{ padding: '1.5rem 1rem', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleConfirmPickup(order)}
                                                className="btn-modern btn-primary-modern"
                                                style={{ height: '42px', padding: '0 1.25rem', borderRadius: '12px' }}
                                                disabled={!!confirming}
                                            >
                                                {confirming === order.id ? <Loader2 size={18} className="animate-spin" /> : <>Verify Release <ArrowRight size={16} /></>}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </DashboardLayout>
    );
}
