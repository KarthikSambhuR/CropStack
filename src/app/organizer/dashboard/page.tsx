'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
    Truck, ClipboardList, Search, Loader2, QrCode, ArrowRight,
    ShieldCheck, Warehouse, Thermometer, Droplets, Wind, Activity,
    Signal, Clock, AlertTriangle, CheckCircle2, ChevronDown, Flame, Fan, Zap
} from 'lucide-react';

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

type OrganizerStats = {
    active_queue: number;
    gate_traffic: number;
    hub_security: number;
    flow_volume: number;
};

type SensorData = {
    temperature: number;
    humidity: number;
    light_intensity: number;
    ph_level: number;
    wind_speed: number;
    rainfall: number;
    co2_level: number;
    pressure: number;
    uv_index: number;
};

type HubData = {
    id: string;
    name: string;
    organizer_id: string;
    organizer_email: string;
    temperature: number;
    moisture: number;
    last_updated: string;
    status: string;
    device_ip?: string;
    device_ip_updated?: string;
    device_state?: string;
    servo_state?: string;
    auto_mode?: boolean;
};

function getTimeAgo(isoStr: string): string {
    if (!isoStr) return 'Never';
    const diff = Date.now() - new Date(isoStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function getTempStatus(temp: number): { color: string; label: string; bg: string } {
    if (temp > 40) return { color: '#ef4444', label: 'CRITICAL', bg: '#fef2f2' };
    if (temp > 35) return { color: '#f59e0b', label: 'HIGH', bg: '#fffbeb' };
    if (temp < 10) return { color: '#3b82f6', label: 'LOW', bg: '#eff6ff' };
    return { color: '#059669', label: 'NORMAL', bg: '#ecfdf5' };
}

function getMoistStatus(moist: number): { color: string; label: string; bg: string } {
    if (moist < 20) return { color: '#ef4444', label: 'CRITICAL', bg: '#fef2f2' };
    if (moist < 35) return { color: '#f59e0b', label: 'LOW', bg: '#fffbeb' };
    if (moist > 80) return { color: '#3b82f6', label: 'HIGH', bg: '#eff6ff' };
    return { color: '#059669', label: 'OPTIMAL', bg: '#ecfdf5' };
}

export default function OrganizerDashboard() {
    const { t } = useLanguage();
    const { user, profile } = useAuth();
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [stats, setStats] = useState<OrganizerStats | null>(null);
    const [sensors, setSensors] = useState<SensorData | null>(null);
    const [hubs, setHubs] = useState<HubData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirming, setConfirming] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [expandedHub, setExpandedHub] = useState<string | null>(null);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);

    const isDeviceConnected = (hub: HubData): boolean => {
        if (!hub.device_ip || !hub.device_ip_updated) return false;
        const elapsed = (Date.now() - new Date(hub.device_ip_updated).getTime()) / 1000;
        return elapsed < 15; // device sends every 1s, so 15s = definitely offline
    };

    const handleHubToggle = async (hub: HubData) => {
        if (toggling) return;
        const connected = isDeviceConnected(hub);
        if (!connected) return;

        const currentState = hub.device_state || 'OFF';
        const newState = currentState === 'ON' ? 'off' : 'on';
        setToggling(hub.id);

        try {
            const res = await fetch(`${API_BASE}/hubs/${hub.id}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: newState }),
            });
            if (res.ok) {
                const data = await res.json();
                // Update hub state locally for instant feedback
                setHubs(prev => prev.map(h =>
                    h.id === hub.id ? { ...h, device_state: data.state } : h
                ));
            } else {
                const err = await res.json();
                console.error('Toggle failed:', err.error);
            }
        } catch (err) {
            console.error('Toggle error:', err);
        } finally {
            setToggling(null);
        }
    };

    const handleServoToggle = async (hub: HubData) => {
        if (toggling) return;
        const connected = isDeviceConnected(hub);
        if (!connected) return;

        const currentState = hub.servo_state || 'OFF';
        const newState = currentState === 'ON' ? 'off' : 'on';
        setToggling('servo-' + hub.id);

        try {
            const res = await fetch(`${API_BASE}/hubs/${hub.id}/servo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: newState }),
            });
            if (res.ok) {
                const data = await res.json();
                setHubs(prev => prev.map(h =>
                    h.id === hub.id ? { ...h, servo_state: data.state } : h
                ));
            } else {
                const err = await res.json();
                console.error('Servo toggle failed:', err.error);
            }
        } catch (err) {
            console.error('Servo toggle error:', err);
        } finally {
            setToggling(null);
        }
    };

    const handleAutoToggle = async (hub: HubData) => {
        if (toggling) return;
        setToggling('auto-' + hub.id);
        const newEnabled = !hub.auto_mode;

        try {
            const res = await fetch(`${API_BASE}/hubs/${hub.id}/auto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled }),
            });
            if (res.ok) {
                const data = await res.json();
                setHubs(prev => prev.map(h =>
                    h.id === hub.id ? { ...h, auto_mode: data.auto_mode } : h
                ));
            } else {
                const err = await res.json();
                console.error('Auto toggle failed:', err.error);
            }
        } catch (err) {
            console.error('Auto toggle error:', err);
        } finally {
            setToggling(null);
        }
    };

    const fetchData = useCallback(async () => {
        try {
            // Build hub query — filter by logged-in organizer's email
            const email = profile?.email || user?.email || '';
            const hubUrl = email
                ? `${API_BASE}/hubs?organizer_email=${encodeURIComponent(email)}`
                : `${API_BASE}/hubs`;

            const [orgRes, sensorRes, hubsRes] = await Promise.all([
                fetch(`${API_BASE}/stats/organizer`),
                fetch(`${API_BASE}/sensors`),
                fetch(hubUrl),
            ]);

            if (!orgRes.ok || !sensorRes.ok) throw new Error('API error');

            const orgData = await orgRes.json();
            const sensorData = await sensorRes.json();
            const hubsData = hubsRes.ok ? await hubsRes.json() : { hubs: [] };

            setStats(orgData.stats);
            setOrders(orgData.orders || []);
            setSensors(sensorData.sensors);
            setHubs(hubsData.hubs || []);
            setError(false);
            setLastSync(new Date());
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [profile?.email, user?.email]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleConfirmPickup = async (order: OrderItem) => {
        if (confirming) return;
        setConfirming(order.id);
        try {
            const res = await fetch(`${API_BASE}/orders/${order.id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error('Failed');
            await fetchData();
        } catch (err) {
            console.error('Error:', err);
            alert('Failed to complete order. Please try again.');
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

    const onlineHubs = hubs.filter(h => h.status === 'online').length;
    const avgTemp = hubs.length ? hubs.reduce((s, h) => s + h.temperature, 0) / hubs.length : 0;
    const avgMoist = hubs.length ? hubs.reduce((s, h) => s + h.moisture, 0) / hubs.length : 0;

    return (
        <DashboardLayout role="organizer">
            {/* Title Section */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1.1 }}>
                            Hub <span style={{ color: 'var(--primary)' }}>Command Center.</span>
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, marginTop: '0.5rem' }}>
                            {error
                                ? '⚠️ Sensor API offline — showing cached data'
                                : `Monitoring ${hubs.length} hub${hubs.length !== 1 ? 's' : ''} assigned to your account`
                            }
                        </p>
                    </div>
                    {lastSync && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-soft)' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: error ? 'var(--error)' : 'var(--success)', animation: error ? 'none' : 'pulse 2s infinite' }} />
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-soft)' }}>
                                Last sync: {lastSync.toLocaleTimeString()}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6rem', flexDirection: 'column', gap: '1rem' }}>
                    <Loader2 size={36} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: 'var(--text-soft)', fontWeight: 600, fontSize: '0.9rem' }}>Synchronizing sensor data...</p>
                </div>
            ) : (
                <>

                    {/* Hub Overview Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                        <div className="card-white" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>My Sensors</span>
                                <div style={{ width: '36px', height: '36px', background: 'var(--primary-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Warehouse size={18} color="var(--primary)" />
                                </div>
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.25rem' }}>{hubs.length}</h2>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>{onlineHubs} online • {hubs.length - onlineHubs} offline</p>
                        </div>

                        <div className="card-white" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Avg Temp</span>
                                <div style={{ width: '36px', height: '36px', background: getTempStatus(avgTemp).bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Thermometer size={18} color={getTempStatus(avgTemp).color} />
                                </div>
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: getTempStatus(avgTemp).color, marginBottom: '0.25rem' }}>
                                {hubs.length ? avgTemp.toFixed(1) : '--'}°C
                            </h2>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Across all sensors</p>
                        </div>

                        <div className="card-white" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Avg Moisture</span>
                                <div style={{ width: '36px', height: '36px', background: getMoistStatus(avgMoist).bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Droplets size={18} color={getMoistStatus(avgMoist).color} />
                                </div>
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: getMoistStatus(avgMoist).color, marginBottom: '0.25rem' }}>
                                {hubs.length ? avgMoist.toFixed(1) : '--'}%
                            </h2>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Across all sensors</p>
                        </div>

                        <div className="card-white" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Pending Orders</span>
                                <div style={{ width: '36px', height: '36px', background: 'var(--primary-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ClipboardList size={18} color="var(--primary)" />
                                </div>
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.25rem' }}>{filteredOrders.length}</h2>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Awaiting clearance</p>
                        </div>
                    </div>

                    {/* Hub Cards */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--secondary)' }}>My Sensor Nodes</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Real-time temperature & moisture from your assigned sensors</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Signal size={14} color="var(--success)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>Live • 3s polling</span>
                            </div>
                        </div>

                        {hubs.length === 0 ? (
                            <div className="card-white" style={{ padding: '4rem', textAlign: 'center', borderStyle: 'dashed' }}>
                                <Warehouse size={48} color="#94a3b8" style={{ marginBottom: '1.25rem', opacity: 0.4 }} />
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--secondary)', marginBottom: '0.5rem' }}>No Sensors Assigned</h4>
                                <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', fontWeight: 500, maxWidth: '360px', margin: '0 auto' }}>
                                    No sensors are currently assigned to your account ({profile?.email}). Contact your administrator to get sensors assigned.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                                {hubs.map((hub) => {
                                    const tempSt = getTempStatus(hub.temperature);
                                    const moistSt = getMoistStatus(hub.moisture);
                                    const isExpanded = expandedHub === hub.id;
                                    return (
                                        <div key={hub.id} className="card-white" style={{
                                            padding: 0, position: 'relative', overflow: 'hidden',
                                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                            transform: isExpanded ? 'scale(1.02)' : 'scale(1)',
                                            boxShadow: isExpanded ? '0 20px 40px -10px rgba(5, 150, 105, 0.15)' : undefined,
                                        }}>
                                            {/* Top accent bar */}
                                            <div style={{ height: '3px', background: `linear-gradient(90deg, ${tempSt.color}, ${moistSt.color})` }} />

                                            <div style={{ padding: '1.25rem' }}>
                                                {/* Header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                        <div style={{ width: '32px', height: '32px', background: 'var(--primary-soft)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Warehouse size={16} color="var(--primary)" />
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--secondary)', lineHeight: 1.2 }}>{hub.name}</p>
                                                            <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', fontWeight: 600, color: 'var(--primary)' }}>{hub.id}</p>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                        <div style={{
                                                            width: '7px', height: '7px', borderRadius: '50%',
                                                            background: hub.status === 'online' ? 'var(--success)' : 'var(--error)',
                                                            boxShadow: hub.status === 'online' ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
                                                            animation: hub.status === 'online' ? 'pulse 2s infinite' : 'none'
                                                        }} />
                                                        <span style={{
                                                            fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
                                                            color: hub.status === 'online' ? 'var(--success)' : 'var(--error)'
                                                        }}>{hub.status}</span>
                                                    </div>
                                                </div>

                                                {/* Sensor Readings */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.75rem' }}>
                                                    <div style={{
                                                        padding: '0.875rem', background: tempSt.bg, borderRadius: '12px',
                                                        border: `1px solid ${tempSt.color}15`, position: 'relative', overflow: 'hidden'
                                                    }}>
                                                        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', opacity: 0.15 }}>
                                                            <Thermometer size={28} color={tempSt.color} />
                                                        </div>
                                                        <p style={{ fontSize: '0.55rem', fontWeight: 800, color: tempSt.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Temperature</p>
                                                        <p style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 900, color: tempSt.color, lineHeight: 1 }}>
                                                            {hub.temperature.toFixed(1)}<span style={{ fontSize: '0.75rem', fontWeight: 600 }}>°C</span>
                                                        </p>
                                                        <span style={{
                                                            display: 'inline-block', marginTop: '0.375rem', fontSize: '0.5rem', fontWeight: 800,
                                                            padding: '0.15rem 0.375rem', borderRadius: '4px', background: `${tempSt.color}20`, color: tempSt.color
                                                        }}>{tempSt.label}</span>
                                                    </div>

                                                    <div style={{
                                                        padding: '0.875rem', background: moistSt.bg, borderRadius: '12px',
                                                        border: `1px solid ${moistSt.color}15`, position: 'relative', overflow: 'hidden'
                                                    }}>
                                                        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', opacity: 0.15 }}>
                                                            <Droplets size={28} color={moistSt.color} />
                                                        </div>
                                                        <p style={{ fontSize: '0.55rem', fontWeight: 800, color: moistSt.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Moisture</p>
                                                        <p style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 900, color: moistSt.color, lineHeight: 1 }}>
                                                            {hub.moisture.toFixed(1)}<span style={{ fontSize: '0.75rem', fontWeight: 600 }}>%</span>
                                                        </p>
                                                        <span style={{
                                                            display: 'inline-block', marginTop: '0.375rem', fontSize: '0.5rem', fontWeight: 800,
                                                            padding: '0.15rem 0.375rem', borderRadius: '4px', background: `${moistSt.color}20`, color: moistSt.color
                                                        }}>{moistSt.label}</span>
                                                    </div>
                                                </div>

                                                {/* Footer */}
                                                <div style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    paddingTop: '0.625rem', borderTop: '1px solid var(--border-soft)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                        <Clock size={11} color="var(--text-soft)" />
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-soft)', fontWeight: 600 }}>
                                                            Updated {getTimeAgo(hub.last_updated)}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <Activity size={11} color="var(--primary)" />
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--primary)', fontWeight: 700 }}>LIVE</span>
                                                    </div>
                                                </div>

                                                {/* Device Control Toggles */}
                                                {(() => {
                                                    const connected = isDeviceConnected(hub);
                                                    const ledOn = (hub.device_state || 'OFF') === 'ON';
                                                    const servoOn = (hub.servo_state || 'OFF') === 'ON';
                                                    const isTogglingLed = toggling === hub.id;
                                                    const isTogglingServo = toggling === 'servo-' + hub.id;
                                                    const isTogglingAuto = toggling === 'auto-' + hub.id;
                                                    const autoMode = hub.auto_mode || false;

                                                    const ToggleSwitch = ({ on, loading, onClick, disabled }: { on: boolean; loading: boolean; onClick: () => void; disabled: boolean }) => (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onClick(); }}
                                                            disabled={disabled}
                                                            style={{
                                                                position: 'relative',
                                                                width: '40px', height: '22px',
                                                                borderRadius: '11px', border: 'none',
                                                                cursor: disabled ? 'not-allowed' : 'pointer',
                                                                background: disabled ? '#e2e8f0' : on ? 'var(--success)' : '#cbd5e1',
                                                                transition: 'background 0.25s ease',
                                                                opacity: loading ? 0.6 : 1,
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <div style={{
                                                                position: 'absolute', top: '2px',
                                                                left: on ? '20px' : '2px',
                                                                width: '18px', height: '18px',
                                                                borderRadius: '50%', background: 'white',
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                                                transition: 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            }}>
                                                                {loading && (
                                                                    <Loader2 size={9} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                                                                )}
                                                            </div>
                                                        </button>
                                                    );

                                                    return (
                                                        <div style={{
                                                            marginTop: '0.625rem', paddingTop: '0.625rem',
                                                            borderTop: '1px solid var(--border-soft)',
                                                        }}>
                                                            {/* Connection status */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                                                                <div style={{
                                                                    width: '5px', height: '5px', borderRadius: '50%',
                                                                    background: connected ? 'var(--success)' : 'var(--error)',
                                                                }} />
                                                                <span style={{ fontSize: '0.5rem', fontWeight: 700, color: connected ? 'var(--success)' : 'var(--text-soft)' }}>
                                                                    {connected ? `Device online · ${hub.device_ip}` : 'No device connected'}
                                                                </span>
                                                            </div>

                                                            {/* Auto Mode Toggle */}
                                                            <div style={{
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                padding: '0.5rem 0.625rem', marginBottom: '0.5rem',
                                                                background: autoMode ? '#fffbeb' : '#f8fafc',
                                                                borderRadius: '8px',
                                                                border: `1px solid ${autoMode ? '#fbbf24' : 'var(--border-soft)'}`,
                                                                transition: 'all 0.3s ease',
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                                    <Zap size={12} color={autoMode ? '#f59e0b' : 'var(--text-soft)'} fill={autoMode ? '#f59e0b' : 'none'} />
                                                                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: autoMode ? '#92400e' : 'var(--secondary)' }}>Auto Mode</span>
                                                                    {autoMode && (
                                                                        <span style={{
                                                                            fontSize: '0.45rem', fontWeight: 900,
                                                                            padding: '0.125rem 0.375rem', borderRadius: '4px',
                                                                            background: '#fef3c7', color: '#92400e',
                                                                            letterSpacing: '0.5px',
                                                                        }}>ACTIVE</span>
                                                                    )}
                                                                </div>
                                                                <ToggleSwitch on={autoMode} loading={isTogglingAuto} onClick={() => handleAutoToggle(hub)} disabled={!connected || isTogglingAuto} />
                                                            </div>

                                                            {/* Manual controls (hidden in auto mode) */}
                                                            {autoMode ? (
                                                                <div style={{
                                                                    padding: '0.625rem', background: '#fffbeb', borderRadius: '8px',
                                                                    border: '1px dashed #fbbf24',
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.375rem' }}>
                                                                        <Zap size={10} color="#f59e0b" />
                                                                        <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#92400e' }}>Automated Control Active</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                        <div style={{
                                                                            flex: 1, display: 'flex', alignItems: 'center', gap: '0.25rem',
                                                                            padding: '0.25rem 0.5rem', background: 'white', borderRadius: '6px',
                                                                        }}>
                                                                            <Flame size={10} color={ledOn ? '#ef4444' : '#d1d5db'} />
                                                                            <span style={{ fontSize: '0.5rem', fontWeight: 700, color: '#6b7280' }}>Heater: {ledOn ? 'ON' : 'OFF'}</span>
                                                                        </div>
                                                                        <div style={{
                                                                            flex: 1, display: 'flex', alignItems: 'center', gap: '0.25rem',
                                                                            padding: '0.25rem 0.5rem', background: 'white', borderRadius: '6px',
                                                                        }}>
                                                                            <Fan size={10} color={servoOn ? '#3b82f6' : '#d1d5db'} style={servoOn ? { animation: 'spin 1s linear infinite' } : undefined} />
                                                                            <span style={{ fontSize: '0.5rem', fontWeight: 700, color: '#6b7280' }}>Fan: {servoOn ? 'ON' : 'OFF'}</span>
                                                                        </div>
                                                                    </div>
                                                                    <p style={{ fontSize: '0.45rem', color: '#92400e', fontWeight: 600, marginTop: '0.375rem', lineHeight: 1.4 }}>
                                                                        Heater activates when moisture &lt; 35% · Fan activates when temp &gt; 35°C
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                                    {/* Heater Toggle */}
                                                                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.625rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                                            <Flame size={12} color={connected && ledOn ? '#ef4444' : 'var(--text-soft)'} />
                                                                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--secondary)' }}>Heater</span>
                                                                        </div>
                                                                        <ToggleSwitch on={ledOn} loading={isTogglingLed} onClick={() => handleHubToggle(hub)} disabled={!connected || isTogglingLed} />
                                                                    </div>

                                                                    {/* Fan Toggle */}
                                                                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.625rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                                            <Fan size={12} color={connected && servoOn ? '#3b82f6' : 'var(--text-soft)'} style={servoOn ? { animation: 'spin 1s linear infinite' } : undefined} />
                                                                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--secondary)' }}>Fan</span>
                                                                        </div>
                                                                        <ToggleSwitch on={servoOn} loading={isTogglingServo} onClick={() => handleServoToggle(hub)} disabled={!connected || isTogglingServo} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
                        <div className="card-white" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Queue</span>
                                <div style={{ width: '40px', height: '40px', background: 'var(--primary-soft)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ClipboardList size={20} color="var(--primary)" />
                                </div>
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>{stats?.active_queue || filteredOrders.length}</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600 }}>Lots pending clearance</p>
                        </div>

                        <div className="card-white" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Traffic</span>
                                <div style={{ width: '40px', height: '40px', background: 'var(--success-soft)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Truck size={20} color="var(--success)" />
                                </div>
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>{stats?.gate_traffic || 0}</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600 }}>Scheduled dispatch</p>
                        </div>

                        <div className="card-white" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Security</span>
                                <ShieldCheck size={24} color="var(--primary)" />
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>{stats?.hub_security || 0}%</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600 }}>Node Health Index</p>
                        </div>

                        <div className="card-white" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Volume</span>
                                <Warehouse size={20} color="var(--primary)" />
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>{t('currency_symbol')}{(stats?.flow_volume || 0).toLocaleString()}</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)', fontWeight: 600 }}>Settlement velocity</p>
                        </div>
                    </div>

                    {/* Orders Table */}
                    <div className="card-white" style={{ padding: '2.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Clearance Terminal</h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Scan and verify Pickup PINs for outbound release.</p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ position: 'relative', width: '280px' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)' }} />
                                    <input
                                        type="text"
                                        className="input-modern"
                                        placeholder="Filter by PIN or Buyer..."
                                        style={{ paddingLeft: '2.75rem', height: '44px', fontSize: '0.85rem' }}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button className="btn-modern btn-primary-modern" style={{ height: '44px', padding: '0 1.25rem' }}>
                                    <QrCode size={18} /> Scanner
                                </button>
                            </div>
                        </div>

                        {filteredOrders.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '5rem', background: 'var(--bg-main)', borderRadius: '20px', border: '1px dashed var(--border)' }}>
                                <CheckCircle2 size={48} color="#94a3b8" style={{ marginBottom: '1.25rem', opacity: 0.4 }} />
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--secondary)' }}>All Clear</h4>
                                <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', fontWeight: 500, marginTop: '0.5rem' }}>No pending orders at this time.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.625rem' }}>
                                    <thead>
                                        <tr style={{ color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 800 }}>PIN</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 800 }}>Buyer</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 800 }}>Product</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 800 }}>Value</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800 }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredOrders.map((order) => (
                                            <tr key={order.id} style={{ background: 'white' }}>
                                                <td style={{ padding: '1.25rem 1rem' }}>
                                                    <span style={{
                                                        fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px',
                                                        background: 'var(--primary-soft)', padding: '0.5rem 0.875rem', borderRadius: '10px',
                                                        fontSize: '0.95rem', border: '1px solid rgba(5, 150, 105, 0.1)'
                                                    }}>
                                                        {order.pickup_code}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem' }}>
                                                    <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--secondary)' }}>{order.buyer_name || 'Anonymous'}</p>
                                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-soft)', fontWeight: 700, textTransform: 'uppercase' }}>Verified ID</p>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem' }}>
                                                    <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--secondary)' }}>{order.product_name}</p>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{order.quantity} {t('unit_q')}</p>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem' }}>
                                                    <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--secondary)' }}>{t('currency_symbol')}{order.total_price.toLocaleString()}</span>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => handleConfirmPickup(order)}
                                                        className="btn-modern btn-primary-modern"
                                                        style={{ height: '40px', padding: '0 1rem', borderRadius: '10px', fontSize: '0.8rem' }}
                                                        disabled={!!confirming}
                                                    >
                                                        {confirming === order.id
                                                            ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                                            : <>Release <ArrowRight size={14} /></>
                                                        }
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </DashboardLayout>
    );
}
