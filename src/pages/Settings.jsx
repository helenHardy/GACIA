import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Building, Bell, Shield, Palette, Save, CheckCircle, Loader2, Moon, Sun, Lock, Key, Receipt } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Settings() {
    const [activeTab, setActiveTab] = useState('general')
    const [saved, setSaved] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [settings, setSettings] = useState({
        system_name: '',
        currency: 'USD',
        business_name: '',
        business_nit: '',
        business_address: '',
        language: 'Español',
        theme: 'light',
        notifications_email: true,
        notifications_push: false,
        enable_tax: true,
        tax_rate: 13,
        tax_name: 'IVA'
    })

    // Password State
    const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' })
    const [passwordError, setPasswordError] = useState(null)
    const [passwordSuccess, setPasswordSuccess] = useState(null)

    useEffect(() => {
        fetchSettings()
    }, [])

    useEffect(() => {
        // Apply theme whenever settings.theme changes
        if (settings.theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [settings.theme])

    async function fetchSettings() {
        try {
            setLoading(true)
            const { data, error } = await supabase.from('settings').select('*')
            if (error) throw error

            if (data) {
                const mapped = {}
                data.forEach(item => {
                    // Convert boolean strings if necessary
                    if (item.value === 'true') mapped[item.key] = true
                    else if (item.value === 'false') mapped[item.key] = false
                    else mapped[item.key] = item.value
                })
                setSettings(prev => ({ ...prev, ...mapped }))
            }
        } catch (err) {
            console.error('Error fetching settings:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            setIsSaving(true)
            const updates = Object.entries(settings).map(([key, value]) => ({
                key,
                value: String(value),
                updated_at: new Date().toISOString()
            }))

            for (const update of updates) {
                const { error } = await supabase
                    .from('settings')
                    .upsert(update, { onConflict: 'key' })
                if (error) throw error
            }

            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            console.error('Error saving settings:', err)
            alert('Error al guardar los cambios: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        setPasswordError(null)
        setPasswordSuccess(null)

        if (passwordData.newPassword.length < 6) {
            setPasswordError('La contraseña debe tener al menos 6 caracteres')
            return
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('Las contraseñas no coinciden')
            return
        }

        try {
            setIsSaving(true)
            const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword })
            if (error) throw error
            setPasswordSuccess('Contraseña actualizada correctamente')
            setPasswordData({ newPassword: '', confirmPassword: '' })
        } catch (err) {
            setPasswordError(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const tabs = [
        { id: 'general', label: 'General', icon: <SettingsIcon size={20} /> },
        { id: 'business', label: 'Empresa', icon: <Building size={20} /> },
        { id: 'billing', label: 'Facturación', icon: <Receipt size={20} /> },
        { id: 'notifications', label: 'Notificaciones', icon: <Bell size={20} /> },
        { id: 'security', label: 'Seguridad', icon: <Shield size={20} /> },
        { id: 'appearance', label: 'Apariencia', icon: <Palette size={20} /> },
    ]

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Configuración</h1>
                    <p style={{ color: 'hsl(var(--secondary-foreground))' }}>Personaliza el funcionamiento de tu sistema</p>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || loading}>
                    {isSaving ? <Loader2 size={20} className="animate-spin" style={{ marginRight: '0.5rem' }} /> :
                        saved ? <CheckCircle size={20} style={{ marginRight: '0.5rem' }} /> :
                            <Save size={20} style={{ marginRight: '0.5rem' }} />}
                    {isSaving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 250px) 1fr', gap: '2rem' }}>
                {/* Sidebar Tabs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="btn"
                            style={{
                                justifyContent: 'flex-start',
                                gap: '0.75rem',
                                padding: '1rem',
                                backgroundColor: activeTab === tab.id ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                                color: activeTab === tab.id ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground))',
                                border: 'none',
                                fontWeight: activeTab === tab.id ? '600' : '400'
                            }}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="card" style={{ padding: '2rem', minHeight: '500px' }}>
                    {activeTab === 'general' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Configuración General</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Nombre del Sistema</label>
                                <input
                                    type="text"
                                    value={settings.system_name}
                                    onChange={(e) => setSettings({ ...settings, system_name: e.target.value })}
                                    className="btn"
                                    style={{ justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Idioma</label>
                                <select
                                    className="btn"
                                    style={{ justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))' }}
                                    value={settings.language}
                                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                                >
                                    <option value="Español">Español</option>
                                    <option value="English">English</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Moneda Principal</label>
                                <select
                                    className="btn"
                                    style={{ justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))' }}
                                    value={settings.currency}
                                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                                >
                                    <option value="USD">USD - Dólar Estadounidense ($)</option>
                                    <option value="EUR">EUR - Euro (€)</option>
                                    <option value="BOL">BOL - Bolivianos (Bs.)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === 'business' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Información de la Empresa</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Razón Social</label>
                                <input
                                    type="text"
                                    value={settings.business_name}
                                    onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                                    className="btn"
                                    style={{ justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>NIT / Identificación Fiscal</label>
                                <input
                                    type="text"
                                    value={settings.business_nit}
                                    onChange={(e) => setSettings({ ...settings, business_nit: e.target.value })}
                                    className="btn"
                                    style={{ justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Dirección Legal</label>
                                <textarea
                                    className="btn"
                                    style={{ height: '80px', justifyContent: 'flex-start', alignItems: 'flex-start', padding: '0.75rem', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                                    value={settings.business_address}
                                    onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Configuración de Facturación e Impuestos</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: 'var(--radius)' }}>
                                    <div>
                                        <h4 style={{ fontWeight: '500' }}>Habilitar Cobro de Impuestos</h4>
                                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--secondary-foreground))' }}>Si se desactiva, no se sumarán impuestos al total de la venta.</p>
                                    </div>
                                    <div className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={settings.enable_tax}
                                            onChange={(e) => setSettings({ ...settings, enable_tax: e.target.checked })}
                                            style={{ width: '1.5rem', height: '1.5rem' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Nombre del Impuesto</label>
                                        <input
                                            type="text"
                                            value={settings.tax_name}
                                            onChange={(e) => setSettings({ ...settings, tax_name: e.target.value })}
                                            className="btn"
                                            style={{ justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                                            placeholder="Ej: IVA, IGV"
                                            disabled={!settings.enable_tax}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Tasa de Impuesto (%)</label>
                                        <input
                                            type="number"
                                            value={settings.tax_rate}
                                            onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                                            className="btn"
                                            style={{ justifyContent: 'flex-start', backgroundColor: 'hsl(var(--secondary))', cursor: 'text' }}
                                            placeholder="Ej: 13"
                                            disabled={!settings.enable_tax}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Apariencia del Sistema</h3>

                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <button
                                    className="btn"
                                    onClick={() => setSettings({ ...settings, theme: 'light' })}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'column',
                                        padding: '2rem',
                                        gap: '1rem',
                                        height: 'auto',
                                        border: settings.theme === 'light' ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                                        backgroundColor: 'hsl(0 0% 100%)',
                                        color: 'hsl(0 0% 0%)'
                                    }}
                                >
                                    <Sun size={32} />
                                    <span style={{ fontWeight: '600' }}>Modo Claro</span>
                                </button>

                                <button
                                    className="btn"
                                    onClick={() => setSettings({ ...settings, theme: 'dark' })}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'column',
                                        padding: '2rem',
                                        gap: '1rem',
                                        height: 'auto',
                                        border: settings.theme === 'dark' ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                                        backgroundColor: 'hsl(222 47% 11%)',
                                        color: 'hsl(210 40% 98%)'
                                    }}
                                >
                                    <Moon size={32} />
                                    <span style={{ fontWeight: '600' }}>Modo Oscuro</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Seguridad y Contraseña</h3>

                            <div className="card" style={{ border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--secondary) / 0.1)', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                    <Lock size={20} style={{ color: 'hsl(var(--primary))' }} />
                                    <h4 style={{ fontWeight: '600' }}>Cambiar Contraseña</h4>
                                </div>

                                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>Nueva Contraseña</label>
                                        <div style={{ position: 'relative' }}>
                                            <Key size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                                            <input
                                                type="password"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                className="btn"
                                                style={{ width: '100%', paddingLeft: '2.5rem', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--background))', cursor: 'text' }}
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>Confirmar Contraseña</label>
                                        <div style={{ position: 'relative' }}>
                                            <Key size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                                            <input
                                                type="password"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                className="btn"
                                                style={{ width: '100%', paddingLeft: '2.5rem', justifyContent: 'flex-start', backgroundColor: 'hsl(var(--background))', cursor: 'text' }}
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    {passwordError && (
                                        <p style={{ color: 'hsl(var(--destructive))', fontSize: '0.875rem' }}>{passwordError}</p>
                                    )}
                                    {passwordSuccess && (
                                        <p style={{ color: 'hsl(142 76% 36%)', fontSize: '0.875rem' }}>{passwordSuccess}</p>
                                    )}

                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : 'Actualizar Contraseña'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Preferencias de Notificaciones</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: 'var(--radius)' }}>
                                    <div>
                                        <h4 style={{ fontWeight: '500' }}>Notificaciones por Correo</h4>
                                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--secondary-foreground))' }}>Recibir resúmenes de ventas y alertas de stock.</p>
                                    </div>
                                    <div className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications_email}
                                            onChange={(e) => setSettings({ ...settings, notifications_email: e.target.checked })}
                                            style={{ width: '1.5rem', height: '1.5rem' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: 'var(--radius)' }}>
                                    <div>
                                        <h4 style={{ fontWeight: '500' }}>Notificaciones Push</h4>
                                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--secondary-foreground))' }}>Recibir alertas en tiempo real en el navegador.</p>
                                    </div>
                                    <div className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications_push}
                                            onChange={(e) => setSettings({ ...settings, notifications_push: e.target.checked })}
                                            style={{ width: '1.5rem', height: '1.5rem' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
