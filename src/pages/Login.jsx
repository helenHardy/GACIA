import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircuitBoard, AlertCircle, Loader2, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
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
            backgroundColor: '#0f172a', /* Deep Slate */
            backgroundImage: `
                radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
                radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), 
                radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%)
            `,
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Decorative elements */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                left: '-10%',
                width: '40%',
                height: '40%',
                background: 'hsl(var(--primary) / 0.15)',
                filter: 'blur(120px)',
                borderRadius: '50%',
                zIndex: 0
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                right: '-10%',
                width: '40%',
                height: '40%',
                background: 'hsl(var(--accent) / 0.15)',
                filter: 'blur(120px)',
                borderRadius: '50%',
                zIndex: 0
            }} />

            <div style={{
                width: '100%',
                maxWidth: '440px',
                padding: '2rem',
                position: 'relative',
                zIndex: 1
            }}>
                <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '24px',
                    padding: '3rem 2.5rem',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <div style={{
                            display: 'inline-flex',
                            padding: '1.25rem',
                            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                            borderRadius: '20px',
                            marginBottom: '1.5rem',
                            color: 'white',
                            boxShadow: '0 10px 20px -5px hsl(var(--primary) / 0.5)'
                        }}>
                            <CircuitBoard size={40} />
                        </div>
                        <h1 style={{
                            fontSize: '2rem',
                            fontWeight: '800',
                            color: 'white',
                            letterSpacing: '-0.025em',
                            marginBottom: '0.5rem'
                        }}>
                            Gacia <span style={{ color: 'hsl(var(--primary))' }}>ERP</span>
                        </h1>
                        <p style={{
                            color: 'rgba(255, 255, 255, 0.5)',
                            fontWeight: '500',
                            fontSize: '0.95rem'
                        }}>
                            Gestión Inteligente de Inventarios
                        </p>
                    </div>

                    {error && (
                        <div style={{
                            padding: '1rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                            borderRadius: '12px',
                            marginBottom: '2rem',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            animation: 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both'
                        }}>
                            <AlertCircle size={18} />
                            <span style={{ fontWeight: '500' }}>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo Electrónico</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.3)' }} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ejemplo@gacia.com"
                                    style={{
                                        width: '100%',
                                        padding: '0.85rem 1rem 0.85rem 3rem',
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'hsl(var(--primary))';
                                        e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contraseña</label>
                                <a href="#" style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', textDecoration: 'none', fontWeight: '600' }}>¿Olvidaste tu contraseña?</a>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.3)' }} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%',
                                        padding: '0.85rem 3.5rem 0.85rem 3rem',
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'hsl(var(--primary))';
                                        e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '0.75rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255, 255, 255, 0.3)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0.5rem'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: '1rem',
                                width: '100%',
                                padding: '1rem',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '1rem',
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.75rem',
                                transition: 'all 0.3s',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    e.target.style.transform = 'translateY(-2px)';
                                    e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.2)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                            }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Verificando...
                                </>
                            ) : (
                                <>
                                    Iniciar Sesión
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p style={{
                    textAlign: 'center',
                    marginTop: '2rem',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '0.85rem',
                    fontWeight: '500'
                }}>
                    &copy; {new Date().getFullYear()} Gacia Soluciones Tecnológicas. <br />
                    Todos los derechos reservados.
                </p>
            </div>

            <style>{`
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
                input::placeholder {
                    color: rgba(255, 255, 255, 0.2);
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
