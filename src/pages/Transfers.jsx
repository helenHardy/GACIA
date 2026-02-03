import React, { useState, useEffect } from 'react'
import { Plus, Search, ArrowRight, RefreshCw, AlertTriangle, Clock, CheckCircle, Ship, XCircle, ChevronRight, X, Trash2, Eye, Edit2, Box, ArrowLeftRight, Truck, MapPin, Calendar, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import TransferModal from '../components/inventory/TransferModal'
import TransferDetailModal from '../components/inventory/TransferDetailModal'

export default function Transfers() {
    const [transfers, setTransfers] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [isReadOnly, setIsReadOnly] = useState(false)
    const [editingTransfer, setEditingTransfer] = useState(null)

    // Toast state
    const [toast, setToast] = useState(null)

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [viewingTransfer, setViewingTransfer] = useState(null)

    const [stats, setStats] = useState({
        pending: 0,
        inTransit: 0,
        received: 0
    })

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [toast])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
    }

    useEffect(() => {
        checkUserRole()
        fetchTransfers()
    }, [])

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            setIsAdmin(data?.role === 'Administrador')
        }
    }

    const [userBranchIds, setUserBranchIds] = useState([])

    // ... (existing state) ...

    async function fetchTransfers() {
        try {
            setLoading(true)
            setError(null)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            const isUserAdmin = profile?.role === 'Administrador'

            let query = supabase
                .from('transfers')
                .select(`
                    *,
                    origin:origin_branch_id (name),
                    destination:destination_branch_id (name),
                    sender:profiles!fk_transfers_sender (full_name),
                    receiver:profiles!fk_transfers_receiver (full_name)
                `)
                .order('created_at', { ascending: false })

            // Fetch branches regardless of admin status to control UI buttons
            const { data: assignments } = await supabase
                .from('user_branches')
                .select('branch_id')
                .eq('user_id', user.id)

            const assignedIds = assignments?.map(a => a.branch_id) || []
            setUserBranchIds(assignedIds)

            if (!isUserAdmin) {
                if (assignedIds.length > 0) {
                    // Filter where either origin or destination is in assigned branches
                    query = query.or(`origin_branch_id.in.(${assignedIds.join(',')}),destination_branch_id.in.(${assignedIds.join(',')})`)
                } else {
                    setTransfers([])
                    setStats({ pending: 0, inTransit: 0, received: 0 })
                    setLoading(false)
                    return
                }
            }

            const { data, error } = await query

            if (error) throw error
            setTransfers(data || [])
            calculateStats(data || [])
        } catch (err) {
            console.error('Error fetching transfers:', err)
            setError('Error al cargar el historial de traspasos.')
        } finally {
            setLoading(false)
        }
    }

    const calculateStats = (data) => {
        setStats({
            pending: data.filter(t => t.status === 'Pendiente').length,
            inTransit: data.filter(t => t.status === 'Enviado').length,
            received: data.filter(t => t.status === 'Recibido').length
        })
    }

    const handleSave = async (transferData) => {
        try {
            setIsSaving(true)
            const { items, ...header } = transferData
            const { data: { user } } = await supabase.auth.getUser()

            let targetTransferId = null

            if (editingTransfer) {
                targetTransferId = editingTransfer.id
                // Delete old items
                const { error: delError } = await supabase
                    .from('transfer_items')
                    .delete()
                    .eq('transfer_id', targetTransferId)
                if (delError) throw delError

                // Update header
                const { error: upError } = await supabase
                    .from('transfers')
                    .update({
                        origin_branch_id: header.origin_branch_id,
                        destination_branch_id: header.destination_branch_id,
                        // we keep status/sender/etc as they were or update if needed
                    })
                    .eq('id', targetTransferId)
                if (upError) throw upError
            } else {
                const { data: transfer, error: tError } = await supabase
                    .from('transfers')
                    .insert([{ ...header, sent_by: user?.id }])
                    .select()
                    .single()
                if (tError) throw tError
                targetTransferId = transfer.id
            }

            const itemsToSave = items.map(item => ({
                transfer_id: targetTransferId,
                product_id: item.product_id,
                quantity: item.quantity
            }))

            const { error: itemsError } = await supabase
                .from('transfer_items')
                .insert(itemsToSave)

            if (itemsError) throw itemsError

            setIsModalOpen(false)
            setEditingTransfer(null)
            fetchTransfers()
            showToast(editingTransfer ? 'Traspaso actualizado correctamente.' : 'Solicitud de traspaso creada con éxito.')
        } catch (err) {
            console.error('Error saving transfer:', err)
            showToast('Error al procesar el traspaso: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleEdit = async (t, forceReadOnly = false) => {
        try {
            setLoading(true)
            const { data: items, error } = await supabase
                .from('transfer_items')
                .select('*, products(name, sku)')
                .eq('transfer_id', t.id)

            if (error) throw error

            const formattedItems = items.map(i => ({
                product_id: i.product_id,
                name: i.products?.name,
                sku: i.products?.sku,
                display_quantity: i.quantity,
                unit_type: 'UNIDAD',
                units_per_box: 1
            }))

            setEditingTransfer({
                ...t,
                items: formattedItems
            })
            setIsReadOnly(forceReadOnly || (!isAdmin && !t.can_edit))
            setIsModalOpen(true)
        } catch (err) {
            console.error(err)
            alert('Error al cargar detalles del traspaso')
        } finally {
            setLoading(false)
        }
    }

    async function togglePermission(id, field, currentValue) {
        try {
            const { error } = await supabase
                .from('transfers')
                .update({ [field]: !currentValue })
                .eq('id', id)

            if (error) throw error

            // Update local state
            setTransfers(prev => prev.map(t => t.id === id ? { ...t, [field]: !currentValue } : t))
        } catch (err) {
            console.error('Error toggling permission:', err)
            showToast('Error al actualizar permisos', 'error')
        }
    }

    const updateStatus = async (id, newStatus) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const updateData = { status: newStatus }
            if (newStatus === 'Recibido') {
                updateData.received_by = user?.id
            }

            const { error } = await supabase
                .from('transfers')
                .update(updateData)
                .eq('id', id)

            if (error) throw error
            fetchTransfers()
            showToast(`Estado actualizado a: ${newStatus}`)
        } catch (err) {
            console.error('Error updating status:', err)
            showToast('Error: ' + err.message, 'error')
        }
    }

    const handleDelete = async (t) => {
        if (!window.confirm(`¿Estás seguro de ELIMINAR el traspaso #${t.transfer_number}?`)) return

        try {
            setLoading(true)
            const { error } = await supabase
                .from('transfers')
                .delete()
                .eq('id', t.id)

            if (error) throw error
            showToast('Traspaso eliminado correctamente.')
            fetchTransfers()
        } catch (err) {
            console.error(err)
            showToast('Error al eliminar: ' + err.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const getStatusConfig = (status) => {
        switch (status) {
            case 'Pendiente': return { bg: 'hsl(var(--secondary) / 0.5)', text: 'hsl(var(--secondary-foreground))', icon: <Clock size={12} /> }
            case 'Enviado': return { bg: 'hsl(var(--primary) / 0.1)', text: 'hsl(var(--primary))', icon: <Truck size={12} /> }
            case 'Recibido': return { bg: 'hsl(142 76% 36% / 0.1)', text: 'hsl(142 76% 36%)', icon: <CheckCircle size={12} /> }
            case 'Cancelado': return { bg: 'hsl(var(--destructive) / 0.1)', text: 'hsl(var(--destructive))', icon: <XCircle size={12} /> }
            default: return { bg: 'hsl(var(--secondary))', text: 'hsl(var(--secondary-foreground))', icon: <Clock size={12} /> }
        }
    }

    const filteredTransfers = transfers.filter(t =>
        t.transfer_number?.toString().includes(searchTerm) ||
        t.id.toString().includes(searchTerm) ||
        t.origin?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.destination?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ padding: '0.5rem' }}>
            {/* Custom Toast */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    backgroundColor: toast.type === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                    color: 'white',
                    padding: '1rem 2rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    zIndex: 1000,
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    {toast.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    <span style={{ fontWeight: '600' }}>{toast.message}</span>
                </div>
            )}

            {isModalOpen && (
                <TransferModal
                    isSaving={isSaving}
                    initialData={editingTransfer}
                    readOnly={isReadOnly}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingTransfer(null)
                    }}
                    onSave={handleSave}
                />
            )}

            {viewingTransfer && (
                <TransferDetailModal
                    transfer={viewingTransfer}
                    onClose={() => setViewingTransfer(null)}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Traslados Logísticos</h1>
                    <p style={{ color: 'hsl(var(--secondary-foreground) / 0.6)', fontWeight: '500' }}>Control y distribución de mercadería entre sucursales</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        className="btn shadow-sm"
                        onClick={fetchTransfers}
                        disabled={loading}
                        style={{ backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: '12px', padding: '0.75rem' }}
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        className="btn btn-primary shadow-lg shadow-primary/20"
                        onClick={() => setIsModalOpen(true)}
                        style={{ borderRadius: '12px', padding: '0.75rem 1.5rem', fontWeight: '700', gap: '0.5rem' }}
                    >
                        <Plus size={22} />
                        Nuevo Traspaso
                    </button>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', borderRadius: '10px' }}>
                            <Clock size={18} />
                        </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'hsl(var(--secondary-foreground) / 0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>En Espera</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0.2rem 0' }}>{stats.pending} <span style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5 }}>solicitudes</span></h3>
                </div>

                <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid hsl(var(--primary) / 0.2)', backgroundColor: 'hsl(var(--primary) / 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '10px' }}>
                            <Truck size={18} />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.1)', padding: '2px 8px', borderRadius: '99px', alignSelf: 'center' }}>EN CAMINO</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'hsl(var(--secondary-foreground) / 0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>En Tránsito</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0.2rem 0' }}>{stats.inTransit} <span style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5 }}>cargamentos</span></h3>
                </div>

                <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid hsl(142 76% 36% / 0.2)', backgroundColor: 'hsl(142 76% 36% / 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 36%)', borderRadius: '10px' }}>
                            <CheckCircle size={18} />
                        </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'hsl(var(--secondary-foreground) / 0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Completados</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0.2rem 0' }}>{stats.received} <span style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5 }}>recepciones</span></h3>
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                    <input
                        type="text"
                        placeholder="Buscar por # de orden, sucursal de origen o destino..."
                        className="btn"
                        style={{
                            width: '100%',
                            padding: '0.85rem 1.25rem 0.85rem 3rem',
                            backgroundColor: 'hsl(var(--secondary) / 0.3)',
                            borderRadius: '14px',
                            cursor: 'text',
                            justifyContent: 'flex-start',
                            border: '1px solid hsl(var(--border) / 0.5)',
                            fontSize: '0.9rem'
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.5rem' }}>
                {loading && transfers.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '6rem' }}>
                        <RefreshCw size={48} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.3 }} />
                        <p style={{ marginTop: '1rem', fontWeight: '600', opacity: 0.3 }}>Cargando logística...</p>
                    </div>
                ) : filteredTransfers.length === 0 ? (
                    <div className="card" style={{ gridColumn: '1 / -1', padding: '6rem', textAlign: 'center', border: '2px dashed hsl(var(--border))', borderRadius: '24px' }}>
                        <Truck size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.1 }} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'hsl(var(--foreground))', opacity: 0.4 }}>Sin historial logístico</h3>
                        <p style={{ opacity: 0.4 }}>Capture un nuevo traspaso para ver el flujo aquí.</p>
                    </div>
                ) : (
                    filteredTransfers.map(t => {
                        const config = getStatusConfig(t.status)
                        return (
                            <div key={t.id} className="card shadow-sm" style={{ padding: 0, borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.6)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {/* Card Header */}
                                <div style={{ padding: '1.25rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '0.85rem', color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.08)', padding: '3px 8px', borderRadius: '6px' }}>
                                            #{t.transfer_number || t.id.slice(0, 8)}
                                        </span>
                                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                            {/* Admin: Permissions Control */}
                                            {isAdmin && (
                                                <div style={{ display: 'flex', gap: '0.25rem', marginRight: '0.5rem', backgroundColor: 'white', padding: '2px', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.3)' }}>
                                                    <button
                                                        onClick={() => togglePermission(t.id, 'can_edit', t.can_edit)}
                                                        title={t.can_edit ? "Bloquear Edición" : "Habilitar Edición"}
                                                        style={{
                                                            padding: '4px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            backgroundColor: t.can_edit ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                                                            color: t.can_edit ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.3)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => togglePermission(t.id, 'can_void', t.can_void)}
                                                        title={t.can_void ? "Bloquear Anulación" : "Habilitar Anulación"}
                                                        style={{
                                                            padding: '4px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            backgroundColor: t.can_void ? 'hsl(var(--destructive) / 0.15)' : 'transparent',
                                                            color: t.can_void ? 'hsl(var(--destructive))' : 'hsl(var(--foreground) / 0.3)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}

                                            <button onClick={() => setViewingTransfer(t)} style={{ padding: '0.4rem', borderRadius: '8px', border: 'none', backgroundColor: 'white', color: 'hsl(var(--foreground))', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} title="Ver Detalle"><Eye size={14} /></button>

                                            {(isAdmin || t.can_edit) ? (
                                                <button onClick={() => handleEdit(t, false)} style={{ padding: '0.4rem', borderRadius: '8px', border: 'none', backgroundColor: 'hsl(var(--primary) / 0.05)', color: 'hsl(var(--primary))', cursor: 'pointer' }} title="Modificar"><Edit2 size={14} /></button>
                                            ) : (
                                                <button onClick={() => handleEdit(t, true)} style={{ padding: '0.4rem', borderRadius: '8px', border: 'none', backgroundColor: 'hsl(var(--secondary) / 0.4)', color: 'hsl(var(--foreground) / 0.4)' }} title="Ver Lectura"><Edit2 size={14} opacity={0.5} /></button>
                                            )}

                                            {(isAdmin || t.can_void) && (
                                                <button onClick={() => handleDelete(t)} style={{ padding: '0.4rem', borderRadius: '8px', border: 'none', backgroundColor: 'hsl(var(--destructive) / 0.05)', color: 'hsl(var(--destructive))', cursor: 'pointer' }} title="Eliminar"><Trash2 size={14} /></button>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.75rem',
                                        fontWeight: '800',
                                        padding: '4px 10px',
                                        borderRadius: '99px',
                                        backgroundColor: config.bg,
                                        color: config.text,
                                        textTransform: 'uppercase'
                                    }}>
                                        {config.icon}
                                        {t.status}
                                    </div>
                                </div>

                                {/* Logistic Flow Area */}
                                <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'hsl(var(--secondary) / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem' }}>
                                            <MapPin size={18} opacity={0.5} />
                                        </div>
                                        <p style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Origen</p>
                                        <p style={{ fontWeight: '800', fontSize: '0.95rem', margin: 0 }}>{t.origin?.name}</p>
                                    </div>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                                        <div style={{ width: '100%', height: '2px', backgroundColor: 'hsl(var(--border) / 0.5)', position: 'relative' }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: '-9px',
                                                left: t.status === 'Pendiente' ? '0%' : (t.status === 'Enviado' ? '50%' : '100%'),
                                                transform: 'translateX(-50%)',
                                                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                                color: t.status === 'Recibido' ? 'hsl(142 76% 36%)' : 'hsl(var(--primary))'
                                            }}>
                                                {t.status === 'Recibido' ? <CheckCircle size={20} fill="white" /> : <Truck size={20} fill="white" />}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.6rem', fontWeight: '800', opacity: 0.3, letterSpacing: '0.05em' }}>TRÁNSITO</span>
                                    </div>

                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'hsl(var(--primary) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', color: 'hsl(var(--primary))' }}>
                                            <MapPin size={18} />
                                        </div>
                                        <p style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Destino</p>
                                        <p style={{ fontWeight: '800', fontSize: '0.95rem', margin: 0 }}>{t.destination?.name}</p>
                                    </div>
                                </div>

                                {/* Details Footer */}
                                <div style={{ padding: '1rem 1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.05)', borderTop: '1px solid hsl(var(--border) / 0.3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                            <Calendar size={14} opacity={0.4} />
                                            <span style={{ opacity: 0.6 }}>Fecha:</span>
                                            <span style={{ fontWeight: '700' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                            <User size={14} opacity={0.4} />
                                            <span style={{ opacity: 0.6 }}>Enviado:</span>
                                            <span style={{ fontWeight: '700' }}>{t.sender?.full_name?.split(' ')[0] || 'Sistema'}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: '1px solid hsl(var(--border) / 0.3)', paddingLeft: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                            <Box size={14} opacity={0.4} />
                                            <span style={{ opacity: 0.6 }}>Items:</span>
                                            <span style={{ fontWeight: '700' }}>Cargando... </span> {/* Podría optimizarse trayendo el count en la query principal */}
                                        </div>
                                        {t.receiver && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                                <User size={14} opacity={0.4} />
                                                <span style={{ opacity: 0.6 }}>Recibido:</span>
                                                <span style={{ fontWeight: '700' }}>{t.receiver?.full_name?.split(' ')[0]}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Bar */}
                                <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem' }}>
                                    {/* Action: PROCESS SEND (Origin Branch Only) */}
                                    {t.status === 'Pendiente' && (isAdmin || userBranchIds.includes(t.origin_branch_id)) && (
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1, borderRadius: '12px', padding: '0.7rem', fontWeight: '800', gap: '0.6rem', fontSize: '0.85rem' }}
                                            onClick={() => updateStatus(t.id, 'Enviado')}
                                        >
                                            <Truck size={18} />
                                            PROCESAR ENVÍO
                                        </button>
                                    )}

                                    {/* Action: CONFIRM RECEPTION (Destination Branch Only) */}
                                    {t.status === 'Enviado' && (isAdmin || userBranchIds.includes(t.destination_branch_id)) && (
                                        <button
                                            className="btn"
                                            style={{ flex: 1, backgroundColor: 'hsl(142 76% 36%)', color: 'white', borderRadius: '12px', padding: '0.7rem', fontWeight: '800', gap: '0.6rem', fontSize: '0.85rem' }}
                                            onClick={() => updateStatus(t.id, 'Recibido')}
                                        >
                                            <CheckCircle size={18} />
                                            CONFIRMAR RECEPCIÓN
                                        </button>
                                    )}

                                    {/* Action: CANCEL (Origin Branch Only) */}
                                    {(t.status === 'Pendiente' || t.status === 'Enviado') && (isAdmin || userBranchIds.includes(t.origin_branch_id)) && (
                                        <button
                                            className="btn"
                                            style={{ borderRadius: '12px', padding: '0.7rem', width: '50px', backgroundColor: 'hsl(var(--destructive) / 0.05)', color: 'hsl(var(--destructive))' }}
                                            onClick={() => updateStatus(t.id, 'Cancelado')}
                                            title="Cancelar"
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
