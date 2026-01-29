import React, { useState, useEffect } from 'react'
import { Plus, Search, Truck, Edit2, Trash2, RefreshCw, AlertTriangle, Phone, Mail, MapPin, X, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SupplierModal from '../components/suppliers/SupplierModal'

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingSupplier, setEditingSupplier] = useState(null)

    useEffect(() => {
        fetchSuppliers()
    }, [])

    async function fetchSuppliers() {
        try {
            setLoading(true)
            setError(null)
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .order('name')

            if (error) throw error
            setSuppliers(data || [])
        } catch (err) {
            console.error('Error fetching suppliers:', err)
            setError('Error al cargar la lista de proveedores.')
        } finally {
            setLoading(false)
        }
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
            if (editingSupplier) {
                const { error } = await supabase
                    .from('suppliers')
                    .update(formData)
                    .eq('id', editingSupplier.id)
                if (error) throw error
                showToast('Proveedor actualizado correctamente')
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert([formData])
                if (error) throw error
                showToast('Proveedor registrado correctamente')
            }
            setIsModalOpen(false)
            setEditingSupplier(null)
            fetchSuppliers()
        } catch (err) {
            console.error('Error saving supplier:', err)
            showToast('Error al guardar el proveedor', 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const confirmDelete = async () => {
        if (!deleteId) return
        try {
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .eq('id', deleteId)
            if (error) throw error
            showToast('Proveedor eliminado correctamente')
            fetchSuppliers()
        } catch (err) {
            console.error('Error deleting supplier:', err)
            showToast('Error al eliminar el proveedor', 'error')
        } finally {
            setDeleteId(null)
        }
    }

    const filteredSuppliers = suppliers.filter(s =>
        (s.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (s.contact_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ position: 'relative', paddingBottom: '2rem' }}>
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
                    <div className="card" style={{ width: '400px', maxWidth: '90vw', padding: '2rem', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: 'hsl(var(--destructive) / 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <Trash2 size={32} color="hsl(var(--destructive))" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>¿Eliminar proveedor?</h3>
                        <p style={{ color: 'hsl(var(--secondary-foreground))', marginBottom: '2rem' }}>
                            Esta acción no se puede deshacer. Se perderán los datos de contacto y el historial asociado podría verse afectado.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--secondary))' }} onClick={() => setDeleteId(null)}>Cancelar</button>
                            <button className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--destructive))', color: 'white' }} onClick={confirmDelete}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <SupplierModal
                    supplier={editingSupplier}
                    isSaving={isSaving}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingSupplier(null)
                    }}
                    onSave={handleSave}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Proveedores</h1>
                    <p style={{ color: 'hsl(var(--secondary-foreground))' }}>Directorio de abastecimiento y contactos</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn"
                        onClick={fetchSuppliers}
                        disabled={loading}
                        style={{ backgroundColor: 'hsl(var(--secondary))' }}
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus size={20} style={{ marginRight: '0.5rem' }} />
                        Nuevo Proveedor
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', padding: '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o contacto..."
                        className="btn"
                        style={{
                            width: '100%',
                            paddingLeft: '2.5rem',
                            backgroundColor: 'hsl(var(--secondary))',
                            cursor: 'text',
                            justifyContent: 'flex-start'
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <div className="card" style={{ marginBottom: '2rem', borderColor: 'hsl(var(--destructive))', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertTriangle size={20} />
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {loading && suppliers.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <RefreshCw size={48} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                </div>
            ) : suppliers.length === 0 ? (
                <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'hsl(var(--secondary-foreground))' }}>
                    <Truck size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.2 }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'semibold', color: 'hsl(var(--foreground))' }}>No hay proveedores</h3>
                    <p>Registra tus proveedores para comenzar a gestionar el abastecimiento.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                    {filteredSuppliers.map(supplier => (
                        <div
                            key={supplier.id}
                            className="card supplier-card"
                            style={{
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.2s',
                                border: '1px solid hsl(var(--border))'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)'
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                                e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.3)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none'
                                e.currentTarget.style.boxShadow = 'none'
                                e.currentTarget.style.borderColor = 'hsl(var(--border))'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: 'var(--radius)' }}>
                                        <Truck size={24} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>{supplier.name}</h3>
                                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--secondary-foreground))' }}>Ref: {supplier.tax_id || 'N/A'}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className="btn"
                                        style={{ padding: '0.5rem', color: 'hsl(var(--secondary-foreground))' }}
                                        onClick={() => {
                                            setEditingSupplier(supplier)
                                            setIsModalOpen(true)
                                        }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        className="btn"
                                        style={{ padding: '0.5rem', color: 'hsl(var(--destructive))' }}
                                        onClick={() => setDeleteId(supplier.id)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                                {supplier.contact_name && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <User size={16} style={{ color: 'hsl(var(--secondary-foreground))' }} />
                                        <span>{supplier.contact_name}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Phone size={16} style={{ color: 'hsl(var(--secondary-foreground))' }} />
                                    <span>{supplier.phone || 'Sin teléfono'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Mail size={16} style={{ color: 'hsl(var(--secondary-foreground))' }} />
                                    <span>{supplier.email || 'Sin correo'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                                    <MapPin size={16} style={{ color: 'hsl(var(--secondary-foreground))', marginTop: '0.125rem' }} />
                                    <span style={{ fontSize: '0.75rem' }}>{supplier.address || 'Sin dirección'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
