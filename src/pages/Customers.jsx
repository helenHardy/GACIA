import React, { useState, useEffect } from 'react'
import { Plus, Search, Users, Edit2, Trash2, RefreshCw, AlertTriangle, Phone, Mail, MapPin, HandCoins, TrendingUp, X, Download, DollarSign, UserCheck, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import CustomerModal from '../components/customers/CustomerModal'
import CustomerPaymentsModal from '../components/customers/CustomerPaymentsModal'
import CustomerLedgerDrawer from '../components/customers/CustomerLedgerDrawer'

export default function Customers() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState(null)
    const [payingCustomer, setPayingCustomer] = useState(null)
    const [viewingLedgerCustomer, setViewingLedgerCustomer] = useState(null)

    // Metrics state
    const [metrics, setMetrics] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        totalDebt: 0
    })

    useEffect(() => {
        fetchCustomers()
    }, [])

    async function fetchCustomers() {
        try {
            setLoading(true)
            setError(null)
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name')

            if (error) throw error
            setCustomers(data || [])
            calculateMetrics(data || [])
        } catch (err) {
            console.error('Error fetching customers:', err)
            setError('Error al cargar la lista de clientes.')
        } finally {
            setLoading(false)
        }
    }

    const calculateMetrics = (data) => {
        const total = data.length
        const active = data.filter(c => c.active).length
        const inactive = total - active
        const totalDebt = data.reduce((sum, c) => sum + (c.current_balance || 0), 0)

        setMetrics({ total, active, inactive, totalDebt })
    }

    // Toast state
    const [toast, setToast] = useState(null) // { message, type: 'success' | 'error' }

    // Delete Modal state
    const [deleteId, setDeleteId] = useState(null)

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [toast])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
    }

    const handleSave = async (formData) => {
        try {
            setIsSaving(true)
            if (editingCustomer) {
                const { error } = await supabase
                    .from('customers')
                    .update(formData)
                    .eq('id', editingCustomer.id)
                if (error) throw error
                showToast('Cliente actualizado correctamente')
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert([formData])
                if (error) throw error
                showToast('Cliente registrado correctamente')
            }
            setIsModalOpen(false)
            setEditingCustomer(null)
            fetchCustomers()
        } catch (err) {
            console.error('Error saving customer:', err)
            showToast('Error al guardar el cliente', 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSavePayment = async (paymentData) => {
        try {
            setIsSaving(true)
            // 1. Insert payment record
            const { error: pError } = await supabase
                .from('customer_payments')
                .insert([paymentData])
            if (pError) throw pError

            // 2. Update customer balance
            const { data: customer } = await supabase
                .from('customers')
                .select('current_balance')
                .eq('id', paymentData.customer_id)
                .single()

            const { error: cError } = await supabase
                .from('customers')
                .update({ current_balance: (customer?.current_balance || 0) - paymentData.amount })
                .eq('id', paymentData.customer_id)
            if (cError) throw cError

            setPayingCustomer(null)
            fetchCustomers()
            showToast('Pago registrado con éxito')
        } catch (err) {
            console.error('Error saving payment:', err)
            showToast('Error al registrar el pago: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const confirmDelete = async () => {
        if (!deleteId) return
        try {
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', deleteId)
            if (error) throw error
            showToast('Cliente eliminado correctamente')
            fetchCustomers()
        } catch (err) {
            console.error('Error deleting customer:', err)
            showToast('No se puede eliminar: tiene historial de ventas/pagos', 'error')
        } finally {
            setDeleteId(null)
        }
    }

    const handleExportCSV = () => {
        try {
            if (customers.length === 0) {
                alert('No hay datos para exportar')
                return
            }

            const headers = ['Nombre,ID Fiscal,Email,Teléfono,Dirección,Estado,Deuda Actual,Límite Crédito']
            const rows = customers.map(c => {
                const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`
                return [
                    escape(c.name),
                    escape(c.tax_id),
                    escape(c.email),
                    escape(c.phone),
                    escape(c.address),
                    escape(c.active ? 'Activo' : 'Inactivo'),
                    (c.current_balance || 0).toFixed(2),
                    (c.credit_limit || 0).toFixed(2)
                ].join(',')
            })

            const csvContent = [headers, ...rows].join('\n')
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.setAttribute('href', url)
            link.setAttribute('download', `clientes_export_${new Date().toLocaleDateString('sv-SE')}.csv`)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (err) {
            console.error('Error exporting CSV:', err)
            alert('Error al exportar datos')
        }
    }

    const filteredCustomers = customers.filter(c =>
        (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (c.tax_id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ position: 'relative', paddingBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Custom Toast */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    backgroundColor: toast.type === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                    color: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    {toast.type === 'error' ? <AlertTriangle size={20} /> : <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                    <span style={{ fontWeight: '500' }}>{toast.message}</span>
                    <button onClick={() => setToast(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                    <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            {deleteId && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 150,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '400px', maxWidth: '90vw', padding: '2rem', textAlign: 'center', borderRadius: '24px' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: 'hsl(var(--destructive) / 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <Trash2 size={32} color="hsl(var(--destructive))" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>¿Eliminar cliente?</h3>
                        <p style={{ color: 'hsl(var(--secondary-foreground))', marginBottom: '2rem' }}>
                            Esta acción no se puede deshacer. Si el cliente tiene ventas o pagos registrados, no se podrá eliminar.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--secondary))', borderRadius: '12px' }} onClick={() => setDeleteId(null)}>Cancelar</button>
                            <button className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--destructive))', color: 'white', borderRadius: '12px' }} onClick={confirmDelete}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <CustomerModal
                    customer={editingCustomer}
                    isSaving={isSaving}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingCustomer(null)
                    }}
                    onSave={handleSave}
                />
            )}

            {/* Header with Title and Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>Cartera de Clientes</h1>
                    <p style={{ opacity: 0.5, fontWeight: '500' }}>Gestión de perfiles y estados de cuenta</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn" onClick={fetchCustomers} disabled={loading} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn" onClick={handleExportCSV} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }} title="Exportar CSV">
                        <Download size={20} />
                    </button>
                    <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={() => setIsModalOpen(true)} style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', fontWeight: '800', gap: '0.5rem' }}>
                        <Plus size={20} /> NUEVO CLIENTE
                    </button>
                </div>
            </div>

            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                        <Users size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Clientes</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--foreground))', lineHeight: 1 }}>{metrics.total}</p>
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
                        <DollarSign size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deuda Total</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--foreground))', lineHeight: 1 }}>${metrics.totalDebt.toFixed(2)}</p>
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', backgroundColor: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 36%)' }}>
                        <UserCheck size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activos / Inactivos</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--foreground))', lineHeight: 1 }}>{metrics.active} / <span style={{ opacity: 0.4 }}>{metrics.inactive}</span></p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'hsl(var(--background))' }}>
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', backgroundColor: 'white', padding: '0.5rem', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)' }}>
                    <Search size={22} style={{ marginLeft: '1rem', opacity: 0.4 }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, NIT o teléfono..."
                        style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem', padding: '0.5rem' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {error && (
                    <div style={{ padding: '1rem', borderRadius: '12px', marginBottom: '2rem', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertTriangle size={20} />
                        <p style={{ margin: 0, fontWeight: '600' }}>{error}</p>
                    </div>
                )}

                {loading && customers.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <RefreshCw size={48} className="animate-spin" style={{ color: 'hsl(var(--primary))', opacity: 0.5 }} />
                    </div>
                ) : customers.length === 0 ? (
                    <div style={{ padding: '6rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                        <Users size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.2 }} />
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'hsl(var(--foreground))', marginBottom: '0.5rem' }}>No hay clientes</h3>
                        <p style={{ maxWidth: '400px', margin: '0 auto' }}>Registra tus clientes para habilitar ventas personalizadas, créditos y seguimiento de cuentas.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                            <thead>
                                <tr style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Cliente</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Identificación</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Estado</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Deuda</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map(customer => (
                                    <tr
                                        key={customer.id}
                                        style={{
                                            backgroundColor: 'white',
                                            transition: 'all 0.2s',
                                        }}
                                        className="hover:bg-secondary/20"
                                    >
                                        <td style={{ padding: '1rem', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px', border: '1px solid hsl(var(--border) / 0.3)', borderRight: 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{
                                                    width: '40px', height: '40px',
                                                    borderRadius: '10px',
                                                    backgroundColor: `hsl(${customer.active ? 'var(--primary)' : 'var(--muted)'} / 0.1)`,
                                                    color: customer.active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '1rem', fontWeight: '800'
                                                }}>
                                                    {customer.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{customer.name}</div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{customer.phone || 'Sin teléfono'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', border: '1px solid hsl(var(--border) / 0.3)', borderLeft: 'none', borderRight: 'none' }}>
                                            <span style={{ fontFamily: 'monospace', fontWeight: '600', opacity: 0.7 }}>{customer.tax_id || 'N/A'}</span>
                                        </td>
                                        <td style={{ padding: '1rem', border: '1px solid hsl(var(--border) / 0.3)', borderLeft: 'none', borderRight: 'none' }}>
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '99px',
                                                backgroundColor: customer.active ? 'hsl(142 76% 36% / 0.1)' : 'hsl(0 0% 50% / 0.1)',
                                                color: customer.active ? 'hsl(142 76% 36%)' : 'hsl(0 0% 50%)'
                                            }}>
                                                {customer.active ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', border: '1px solid hsl(var(--border) / 0.3)', borderLeft: 'none', borderRight: 'none' }}>
                                            <div style={{ fontWeight: '900', color: (customer.current_balance || 0) > 0 ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)' }}>
                                                ${(customer.current_balance || 0).toFixed(2)}
                                            </div>
                                            <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>Límite: ${(customer.credit_limit || 0).toFixed(2)}</div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', borderTopRightRadius: '12px', borderBottomRightRadius: '12px', border: '1px solid hsl(var(--border) / 0.3)', borderLeft: 'none' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                                <button
                                                    onClick={() => setPayingCustomer(customer)}
                                                    className="btn btn-primary"
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '8px', fontWeight: '800' }}
                                                    title="Abonar Pago"
                                                >
                                                    <HandCoins size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setViewingLedgerCustomer(customer)}
                                                    className="btn"
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '8px', backgroundColor: 'white', border: '1px solid hsl(var(--border))' }}
                                                    title="Ver Historial"
                                                >
                                                    <TrendingUp size={14} />
                                                </button>
                                                <div style={{ width: '1px', height: '24px', backgroundColor: 'hsl(var(--border))', margin: '0 0.2rem' }}></div>
                                                <button
                                                    onClick={() => { setEditingCustomer(customer); setIsModalOpen(true); }}
                                                    className="btn"
                                                    style={{ padding: '0.4rem', color: 'hsl(var(--muted-foreground))' }}
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteId(customer.id)}
                                                    className="btn"
                                                    style={{ padding: '0.4rem', color: 'hsl(var(--destructive))' }}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {
                payingCustomer && (
                    <CustomerPaymentsModal
                        customer={payingCustomer}
                        isSaving={isSaving}
                        onClose={() => setPayingCustomer(null)}
                        onSave={handleSavePayment}
                    />
                )
            }

            {
                viewingLedgerCustomer && (
                    <CustomerLedgerDrawer
                        customer={viewingLedgerCustomer}
                        onClose={() => setViewingLedgerCustomer(null)}
                    />
                )
            }
        </div>
    )
}
