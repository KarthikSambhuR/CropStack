'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
    TrendingUp, TrendingDown, Database, Activity, ArrowUpRight, ArrowDownRight,
    Layers, Loader2, Search, Filter, BarChart3, ChevronDown, ChevronUp,
    Wheat, Sparkles, Signal, Clock, ArrowRight, Minus, Info, Shield
} from 'lucide-react';
import { API_BASE } from '@/lib/firebase';

type CommodityItem = {
    name: string;
    price: number;
    change: number;
    change_7d?: number;
    volume: string;
    trend: string;
    category?: string;
    msp?: number;
    high?: number;
    low?: number;
    unit?: string;
};

type NetworkStats = {
    supply_index: number;
    storage_utilization: number;
    escrow_liquidity: number;
    market_sentiment: string;
};

type ClusterItem = {
    name: string;
    value: number;
    color: string;
};

const CATEGORIES: { [key: string]: { label: string; emoji: string } } = {
    all: { label: 'All', emoji: '📊' },
    grain: { label: 'Grains', emoji: '🌾' },
    pulse: { label: 'Pulses', emoji: '🫘' },
    oilseed: { label: 'Oilseeds', emoji: '🌻' },
    fiber: { label: 'Fiber', emoji: '🧵' },
    cash_crop: { label: 'Cash Crops', emoji: '🏭' },
    spice: { label: 'Spices', emoji: '🌶️' },
    vegetable: { label: 'Vegetables', emoji: '🥬' },
};

function getTrendIcon(trend: string) {
    if (trend === 'bullish') return <TrendingUp size={14} />;
    if (trend === 'bearish') return <TrendingDown size={14} />;
    return <Minus size={14} />;
}

function getTrendColor(trend: string) {
    if (trend === 'bullish') return 'var(--success)';
    if (trend === 'bearish') return 'var(--error)';
    return 'var(--text-soft)';
}

function getChangeColor(val: number): string {
    if (val > 0) return 'var(--success)';
    if (val < 0) return 'var(--error)';
    return 'var(--text-soft)';
}

