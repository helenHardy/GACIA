import React, { useState, useEffect, useRef } from 'react'
import { X, Save, AlertCircle, Loader2, UploadCloud, Building2, MapPin, Phone, CheckCircle2 } from 'lucide-react'
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
    const fileInputRef = useRef(null)

    useEffect(() => {
        if (branch) {
            setFormData({
                name: branch.name || '',
                address: branch.address || '',
                phone: branch.phone || '',
                active: branch.active ?? true,
                logo_url: branch.logo_url || ''
            })
        }
    }, [branch?.id])

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
            right: 0,
            bottom: 0,
            backgroundColor: 'hsl(var(--background) / 0.8)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <style>
                {`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .branch-card { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                .upload-overlay { opacity: 0; transition: all 0.2s ease; }
                .upload-area:hover .upload-overlay { opacity: 1; }
                .input-group:focus-within label { color: hsl(var(--primary)); }
                .input-group:focus-within .input-icon { color: hsl(var(--primary)); opacity: 1; }
                `}
            </style>

            <div className="card branch-card" style={{ 
                width: '100%', 
                maxWidth: '520px', 
                padding: '0', 
                overflow: 'hidden', 
                borderRadius: '32px',
                border: '1px solid hsl(var(--border) / 0.5)',
                boxShadow: '0 40px 100px -20px hsl(var(--primary) / 0.15)'
            }}>
                {/* Header Section */}
                <div style={{ 
                    padding: '2.5rem 2.5rem 1.5rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    background: 'linear-gradient(180deg, hsl(var(--primary) / 0.03) 0%, transparent 100%)'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>
                            {branch ? 'Editar Sucursal' : 'Nueva Sucursal'}
                        </h2>
                        <p style={{ margin: '0.25rem 0 0', opacity: 0.5, fontWeight: '600', fontSize: '0.9rem' }}>
                            {branch ? 'Actualiza los detalles del punto de venta' : 'Crea un nuevo punto de venta o almacén'}
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="btn" 
                        style={{ 
                            padding: '0.6rem', 
                            borderRadius: '50%', 
                            backgroundColor: 'white', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            transition: 'transform 0.2s'
                        }} 
                        disabled={isSaving}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '0 2.5rem 2.5rem' }}>
                    {error && (
                        <div style={{ 
                            padding: '1rem', 
                            backgroundColor: 'hsl(var(--destructive) / 0.08)', 
                            color: 'hsl(var(--destructive))', 
                            borderRadius: '16px', 
                            marginBottom: '1.5rem', 
                            fontSize: '0.85rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem',
                            fontWeight: '700',
                            border: '1px solid hsl(var(--destructive) / 0.1)'
                        }}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        
                        {/* Logo Upload Section - Modern Circular Style */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div 
                                className="upload-area"
                                onClick={() => fileInputRef.current?.click()}
                                style={{ 
                                    position: 'relative',
                                    width: '120px', 
                                    height: '120px', 
                                    borderRadius: '32px',
                                    backgroundColor: 'hsl(var(--secondary) / 0.5)',
                                    border: '2px dashed hsl(var(--border) / 0.5)',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                {formData.logo_url ? (
                                    <img src={formData.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                                        <UploadCloud size={32} style={{ opacity: 0.3, marginBottom: '0.25rem' }} />
                                        <p style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>LOGO</p>
                                    </div>
                                )}
                                
                                <div className="upload-overlay" style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundColor: 'hsl(var(--primary) / 0.9)',
                                    color: 'white',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.25rem'
                                }}>
                                    <UploadCloud size={24} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: '900' }}>{uploading ? '...' : 'SUBIR'}</span>
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                    disabled={uploading || isSaving}
                                />
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '0.5rem', opacity: 0.4 }}>
                                    Nombre de la Sucursal
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Building2 size={18} className="input-icon" style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3, transition: 'all 0.2s' }} />
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Ej: Sucursal Central"
                                        style={{ 
                                            width: '100%', 
                                            padding: '1.1rem 1.25rem 1.1rem 3.25rem', 
                                            backgroundColor: 'hsl(var(--secondary) / 0.5)', 
                                            borderRadius: '20px', 
                                            border: 'none', 
                                            fontSize: '1rem', 
                                            fontWeight: '700',
                                            outline: 'none',
                                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                        }}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '0.5rem', opacity: 0.4 }}>
                                    Dirección Física
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={18} className="input-icon" style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3, transition: 'all 0.2s' }} />
                                    <input
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder="Calle, Número, Zona..."
                                        style={{ 
                                            width: '100%', 
                                            padding: '1.1rem 1.25rem 1.1rem 3.25rem', 
                                            backgroundColor: 'hsl(var(--secondary) / 0.5)', 
                                            borderRadius: '20px', 
                                            border: 'none', 
                                            fontSize: '1rem', 
                                            fontWeight: '700',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '0.5rem', opacity: 0.4 }}>
                                        Teléfono
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Phone size={18} className="input-icon" style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3, transition: 'all 0.2s' }} />
                                        <input
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="770-12345"
                                            style={{ 
                                                width: '100%', 
                                                padding: '1.1rem 1.25rem 1.1rem 3.25rem', 
                                                backgroundColor: 'hsl(var(--secondary) / 0.5)', 
                                                borderRadius: '20px', 
                                                border: 'none', 
                                                fontSize: '1rem', 
                                                fontWeight: '700',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: formData.active ? 'hsl(142 76% 36% / 0.05)' : 'hsl(var(--secondary) / 0.3)', borderRadius: '20px', cursor: 'pointer', alignSelf: 'flex-end', transition: 'all 0.2s' }} onClick={() => setFormData(p => ({ ...p, active: !p.active }))}>
                                    <CheckCircle2 size={24} style={{ color: formData.active ? 'hsl(142 76% 36%)' : 'hsl(var(--border))', transition: 'all 0.2s' }} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: '800', opacity: formData.active ? 1 : 0.4 }}>{formData.active ? 'Activa' : 'Inactiva'}</span>
                                </div>
                            </div>

                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSaving || uploading}
                        style={{ 
                            marginTop: '2.5rem', 
                            width: '100%', 
                            padding: '1.25rem', 
                            borderRadius: '24px', 
                            fontSize: '1.1rem', 
                            fontWeight: '900', 
                            gap: '0.75rem',
                            boxShadow: '0 20px 40px -10px hsl(var(--primary) / 0.4)',
                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                    >
                        {isSaving ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            <>
                                <Save size={24} />
                                {branch ? 'GUARDAR CAMBIOS' : 'CREAR SUCURSAL'}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
