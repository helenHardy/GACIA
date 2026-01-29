import React, { useState, useEffect } from 'react'
import { Plus, MapPin, Phone, Edit2, Trash2, Building2, RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import BranchModal from '../components/inventory/BranchModal'

export default function Branches() {
    const [branches, setBranches] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingBranch, setEditingBranch] = useState(null)

    useEffect(() => {
        fetchBranches()
    }, [])

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                    {branches.map(branch => (
                        <div key={branch.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '4px',
                                height: '100%',
                                backgroundColor: branch.active ? 'hsl(142 76% 36%)' : 'hsl(var(--secondary))'
                            }} />

                            <div style={{ paddingLeft: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            padding: '0.5rem',
                                            borderRadius: 'var(--radius)',
                                            backgroundColor: 'hsl(var(--secondary))',
                                            color: 'hsl(var(--foreground))'
                                        }}>
                                            <Building2 size={24} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{branch.name}</h3>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '999px',
                                                backgroundColor: branch.active ? 'hsl(142 76% 36% / 0.1)' : 'hsl(var(--secondary))',
                                                color: branch.active ? 'hsl(142 76% 36%)' : 'hsl(var(--secondary-foreground))'
                                            }}>
                                                {branch.active ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className="btn"
                                            style={{ padding: '0.5rem', color: 'hsl(var(--secondary-foreground))' }}
                                            onClick={() => {
                                                setEditingBranch(branch)
                                                setIsModalOpen(true)
                                            }}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="btn"
                                            style={{ padding: '0.5rem', color: 'hsl(var(--destructive))' }}
                                            onClick={() => handleDelete(branch.id)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'hsl(var(--secondary-foreground))' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <MapPin size={16} />
                                        <span>{branch.address || 'Sin dirección'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Phone size={16} />
                                        <span>{branch.phone || 'Sin teléfono'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
