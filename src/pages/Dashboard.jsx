import React, { useState, useEffect } from 'react'
import { TrendingUp, Users, Package, DollarSign, RefreshCw, Clock, Plus, ShoppingCart, FileText, ArrowUpRight, ArrowRight, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SalesChart from '../components/dashboard/SalesChart'
import { useNavigate } from 'react-router-dom'

const StatCard = ({ title, value, icon, trend, loading, colorClass, gradient }) => (
    <div className="card" style={{
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid hsl(var(--border) / 0.6)',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)'
    }}>
        {/* Background Gradient Decoration */}
        <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: gradient,
            opacity: 0.1,
            borderRadius: '0 0 0 100%',
            pointerEvents: 'none'
        }} />

        {loading && (
            <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }}>
                <RefreshCw size={16} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
            </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                    padding: '0.75rem',
                    borderRadius: '12px',
                    backgroundColor: `hsl(var(--${colorClass}) / 0.1)`,
                    color: `hsl(var(--${colorClass}))`,
                    display: 'inline-flex'
                }}>
                    {icon}
                </div>
                {trend && (
                    <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '99px',
                        backgroundColor: 'hsl(142 76% 36% / 0.1)',
                        color: 'hsl(142 76% 36%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}>
                        <TrendingUp size={12} />
                        {trend}
                    </div>
                )}
            </div>

            <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{title}</p>
                <h3 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'hsl(var(--foreground))' }}>{loading ? '...' : value}</h3>
            </div>
        </div>
    </div>
)

const QuickAction = ({ icon, label, onClick, color = 'primary' }) => (
    <button
        onClick={onClick}
        className="card hover-scale"
        style={{
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            border: '1px solid hsl(var(--border) / 0.6)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            backgroundColor: 'white',
            textAlign: 'center'
        }}
    >
        <div style={{
            padding: '0.75rem',
            borderRadius: '50%',
            backgroundColor: `hsl(var(--${color}) / 0.1)`,
            color: `hsl(var(--${color}))`
        }}>
            {icon}
        </div>
        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'hsl(var(--foreground))' }}>{label}</span>
    </button>
)

