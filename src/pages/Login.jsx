import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircuitBoard, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (authError) throw authError
            navigate('/')
        } catch (err) {
            console.error('Login error:', err)
            setError(err.message === 'Invalid login credentials'
                ? 'Credenciales inválidas. Verifica tu correo y contraseña.'
                : err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'hsl(var(--background))'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        padding: '1rem',
                        backgroundColor: 'hsl(var(--primary) / 0.1)',
                        borderRadius: '50%',
                        marginBottom: '1rem',
                        color: 'hsl(var(--primary))'
                    }}>
                        <CircuitBoard size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Bienvenido a Gacia</h1>
                    <p style={{ color: 'hsl(var(--secondary-foreground))', marginTop: '0.5rem' }}>Inicia sesión para continuar</p>
                </div>

                {error && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: 'hsl(var(--destructive) / 0.1)',
                        color: 'hsl(var(--destructive))',
                        borderRadius: 'var(--radius)',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: '1px solid hsl(var(--destructive) / 0.2)'
                    }}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@gacia.com"
                            className="btn"
                            style={{
                                border: '1px solid hsl(var(--input))',
                                backgroundColor: 'transparent',
                                justifyContent: 'flex-start',
                                cursor: 'text'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Contraseña</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="btn"
                            style={{
                                border: '1px solid hsl(var(--input))',
                                backgroundColor: 'transparent',
                                justifyContent: 'flex-start',
                                cursor: 'text'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ marginTop: '1rem', width: '100%', gap: '0.5rem' }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Ingresando...
                            </>
                        ) : (
                            'Ingresar'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
