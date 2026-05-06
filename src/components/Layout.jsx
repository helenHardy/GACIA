import React, { useState, useEffect, useRef } from 'react'
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
    ChevronLeft,
    ChevronDown,
    MapPin,
    Bell
} from 'lucide-react'
import NotificationBell from './NotificationBell'
import { useBranch } from '../context/BranchContext'
import '../styles/layout.css'

export default function Layout() {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [userRole, setUserRole] = useState(null)
    const [branding, setBranding] = useState(null)
    const [allowedMenuKeys, setAllowedMenuKeys] = useState([])
    const [loadingPermissions, setLoadingPermissions] = useState(true)

    const [collapsed, setCollapsed] = useState(false)
    const { branches, selectedBranchId, setSelectedBranchId, loading: loadingBranches } = useBranch()

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
        { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard', key: 'dashboard' },
        { to: '/pos', icon: <ShoppingCart size={18} />, label: 'Punto de Venta', key: 'pos' },
        { to: '/sales', icon: <History size={18} />, label: 'Historial Ventas', key: 'sales' },
        { to: '/quotations', icon: <FileText size={18} />, label: 'Cotizar', key: 'quotations' },
        { to: '/quotation-history', icon: <History size={18} />, label: 'Historial Cotizaciones', key: 'quotations' },
        { to: '/inventory', icon: <Package size={18} />, label: 'Inventario', key: 'inventory' },
        { to: '/branches', icon: <Building2 size={18} />, label: 'Sucursales', key: 'branches' },
        { to: '/purchases', icon: <ClipboardList size={18} />, label: 'Cargar Inventario', key: 'purchases' },
        { to: '/transfers', icon: <ArrowLeftRight size={18} />, label: 'Traspasos', key: 'transfers' },
        { to: '/reports', icon: <FileText size={18} />, label: 'Reportes', key: 'reports' },
        { to: '/customers', icon: <Contact size={18} />, label: 'Clientes', key: 'customers' },
        { to: '/users', icon: <UserRoundCog size={18} />, label: 'Usuarios', key: 'users' },
        { to: '/classifications', icon: <Layers size={18} />, label: 'Clasificaciones', key: 'classifications' },
        { to: '/settings', icon: <Settings size={18} />, label: 'Configuración', key: 'settings' },
    ]

    const navItems = allNavItems.filter(item =>
        userRole === 'Administrador' || allowedMenuKeys.includes(item.key)
    )

    // Organizar en grupos
    const navGroups = [
        { id: 'main', label: null, keys: ['dashboard'] },
        { id: 'ventas', label: 'Ventas', keys: ['pos', 'sales', 'quotations'] },
        { id: 'inventario', label: 'Inventario', keys: ['inventory', 'purchases', 'transfers', 'classifications'] },
        { id: 'gestion', label: 'Gestión', keys: ['branches', 'customers', 'users', 'reports'] },
        { id: 'config', label: null, keys: ['settings'] },
    ]

    const [openGroups, setOpenGroups] = useState({ ventas: true, inventario: true, gestion: true })
    const toggleGroup = (id) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))

    const [tooltip, setTooltip] = useState(null)
    const [flyout, setFlyout] = useState(null)
    const flyoutTimer = useRef(null)

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

    const startFlyoutClose = () => {
        flyoutTimer.current = setTimeout(() => setFlyout(null), 300)
    }

    const cancelFlyoutClose = () => {
        if (flyoutTimer.current) clearTimeout(flyoutTimer.current)
    }

    const handleGroupHover = (group, groupItems, e) => {
        if (!collapsed || !group.label) return
        cancelFlyoutClose()
        setTooltip(null)
        const rect = e.currentTarget.getBoundingClientRect()
        setFlyout({ label: group.label, items: groupItems, top: rect.top, left: rect.right + 6 })
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

                <nav className="sidebar-nav" onMouseLeave={() => { handleMouseLeave(); startFlyoutClose(); }}>
                    {navGroups.map(group => {
                        const groupItems = navItems.filter(item => group.keys.includes(item.key))
                        if (groupItems.length === 0) return null
                        const isOpen = !group.label || openGroups[group.id]

                        if (collapsed) {
                            if (!group.label) {
                                return groupItems.map(item => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                        onMouseEnter={(e) => { setFlyout(null); handleMouseEnter(item.label, e); }}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </NavLink>
                                ))
                            }
                            const firstIcon = groupItems[0].icon
                            return (
                                <div
                                    key={group.id}
                                    className="nav-item"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={(e) => handleGroupHover(group, groupItems, e)}
                                >
                                    {firstIcon}
                                </div>
                            )
                        }

                        return (
                            <div key={group.id} style={{ marginBottom: '0.15rem' }}>
                                {group.label && (
                                    <button
                                        onClick={() => toggleGroup(group.id)}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.35rem 0.85rem',
                                            marginTop: '0.25rem',
                                            background: 'none',
                                            border: 'none',
                                            color: 'rgba(255,255,255,0.4)',
                                            fontSize: '0.65rem',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.08em',
                                            cursor: 'pointer',
                                            transition: 'color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                    >
                                        <span>{group.label}</span>
                                        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                                    </button>
                                )}
                                <div style={{ overflow: 'hidden', maxHeight: isOpen ? '500px' : '0px', transition: 'max-height 0.25s ease' }}>
                                    {groupItems.map(item => (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                            style={group.label ? { paddingLeft: '1.5rem' } : {}}
                                        >
                                            {item.icon}
                                            <span>{item.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <h2 className="text-xl font-semibold">Bienvenido</h2>
                        
                        {!loadingBranches && branches.length > 0 && (
                            <div className="global-branch-selector">
                                <MapPin size={16} className="text-primary" />
                                <span className="label">Sucursal:</span>
                                {branches.length > 1 ? (
                                    <select 
                                        className="branch-select"
                                        value={selectedBranchId || ''}
                                        onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                                    >
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <span style={{ fontWeight: '700', color: 'hsl(var(--foreground))', marginLeft: '0.5rem' }}>
                                        {branches[0].name}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <NotificationBell />
                        
                        <div className="user-menu">
                        <div className="avatar">
                            <span className="text-sm font-medium">{user?.email || 'Cargando...'}</span>
                        </div>
                    </div>
                    </div>
                </header>

                <div className="page-content">
                    <Outlet />
                </div>
            </main>

            {/* Tooltip simple para ítems sueltos */}
            {tooltip && collapsed && !flyout && (
                <div
                    style={{
                        position: 'fixed',
                        top: tooltip.top,
                        left: tooltip.left,
                        transform: 'translateY(-50%)',
                        backgroundColor: '#1e293b',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        zIndex: 1000,
                        boxShadow: '0 8px 25px rgba(0,0,0,0.25)',
                        pointerEvents: 'none',
                        animation: 'flyoutIn 0.15s ease-out'
                    }}
                >
                    {tooltip.label}
                    <div style={{
                        position: 'absolute', left: '-4px', top: '50%',
                        transform: 'translateY(-50%) rotate(45deg)',
                        width: '8px', height: '8px', backgroundColor: '#1e293b', zIndex: -1
                    }} />
                </div>
            )}

            {/* Flyout popup para grupos */}
            {flyout && collapsed && (
                <div
                    onMouseEnter={cancelFlyoutClose}
                    onMouseLeave={() => setFlyout(null)}
                    style={{
                        position: 'fixed',
                        top: flyout.top,
                        left: flyout.left - 10,
                        paddingLeft: '10px',
                        zIndex: 1000,
                    }}
                >
                  <div style={{
                        backgroundColor: '#1e293b',
                        borderRadius: '12px',
                        padding: '0.5rem',
                        minWidth: '200px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                        animation: 'flyoutIn 0.15s ease-out'
                    }}>
                    <div style={{ padding: '0.4rem 0.75rem 0.5rem', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>
                        {flyout.label}
                    </div>
                    {flyout.items.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setFlyout(null)}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            style={{ borderRadius: '8px', fontSize: '0.88rem' }}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                    <div style={{
                        position: 'absolute', left: '5px', top: '18px',
                        transform: 'rotate(45deg)',
                        width: '10px', height: '10px', backgroundColor: '#1e293b', zIndex: -1
                    }} />
                  </div>
                </div>
            )}

            <style>{`
                @keyframes flyoutIn {
                    from { opacity: 0; transform: translateX(-8px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    )
}