export default function Dashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState({
        totalSales: 0,
        activeOrders: 0,
        newClients: 0,
        lowStock: 0
    })
    const [recentSales, setRecentSales] = useState([])
    const [dailySales, setDailySales] = useState([])
    const [loading, setLoading] = useState(true)

    const [branches, setBranches] = useState([])
    const [selectedBranchId, setSelectedBranchId] = useState('all')
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        fetchBranches()
    }, [])

    useEffect(() => {
        if (selectedBranchId) {
            fetchDashboardData()
        }
    }, [selectedBranchId])

    async function fetchBranches() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            const isUserAdmin = profile?.role === 'Administrador'
            setIsAdmin(isUserAdmin)

            let query = supabase.from('branches').select('*').eq('active', true).order('name')

            if (!isUserAdmin) {
                const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                const assignedIds = assignments?.map(a => a.branch_id) || []

                if (assignedIds.length > 0) {
                    query = query.in('id', assignedIds)
                } else {
                    setBranches([])
                    return
                }
            }

            const { data } = await query
            setBranches(data || [])

            // Set default selection
            if (data && data.length > 0) {
                if (selectedBranchId === 'all' && !isUserAdmin) {
                    setSelectedBranchId(data[0].id)
                } else if (!selectedBranchId || (selectedBranchId !== 'all' && !data.find(b => b.id === selectedBranchId))) {
                    setSelectedBranchId(data[0].id)
                }
            }
        } catch (err) {
            console.error('Error fetching branches:', err)
        }
    }

    async function fetchDashboardData() {
        try {
            setLoading(true)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Get Role & Branch Permissions
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
            const isAdmin = profile?.role === 'Administrador'

            let assignedBranchIds = []
            if (!isAdmin) {
                const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                assignedBranchIds = assignments?.map(a => a.branch_id) || []
            }

            // Helper to apply branch filter
            const applyBranchFilter = (query) => {
                // 1. Specific Branch Selected
                if (selectedBranchId !== 'all') {
                    return query.eq('branch_id', selectedBranchId)
                }

                // 2. All + Non-Admin (Restrict to assigned)
                if (!isAdmin) {
                    if (assignedBranchIds.length > 0) {
                        return query.in('branch_id', assignedBranchIds)
                    } else {
                        return query.eq('id', -1) // Block
                    }
                }

                // 3. All + Admin (No filter)
                return query
            }

            // 2. Ventas Totales
            let salesQuery = supabase.from('sales').select('total, branch_id')
            salesQuery = applyBranchFilter(salesQuery)
            const { data: salesData } = await salesQuery
            const total = salesData?.reduce((acc, curr) => acc + Number(curr.total), 0) || 0

            // 3. Ventas de Hoy
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            let ordersQuery = supabase
                .from('sales')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString())
            ordersQuery = applyBranchFilter(ordersQuery)
            const { count: ordersCount } = await ordersQuery

            // 4. Clientes (Total Profiles)
            // Note: Currently counting global profiles. If this should be customers per branch, it needs a different schema relation.
            // Keeping global for now as "New Clients" usually implies system-wide growth or customer db.
            const { count: clientsCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })

            // 5. Stock Bajo
            let lowStockCount = 0
            if (selectedBranchId !== 'all') {
                const { data: branchStock } = await supabase
                    .from('product_branch_settings')
                    .select('stock, min_stock')
                    .eq('branch_id', selectedBranchId)
                lowStockCount = branchStock?.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length || 0
            } else {
                if (isAdmin) {
                    const { data: lowStockData } = await supabase
                        .from('products')
                        .select('id, stock, min_stock')
                    lowStockCount = lowStockData?.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length || 0
                } else if (assignedBranchIds.length > 0) {
                    const { data: branchStock } = await supabase
                        .from('product_branch_settings')
                        .select('stock, min_stock')
                        .in('branch_id', assignedBranchIds)
                    lowStockCount = branchStock?.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length || 0
                }
            }


            // 6. Actividad Reciente
            let recentQuery = supabase
                .from('sales')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5)
            recentQuery = applyBranchFilter(recentQuery)
            const { data: recent } = await recentQuery

            // 7. Datos para el gráfico (últimos 7 días)
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

            let dailyQuery = supabase
                .from('sales')
                .select('total, created_at, branch_id')
                .gte('created_at', sevenDaysAgo.toISOString())
                .order('created_at', { ascending: true })
            dailyQuery = applyBranchFilter(dailyQuery)

            const { data: dailyData } = await dailyQuery

            // Agrupar por día
            const days = []
            for (let i = 6; i >= 0; i--) {
                const d = new Date()
                d.setDate(d.getDate() - i)
                const dateStr = d.toLocaleDateString('sv-SE')
                const totalDay = dailyData
                    ?.filter(s => s.created_at.startsWith(dateStr))
                    .reduce((acc, curr) => acc + Number(curr.total), 0) || 0

                days.push({
                    date: dateStr,
                    label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
                    total: totalDay
                })
            }

            setStats({
                totalSales: total,
                activeOrders: ordersCount || 0,
                newClients: clientsCount || 0,
                lowStock: lowStockCount
            })
            setRecentSales(recent || [])
            setDailySales(days)

        } catch (err) {
            console.error('Error fetching dashboard data:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.03em', color: 'hsl(var(--foreground))' }}>Dashboard General</h1>
                    <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '1rem', marginTop: '0.25rem' }}>Bienvenido de nuevo, aquí tienes el resumen de tu negocio.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', padding: '0 0.5rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', height: '42px' }}>
                        <Building2 size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
                        <select
                            disabled={branches.length <= 1 && !isAdmin}
                            style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: '600', fontSize: '0.9rem', padding: '0.5rem 0', minWidth: '150px' }}
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value)}
                        >
                            {isAdmin && <option value="all">Todas las Sucursales</option>}
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        className="btn"
                        onClick={fetchDashboardData}
                        disabled={loading}
                        style={{
                            backgroundColor: 'white',
                            border: '1px solid hsl(var(--border))',
                            color: 'hsl(var(--foreground))',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            padding: '0.6rem 1rem',
                            fontWeight: '600',
                            height: '42px'
                        }}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} style={{ marginRight: '0.5rem' }} />
                        Sincronizar
                    </button>
                </div>
            </div>

            {/* Quick Actions (Optional, but adds functionality) */}
            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Acciones Rápidas</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                    <QuickAction icon={<ShoppingCart size={24} />} label="Nueva Venta" onClick={() => navigate('/pos')} color="primary" />
                    <QuickAction icon={<Package size={24} />} label="Inventario" onClick={() => navigate('/inventory')} color="secondary" />
                    <QuickAction icon={<Users size={24} />} label="Clientes" onClick={() => navigate('/customers')} color="secondary" />
                    <QuickAction icon={<FileText size={24} />} label="Reportes" onClick={() => navigate('/reports')} color="secondary" />
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard
                    title="Ventas Totales"
                    value={`$${stats.totalSales.toLocaleString()}`}
                    icon={<DollarSign size={24} />}
                    loading={loading}
                    colorClass="primary"
                    gradient="radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)"
                />
                <StatCard
                    title="Ventas de Hoy"
                    value={stats.activeOrders}
                    icon={<TrendingUp size={24} />}
                    loading={loading}
                    colorClass="secondary-foreground"
                    gradient="radial-gradient(circle, hsl(var(--secondary-foreground)) 0%, transparent 70%)"
                    trend={stats.activeOrders > 0 ? '+10%' : null}
                />
                <StatCard
                    title="Clientes Registrados"
                    value={stats.newClients}
                    icon={<Users size={24} />}
                    loading={loading}
                    colorClass="primary"
                    gradient="radial-gradient(circle, hsl(262 83% 58%) 0%, transparent 70%)"
                />
                <StatCard
                    title="Stock Bajo"
                    value={stats.lowStock}
                    icon={<Package size={24} />}
                    loading={loading}
                    colorClass="destructive"
                    gradient="radial-gradient(circle, hsl(var(--destructive)) 0%, transparent 70%)"
                />
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Sales Chart Section */}
                <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Rendimiento de Ventas</h3>
                            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Ingresos de los últimos 7 días</p>
                        </div>
                        <button className="btn" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>Ver Detalle</button>
                    </div>

                    <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--muted) / 0.1)', borderRadius: '12px' }}>
                        {loading ? (
                            <RefreshCw size={48} className="animate-spin" style={{ opacity: 0.2, color: 'hsl(var(--primary))' }} />
                        ) : (
                            <SalesChart data={dailySales} />
                        )}
                    </div>
                </div>

                {/* Recent Activity Section */}
                <div className="card" style={{ padding: '0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Actividad Reciente</h3>
                        <ArrowRight size={18} style={{ color: 'hsl(var(--muted-foreground))', cursor: 'pointer' }} />
                    </div>

                    <div style={{ padding: '0' }}>
                        {recentSales.length === 0 && !loading ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'hsl(var(--muted-foreground))' }}>
                                <Clock size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                <p style={{ fontSize: '0.9rem' }}>No hay actividad registrada recientemente.</p>
                            </div>
                        ) : (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {recentSales.map((sale, idx) => (
                                    <li key={sale.id} className="hover-bg" style={{
                                        padding: '1rem 1.5rem',
                                        borderBottom: idx !== recentSales.length - 1 ? '1px solid hsl(var(--border) / 0.5)' : 'none',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'background-color 0.2s'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '10px',
                                                backgroundColor: 'hsl(142 76% 36% / 0.1)',
                                                color: 'hsl(142 76% 36%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <DollarSign size={20} />
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: '600', fontSize: '0.9rem', color: 'hsl(var(--foreground))' }}>Venta #{sale.id.toString().padStart(4, '0')}</p>
                                                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                                    {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Contado
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: '700', color: 'hsl(var(--foreground))', display: 'block' }}>+${Number(sale.total).toLocaleString()}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'hsl(142 76% 36%)', fontWeight: '500' }}>Completado</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .hover-scale:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    border-color: hsl(var(--primary) / 0.5) !important;
                }
                .hover-bg:hover {
                    background-color: hsl(var(--muted) / 0.3);
                }
            `}</style>
        </div>
    )
}

