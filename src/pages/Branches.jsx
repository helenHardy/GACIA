import React, { useState, useEffect } from 'react'
import { Plus, MapPin, Phone, Edit2, Trash2, Building2, RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import BranchModal from '../components/inventory/BranchModal'
//jhjhjh
export default function Branches() {
    const [branches, setBranches] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingBranch, setEditingBranch] = useState(null)
    const [defaultBranchId, setDefaultBranchId] = useState(null)

    useEffect(() => {
        fetchBranches()
        fetchDefaultBranch()
    }, [])

    async function fetchDefaultBranch() {
        const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'default_purchase_branch')
            .maybeSingle()
        if (data) setDefaultBranchId(data.value)
    }

    async function setDefaultBranch(id) {
        try {
            const { error } = await supabase
                .from('settings')
                .upsert({ 
                    key: 'default_purchase_branch', 
                    value: id.toString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })
            if (error) throw error
            setDefaultBranchId(id.toString())
        } catch (err) {
            console.error('Error setting default branch:', err)
            alert('Error al establecer la sucursal por defecto.')
        }
    }

    async function fetchBranches() {
        try {
            setLoading(true)
            setError(null)
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .order('name')

            if (error) throw error
            setBranches(data || [])
        } catch (err) {
            console.error('Error fetching branches:', err)
            setError('Error al cargar las sucursales.')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (formData) => {
        try {
            setIsSaving(true)
            if (editingBranch) {
                const { error } = await supabase
                    .from('branches')
                    .update(formData)
                    .eq('id', editingBranch.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('branches')
                    .insert([formData])
                if (error) throw error
            }
            setIsModalOpen(false)
            setEditingBranch(null)
            fetchBranches()
        } catch (err) {
            console.error('Error saving branch:', err)
            alert('Error al guardar la sucursal')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta sucursal?')) return
        try {
            const { error } = await supabase
                .from('branches')
                .delete()
                .eq('id', id)
            if (error) throw error
            fetchBranches()
        } catch (err) {
            console.error('Error deleting branch:', err)
            alert('Error al eliminar la sucursal')
        }
    }

    return (
        <div>
            {isModalOpen && (
                <BranchModal
                    branch={editingBranch}
                    isSaving={isSaving}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingBranch(null)
                    }}
                    onSave={handleSave}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Sucursales</h1>
                    <p style={{ color: 'hsl(var(--secondary-foreground))' }}>Gestión de puntos de venta y almacenes</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn"
                        onClick={fetchBranches}
                        disabled={loading}
                        style={{ backgroundColor: 'hsl(var(--secondary))' }}
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus size={20} style={{ marginRight: '0.5rem' }} />
                        Nueva Sucursal
                    </button>
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

            {loading && branches.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <RefreshCw size={48} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                </div>
            ) : branches.length === 0 ? (
                <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'hsl(var(--secondary-foreground))' }}>
                    <Building2 size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.2 }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'semibold', color: 'hsl(var(--foreground))' }}>No hay sucursales</h3>
                    <p>Agrega tu primera sucursal para comenzar a gestionar tus puntos de venta.</p>
                </div>
            ) : (
            <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.6)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                        <tr>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Sucursal</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Ubicación / Contacto</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Estado</th>
                            <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {branches.map(branch => (
                            <tr key={branch.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '40px', height: '40px',
                                            borderRadius: '12px',
                                            backgroundColor: 'hsl(var(--secondary))',
                                            color: 'hsl(var(--foreground))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            overflow: 'hidden',
                                            border: '1px solid hsl(var(--border) / 0.5)'
                                        }}>
                                            {branch.logo_url ? (
                                                <img src={branch.logo_url} alt={branch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <Building2 size={20} style={{ opacity: 0.5 }} />
                                            )}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>{branch.name}</h3>
                                            {defaultBranchId === branch.id.toString() && (
                                                <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'hsl(var(--primary))', textTransform: 'uppercase' }}>Sucursal Principal</span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>
                                            <MapPin size={14} style={{ opacity: 0.5 }} />
                                            <span>{branch.address || 'Sin dirección'}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'hsl(var(--secondary-foreground) / 0.6)' }}>
                                            <Phone size={14} style={{ opacity: 0.5 }} />
                                            <span>{branch.phone || 'Sin teléfono'}</span>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem' }}>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: '800',
                                        padding: '4px 12px',
                                        borderRadius: '99px',
                                        backgroundColor: branch.active ? 'hsl(142 76% 36% / 0.1)' : 'hsl(var(--secondary))',
                                        color: branch.active ? 'hsl(142 76% 36%)' : 'hsl(var(--secondary-foreground))'
                                    }}>
                                        {branch.active ? 'ACTIVA' : 'INACTIVA'}
                                    </span>
                                </td>
                                <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        <button
                                            className="btn"
                                            title="Establecer como principal"
                                            style={{
                                                padding: '0.6rem',
                                                color: defaultBranchId === branch.id.toString() ? 'white' : 'hsl(var(--secondary-foreground) / 0.4)',
                                                backgroundColor: defaultBranchId === branch.id.toString() ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                                                borderRadius: '10px',
                                                border: 'none'
                                            }}
                                            onClick={() => setDefaultBranch(branch.id)}
                                        >
                                            <Building2 size={18} />
                                        </button>
                                        <button
                                            className="btn"
                                            style={{ padding: '0.6rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}
                                            onClick={() => {
                                                setEditingBranch(branch)
                                                setIsModalOpen(true)
                                            }}
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            className="btn"
                                            style={{ padding: '0.6rem', borderRadius: '10px', backgroundColor: 'hsl(var(--destructive) / 0.05)', color: 'hsl(var(--destructive))' }}
                                            onClick={() => handleDelete(branch.id)}
                                        >
                                            <Trash2 size={18} />
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
    )
}
