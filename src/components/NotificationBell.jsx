import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Bell, Info, AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const dropdownRef = useRef(null)
    const navigate = useNavigate()
    const [user, setUser] = useState(null)

    useEffect(() => {
        fetchNotifications()
        
        // Suscribirse a cambios en tiempo real
        const channel = supabase
            .channel('public:notifications')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications' 
            }, payload => {
                console.log('Nueva notificación recibida:', payload)
                setNotifications(prev => [payload.new, ...prev])
                setUnreadCount(prev => prev + 1)
                
                // Mostrar alerta sonora o visual si se desea
                if (Notification.permission === 'granted') {
                    new Notification(payload.new.title, {
                        body: payload.new.message
                    })
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function fetchNotifications() {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (!currentUser) return
            setUser(currentUser)

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20)

            if (data) {
                setNotifications(data)
                // Unread if currentUser.id NOT in read_by
                const unread = data.filter(n => !n.read_by || !n.read_by.includes(currentUser.id)).length
                setUnreadCount(unread)
            }
        } catch (err) {
            console.error('Error fetching notifications:', err)
        } finally {
            setLoading(false)
        }
    }

    async function markAsRead(id) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const notification = notifications.find(n => n.id === id)
        if (notification?.read_by?.includes(user.id)) return

        const { error } = await supabase.rpc('mark_notification_read', { 
            p_notification_id: id, 
            p_user_id: user.id 
        })

        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_by: [...(n.read_by || []), user.id] } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        }
    }

    async function markAllAsRead() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        for (const n of notifications) {
            if (!n.read_by || !n.read_by.includes(user.id)) {
                await markAsRead(n.id)
            }
        }
    }

    async function deleteNotification(id, e) {
        if (e) e.stopPropagation();
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const notification = notifications.find(n => n.id === id)

        const { error } = await supabase.rpc('clear_notification', {
            p_notification_id: id,
            p_user_id: user.id
        })

        if (!error) {
            setNotifications(prev => prev.filter(n => n.id !== id))
            if (!notification.read_by || !notification.read_by.includes(user.id)) {
                setUnreadCount(prev => Math.max(0, prev - 1))
            }
        }
    }

    async function clearAll() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.rpc('clear_all_notifications', {
            p_user_id: user.id
        })

        if (!error) {
            setNotifications([])
            setUnreadCount(0)
        }
    }

    const handleNotificationClick = (notification) => {
        markAsRead(notification.id)
        if (notification.link) {
            navigate(notification.link)
        }
        setIsOpen(false)
    }

    const getTypeIcon = (type) => {
        switch (type) {
            case 'warning': return <AlertTriangle size={16} color="#f59e0b" />
            case 'success': return <CheckCircle2 size={16} color="#10b981" />
            case 'error': return <XCircle size={16} color="#ef4444" />
            default: return <Info size={16} color="#3b82f6" />
        }
    }

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'relative',
                    padding: '0.6rem',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: isOpen ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                    color: isOpen ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.6)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Bell size={20} strokeWidth={2.5} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '18px',
                        height: '18px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        borderRadius: '50%',
                        fontSize: '0.65rem',
                        fontWeight: '900',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        {unreadCount > 9 ? '+9' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    width: '320px',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                    border: '1px solid hsl(var(--border) / 0.4)',
                    zIndex: 2000,
                    overflow: 'hidden',
                    animation: 'slideIn 0.2s ease-out'
                }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid hsl(var(--border) / 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--primary) / 0.02)' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notificaciones</h4>
                        {unreadCount > 0 && (
                            <button 
                                onClick={markAllAsRead}
                                style={{ border: 'none', background: 'none', color: 'hsl(var(--primary))', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}
                            >
                                MARCAR TODO LEÍDO
                            </button>
                        )}
                    </div>

                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '3rem 2rem', textAlign: 'center', opacity: 0.4 }}>
                                <Bell size={32} style={{ margin: '0 auto 1rem' }} strokeWidth={1} />
                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700' }}>No tienes notificaciones aún</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div 
                                    key={n.id} 
                                    onClick={() => handleNotificationClick(n)}
                                    style={{
                                        padding: '1rem 1.25rem',
                                        borderBottom: '1px solid hsl(var(--border) / 0.2)',
                                        cursor: 'pointer',
                                        backgroundColor: (n.read_by && n.read_by.includes(user?.id)) ? 'transparent' : 'hsl(var(--primary) / 0.04)',
                                        transition: 'background 0.2s',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = (n.read_by && n.read_by.includes(user?.id)) ? 'transparent' : 'hsl(var(--primary) / 0.04)'}
                                >
                                    {(!n.read_by || !n.read_by.includes(user?.id)) && (
                                        <div style={{ position: 'absolute', left: '10px', top: '1.2rem', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary))' }} />
                                    )}
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <div style={{ marginTop: '2px' }}>{getTypeIcon(n.type)}</div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: '0 0 2px 0', fontSize: '0.85rem', fontWeight: '800', lineHeight: 1.2 }}>{n.title}</p>
                                            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', opacity: 0.6, lineHeight: 1.4 }}>{n.message}</p>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '700', opacity: 0.3, marginTop: '4px', display: 'block' }}>
                                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => deleteNotification(n.id, e)}
                                            style={{ border: 'none', background: 'none', color: 'hsl(var(--foreground) / 0.2)', cursor: 'pointer', padding: '4px', alignSelf: 'flex-start' }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = 'hsl(var(--destructive))'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'hsl(var(--foreground) / 0.2)'}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem', borderTop: '1px solid hsl(var(--border) / 0.3)' }}>
                        <button 
                            onClick={clearAll}
                            style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid hsl(var(--destructive) / 0.2)', backgroundColor: 'white', color: 'hsl(var(--destructive))', fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                            LIMPIAR TODO
                        </button>
                        <button 
                            onClick={() => setIsOpen(false)}
                            style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', backgroundColor: 'hsl(var(--secondary) / 0.4)', color: 'hsl(var(--foreground) / 0.6)', fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                            CERRAR
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from { transform: translateY(-10px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
