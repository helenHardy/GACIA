import React, { useState, useEffect } from 'react'
import { X, Banknote, QrCode, CheckCircle, RefreshCw, User, HandCoins, Search, ChevronDown, Wallet, ArrowRight, UserPlus, Info, Split, Tag } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function CheckoutModal({ total, onClose, onConfirm, isProcessing, currencySymbol = 'Bs.' }) {
    const [paymentMethod, setPaymentMethod] = useState('Efectivo')
    const [amountPaid, setAmountPaid] = useState('')
    const [customers, setCustomers] = useState([])
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [customerSearch, setCustomerSearch] = useState('')
    const [showCustomerList, setShowCustomerList] = useState(false)
    const [discount, setDiscount] = useState('')

    // New Customer Creation State
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)
    const [newCustomerData, setNewCustomerData] = useState({ name: '', tax_id: '', email: '', phone: '' })

    // Mixed payment states
    const [amountCash, setAmountCash] = useState('')
    const [secondaryMethod, setSecondaryMethod] = useState('QR') // QR or Digital

    useEffect(() => {
        async function fetchCustomers() {
            const { data } = await supabase.from('customers').select('*').eq('active', true).order('name')
            setCustomers(data || [])
        }
        fetchCustomers()
    }, [])

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.tax_id?.toLowerCase().includes(customerSearch.toLowerCase())
    )

    const discountVal = parseFloat(discount) || 0
    const finalTotal = Math.max(0, total - discountVal)
    const change = amountPaid ? Math.max(0, parseFloat(amountPaid) - finalTotal).toFixed(2) : '0.00'

    // Mixed payment calculations
    const cashVal = parseFloat(amountCash) || 0
    const digitalVal = Math.max(0, total - cashVal).toFixed(2)

    const handleConfirm = () => {
        if (paymentMethod === 'Crédito' && !selectedCustomer) {
            alert('Debe seleccionar un cliente para ventas a crédito')
            return
        }

        let finalPaymentMethod = paymentMethod
        let finalAmountReceived = amountPaid ? parseFloat(amountPaid) : finalTotal
        let finalChange = parseFloat(change)

        if (paymentMethod === 'Mixto') {
            finalPaymentMethod = `Mixto (Efectivo: ${cashVal.toFixed(2)} + ${secondaryMethod}: ${digitalVal})`
            finalAmountReceived = finalTotal // Sum is always total for pure mixed entry unless we allow overpayment in cash
        }

        onConfirm({
            paymentMethod: finalPaymentMethod,
            amountPaid: finalAmountReceived,
            change: finalChange,
            discount: discountVal,
            customerId: selectedCustomer?.id || null,
            customer: selectedCustomer,
            isCredit: paymentMethod === 'Crédito'
        })
    }



    const startCreateCustomer = () => {
        const isNumeric = /^\d+$/.test(customerSearch)
        setNewCustomerData({
            name: !isNumeric ? customerSearch : '',
            tax_id: isNumeric ? customerSearch : '',
            email: '',
            phone: ''
        })
        setIsCreatingCustomer(true)
        setShowCustomerList(true)
    }

    const handleCreateCustomer = async () => {
        if (!newCustomerData.name.trim()) return alert('El nombre es obligatorio')

        try {
            const { data, error } = await supabase.from('customers').insert([{
                name: newCustomerData.name,
                tax_id: newCustomerData.tax_id,
                email: newCustomerData.email,
                phone: newCustomerData.phone,
                active: true
            }]).select().single()

            if (error) throw error

            const updatedCustomers = [...customers, data].sort((a, b) => a.name.localeCompare(b.name))
            setCustomers(updatedCustomers)
            setSelectedCustomer(data)
            setIsCreatingCustomer(false)
            setNewCustomerData({ name: '', tax_id: '', email: '', phone: '' })
            setShowCustomerList(false)
        } catch (err) {
            console.error(err)
            alert('Error al crear cliente')
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
            <div className="card shadow-2xl" style={{
                width: '100%',
                maxWidth: '650px',
                padding: 0,
                borderRadius: '24px',
                overflow: 'hidden',
                backgroundColor: 'hsl(var(--background))'
            }}>
                {/* Modal Header */}
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.6rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}>
                            <Wallet size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>Finalizar Transacción</h2>
                            <p style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Gestione el cobro y los datos del cliente</p>
                        </div>
                    </div>
                    {!isProcessing && (
                        <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }}>
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div style={{ padding: '2rem', maxHeight: '75vh', overflowY: 'auto' }}>

                    {/* Total Display High Impact */}
                    <div style={{
                        padding: '2rem',
                        backgroundColor: 'hsl(var(--primary) / 0.04)',
                        borderRadius: '20px',
                        border: '1px solid hsl(var(--primary) / 0.1)',
                        textAlign: 'center',
                        marginBottom: '2rem',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05, transform: 'rotate(-15deg)' }}>
                            <Banknote size={120} />
                        </div>
                        <p style={{ color: 'hsl(var(--primary))', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Total a cobrar</p>
                        <h3 style={{ fontSize: '3.5rem', fontWeight: '900', margin: 0, color: 'hsl(var(--foreground))', letterSpacing: '-0.03em' }}>
                            <span style={{ fontSize: '1.5rem', opacity: 0.4, marginRight: '8px' }}>{currencySymbol}</span>
                            {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h3>
                        {discountVal > 0 && (
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontWeight: '700', color: 'hsl(var(--destructive))' }}>
                                Ahorro por descuento: -{currencySymbol}{discountVal.toFixed(2)}
                            </p>
                        )}
                    </div>

                    {/* Descuento Input */}
                    <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'hsl(var(--secondary) / 0.15)', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Tag size={14} /> Aplicar Descuento
                            </label>
                            {discountVal > 0 && <span style={{ fontSize: '0.75rem', fontWeight: '800', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', padding: '2px 8px', borderRadius: '6px' }}>-{((discountVal / total) * 100).toFixed(1)}%</span>}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={discount}
                                onChange={(e) => setDiscount(e.target.value)}
                                disabled={isProcessing}
                                style={{
                                    width: '100%',
                                    padding: '0.85rem 1rem 0.85rem 2.5rem',
                                    fontSize: '1.1rem',
                                    fontWeight: '800',
                                    borderRadius: '14px',
                                    border: '1px solid hsl(var(--border) / 0.6)',
                                    outline: 'none',
                                    backgroundColor: 'white'
                                }}
                            />
                        </div>
                    </div>

                    {/* Cliente Selector Premium */}
                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.75rem' }}>
                            <User size={14} /> Cliente para la Factura
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    style={{
                                        flex: 1,
                                        padding: '1rem 1.25rem',
                                        backgroundColor: 'hsl(var(--secondary) / 0.3)',
                                        border: '1px solid hsl(var(--border) / 0.5)',
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                    onClick={() => { setShowCustomerList(!showCustomerList); setIsCreatingCustomer(false); }}
                                    disabled={isProcessing}
                                >
                                    <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--background))', borderRadius: '10px', color: 'hsl(var(--primary))' }}>
                                        <User size={20} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '0.95rem', fontWeight: '700', margin: 0 }}>{selectedCustomer ? selectedCustomer.name : 'Cliente General (Contado)'}</p>
                                        {selectedCustomer && <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: 0 }}>NIT/CI: {selectedCustomer.tax_id || '---'}</p>}
                                    </div>
                                    <ChevronDown size={20} opacity={0.3} />
                                </button>
                                <button
                                    type="button"
                                    onClick={startCreateCustomer}
                                    disabled={isProcessing}
                                    style={{
                                        padding: '0 1.25rem',
                                        backgroundColor: 'hsl(var(--primary) / 0.1)',
                                        border: '1px solid hsl(var(--primary) / 0.2)',
                                        borderRadius: '16px',
                                        color: 'hsl(var(--primary))',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.25rem'
                                    }}
                                >
                                    <UserPlus size={24} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: '800' }}>NUEVO</span>
                                </button>
                            </div>

                            {showCustomerList && (
                                <div className="card shadow-2xl" style={{ position: 'absolute', top: '100%', left: 0, width: '100%', zIndex: 110, marginTop: '0.75rem', padding: 0, overflow: 'hidden', borderRadius: '20px' }}>

                                    {!isCreatingCustomer ? (
                                        <>
                                            <div style={{ padding: '1rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', backgroundColor: 'hsl(var(--secondary) / 0.1)', display: 'flex', gap: '0.5rem' }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                                    <input
                                                        autoFocus
                                                        placeholder="Buscar por nombre o NIT..."
                                                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.8rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid hsl(var(--primary) / 0.2)', fontSize: '0.9rem', outline: 'none' }}
                                                        value={customerSearch}
                                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                                <button
                                                    className="btn"
                                                    style={{ width: '100%', justifyContent: 'flex-start', padding: '1rem 1.5rem', borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}
                                                    onClick={() => { setSelectedCustomer(null); setShowCustomerList(false); }}
                                                >
                                                    <User size={18} style={{ marginRight: '0.75rem', opacity: 0.5 }} />
                                                    <span style={{ fontWeight: '700' }}>Cliente General / Final</span>
                                                </button>
                                                {filteredCustomers.length === 0 ? (
                                                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                                                        <p style={{ opacity: 0.5, marginBottom: '1rem' }}>No se encontraron clientes</p>
                                                        {customerSearch && (
                                                            <button
                                                                className="btn btn-primary"
                                                                style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }}
                                                                onClick={startCreateCustomer}
                                                            >
                                                                <UserPlus size={18} />
                                                                Crear "{customerSearch}"
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    filteredCustomers.map(c => (
                                                        <button
                                                            key={c.id}
                                                            className="btn"
                                                            style={{ width: '100%', justifyContent: 'flex-start', padding: '1rem 1.5rem', borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}
                                                            onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); }}
                                                        >
                                                            <div style={{ textAlign: 'left', flex: 1 }}>
                                                                <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>{c.name}</div>
                                                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: '600' }}>
                                                                    <span style={{ opacity: 0.5 }}>CI/NIT: {c.tax_id || '---'}</span>
                                                                    <span style={{ color: (c.current_balance || 0) > 0 ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)' }}>Saldo: {currencySymbol}{c.current_balance?.toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                            <ArrowRight size={16} opacity={0.3} />
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ padding: '1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>Nuevo Cliente</h4>
                                                <button onClick={() => setIsCreatingCustomer(false)} className="btn" style={{ padding: '0.4rem', borderRadius: '50%' }}><X size={16} /></button>
                                            </div>
                                            <div style={{ display: 'grid', gap: '1rem' }}>
                                                <input
                                                    placeholder="Nombre Completo / Razón Social *"
                                                    value={newCustomerData.name}
                                                    onChange={e => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '0.9rem' }}
                                                    autoFocus
                                                />
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                    <input
                                                        placeholder="NIT / CI / Cédula"
                                                        value={newCustomerData.tax_id}
                                                        onChange={e => setNewCustomerData({ ...newCustomerData, tax_id: e.target.value })}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '0.9rem' }}
                                                    />
                                                    <input
                                                        placeholder="Teléfono"
                                                        value={newCustomerData.phone}
                                                        onChange={e => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '0.9rem' }}
                                                    />
                                                </div>
                                                <input
                                                    placeholder="Email (Opcional)"
                                                    value={newCustomerData.email}
                                                    onChange={e => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '0.9rem' }}
                                                />
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={handleCreateCustomer}
                                                    style={{ marginTop: '0.5rem', padding: '0.75rem', fontWeight: '800' }}
                                                >
                                                    Guardar Cliente
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.75rem' }}>Método de Pago</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                            {[
                                { id: 'Efectivo', icon: <Banknote size={20} />, label: 'Efectivo' },
                                { id: 'QR', icon: <QrCode size={20} />, label: 'QR' },
                                { id: 'Mixto', icon: <Split size={20} />, label: 'Mixto' },
                                { id: 'Crédito', icon: <HandCoins size={20} />, label: 'Crédito' }
                            ].map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id)}
                                    disabled={isProcessing}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        padding: '1rem 0.25rem',
                                        borderRadius: '16px',
                                        border: '2px solid',
                                        borderColor: paymentMethod === method.id ? 'hsl(var(--primary))' : 'hsl(var(--border) / 0.4)',
                                        backgroundColor: paymentMethod === method.id ? 'hsl(var(--primary) / 0.05)' : 'white',
                                        color: paymentMethod === method.id ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                                        fontSize: '0.7rem',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {method.icon}
                                    <span>{method.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Specific Payment Inputs */}
                    {paymentMethod === 'Efectivo' && (
                        <div style={{
                            padding: '1.5rem',
                            backgroundColor: 'hsl(var(--secondary) / 0.1)',
                            borderRadius: '20px',
                            border: '1px solid hsl(var(--border) / 0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                        }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem' }}>Indique monto recibido</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amountPaid}
                                        onChange={(e) => setAmountPaid(e.target.value)}
                                        disabled={isProcessing}
                                        style={{
                                            width: '100%',
                                            padding: '1rem 1rem 1rem 2.5rem',
                                            fontSize: '1.5rem',
                                            fontWeight: '900',
                                            borderRadius: '14px',
                                            border: '1px solid hsl(var(--border) / 0.6)',
                                            outline: 'none'
                                        }}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                border: '1px solid hsl(142 76% 36% / 0.2)'
                            }}>
                                <span style={{ fontWeight: '700', opacity: 0.6 }}>Cambio a entregar:</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'hsl(142 76% 36%)' }}>{currencySymbol}{change}</span>
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'Mixto' && (
                        <div style={{
                            padding: '1.5rem',
                            backgroundColor: 'hsl(var(--secondary) / 0.1)',
                            borderRadius: '20px',
                            border: '1px solid hsl(var(--border) / 0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem' }}>Efectivo</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={amountCash}
                                            onChange={(e) => setAmountCash(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2rem', fontSize: '1.1rem', fontWeight: '800', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.6)' }}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem' }}>Digital ({secondaryMethod})</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <div style={{ position: 'relative', flex: 1 }}>
                                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                                            <input
                                                type="text"
                                                readOnly
                                                value={digitalVal}
                                                style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2rem', fontSize: '1.1rem', fontWeight: '800', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'hsl(var(--secondary) / 0.2)' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '2px', backgroundColor: 'hsl(var(--secondary) / 0.4)', padding: '4px', borderRadius: '12px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setSecondaryMethod('QR')}
                                                style={{ padding: '0.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: secondaryMethod === 'QR' ? 'white' : 'transparent', color: secondaryMethod === 'QR' ? 'hsl(var(--primary))' : 'inherit' }}
                                            ><QrCode size={18} /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--primary) / 0.05)', borderRadius: '12px', border: '1px solid hsl(var(--primary) / 0.1)', textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', opacity: 0.6 }}>Total Cubierto: <span style={{ fontWeight: '900', color: 'hsl(var(--primary))', opacity: 1 }}>{currencySymbol}{(cashVal + parseFloat(digitalVal)).toFixed(2)}</span> / {currencySymbol}{total.toFixed(2)}</p>
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'Crédito' && (
                        <div style={{ padding: '1.25rem', backgroundColor: 'hsl(var(--destructive) / 0.05)', borderRadius: '16px', border: '1px solid hsl(var(--destructive) / 0.1)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ color: 'hsl(var(--destructive))' }}><Info size={24} /></div>
                            <div>
                                <p style={{ fontSize: '0.85rem', fontWeight: '700', margin: 0, color: 'hsl(var(--destructive))' }}>Venta a Crédito</p>
                                <p style={{ fontSize: '0.75rem', fontWeight: '500', margin: 0, opacity: 0.7 }}>
                                    {selectedCustomer ? `El monto de ${currencySymbol}${total.toFixed(2)} se sumará a la cuenta de ${selectedCustomer.name}.` : 'Seleccione un cliente para habilitar esta opción.'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ padding: '1.5rem 2rem', backgroundColor: 'hsl(var(--secondary) / 0.05)', borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing || (paymentMethod === 'Crédito' && !selectedCustomer)}
                        className="btn btn-primary shadow-xl shadow-primary/20"
                        style={{ width: '100%', padding: '1.25rem', borderRadius: '18px', fontSize: '1.2rem', fontWeight: '800', gap: '0.75rem' }}
                    >
                        {isProcessing ? (
                            <><RefreshCw size={24} className="animate-spin" /> PROCESANDO...</>
                        ) : (
                            <><CheckCircle size={24} /> CONFIRMAR Y GENERAR TICKET</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
