import React, { useState, useEffect } from 'react'
import { X, Save, Loader2, Shield, Building2, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function UserModal({ user, onClose, onSave, isSaving }) {
    const [branches, setBranches] = useState([])
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'Empleado',
        active: true,
        assigned_branches: [] // Array of branch IDs
    })

    useEffect(() => {
        async function fetchBranches() {
            const { data } = await supabase.from('branches').select('*').eq('active', true).order('name')
            setBranches(data || [])
        }
        fetchBranches()

        async function loadUserSpecificData() {
            if (user) {
                // Initialize form with User data but EMPTY branches first to prevent UI flickering/bleeding
                setFormData({
                    full_name: user.full_name || '',
                    email: user.email || '',
                    password: '',
                    role: user.role || 'Empleado',
                    active: user.active ?? true,
                    assigned_branches: []
                })

                // Then fetch the real branches
                const { data } = await supabase
                    .from('user_branches')
                    .select('branch_id')
                    .eq('user_id', user.id)

                const branchIds = data ? data.map(b => b.branch_id) : []

                setFormData(prev => ({
                    ...prev,
                    assigned_branches: branchIds
                }))
            } else {
                // Reset for new user
                setFormData({
                    full_name: '',
                    email: '',
                    password: '',
                    role: 'Empleado',
                    active: true,
                    assigned_branches: []
                })
            }
        }

        loadUserSpecificData()
    }, [user])



    const handleSubmit = (e) => {
        e.preventDefault()
        if (!user && (!formData.password || formData.password.length < 6)) {
            alert('La contraseña debe tener al menos 6 caracteres')
            return
        }
        onSave(formData)
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '0', overflow: 'hidden', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--muted) / 0.3)' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
                            {user ? 'Editar Miembro' : 'Nuevo Miembro'}
                        </h2>
                        <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem' }}>
                            {user ? 'Actualiza la información y permisos.' : 'Invita a un nuevo usuario al sistema.'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn"
                        style={{ padding: '0.5rem', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--muted-foreground))', backgroundColor: 'white', border: '1px solid hsl(var(--border))' }}
                        disabled={isSaving}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>Nombre Completo</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }} />
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej. Juan Pérez"
                                    className="btn"
                                    style={{
                                        width: '100%',
                                        paddingLeft: '2.75rem',
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        cursor: 'text',
                                        justifyContent: 'flex-start',
                                        fontWeight: '500'
                                    }}
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>Correo Electrónico</label>
                            <input
                                required
                                type="email"
                                placeholder="juan@empresa.com"
                                className="btn"
                                style={{
                                    width: '100%',
                                    backgroundColor: 'hsl(var(--background))',
                                    border: '1px solid hsl(var(--border))',
                                    cursor: 'text',
                                    justifyContent: 'flex-start',
                                    fontWeight: '500'
                                }}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        {!user && (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>Contraseña</label>
                                <input
                                    required
                                    type="password"
                                    placeholder="Mínimo 6 caracteres"
                                    className="btn"
                                    style={{
                                        width: '100%',
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        cursor: 'text',
                                        justifyContent: 'flex-start',
                                        fontFamily: 'monospace'
                                    }}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>Rol en el Sistema</label>
                            <div style={{ position: 'relative' }}>
                                <Shield size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }} />
                                <select
                                    className="btn"
                                    style={{
                                        width: '100%',
                                        paddingLeft: '2.75rem',
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        cursor: 'pointer',
                                        appearance: 'none'
                                    }}
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="Administrador">Administrador</option>
                                    <option value="Empleado">Empleado</option>
                                    <option value="Cajero">Cajero</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>Estado</label>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.65rem 1rem',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 'var(--radius)',
                                cursor: 'pointer',
                                backgroundColor: formData.active ? 'hsl(142 76% 36% / 0.05)' : 'hsl(var(--background))',
                                transition: 'all 0.2s'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={formData.active}
                                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'hsl(142 76% 36%)' }}
                                />
                                <span style={{ fontSize: '0.9rem', fontWeight: '500', color: formData.active ? 'hsl(142 76% 36%)' : 'hsl(var(--muted-foreground))' }}>
                                    {formData.active ? 'Acceso Habilitado' : 'Acceso Denegado'}
                                </span>
                            </label>
                        </div>
                    </div>

                    <div style={{ padding: '1.5rem', backgroundColor: 'hsl(var(--muted) / 0.3)', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.5)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <Building2 size={18} style={{ color: 'hsl(var(--primary))' }} />
                            <label style={{ fontSize: '0.9rem', fontWeight: '700', color: 'hsl(var(--foreground))' }}>Sucursales Asignadas</label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', maxHeight: '150px', overflowY: 'auto' }}>
                            {branches.map(b => (
                                <label
                                    key={b.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem',
                                        padding: '0.5rem 0.75rem',
                                        backgroundColor: formData.assigned_branches.includes(b.id) ? 'white' : 'transparent',
                                        borderRadius: '8px',
                                        border: formData.assigned_branches.includes(b.id) ? '1px solid hsl(var(--primary))' : '1px solid transparent',
                                        cursor: 'pointer',
                                        boxShadow: formData.assigned_branches.includes(b.id) ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                        transition: 'all 0.1s'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.assigned_branches.includes(b.id)}
                                        onChange={(e) => {
                                            const checked = e.target.checked
                                            setFormData(prev => ({
                                                ...prev,
                                                assigned_branches: checked
                                                    ? [...prev.assigned_branches, b.id]
                                                    : prev.assigned_branches.filter(id => id !== b.id)
                                            }))
                                        }}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'hsl(var(--primary))' }}
                                    />
                                    <span style={{ fontSize: '0.85rem', fontWeight: formData.assigned_branches.includes(b.id) ? '600' : '400', color: formData.assigned_branches.includes(b.id) ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>{b.name}</span>
                                </label>
                            ))}
                        </div>
                        {branches.length === 0 && (
                            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>No hay sucursales activas disponibles.</p>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ padding: '0.75rem 1.5rem', fontWeight: '600', backgroundColor: 'transparent', border: '1px solid hsl(var(--border))' }}>
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSaving}
                            style={{ padding: '0.75rem 2rem', gap: '0.5rem', fontWeight: '600', borderRadius: '10px', boxShadow: '0 4px 6px -1px hsl(var(--primary) / 0.3)' }}
                        >
                            {isSaving ? (
                                <><Loader2 size={20} className="animate-spin" /> Guardando...</>
                            ) : (
                                <><Save size={20} /> {user ? 'Guardar Cambios' : 'Crear Cuenta'}</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
