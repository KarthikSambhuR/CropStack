'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ShoppingBag,
    Package,
    History,
    Settings,
    LogOut,
    PlusCircle,
    Globe,
    ShieldCheck,
    Warehouse,
    ChevronRight,
    Bell,
    Database,
    Clock,
    Landmark
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

type SidebarProps = {
    role: 'buyer' | 'seller' | 'organizer';
};

export default function Sidebar({ role }: SidebarProps) {
    const pathname = usePathname();
    const { signOut } = useAuth();
    const { language, setLanguage, t } = useLanguage();

    const buyerLinks = [
        { name: t('dashboard'), href: '/buyer/dashboard', icon: LayoutDashboard },
        { name: t('catalog'), href: '/buyer/catalog', icon: ShoppingBag },
        { name: t('orders'), href: '/buyer/orders', icon: History },
    ];

    const sellerLinks = [
        { name: t('dashboard'), href: '/seller/dashboard', icon: LayoutDashboard },
        { name: t('products'), href: '/seller/products', icon: Package },
        { name: t('inventory'), href: '/seller/products/new', icon: PlusCircle },
        { name: 'My Loans', href: '/seller/loans', icon: Landmark },
    ];

    const organizerLinks = [
        { name: t('dashboard'), href: '/organizer/dashboard', icon: LayoutDashboard },
        { name: t('warehouse_queue'), href: '/organizer/queue', icon: ShieldCheck },
        { name: t('summary'), href: '/organizer/inventory', icon: Database },
    ];

    const links = role === 'buyer' ? buyerLinks : role === 'seller' ? sellerLinks : organizerLinks;

    const languages = [
        { code: 'en', label: 'English' },
        { code: 'hi', label: 'हिन्दी' },
        { code: 'te', label: 'తెలుగు' },
        { code: 'ml', label: 'മലയാളം' },
        { code: 'ta', label: 'தமிழ்' },
        { code: 'kn', label: 'ಕನ್ನಡ' }
    ];

    return (
        <aside style={{
            width: '280px',
            background: 'white',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            position: 'sticky',
            top: 0,
            zIndex: 100
        }}>
            {/* Logo */}
            <div style={{ padding: '2.5rem 2rem', borderBottom: '1px solid var(--border-soft)' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
                    <div style={{ width: '36px', height: '36px', background: 'var(--primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)' }}>
                        <Warehouse size={20} color="white" />
                    </div>
                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--secondary)', letterSpacing: '-0.04em' }}>{t('app_name')}</span>
                </Link>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '2rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0.75rem 1.25rem' }}>
                    {t('roles.' + role)} Menu
                </p>
                {links.map((link, index) => {
                    const Icon = link.icon;
                    const isActive = link.href.endsWith('/dashboard')
                        ? pathname === link.href
                        : pathname.startsWith(link.href);
                    return (
                        <Link
                            key={`${link.href}-${index}`}
                            href={link.href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                padding: '0.875rem 1rem',
                                borderRadius: '12px',
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                background: isActive ? 'var(--primary-soft)' : 'transparent',
                                fontWeight: isActive ? 700 : 600,
                                fontSize: '0.925rem',
                                textDecoration: 'none',
                                transition: 'all 0.2s ease',
                                border: isActive ? '1px solid rgba(5, 150, 105, 0.1)' : '1px solid transparent'
                            }}
                        >
                            <Icon size={18} />
                            {link.name}
                            {isActive && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Config */}
            <div style={{ padding: '2rem 1.5rem', borderTop: '1px solid var(--border-soft)', background: '#fcfcfe' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Globe size={14} color="var(--text-soft)" />
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Language</span>
                    </div>
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as any)}
                        style={{
                            width: '100%',
                            padding: '0.625rem',
                            borderRadius: '10px',
                            border: '1.5px solid var(--border)',
                            background: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color: 'var(--secondary)',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {languages.map(l => (
                            <option key={l.code} value={l.code}>{l.label}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <Link href="/settings" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: pathname === '/settings' ? 'var(--primary)' : 'var(--text-muted)',
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        fontWeight: 700,
                        padding: '0.75rem',
                        borderRadius: '10px',
                        background: pathname === '/settings' ? 'var(--primary-soft)' : 'transparent'
                    }}>
                        <Settings size={18} /> {t('settings')}
                    </Link>
                    <button
                        onClick={() => signOut()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            color: 'var(--error)',
                            width: '100%',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            borderRadius: '10px',
                            transition: 'all 0.2s ease',
                            marginTop: '0.5rem'
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = 'var(--error-soft)')}
                        onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
                    >
                        <LogOut size={18} /> {t('logout')}
                    </button>
                </div>
            </div>
        </aside>
    );
}
