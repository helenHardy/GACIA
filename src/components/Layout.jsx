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
    Layers
} from 'lucide-react'
import '../styles/layout.css'

export default function Layout() {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [userRole, setUserRole] = useState(null) // 'Administrador' | 'Empleado' | 'Cajero'

    useEffect(() => {
        async function fetchUserRole(userId) {
            const { data } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .maybeSingle()

            if (data) setUserRole(data.role)
        }

        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
            if (user) fetchUserRole(user.id)
        })
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    const allNavItems = [
        { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard', roles: ['Administrador', 'Empleado', 'Cajero'] },
        { to: '/pos', icon: <ShoppingCart size={20} />, label: 'Punto de Venta', roles: ['Administrador', 'Empleado', 'Cajero'] },
        { to: '/sales', icon: <History size={20} />, label: 'Historial Ventas', roles: ['Administrador', 'Empleado', 'Cajero'] },
        { to: '/quotations', icon: <FileText size={20} />, label: 'Cotizaciones', roles: ['Administrador', 'Empleado', 'Cajero'] },
        { to: '/inventory', icon: <Package size={20} />, label: 'Inventario', roles: ['Administrador', 'Empleado'] },
        { to: '/branches', icon: <Building2 size={20} />, label: 'Sucursales', roles: ['Administrador'] },
        { to: '/suppliers', icon: <Truck size={20} />, label: 'Proveedores', roles: ['Administrador', 'Empleado'] },
        { to: '/purchases', icon: <ClipboardList size={20} />, label: 'Compras', roles: ['Administrador', 'Empleado'] },
        { to: '/transfers', icon: <ArrowLeftRight size={20} />, label: 'Traspasos', roles: ['Administrador', 'Empleado'] },
        { to: '/reports', icon: <FileText size={20} />, label: 'Reportes', roles: ['Administrador', 'Empleado'] },
        { to: '/customers', icon: <Contact size={20} />, label: 'Clientes', roles: ['Administrador', 'Empleado', 'Cajero'] },
        { to: '/users', icon: <UserRoundCog size={20} />, label: 'Usuarios', roles: ['Administrador'] },
        { to: '/classifications', icon: <Layers size={20} />, label: 'Clasificaciones', roles: ['Administrador', 'Empleado'] },
        { to: '/settings', icon: <Settings size={20} />, label: 'Configuración', roles: ['Administrador'] },
    ]

    const navItems = allNavItems.filter(item =>
        !userRole || (item.roles && item.roles.includes(userRole))
    )

    return (
        <div className="layout-wrapper">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <span className="brand-title">Gacia ERP</span>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="nav-item" style={{ width: '100%', color: 'hsl(var(--destructive))' }}>
                        <LogOut size={20} />
                        <span>Cerrar Sesión</span>
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
        </div>
    )
}
