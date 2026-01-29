import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Loader2, Phone, Mail, MapPin, User } from 'lucide-react'

export default function SupplierModal({ supplier, onClose, onSave, isSaving }) {
    const [formData, setFormData] = useState({
        name: supplier?.name || '',
        contact_name: supplier?.contact_name || '',
        email: supplier?.email || '',
        phone: supplier?.phone || '',
        address: supplier?.address || '',
        tax_id: supplier?.tax_id || ''
    })
    const [error, setError] = useState(null)

    useEffect(() => {
        if (supplier) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                name: supplier.name || '',
                contact_name: supplier.contact_name || '',
                email: supplier.email || '',
                phone: supplier.phone || '',
                address: supplier.address || '',
                tax_id: supplier.tax_id || ''
            })
        }
    }, [supplier?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        setError(null)

        // Validations
        if (!formData.name.trim()) {
            setError('El nombre de la empresa es obligatorio')
            return
        }
        if (formData.name.length < 3) {
            setError('El nombre debe tener al menos 3 caracteres')
            return
        }

        if (formData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(formData.email)) {
                setError('El formato del correo electrónico no es válido')
                return
            }
        }

        if (formData.phone && formData.phone.length < 8) {
            setError('El número de teléfono parece incompleto')
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
            <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '2.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                    </h2>
                    <button onClick={onClose} className="btn" style={{ padding: '0.25rem' }} disabled={isSaving}>
                        <X size={24} />
                    </button>
                </div>

                {error && (
                    <div style={{ padding: '1rem', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', borderRadius: 'var(--radius)', marginBottom: '1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid hsl(var(--destructive) / 0.2)' }}>
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Nombre de la Empresa</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Ej: Proveedora Integral S.A."
                                    className="btn"
                                    style={{ width: '100%', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', padding: '0.75rem' }}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Nombre de Contacto</label>
                            <input
                                name="contact_name"
                                value={formData.contact_name}
                                onChange={handleChange}
                                placeholder="Nombre completo"
                                className="btn"
                                style={{ width: '100%', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', padding: '0.75rem' }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>NIT / RUC / ID Fiscal</label>
                            <input
                                name="tax_id"
                                value={formData.tax_id}
                                onChange={handleChange}
                                placeholder="ID Fiscal"
                                className="btn"
                                style={{ width: '100%', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', padding: '0.75rem' }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Teléfono</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                                <input
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="Número de contacto"
                                    className="btn"
                                    style={{ width: '100%', paddingLeft: '2.5rem', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="correo@ejemplo.com"
                                    className="btn"
                                    style={{ width: '100%', paddingLeft: '2.5rem', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                                />
                            </div>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Dirección de la Empresa</label>
                            <div style={{ position: 'relative' }}>
                                <MapPin size={16} style={{ position: 'absolute', left: '0.75rem', top: '1.1rem', color: 'hsl(var(--secondary-foreground))' }} />
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="Ubicación física"
                                    className="btn"
                                    style={{ width: '100%', minHeight: '80px', paddingLeft: '2.5rem', paddingTop: '0.75rem', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', resize: 'vertical' }}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSaving}
                        style={{ marginTop: '0.5rem', width: '100%', gap: '0.75rem', padding: '1rem', fontSize: '1rem' }}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save size={24} />
                                {supplier ? 'Actualizar Proveedor' : 'Registrar Proveedor'}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
