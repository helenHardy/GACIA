import React, { useState, useEffect } from 'react'
import { Plus, Search, User, Mail, Shield, MoreVertical, RefreshCw, AlertTriangle, Edit2, Trash2, X, CheckCircle, KeyRound, Lock, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import UserModal from '../components/users/UserModal'

export default function Users() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    // UI state
    const [toast, setToast] = useState(null)
    const [deleteId, setDeleteId] = useState(null)

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [isSaving, setIsSaving] = useState(false)

    // Password Reset state
    const [passwordModalUser, setPasswordModalUser] = useState(null)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [sqlModalOpen, setSqlModalOpen] = useState(false)
    const [copiedSql, setCopiedSql] = useState(false)

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
        fetchUsers()
    }, [])

    async function fetchUsers() {
        try {
            setLoading(true)
            setError(null)

            // Fetch profiles
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name')

            if (profilesError) throw profilesError

            // Fetch all user_branches with branch names
            const { data: assignments, error: assignmentsError } = await supabase
                .from('user_branches')
                .select('user_id, branches(name)')

            if (assignmentsError) throw assignmentsError

            // Merge data
            const profilesWithBranches = profiles.map(p => {
                const userAssignments = assignments?.filter(a => a.user_id === p.id) || []
                const branchNames = userAssignments.map(a => a.branches?.name).filter(Boolean)
                return {
                    ...p,
                    assigned_branches_names: branchNames
                }
            })

            setUsers(profilesWithBranches || [])
        } catch (err) {
            console.error('Error fetching users:', err)
            setError('Error al cargar los usuarios.')
        } finally {
            setLoading(false)
        }
    }

    const changeUserPassword = async (targetUserId, newPassword) => {
        if (!newPassword || newPassword.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres.')
        }

        const { error } = await supabase.rpc('admin_change_user_password', {
            target_user_id: targetUserId,
            new_password: newPassword
        })

        if (error) {
            if (error.code === 'PGRST202' || error.message?.includes('admin_change_user_password')) {
                setSqlModalOpen(true)
                throw new Error('Se requiere instalar una función SQL en Supabase para permitir a los administradores cambiar contraseñas.')
            }
            throw error
        }
    }

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault()
        if (!newPassword || newPassword.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres', 'error')
            return
        }
        if (newPassword !== confirmPassword) {
            showToast('Las contraseñas no coinciden', 'error')
            return
        }

        try {
            setIsChangingPassword(true)
            await changeUserPassword(passwordModalUser.id, newPassword)
            showToast(`Contraseña actualizada para ${passwordModalUser.full_name || 'el usuario'}`)
            setPasswordModalUser(null)
            setNewPassword('')
            setConfirmPassword('')
        } catch (err) {
            console.error('Error updating password:', err)
            showToast(err.message, 'error')
        } finally {
            setIsChangingPassword(false)
        }
    }

    const handleSave = async (formData) => {
        try {
            setIsSaving(true)
            let userId = null

            if (editingUser) {
                // Actualizar usuario existente (solo perfil)
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        full_name: formData.full_name,
                        role: formData.role,
                        active: formData.active
                    })
                    .eq('id', editingUser.id)

                if (error) throw error
                userId = editingUser.id

                // Si se proporcionó nueva contraseña al editar
                if (formData.password && formData.password.trim().length >= 6) {
                    try {
                        await changeUserPassword(editingUser.id, formData.password.trim())
                        showToast('Usuario y contraseña actualizados correctamente')
                    } catch (passErr) {
                        console.error('Error changing password:', passErr)
                        showToast('Perfil actualizado pero falló el cambio de contraseña: ' + passErr.message, 'error')
                    }
                } else {
                    showToast('Usuario actualizado correctamente')
                }
            } else {
                // Crear nuevo usuario (Auth + Perfil)
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.full_name,
                            role: formData.role
                        }
                    }
                })

                if (authError) throw authError

                if (authData.user) {
                    userId = authData.user.id
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: authData.user.id,
                            email: formData.email,
                            full_name: formData.full_name,
                            role: formData.role,
                            active: true
                        })

                    if (profileError) console.error('Error updating profile manually:', profileError)
                }

                showToast('Usuario creado correctamente. (Si se cerró tu sesión, vuelve a ingresar)')
            }

            // --- MANAGE BRANCH ASSIGNMENTS ---
            if (userId && formData.assigned_branches) {
                // 1. Delete existing assignments
                const { error: deleteError } = await supabase
                    .from('user_branches')
                    .delete()
                    .eq('user_id', userId)

                if (deleteError) {
                    console.error('Error removing old assignments:', deleteError)
                }

                // 2. Insert new assignments
                if (formData.assigned_branches.length > 0) {
                    const assignments = formData.assigned_branches.map(branchId => ({
                        user_id: userId,
                        branch_id: branchId
                    }))

                    const { error: insertError } = await supabase
                        .from('user_branches')
                        .insert(assignments)

                    if (insertError) throw insertError
                }
            }

            setIsModalOpen(false)
            setEditingUser(null)
            fetchUsers()
        } catch (err) {
            console.error('Error saving user:', err)
            showToast('Error al guardar el usuario: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const confirmDelete = async () => {
        if (!deleteId) return
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', deleteId)
            if (error) throw error
            showToast('Usuario eliminado correctamente')
            fetchUsers()
        } catch (err) {
            console.error('Error deleting user:', err)
            showToast('Error al eliminar el usuario.', 'error')
        } finally {
            setDeleteId(null)
        }
    }

    const [stats, setStats] = useState({ total: 0, active: 0, admins: 0 })

    useEffect(() => {
        if (users.length) {
            setStats({
                total: users.length,
                active: users.filter(u => u.active).length,
                admins: users.filter(u => u.role === 'Administrador').length
            })
        }
    }, [users])

    const filteredUsers = users.filter(u =>
        (u.full_name?.toLowerCase() || u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ padding: '0.5rem', maxWidth: '1600px', margin: '0 auto' }}>
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
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    {toast.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    <span style={{ fontWeight: '600' }}>{toast.message}</span>
                    <button onClick={() => setToast(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }}>
                        <X size={16} />
                    </button>
                    <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            {deleteId && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 150,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
                }}>
                    <div className="card" style={{ width: '400px', maxWidth: '90vw', padding: '2rem', textAlign: 'center', borderRadius: '16px', border: '1px solid hsl(var(--border))' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: 'hsl(var(--destructive) / 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'hsl(var(--destructive))' }}>
                            <Trash2 size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>¿Eliminar usuario?</h3>
                        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2rem', lineHeight: '1.5' }}>
                            Esta acción eliminará el acceso del usuario permanentemente.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--secondary))', fontWeight: '600' }} onClick={() => setDeleteId(null)}>Cancelar</button>
                            <button className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--destructive))', color: 'white', fontWeight: '600' }} onClick={confirmDelete}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>Equipo</h1>
                <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '1rem' }}>Gestiona los miembros de tu organización y sus permisos.</p>
            </div>

            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid hsl(var(--border) / 0.6)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                        <User size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Usuarios</p>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1 }}>{stats.total}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid hsl(var(--border) / 0.6)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 36%)' }}>
                        <CheckCircle size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activos</p>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1 }}>{stats.active}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid hsl(var(--border) / 0.6)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'hsl(262 83% 58% / 0.1)', color: 'hsl(262 83% 58%)' }}>
                        <Shield size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Administradores</p>
                        <h3 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1 }}>{stats.admins}</h3>
                    </div>
                </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="card" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '12px', flex: 1, maxWidth: '400px', border: '1px solid hsl(var(--border))' }}>
                    <Search size={20} style={{ marginLeft: '0.5rem', color: 'hsl(var(--muted-foreground))' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            fontSize: '0.95rem',
                            backgroundColor: 'transparent',
                            color: 'hsl(var(--foreground))'
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn"
                        onClick={fetchUsers}
                        disabled={loading}
                        style={{ backgroundColor: 'white', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', padding: '0.75rem', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                        title="Recargar lista"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        className="btn btn-primary shadow-lg shadow-primary/25"
                        onClick={() => {
                            setEditingUser(null)
                            setIsModalOpen(true)
                        }}
                        style={{ borderRadius: '12px', padding: '0.75rem 1.5rem', fontWeight: '600', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                    >
                        <Plus size={20} />
                        <span>Nuevo Miembro</span>
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="card" style={{ marginBottom: '2rem', borderColor: 'hsl(var(--destructive))', backgroundColor: 'hsl(var(--destructive) / 0.05)', color: 'hsl(var(--destructive))', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: '12px' }}>
                    <AlertTriangle size={24} />
                    <p style={{ fontWeight: '500' }}>{error}</p>
                </div>
            )}

            {/* Table Section */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.6)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', borderBottom: '1px solid hsl(var(--border))' }}>Usuario</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', borderBottom: '1px solid hsl(var(--border))' }}>Rol</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', borderBottom: '1px solid hsl(var(--border))' }}>Sucursales</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', borderBottom: '1px solid hsl(var(--border))' }}>Estado</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', borderBottom: '1px solid hsl(var(--border))', textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                            {loading && filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '4rem', textAlign: 'center' }}>
                                        <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.5 }} />
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                                        <User size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                                        <p style={{ fontSize: '1.1rem', fontWeight: '500' }}>No se encontraron usuarios</p>
                                        <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Intenta ajustar los filtros de búsqueda</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user, index) => (
                                    <tr key={user.id} className="hover-row" style={{ backgroundColor: 'white' }}>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{
                                                    width: '44px',
                                                    height: '44px',
                                                    background: `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)`,
                                                    color: 'white',
                                                    borderRadius: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: '700',
                                                    fontSize: '1.1rem',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}>
                                                    {user.full_name?.charAt(0).toUpperCase() || <User size={20} />}
                                                </div>
                                                <div>
                                                    <p style={{ fontWeight: '600', fontSize: '0.95rem', color: 'hsl(var(--foreground))' }}>{user.full_name || 'Sin nombre'}</p>
                                                    <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>{user.email || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '99px',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                backgroundColor: user.role === 'Administrador' ? 'hsl(262 83% 58% / 0.1)' : 'hsl(var(--primary) / 0.1)',
                                                color: user.role === 'Administrador' ? 'hsl(262 83% 58%)' : 'hsl(var(--primary))',
                                                letterSpacing: '0.02em',
                                                textTransform: 'uppercase'
                                            }}>
                                                {user.role === 'Administrador' ? <Shield size={12} /> : <User size={12} />}
                                                {user.role || 'Empleado'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                {user.assigned_branches_names && user.assigned_branches_names.length > 0
                                                    ? user.assigned_branches_names.map((branch, idx) => (
                                                        <span key={idx} style={{
                                                            padding: '0.2rem 0.6rem',
                                                            backgroundColor: 'hsl(var(--secondary))',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            color: 'hsl(var(--secondary-foreground))',
                                                            fontWeight: '500'
                                                        }}>
                                                            {branch}
                                                        </span>
                                                    ))
                                                    : <span style={{ color: 'hsl(var(--muted-foreground))', fontStyle: 'italic', fontSize: '0.85rem' }}>Sin asignación</span>
                                                }
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: user.active ? 'hsl(142 76% 36%)' : 'hsl(var(--muted-foreground))',
                                                    boxShadow: user.active ? '0 0 0 2px hsl(142 76% 36% / 0.2)' : 'none'
                                                }} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: '500', color: user.active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
                                                    {user.active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', opacity: 0.8 }} className="actions-cell">
                                                <button
                                                    className="btn"
                                                    style={{ padding: '0.5rem', borderRadius: '8px', color: 'hsl(var(--muted-foreground))', transition: 'all 0.2s', backgroundColor: 'transparent' }}
                                                    onClick={() => {
                                                        setPasswordModalUser(user)
                                                        setNewPassword('')
                                                        setConfirmPassword('')
                                                    }}
                                                    title="Cambiar Contraseña"
                                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(38 92% 50%)'; e.currentTarget.style.backgroundColor = 'hsl(38 92% 50% / 0.1)' }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.backgroundColor = 'transparent' }}
                                                >
                                                    <KeyRound size={18} />
                                                </button>
                                                <button
                                                    className="btn"
                                                    style={{ padding: '0.5rem', borderRadius: '8px', color: 'hsl(var(--muted-foreground))', transition: 'all 0.2s', backgroundColor: 'transparent' }}
                                                    onClick={() => {
                                                        setEditingUser(user)
                                                        setIsModalOpen(true)
                                                    }}
                                                    title="Editar"
                                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(var(--primary))'; e.currentTarget.style.backgroundColor = 'hsl(var(--primary) / 0.1)' }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.backgroundColor = 'transparent' }}
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    className="btn"
                                                    style={{ padding: '0.5rem', borderRadius: '8px', color: 'hsl(var(--muted-foreground))', transition: 'all 0.2s', backgroundColor: 'transparent' }}
                                                    onClick={() => setDeleteId(user.id)}
                                                    title="Eliminar"
                                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(var(--destructive))'; e.currentTarget.style.backgroundColor = 'hsl(var(--destructive) / 0.05)' }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; e.currentTarget.style.backgroundColor = 'transparent' }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <UserModal
                    user={editingUser}
                    isSaving={isSaving}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingUser(null)
                    }}
                    onSave={handleSave}
                />
            )}

            {/* Change Password Modal */}
            {passwordModalUser && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
                    <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '440px', padding: '2rem', borderRadius: '24px', backgroundColor: 'hsl(var(--background))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ padding: '0.6rem', backgroundColor: 'hsl(38 92% 50% / 0.1)', color: 'hsl(38 92% 50%)', borderRadius: '12px' }}>
                                    <KeyRound size={22} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>Cambiar Contraseña</h2>
                                    <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>{passwordModalUser.full_name || passwordModalUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setPasswordModalUser(null)} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>Nueva Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    autoFocus
                                    placeholder="Mínimo 6 caracteres"
                                    style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '1rem', fontFamily: 'monospace' }}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>Confirmar Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="Repetir nueva contraseña"
                                    style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '1rem', fontFamily: 'monospace' }}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem' }}>
                                <button type="button" onClick={() => setPasswordModalUser(null)} className="btn" style={{ flex: 1, padding: '0.85rem', borderRadius: '14px', fontWeight: '700' }}>Cancelar</button>
                                <button
                                    type="submit"
                                    disabled={isChangingPassword}
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: '0.85rem', borderRadius: '14px', fontWeight: '800', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}
                                >
                                    {isChangingPassword ? <RefreshCw size={18} className="animate-spin" /> : <Lock size={18} />}
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SQL Function Setup Helper Modal */}
            {sqlModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
                    <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '600px', padding: '2rem', borderRadius: '24px', backgroundColor: 'hsl(var(--background))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ padding: '0.6rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}>
                                    <Shield size={24} />
                                </div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>Instalación de Función de Contraseñas</h2>
                            </div>
                            <button onClick={() => setSqlModalOpen(false)} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }}><X size={20} /></button>
                        </div>

                        <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem', lineHeight: '1.5' }}>
                            Para que el panel de administración pueda cambiar la contraseña de cualquier usuario en Supabase, ejecuta esta consulta **una sola vez** en el **SQL Editor** de tu panel de Supabase:
                        </p>

                        <div style={{ position: 'relative', backgroundColor: 'hsl(222 47% 11%)', color: '#e2e8f0', padding: '1rem', borderRadius: '12px', fontFamily: 'monospace', fontSize: '0.8rem', overflowX: 'auto', maxHeight: '200px', marginBottom: '1.5rem' }}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
{`CREATE OR REPLACE FUNCTION admin_change_user_password(target_user_id uuid, new_password text)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Administrador'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado. Solo administradores pueden cambiar contraseñas.';
    END IF;

    IF new_password IS NULL OR length(new_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`}
                            </pre>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`CREATE OR REPLACE FUNCTION admin_change_user_password(target_user_id uuid, new_password text)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Administrador'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado. Solo administradores pueden cambiar contraseñas.';
    END IF;

    IF new_password IS NULL OR length(new_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`)
                                    setCopiedSql(true)
                                    setTimeout(() => setCopiedSql(false), 2000)
                                }}
                                className="btn btn-primary"
                                style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                {copiedSql ? <Check size={18} /> : <Copy size={18} />}
                                {copiedSql ? '¡Copiado!' : 'Copiar Código SQL'}
                            </button>
                            <button onClick={() => setSqlModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: '700' }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .hover-row:hover {
                    background-color: hsl(var(--muted) / 0.2) !important;
                }
                .hover-row:hover .actions-cell {
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    )
}
