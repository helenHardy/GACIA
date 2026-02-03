import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Loader2, UploadCloud } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function BranchModal({ branch, onClose, onSave, isSaving }) {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        active: true,
        logo_url: ''
    })
    const [error, setError] = useState(null)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (branch) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                name: branch.name || '',
                address: branch.address || '',
                phone: branch.phone || '',
                active: branch.active ?? true,
                logo_url: branch.logo_url || ''
            })
        }
    }, [branch?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleImageUpload = async (e) => {
        try {
            const file = e.target.files[0]
            if (!file) return

            setUploading(true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `branches/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath)

            setFormData(prev => ({ ...prev, logo_url: data.publicUrl }))
        } catch (error) {
            console.error('Error uploading image:', error)
            setError('Error al subir la imagen')
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.name) {
            setError('El nombre de la sucursal es obligatorio')
            return
        }
        onSave(formData)
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                        {branch ? 'Editar Sucursal' : 'Nueva Sucursal'}
                    </h2>
                    <button onClick={onClose} className="btn" style={{ padding: '0.25rem' }} disabled={isSaving}>
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Logotipo</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '64px', height: '64px',
                                borderRadius: '12px',
                                backgroundColor: 'hsl(var(--secondary))',
                                border: '1px dashed hsl(var(--border))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden',
                                flexShrink: 0
                            }}>
                                {formData.logo_url ? (
                                    <img src={formData.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <UploadCloud size={24} style={{ opacity: 0.3 }} />
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    style={{ fontSize: '0.875rem' }}
                                    disabled={uploading || isSaving}
                                />
                                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.25rem' }}>
                                    {uploading ? 'Subiendo...' : 'Recomendado: 200x200px (PNG, JPG)'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Nombre de la Sucursal</label>
                        <input
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Ej: Sucursal Centro"
                            className="btn"
                            style={{ width: '100%', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Dirección</label>
                        <input
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Calle 123, Av. Principal"
                            className="btn"
                            style={{ width: '100%', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Teléfono</label>
                        <input
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="2222-3333"
                            className="btn"
                            style={{ width: '100%', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                            type="checkbox"
                            id="active"
                            name="active"
                            checked={formData.active}
                            onChange={handleChange}
                            style={{ width: '18px', height: '18px' }}
                        />
                        <label htmlFor="active" style={{ fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>Sucursal Activa</label>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSaving || uploading}
                        style={{ marginTop: '0.5rem', width: '100%', gap: '0.5rem' }}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                {branch ? 'Actualizar Sucursal' : 'Crear Sucursal'}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
