import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Loader2, Phone, Mail, MapPin, DollarSign } from 'lucide-react'

export default function CustomerModal({ customer, onClose, onSave, isSaving }) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        tax_id: '',
        credit_limit: 0,
        active: true
    })
    const [error, setError] = useState(null)

    useEffect(() => {
        if (customer) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                name: customer.name || '',
                email: customer.email || '',
                phone: customer.phone || '',
                address: customer.address || '',
                tax_id: customer.tax_id || '',
                credit_limit: customer.credit_limit || 0,
                active: customer.active !== undefined ? customer.active : true
            })
        }
    }, [customer?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (name === 'credit_limit' ? parseFloat(value) || 0 : value)
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        setError(null)

        // Validations
        if (!formData.name.trim()) {
            setError('El nombre del cliente es obligatorio')
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
                        {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
                    </h2>
                    <button onClick={onClose} className="btn" style={{ padding: '0.25rem' }} disabled={isSaving}>
                        <X size={24} />
                    </button>
                </div>

                {error && (
                    <div style={{ padding: '1rem', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', borderRadius: 'var(--radius)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Nombre Completo / Razón Social</label>
                            <input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Ej: Juan Pérez o Distribuidora S.A."
                                className="btn"
                                style={{ width: '100%', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', padding: '0.75rem' }}
                                required
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>ID Fiscal (NIT/RUC)</label>
                            <input
                                name="tax_id"
                                value={formData.tax_id}
                                onChange={handleChange}
                                placeholder="Identificación fiscal"
                                className="btn"
                                style={{ width: '100%', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', padding: '0.75rem' }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Límite de Crédito ($)</label>
                            <div style={{ position: 'relative' }}>
                                <DollarSign size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                                <input
                                    type="number"
                                    name="credit_limit"
                                    value={formData.credit_limit}
                                    onChange={handleChange}
                                    className="btn"
                                    style={{ width: '100%', paddingLeft: '2.5rem', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Teléfono</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                                <input
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="Contacto"
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
                            <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Dirección</label>
                            <div style={{ position: 'relative' }}>
                                <MapPin size={16} style={{ position: 'absolute', left: '0.75rem', top: '1.1rem', color: 'hsl(var(--secondary-foreground))' }} />
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="Ubicación de entrega o cobro"
                                    className="btn"
                                    style={{ width: '100%', minHeight: '80px', paddingLeft: '2.5rem', paddingTop: '0.75rem', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', resize: 'vertical' }}
                                />
                            </div>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', padding: '1rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))' }}>
                                <div style={{ position: 'relative', width: '44px', height: '24px' }}>
                                    <input
                                        type="checkbox"
                                        name="active"
                                        checked={formData.active}
                                        onChange={handleChange}
                                        style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', zIndex: 1 }}
                                    />
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        backgroundColor: formData.active ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground) / 0.3)',
                                        borderRadius: '12px', transition: 'all 0.2s'
                                    }}></div>
                                    <div style={{
                                        position: 'absolute', top: '4px', left: formData.active ? '24px' : '4px',
                                        width: '16px', height: '16px', backgroundColor: 'white',
                                        borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'all 0.2s'
                                    }}></div>
                                </div>
                                <div>
                                    <p style={{ fontWeight: '600', fontSize: '0.875rem' }}>Estado del Cliente</p>
                                    <p style={{ fontSize: '0.75rem', color: 'hsl(var(--secondary-foreground))' }}>
                                        {formData.active ? 'Activo (Disponible en POS)' : 'Inactivo (No aparecerá en POS)'}
                                    </p>
                                </div>
                            </label>
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
                                {customer ? 'Actualizar Cliente' : 'Registrar Cliente'}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
