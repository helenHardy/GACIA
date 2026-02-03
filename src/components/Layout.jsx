import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    Settings,
    LogOut,
    Building2,
    Truck,
    ClipboardList,
    ArrowLeftRight,
    UserRoundCog,
    Contact,
    History,
    FileText,
    Layers,
    ChevronRight,
    ChevronLeft
} from 'lucide-react'
import '../styles/layout.css'

export default function Layout() {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [userRole, setUserRole] = useState(null)
    const [branding, setBranding] = useState(null)
    const [allowedMenuKeys, setAllowedMenuKeys] = useState([])
    const [loadingPermissions, setLoadingPermissions] = useState(true)

    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => {
        async function fetchPermissions(role) {
            try {
                const { data } = await supabase
                    .from('role_permissions')
                    .select('menu_key')
                    .eq('role_name', role)

                if (data) {
                    setAllowedMenuKeys(data.map(p => p.menu_key))
                }
            } catch (err) {
                console.error('Error fetching permissions:', err)
            } finally {
                setLoadingPermissions(false)
            }
        }

        async function fetchUserRole(userId) {
            const { data } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .maybeSingle()

            if (data) {
                setUserRole(data.role)
                fetchPermissions(data.role)
            } else {
                setLoadingPermissions(false)
            }
        }

        async function fetchUserBranding(userId) {
            try {
                const { data: assignments } = await supabase
                    .from('user_branches')
                    .select(`
                        branches (
                            name,
                            logo_url
                        )
                    `)
                    .eq('user_id', userId)

                if (assignments && assignments.length === 1 && assignments[0].branches) {
                    setBranding({
                        name: assignments[0].branches.name,
                        logo: assignments[0].branches.logo_url
                    })
                } else {
                    setBranding(null)
                }
            } catch (err) {
                console.error('Error fetching branding:', err)
            }
        }

        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
            if (user) {
                fetchUserRole(user.id)
                fetchUserBranding(user.id)
            } else {
                setLoadingPermissions(false)
            }
        })
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    const allNavItems = [
        { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard', key: 'dashboard' },
        { to: '/pos', icon: <ShoppingCart size={20} />, label: 'Punto de Venta', key: 'pos' },
        { to: '/sales', icon: <History size={20} />, label: 'Historial Ventas', key: 'sales' },
        { to: '/quotations', icon: <FileText size={20} />, label: 'Cotizaciones', key: 'quotations' },
        { to: '/inventory', icon: <Package size={20} />, label: 'Inventario', key: 'inventory' },
        { to: '/branches', icon: <Building2 size={20} />, label: 'Sucursales', key: 'branches' },
        { to: '/suppliers', icon: <Truck size={20} />, label: 'Proveedores', key: 'suppliers' },
        { to: '/purchases', icon: <ClipboardList size={20} />, label: 'Compras', key: 'purchases' },
        { to: '/transfers', icon: <ArrowLeftRight size={20} />, label: 'Traspasos', key: 'transfers' },
        { to: '/reports', icon: <FileText size={20} />, label: 'Reportes', key: 'reports' },
        { to: '/customers', icon: <Contact size={20} />, label: 'Clientes', key: 'customers' },
        { to: '/users', icon: <UserRoundCog size={20} />, label: 'Usuarios', key: 'users' },
        { to: '/classifications', icon: <Layers size={20} />, label: 'Clasificaciones', key: 'classifications' },
        { to: '/settings', icon: <Settings size={20} />, label: 'Configuración', key: 'settings' },
    ]

    const navItems = allNavItems.filter(item =>
        userRole === 'Administrador' || allowedMenuKeys.includes(item.key)
    )

    const [tooltip, setTooltip] = useState(null)

    const handleMouseEnter = (label, e) => {
        if (!collapsed) return
        const rect = e.currentTarget.getBoundingClientRect()
        setTooltip({
            label,
            top: rect.top + (rect.height / 2),
            left: rect.right + 10
        })
    }

    const handleMouseLeave = () => {
        setTooltip(null)
    }

    return (
        <div className="layout-wrapper">
            <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    {!collapsed && (
                        branding ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '100%' }}>
                                {branding.logo && (
                                    <img
                                        src={branding.logo}
                                        alt="Logo"
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '8px',
                                            objectFit: 'cover',
                                            border: '1px solid hsl(var(--border) / 0.5)'
                                        }}
                                    />
                                )}
                                <span className="brand-title" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {branding.name}
                                </span>
                            </div>
                        ) : (
                            <span className="brand-title">Gacia ERP</span>
                        )
                    )}
                    {collapsed && (
                        branding?.logo ? (
                            <img
                                src={branding.logo}
                                alt="Logo"
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    objectFit: 'cover'
                                }}
                            />
                        ) : (
                            <span className="brand-title" style={{ fontSize: '1.5rem' }}>G</span>
                        )
                    )}
                </div>

                <div style={{ padding: '0.5rem 1rem 0' }}>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="btn"
                        style={{ width: '100%', justifyContent: 'center', backgroundColor: 'transparent', border: '1px solid hsl(var(--border))' }}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                <nav className="sidebar-nav" onMouseLeave={handleMouseLeave}>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onMouseEnter={(e) => handleMouseEnter(item.label, e)}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="nav-item" style={{ width: '100%', color: 'hsl(var(--destructive))' }}>
                        <LogOut size={20} />
                        {!collapsed && <span>Cerrar Sesión</span>}
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="top-header">
                    <h2 className="text-xl font-semibold">Bienvenido</h2>
                    <div className="user-menu">
                        <div className="avatar">
                            <span className="text-sm font-medium">{user?.email || 'Cargando...'}</span>
                        </div>
                    </div>
                </header>

                <div className="page-content">
                    <Outlet />
                </div>
            </main>

            {tooltip && collapsed && (
                <div
                    style={{
                        position: 'fixed',
                        top: tooltip.top,
                        left: tooltip.left,
                        transform: 'translateY(-50%)',
                        backgroundColor: '#1e293b',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        pointerEvents: 'none',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    {tooltip.label}
                    {/* Arrow */}
                    <div style={{
                        position: 'absolute',
                        left: '-4px',
                        top: '50%',
                        transform: 'translateY(-50%) rotate(45deg)',
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#1e293b',
                        zIndex: -1
                    }} />
                </div>
            )}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-50%) translateX(-5px); }
                    to { opacity: 1; transform: translateY(-50%) translateX(0); }
                }
            `}</style>
        </div>
    )
}