function MiniSparkline({ value, trend }: { value: number; trend: string }) {
    // Generate a deterministic sparkline from the price value
    const seed = Math.abs(value * 7.3);
    const points: number[] = [];
    for (let i = 0; i < 20; i++) {
        const x = Math.sin(seed + i * 0.7) * 15 + Math.cos(seed * 0.3 + i * 0.4) * 10;
        const trendBias = trend === 'bullish' ? i * 0.8 : trend === 'bearish' ? -i * 0.6 : 0;
        points.push(30 + x + trendBias);
    }
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const normalized = points.map(p => ((p - min) / range) * 30);

    const pathD = normalized.map((y, i) => {
        const x = (i / (normalized.length - 1)) * 80;
        return `${i === 0 ? 'M' : 'L'} ${x} ${34 - y}`;
    }).join(' ');

    const color = trend === 'bullish' ? '#10b981' : trend === 'bearish' ? '#ef4444' : '#94a3b8';

    return (
        <svg width="80" height="36" viewBox="0 0 80 36" style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id={`grad-${value}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={`${pathD} L 80 36 L 0 36 Z`} fill={`url(#grad-${value})`} />
            <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="80" cy={34 - normalized[normalized.length - 1]} r="2.5" fill={color} />
        </svg>
    );
}

function PriceRangeBar({ low, high, current, msp }: { low: number; high: number; current: number; msp: number }) {
    const range = high - low || 1;
    const pos = Math.max(0, Math.min(100, ((current - low) / range) * 100));
    const mspPos = msp > 0 ? Math.max(0, Math.min(100, ((msp - low) / range) * 100)) : -1;

    return (
        <div style={{ position: 'relative', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'visible' }}>
            <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${pos}%`, borderRadius: '3px',
                background: `linear-gradient(90deg, #059669, ${pos > 70 ? '#f59e0b' : '#10b981'})`,
                transition: 'width 0.5s ease'
            }} />
            {mspPos >= 0 && (
                <div style={{
                    position: 'absolute', left: `${mspPos}%`, top: '-3px', width: '2px', height: '12px',
                    background: '#ef4444', borderRadius: '1px', zIndex: 2,
                }} title={`MSP: ₹${msp}`} />
            )}
            <div style={{
                position: 'absolute', left: `calc(${pos}% - 4px)`, top: '-3px',
                width: '8px', height: '12px', background: 'var(--primary)', borderRadius: '4px',
                boxShadow: '0 0 6px rgba(5,150,105,0.4)', zIndex: 3,
            }} />
        </div>
    );
}

export default function MarketIntelligence() {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const [commodities, setCommodities] = useState<CommodityItem[]>([]);
    const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
    const [clusterHealth, setClusterHealth] = useState<ClusterItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortField, setSortField] = useState<'name' | 'price' | 'change'>('price');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/market`);
            if (!res.ok) throw new Error('API error');
            const data = await res.json();

            setCommodities(data.commodities || []);
            setNetworkStats(data.network_stats || null);
            setClusterHealth(data.cluster_health || []);
            setError(false);
            setLastSync(new Date());
        } catch (err) {
            console.error('Failed to fetch market data:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 8000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const filtered = useMemo(() => {
        let list = [...commodities];

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q));
        }
        if (selectedCategory !== 'all') {
            list = list.filter(c => c.category === selectedCategory);
        }

        list.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'name') cmp = a.name.localeCompare(b.name);
            else if (sortField === 'price') cmp = a.price - b.price;
            else cmp = a.change - b.change;
            return sortDir === 'desc' ? -cmp : cmp;
        });

        return list;
    }, [commodities, searchTerm, selectedCategory, sortField, sortDir]);

    const handleSort = (field: 'name' | 'price' | 'change') => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const bullishCount = commodities.filter(c => c.trend === 'bullish').length;
    const bearishCount = commodities.filter(c => c.trend === 'bearish').length;
    const totalVolume = commodities.reduce((s, c) => {
        const match = c.volume.match(/([\d.]+)k/);
        return s + (match ? parseFloat(match[1]) : 0);
    }, 0);
    const avgChange = commodities.length ? commodities.reduce((s, c) => s + c.change, 0) / commodities.length : 0;

    const availableCategories = useMemo(() => {
        const cats = new Set(commodities.map(c => c.category || ''));
        return ['all', ...Array.from(cats).filter(Boolean)];
    }, [commodities]);

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) return <ChevronDown size={12} style={{ opacity: 0.3 }} />;
        return sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />;
    };

    return (
        <DashboardLayout role={profile?.role as 'buyer' | 'seller' | 'organizer' || 'buyer'}>
            {/* Hero */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1.1 }}>
                            Market <span style={{ color: 'var(--primary)' }}>Intelligence.</span>
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, marginTop: '0.5rem' }}>
                            {error
                                ? '⚠️ Could not connect to price feeds — showing cached data'
                                : `Live pricing for ${commodities.length} commodities across Indian mandis`
                            }
                        </p>
                    </div>
                    {lastSync && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-soft)' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: error ? 'var(--error)' : 'var(--success)', animation: error ? 'none' : 'pulse 2s infinite' }} />
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-soft)' }}>
                                {lastSync.toLocaleTimeString()}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6rem', flexDirection: 'column', gap: '1rem' }}>
                    <Loader2 size={36} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: 'var(--text-soft)', fontWeight: 600, fontSize: '0.9rem' }}>Loading market feeds...</p>
                </div>
            ) : (
                <>
                    {/* Market Summary Strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                        <div className="card-white" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Commodities</span>
                                <BarChart3 size={16} color="var(--primary)" />
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>{commodities.length}</h3>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Live feeds active</p>
                        </div>

                        <div className="card-white" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Bullish</span>
                                <TrendingUp size={16} color="var(--success)" />
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--success)' }}>{bullishCount}</h3>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Prices rising</p>
                        </div>

                        <div className="card-white" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Bearish</span>
                                <TrendingDown size={16} color="var(--error)" />
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--error)' }}>{bearishCount}</h3>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Prices dropping</p>
                        </div>

                        <div className="card-white" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Avg Change</span>
                                <Activity size={16} color={getChangeColor(avgChange)} />
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 900, color: getChangeColor(avgChange) }}>
                                {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(1)}%
                            </h3>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600 }}>Market momentum</p>
                        </div>

                        <div className="card-white" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.9)', color: 'white', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Volume</span>
                                <Layers size={16} color="var(--primary)" />
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>{totalVolume.toFixed(0)}k</h3>
                            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Quintal traded</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
                        {/* Main Table */}
                        <div>
                            {/* Search & Filter Bar */}
                            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-soft)' }} />
                                    <input
                                        type="text"
                                        className="input-modern"
                                        placeholder="Search commodities..."
                                        style={{ paddingLeft: '2.5rem', height: '42px', fontSize: '0.85rem' }}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                    {availableCategories.map(cat => {
                                        const meta = CATEGORIES[cat] || { label: cat, emoji: '📦' };
                                        const isActive = selectedCategory === cat;
                                        return (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedCategory(cat)}
                                                style={{
                                                    padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.7rem',
                                                    fontWeight: 700, cursor: 'pointer', border: '1px solid',
                                                    background: isActive ? 'var(--primary-soft)' : 'white',
                                                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                                    borderColor: isActive ? 'rgba(5,150,105,0.2)' : 'var(--border-soft)',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                {meta.emoji} {meta.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Commodity Table */}
                            <div className="card-white" style={{ padding: 0, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                            <th onClick={() => handleSort('name')} style={{ padding: '1rem 1.25rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', userSelect: 'none' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Commodity <SortIcon field="name" /></span>
                                            </th>
                                            <th onClick={() => handleSort('price')} style={{ padding: '1rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', userSelect: 'none' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>Price <SortIcon field="price" /></span>
                                            </th>
                                            <th onClick={() => handleSort('change')} style={{ padding: '1rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', userSelect: 'none' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>24h <SortIcon field="change" /></span>
                                            </th>
                                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>7d</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Chart</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>Volume</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((c) => {
                                            const isExpanded = expandedRow === c.name;
                                            const catMeta = CATEGORIES[c.category || ''] || { label: c.category, emoji: '📦' };
                                            return (
                                                <React.Fragment key={c.name}>
                                                    <tr
                                                        onClick={() => setExpandedRow(isExpanded ? null : c.name)}
                                                        style={{
                                                            borderBottom: isExpanded ? 'none' : '1px solid var(--border-soft)',
                                                            cursor: 'pointer', transition: 'background 0.15s',
                                                            background: isExpanded ? 'var(--primary-soft)' : undefined,
                                                        }}
                                                        onMouseOver={(e) => { if (!isExpanded) e.currentTarget.style.background = '#fafbfc'; }}
                                                        onMouseOut={(e) => { if (!isExpanded) e.currentTarget.style.background = ''; }}
                                                    >
                                                        <td style={{ padding: '1rem 1.25rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                <span style={{ fontSize: '1.25rem' }}>{catMeta.emoji}</span>
                                                                <div>
                                                                    <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--secondary)', lineHeight: 1.2 }}>{c.name}</p>
                                                                    <p style={{ fontSize: '0.6rem', fontWeight: 700, color: getTrendColor(c.trend), textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                        {getTrendIcon(c.trend)} {c.trend}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                            <p style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--secondary)', fontFamily: 'monospace' }}>
                                                                ₹{c.price.toLocaleString()}
                                                            </p>
                                                            <p style={{ fontSize: '0.6rem', color: 'var(--text-soft)', fontWeight: 600 }}>{c.unit || 'per quintal'}</p>
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                                                fontWeight: 800, fontSize: '0.85rem', color: getChangeColor(c.change),
                                                                padding: '0.25rem 0.5rem', borderRadius: '6px',
                                                                background: c.change > 0 ? 'var(--success-soft)' : c.change < 0 ? 'var(--error-soft)' : '#f8fafc'
                                                            }}>
                                                                {c.change > 0 ? <ArrowUpRight size={12} /> : c.change < 0 ? <ArrowDownRight size={12} /> : null}
                                                                {c.change >= 0 ? '+' : ''}{c.change}%
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: getChangeColor(c.change_7d || 0) }}>
                                                                {(c.change_7d || 0) >= 0 ? '+' : ''}{(c.change_7d || 0).toFixed(1)}%
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                <MiniSparkline value={c.price} trend={c.trend} />
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.volume}</span>
                                                        </td>
                                                    </tr>

                                                    {/* Expanded detail row */}
                                                    {isExpanded && (
                                                        <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                                            <td colSpan={6} style={{ padding: '0 1.25rem 1.25rem' }}>
                                                                <div style={{
                                                                    background: 'white', borderRadius: '12px', padding: '1.25rem',
                                                                    border: '1px solid var(--border-soft)',
                                                                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', alignItems: 'center'
                                                                }}>
                                                                    <div>
                                                                        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.375rem' }}>Day Range</p>
                                                                        <PriceRangeBar low={c.low || 0} high={c.high || 0} current={c.price} msp={c.msp || 0} />
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem' }}>
                                                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-soft)' }}>₹{(c.low || 0).toLocaleString()}</span>
                                                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-soft)' }}>₹{(c.high || 0).toLocaleString()}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div style={{ textAlign: 'center' }}>
                                                                        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>MSP (Govt Price)</p>
                                                                        <p style={{ fontSize: '1.1rem', fontWeight: 900, color: (c.msp || 0) > 0 ? 'var(--secondary)' : 'var(--text-soft)' }}>
                                                                            {(c.msp || 0) > 0 ? `₹${(c.msp || 0).toLocaleString()}` : 'N/A'}
                                                                        </p>
                                                                        {(c.msp || 0) > 0 && (
                                                                            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: c.price > (c.msp || 0) ? 'var(--success)' : 'var(--error)' }}>
                                                                                {c.price > (c.msp || 0) ? '▲ Above MSP' : '▼ Below MSP'}
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    <div style={{ textAlign: 'center' }}>
                                                                        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Category</p>
                                                                        <span style={{
                                                                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                                                            padding: '0.375rem 0.75rem', borderRadius: '8px',
                                                                            background: 'var(--primary-soft)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)'
                                                                        }}>
                                                                            {catMeta.emoji} {catMeta.label}
                                                                        </span>
                                                                    </div>

                                                                    <div style={{ textAlign: 'center' }}>
                                                                        <p style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Trade Volume</p>
                                                                        <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--secondary)' }}>{c.volume}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {filtered.length === 0 && (
                                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                                        <Search size={36} color="#94a3b8" style={{ marginBottom: '1rem', opacity: 0.4 }} />
                                        <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>No commodities match your search</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Market Pulse */}
                            {networkStats && (
                                <div className="card-white" style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                        <Signal size={16} color="var(--primary)" />
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Market Pulse</h4>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Supply Index</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--secondary)' }}>{networkStats.supply_index}</span>
                                        </div>
                                        <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px' }}>
                                            <div style={{ height: '100%', width: `${networkStats.supply_index}%`, background: 'var(--primary)', borderRadius: '2px', transition: 'width 0.5s' }} />
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Storage Use</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--secondary)' }}>{networkStats.storage_utilization}%</span>
                                        </div>
                                        <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px' }}>
                                            <div style={{ height: '100%', width: `${networkStats.storage_utilization}%`, background: networkStats.storage_utilization > 80 ? 'var(--error)' : 'var(--primary)', borderRadius: '2px', transition: 'width 0.5s' }} />
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Escrow Pool</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--secondary)' }}>₹{networkStats.escrow_liquidity}Cr</span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '10px', background: 'var(--primary-soft)', border: '1px solid rgba(5,150,105,0.1)' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>Sentiment</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--primary)' }}>{networkStats.market_sentiment}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Cluster Health */}
                            <div className="card-white" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                    <Database size={16} color="var(--primary)" />
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Regional Supply Health</h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {clusterHealth.map((region, i) => (
                                        <div key={i}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.8rem' }}>
                                                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{region.name}</span>
                                                <span style={{ fontWeight: 900, color: region.value > 60 ? 'var(--success)' : region.value > 30 ? 'var(--warning)' : 'var(--error)' }}>
                                                    {region.value}%
                                                </span>
                                            </div>
                                            <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${region.value}%`, background: region.color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Top Movers */}
                            <div className="card-white" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                    <Sparkles size={16} color="var(--warning)" />
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Top Movers</h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                    {[...commodities].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5).map((c, i) => (
                                        <div key={i} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border-soft)',
                                            background: '#fafbfc'
                                        }}>
                                            <div>
                                                <p style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--secondary)', lineHeight: 1.2 }}>{c.name}</p>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-soft)' }}>₹{c.price.toLocaleString()}</p>
                                            </div>
                                            <span style={{
                                                fontWeight: 800, fontSize: '0.75rem', color: getChangeColor(c.change),
                                                display: 'flex', alignItems: 'center', gap: '0.15rem'
                                            }}>
                                                {c.change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                {c.change >= 0 ? '+' : ''}{c.change}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* MSP Alert */}
                            <div className="card-white" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85))', color: 'white', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Shield size={16} color="var(--primary)" />
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>MSP Watch</h4>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: '1rem' }}>
                                    {commodities.filter(c => (c.msp || 0) > 0 && c.price < (c.msp || 0)).length} commodities trading below their Minimum Support Price. Government procurement at MSP is available.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {commodities.filter(c => (c.msp || 0) > 0 && c.price < (c.msp || 0)).slice(0, 3).map((c, i) => (
                                        <div key={i} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '0.5rem 0.75rem', borderRadius: '8px',
                                            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239,68,68,0.2)'
                                        }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{c.name}</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#fca5a5' }}>
                                                ▼ ₹{((c.msp || 0) - c.price).toLocaleString()} below
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
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
                table tbody tr:hover {
                    background: #fafbfc;
                }
            `}</style>
        </DashboardLayout>
    );
}
