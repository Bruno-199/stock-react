import { useEffect, useMemo, useRef, useState } from 'react'

// Utilidades API (mantiene la lógica de autodetección de entorno)
const getApiUrl = () => {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://stock-react-api.onrender.com/api'
  }
  return 'http://localhost:8000/api'
}

const API_BASE_URL = getApiUrl()
const PING_URL = API_BASE_URL.replace('/api', '/ping')

const api = {
  async get(endpoint) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`)
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`)
    return res.json()
  },
  async post(endpoint, data) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`)
    return res.json()
  },
  async put(endpoint, data) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`)
    return res.json()
  },
  async delete(endpoint) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`)
    return res.json()
  }
}

// Toast simple
function useToasts() {
  const [toasts, setToasts] = useState([])
  const show = (message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration)
  }
  return { toasts, show }
}

function Toasts({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <div className="toast-icon">{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}</div>
          <div className="toast-content">{t.message}</div>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [view, setView] = useState('ventas') // ventas | agregar | stock
  const [isNavOpen, setIsNavOpen] = useState(false)

  // Datos principales
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [modoBusqueda, setModoBusqueda] = useState(false)
  const [busquedaProductoId, setBusquedaProductoId] = useState(null)

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const productosPorPagina = 50

  // Venta
  const [ventaActual, setVentaActual] = useState([])
  const [confirmingVenta, setConfirmingVenta] = useState(false)

  // Modal edición
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editProducto, setEditProducto] = useState(null)
  const [agregandoProducto, setAgregandoProducto] = useState(false)
  const [guardandoProducto, setGuardandoProducto] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)

  // Form refs
  const refCodigoVenta = useRef(null)
  const refBusquedaCodigo = useRef(null)
  const refCodigoNuevo = useRef(null)

  const { toasts, show } = useToasts()

  // Keep alive
  useEffect(() => {
    const ping = () => {
      if (!API_BASE_URL.includes('localhost')) {
        fetch(PING_URL).catch(() => {})
      }
    }
    const i1 = setInterval(ping, 300000)
    const t1 = setTimeout(ping, 30000)
    return () => {
      clearInterval(i1)
      clearTimeout(t1)
    }
  }, [])

  // Cargar datos
  const cargarCategorias = async () => {
    try {
      const cats = await api.get('/categorias')
      setCategorias(cats)
    } catch (e) {
      console.error(e)
      show('Error al cargar categorías', 'error')
    }
  }

  const cargarProductos = async () => {
    try {
      const prods = await api.get('/productos')
      setProductos(prods)
    } catch (e) {
      console.error(e)
      show('Error al cargar productos', 'error')
    }
  }

  useEffect(() => {
    cargarCategorias()
    cargarProductos()
  }, [])

  // Navegación
  const mostrarSeccion = (v) => {
    setView(v)
    setPaginaActual(1)
    setIsNavOpen(false)
    if (v === 'stock') {
      setModoBusqueda(false)
      setBusquedaProductoId(null)
      setTimeout(() => refBusquedaCodigo.current?.focus(), 100)
    } else if (v === 'agregar') {
      setTimeout(() => refCodigoNuevo.current?.focus(), 100)
    } else if (v === 'ventas') {
      setTimeout(() => refCodigoVenta.current?.focus(), 100)
    }
  }

  const scrollArriba = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Búsqueda por código (stock)
  const buscarPorCodigo = (codigo) => {
    if (!codigo) {
      show('Por favor ingrese un código para buscar', 'warning')
      return
    }
    const encontrado = productos.find((p) => p.codigo === codigo)
    if (encontrado) {
      setBusquedaProductoId(encontrado.id)
      setModoBusqueda(true)
      setPaginaActual(1)
      show(`Producto encontrado: ${encontrado.nombre}`, 'success')
    } else {
      show('No se encontró producto con ese código', 'error')
    }
  }

  const limpiarBusqueda = () => {
    setModoBusqueda(false)
    setBusquedaProductoId(null)
    setPaginaActual(1)
  }

  // Agregar producto
  const onAgregarProducto = async (e) => {
    e.preventDefault()
    if (agregandoProducto) return
    const form = e.currentTarget
    const codigo = form.codigo.value.trim()
    const nombre = form.nombre.value.trim()
    const precio = Number(form.precio.value)
    const stockInicial = Number(form.stock.value)

    if (!codigo || !nombre) {
      show('El código y nombre son obligatorios', 'error')
      return
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      show('El precio debe ser mayor a 0', 'error')
      return
    }
    if (!Number.isFinite(stockInicial) || stockInicial < 0) {
      show('El stock no puede ser negativo', 'error')
      return
    }

    const producto = {
      nombre,
      codigo,
      categoria_id: parseInt(form.categoria.value),
      precio,
      detalle: form.detalle.value.trim(),
      stock_minimo: 0
    }

    try {
      setAgregandoProducto(true)
      const resp = await api.post('/productos', producto)
      const productoId = resp.id || resp.producto?.id
      if (stockInicial > 0 && productoId) {
        await api.post('/movimientos/entrada', { producto_id: productoId, cantidad: stockInicial })
      }
      form.reset()
      show('Producto agregado exitosamente', 'success')
      await cargarProductos()
    } catch (e) {
      console.error(e)
      show(`Error al agregar producto: ${e.message}`, 'error')
    } finally {
      setAgregandoProducto(false)
    }
  }

  // Eliminar producto
  const eliminarProducto = async (id) => {
    const prod = productos.find((p) => p.id === id)
    const nombre = prod ? prod.nombre : 'este producto'
    if (!confirm(`¿Está seguro de que desea eliminar "${nombre}"?\n\nEsta acción no se puede deshacer.`)) return
    try {
      setEliminandoId(id)
      await api.delete(`/productos/${id}`)
      show(`Producto "${nombre}" eliminado exitosamente`, 'success')
      await cargarProductos()
      if (modoBusqueda && busquedaProductoId === id) limpiarBusqueda()
    } catch (e) {
      console.error(e)
      show(`Error al eliminar producto: ${e.message}`, 'error')
      await cargarProductos()
    } finally {
      setEliminandoId(null)
    }
  }

  // Abrir/guardar edición
  const abrirEditar = (id) => {
    const p = productos.find((x) => x.id === id)
    if (!p) return
    setEditProducto({ ...p })
    setModalAbierto(true)
  }

  const guardarEdicion = async (e) => {
    e.preventDefault()
    if (!editProducto) return
    if (guardandoProducto) return
    try {
      setGuardandoProducto(true)
      const id = editProducto.id
      const payload = {
        nombre: editProducto.nombre,
        codigo: editProducto.codigo,
        categoria_id: parseInt(editProducto.categoria_id),
        precio: Number(editProducto.precio),
        detalle: editProducto.detalle,
        stock_minimo: 0
      }
      if (!Number.isFinite(payload.precio) || payload.precio <= 0) {
        show('Precio inválido', 'error')
        return
      }
      const nuevoStock = Number(editProducto.stock_actual)
      if (!Number.isFinite(nuevoStock) || nuevoStock < 0) {
        show('Cantidad en stock inválida', 'error')
        return
      }
      await api.put(`/productos/${id}`, payload)
      const stockActual = productos.find((p) => p.id === id)?.stock_actual || 0
      const dif = nuevoStock - stockActual
      if (dif > 0) await api.post('/movimientos/entrada', { producto_id: id, cantidad: dif })
      if (dif < 0) await api.post('/movimientos/salida', { producto_id: id, cantidad: Math.abs(dif) })
      show('Producto actualizado exitosamente', 'success')
      setModalAbierto(false)
      setEditProducto(null)
      await cargarProductos()
    } catch (e) {
      console.error(e)
      show(`Error al actualizar producto: ${e.message}`, 'error')
      await cargarProductos()
    } finally {
      setGuardandoProducto(false)
    }
  }

  // Venta
  const procesarCodigoVenta = async (codigo) => {
    try {
      const producto = await api.get(`/productos/codigo/${codigo}`)
      if (producto.stock_actual > 0) {
        agregarProductoAVenta(producto)
      } else {
        show('Producto sin stock disponible', 'warning')
      }
    } catch (e) {
      console.error(e)
      show('Producto no encontrado', 'error')
    }
  }

  const agregarProductoAVenta = (producto) => {
    setVentaActual((venta) => {
      const precio = parseFloat(producto.precio || 0)
      const existente = venta.find((i) => i.id === producto.id)
      if (existente) {
        if (existente.cantidad < producto.stock_actual) {
          const nueva = venta.map((i) =>
            i.id === producto.id ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio } : i
          )
          return nueva
        } else {
          show('Stock insuficiente', 'warning')
          return venta
        }
      }
      return [...venta, { id: producto.id, nombre: producto.nombre, precio, cantidad: 1, subtotal: precio }]
    })
  }

  const actualizarCantidadVenta = (id, nuevaCantidad) => {
    const producto = productos.find((p) => p.id === id)
    if (!producto) return
    if (nuevaCantidad > producto.stock_actual) {
      show('Stock insuficiente', 'warning')
      return
    }
    if (nuevaCantidad <= 0) {
      eliminarProductoVenta(id)
      return
    }
    setVentaActual((venta) =>
      venta.map((i) => (i.id === id ? { ...i, cantidad: nuevaCantidad, subtotal: nuevaCantidad * i.precio } : i))
    )
  }

  const eliminarProductoVenta = (id) => {
    setVentaActual((venta) => venta.filter((i) => i.id !== id))
  }

  const totalVenta = useMemo(
    () => ventaActual.reduce((acc, it) => acc + parseFloat(it.subtotal || 0), 0).toFixed(2),
    [ventaActual]
  )

  const confirmarVenta = async () => {
    // Evitar doble envío
    if (confirmingVenta) return

    if (ventaActual.length === 0) {
      show('No hay productos en la venta actual', 'warning')
      return
    }

    setConfirmingVenta(true)
    try {
      const productosPayload = ventaActual.map((i) => ({ producto_id: i.id, cantidad: i.cantidad }))
      await api.post('/ventas', { productos: productosPayload })
      // Actualizar stock local
      setProductos((prods) =>
        prods.map((p) => {
          const item = ventaActual.find((i) => i.id === p.id)
          if (!item) return p
          return { ...p, stock_actual: Math.max(0, (p.stock_actual || 0) - item.cantidad) }
        })
      )
      setVentaActual([])
      show('Venta realizada con \u00e9xito', 'success')
    } catch (e) {
      console.error(e)
      show(`Error al procesar venta: ${e.message}`, 'error')
      await cargarProductos()
    } finally {
      setConfirmingVenta(false)
    }
  }

  // Derivados para render
  const productoBuscado = useMemo(() => {
    if (!modoBusqueda || busquedaProductoId == null) return null
    return productos.find((p) => p.id === busquedaProductoId) || null
  }, [modoBusqueda, busquedaProductoId, productos])

  useEffect(() => {
    if (!modoBusqueda || busquedaProductoId == null) return
    if (!productoBuscado) limpiarBusqueda()
  }, [modoBusqueda, busquedaProductoId, productoBuscado])

  const productosAUsar = modoBusqueda ? (productoBuscado ? [productoBuscado] : []) : productos
  const totalProductos = productosAUsar.length
  const totalPaginas = Math.ceil(totalProductos / productosPorPagina) || 1
  const inicio = (paginaActual - 1) * productosPorPagina
  const fin = inicio + productosPorPagina
  const productosPagina = productosAUsar.slice(inicio, fin)

  return (
    <div>
      {/* Sidenav */}
      <div id="mySidenav" className="sidenav" style={{ width: isNavOpen ? 250 : 0 }}>
        <a href="#" className="closebtn" onClick={(e) => { e.preventDefault(); setIsNavOpen(false) }}>&times;</a>
        <button className={`nav-btn ${view === 'ventas' ? 'active' : ''}`} onClick={() => mostrarSeccion('ventas')}>Realizar Ventas</button>
        <button className={`nav-btn ${view === 'agregar' ? 'active' : ''}`} onClick={() => mostrarSeccion('agregar')}>Agregar Productos</button>
        <button className={`nav-btn ${view === 'stock' ? 'active' : ''}`} onClick={() => mostrarSeccion('stock')}>Control de Stock</button>
      </div>

      {/* Header */}
      <header>
        <span className="menu-btn" onClick={() => setIsNavOpen(true)}>&#9776; Menu</span>
        <h1>Control de Stock - Kiosco</h1>
      </header>

      <main>
        {/* Ventas */}
        {view === 'ventas' && (
          <section id="ventasSection" className="content-section" style={{ display: 'block' }}>
            <h2>Realizar Venta</h2>
            <div className="venta-container">
              <div className="scanner-section">
                <div className="form-group">
                  <label htmlFor="codigoProducto">Escanear Código de Producto:</label>
                  <input ref={refCodigoVenta} type="text" id="codigoProducto" placeholder="Ingrese o escanee el código..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); procesarCodigoVenta(e.currentTarget.value.trim()); e.currentTarget.value = '' } }} />
                </div>
              </div>

              <div className="venta-actual">
                <h3>Venta Actual</h3>
                <div className="tabla-container">
                  <table id="tablaVenta">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Precio Unit.</th>
                        <th>Cantidad</th>
                        <th>Subtotal</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventaActual.map((item) => (
                        <tr key={item.id}>
                          <td>{item.nombre}</td>
                          <td>${parseFloat(item.precio || 0).toFixed(2)}</td>
                          <td>
                            <input type="number" className="cantidad-input" value={item.cantidad} min={1} onChange={(e) => actualizarCantidadVenta(item.id, parseInt(e.target.value))} />
                          </td>
                          <td>${parseFloat(item.subtotal || 0).toFixed(2)}</td>
                          <td>
                            <button className="btn-eliminar-producto" onClick={() => eliminarProductoVenta(item.id)}>Eliminar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="venta-total">
                  <h3>Total: ${totalVenta}</h3>
                  <button id="confirmarVenta" className="btn-primary" onClick={confirmarVenta} disabled={confirmingVenta} aria-busy={confirmingVenta}>
                    {confirmingVenta ? 'Procesando...' : 'Confirmar Venta'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Agregar */}
        {view === 'agregar' && (
          <section id="agregarSection" className="content-section" style={{ display: 'block' }}>
            <h2>Agregar Nuevo Producto</h2>
            <form id="productoForm" onSubmit={onAgregarProducto}>
              <div className="form-group">
                <label htmlFor="categoria">Categoría:</label>
                <select id="categoria" name="categoria" required disabled={categorias.length === 0}>
                  {categorias.length === 0 && <option value="">Cargando categorías...</option>}
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="codigo">Código:</label>
                <input ref={refCodigoNuevo} type="text" id="codigo" name="codigo" placeholder="Código único del producto" required />
              </div>
              <div className="form-group">
                <label htmlFor="nombre">Nombre:</label>
                <input type="text" id="nombre" name="nombre" required />
              </div>
              <div className="form-group">
                <label htmlFor="detalle">Detalle:</label>
                <textarea id="detalle" name="detalle" required></textarea>
              </div>
              <div className="form-group">
                <label htmlFor="precio">Precio:</label>
                <input type="number" id="precio" name="precio" step="0.01" required />
              </div>
              <div className="form-group">
                <label htmlFor="stock">Cantidad en Stock:</label>
                <input type="number" id="stock" name="stock" required />
              </div>
              <button type="submit" className="btn-primary" disabled={agregandoProducto} aria-busy={agregandoProducto}>
                {agregandoProducto ? 'Guardando...' : 'Agregar Producto'}
              </button>
            </form>
          </section>
        )}

        {/* Stock */}
        {view === 'stock' && (
          <section id="stockSection" className="content-section" style={{ display: 'block' }}>
            <h2>Stock Actual</h2>
            <div className="stock-container">
              <div className="search-container">
                <div className="form-group">
                  <label htmlFor="busquedaCodigo">Búsqueda Rápida - Código de Barras:</label>
                  <div className="search-input-container">
                    <input ref={refBusquedaCodigo} type="text" id="busquedaCodigo" placeholder="Escanee o ingrese el código de barras..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarPorCodigo(e.currentTarget.value.trim()); e.currentTarget.value = '' } }} />
                    <button id="btnVerTodos" className="btn-secondary" onClick={limpiarBusqueda}>Ver Todos</button>
                  </div>
                </div>
              </div>

              <div id="stock-tables" className="stock-tables">
                {!modoBusqueda && categorias.map((cat) => (
                  <div key={cat.id} className="table-wrapper">
                    <h3>{cat.nombre}</h3>
                    <div className="tabla-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Código</th>
                            <th>Precio</th>
                            <th>Stock</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productosPagina
                            .filter((p) => p.categoria_id === cat.id)
                            .map((p) => (
                              <tr key={p.id}>
                                <td>{p.nombre}</td>
                                <td>{p.codigo}</td>
                                <td>${parseFloat(p.precio || 0).toFixed(2)}</td>
                                <td className={p.stock_actual <= 0 ? 'stock-bajo' : ''}>{p.stock_actual}</td>
                                <td>
                                  <button className="btn-editar" onClick={() => abrirEditar(p.id)}>Editar</button>
                                  <button className="btn-eliminar" onClick={() => eliminarProducto(p.id)} disabled={eliminandoId === p.id} aria-busy={eliminandoId === p.id}>
                                    {eliminandoId === p.id ? 'Eliminando...' : 'Eliminar'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {modoBusqueda && (
                  <div className="table-wrapper">
                    <h3>Resultado de búsqueda</h3>
                    <div className="tabla-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Código</th>
                            <th>Precio</th>
                            <th>Stock</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productosPagina.map((p) => (
                            <tr key={p.id}>
                              <td>{p.nombre}</td>
                              <td>{p.codigo}</td>
                              <td>${parseFloat(p.precio || 0).toFixed(2)}</td>
                              <td className={p.stock_actual <= 0 ? 'stock-bajo' : ''}>{p.stock_actual}</td>
                              <td>
                                <button className="btn-editar" onClick={() => abrirEditar(p.id)}>Editar</button>
                                <button className="btn-eliminar" onClick={() => eliminarProducto(p.id)} disabled={eliminandoId === p.id} aria-busy={eliminandoId === p.id}>
                                  {eliminandoId === p.id ? 'Eliminando...' : 'Eliminar'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Paginación */}
              <div id="pagination-controls" className="pagination-controls" style={{ display: modoBusqueda && totalProductos === 1 ? 'none' : 'block' }}>
                <div className="pagination-info">
                  <span id="pagination-text">Mostrando productos {inicio + 1} a {Math.min(fin, totalProductos)} de {totalProductos}</span>
                </div>
                <div className="pagination-buttons">
                  <button
                    id="btn-anterior"
                    className="btn-pagination"
                    onClick={() => {
                      setPaginaActual((p) => Math.max(1, p - 1))
                      scrollArriba()
                    }}
                  >
                    ← Anterior
                  </button>
                  <div id="pagination-numbers" className="pagination-numbers">
                    {/* Opcionalmente se pueden renderizar números de página */}
                  </div>
                  <button
                    id="btn-siguiente"
                    className="btn-pagination"
                    onClick={() => {
                      setPaginaActual((p) => Math.min(totalPaginas, p + 1))
                      scrollArriba()
                    }}
                  >
                    Siguiente →
                  </button>
                </div>
                <div className="pagination-summary">
                  <span id="page-indicator">Página {paginaActual} de {totalPaginas}</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modal editar */}
      {modalAbierto && editProducto && (
        <div id="modalEditar" className="modal" onClick={(e) => { if (e.target.classList.contains('modal')) setModalAbierto(false) }}>
          <div className="modal-content">
            <span className="close" onClick={() => setModalAbierto(false)}>&times;</span>
            <h2>Editar Producto</h2>
            <form id="editarForm" onSubmit={guardarEdicion}>
              <input type="hidden" value={editProducto.id} />
              <div className="form-group">
                <label htmlFor="editCodigo">Código:</label>
                <input type="text" id="editCodigo" value={editProducto.codigo} onChange={(e) => setEditProducto((p) => ({ ...p, codigo: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label htmlFor="editCategoria">Categoría:</label>
                <select id="editCategoria" value={editProducto.categoria_id} onChange={(e) => setEditProducto((p) => ({ ...p, categoria_id: e.target.value }))} required>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="editNombre">Nombre:</label>
                <input type="text" id="editNombre" value={editProducto.nombre} onChange={(e) => setEditProducto((p) => ({ ...p, nombre: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label htmlFor="editDetalle">Detalle:</label>
                <textarea id="editDetalle" value={editProducto.detalle || ''} onChange={(e) => setEditProducto((p) => ({ ...p, detalle: e.target.value }))} required></textarea>
              </div>
              <div className="form-group">
                <label htmlFor="editPrecio">Precio:</label>
                <input type="number" id="editPrecio" step="0.01" value={editProducto.precio} onChange={(e) => setEditProducto((p) => ({ ...p, precio: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label htmlFor="editStock">Cantidad en Stock:</label>
                <input
                  type="number"
                  id="editStock"
                  value={editProducto.stock_actual === '' ? '' : editProducto.stock_actual ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setEditProducto((p) => ({ ...p, stock_actual: value === '' ? '' : parseInt(value) }))
                  }}
                  required
                />
              </div>
              <button type="submit" className="btn-primary" disabled={guardandoProducto} aria-busy={guardandoProducto}>
                {guardandoProducto ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toasts */}
      <Toasts toasts={toasts} />
    </div>
  )
}

export default App
