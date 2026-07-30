document.addEventListener('DOMContentLoaded', () => {
  const API = {
    productos: '/api/productos',
    uploadMultiple: '/api/upload-multiple',
    ventas: '/api/ventas',
    publish: '/api/git-publish'
  };

  const $ = id => document.getElementById(id);
  const productosTableBody = $('productosTableBody');
  const productoForm = $('productoForm');
  const productoId = $('productoId');
  const prodNombre = $('prodNombre');
  const prodPrecio = $('prodPrecio');
  const prodStock = $('prodStock');
  const prodTieneVariantes = $('prodTieneVariantes');
  const simpleFields = $('simpleFields');
  const variantesEditor = $('variantesEditor');
  const variantesList = $('variantesList');
  const btnAddVariante = $('btnAddVariante');
  const prodImagenes = $('prodImagenes');
  const prodImagenesUrl = $('prodImagenesUrl');
  const prodDescripcion = $('prodDescripcion');
  const prodCategoria = $('prodCategoria');
  const formProductoTitle = $('formProductoTitle');
  const btnNuevoProducto = $('btnNuevoProducto');
  const btnCancelarProducto = $('btnCancelarProducto');
  const btnGuardarProducto = $('btnGuardarProducto');
  const btnAddImagenes = $('btnAddImagenes');
  const imagenesPreview = $('imagenesPreview');
  const ventaProducto = $('ventaProducto');
  const ventaCantidad = $('ventaCantidad');
  const ventaMetodo = $('ventaMetodo');
  const ventaCliente = $('ventaCliente');
  const btnRegistrarVenta = $('btnRegistrarVenta');
  const ventasList = $('ventasList');
  const btnPublicar = $('btnPublicar');
  const publishOutput = $('publishOutput');
  const toast = $('toast');

  let productos = [];
  let editando = false;
  let imagenesActuales = [];
  let variantesActuales = [];

  function showToast(msg, type = 'success') {
    toast.textContent = msg;
    toast.className = `toast toast-${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async function fetchJSON(url, opts = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    return res.json();
  }

  // ─── Variant Toggle ────────────────────────

  prodTieneVariantes.addEventListener('change', () => {
    const checked = prodTieneVariantes.checked;
    simpleFields.style.display = checked ? 'none' : '';
    variantesEditor.style.display = checked ? 'block' : 'none';
    if (checked && variantesActuales.length === 0) {
      addVarianteRow();
    }
  });

  // ─── Variant Editor ────────────────────────

  function addVarianteRow(tono = '', precio = '', stock = '0') {
    variantesActuales.push({ id: null, tono, precio: Number(precio) || 0, stock: Number(stock) || 0 });
    renderVariantes();
  }

  function renderVariantes() {
    variantesList.innerHTML = '';
    variantesActuales.forEach((v, i) => {
      const row = document.createElement('div');
      row.className = 'variante-row';
      row.innerHTML = `
        <input class="v-tono" type="text" placeholder="Ej: 03, Café, Rojo" value="${v.tono}">
        <input class="v-precio" type="number" placeholder="Precio" min="0" value="${v.precio}">
        <input class="v-stock" type="number" placeholder="Stock" min="0" value="${v.stock}">
        <button type="button" class="btn-remove-variante" data-index="${i}">&times;</button>
      `;
      const inputs = row.querySelectorAll('input');
      inputs[0].addEventListener('input', e => { variantesActuales[i].tono = e.target.value; });
      inputs[1].addEventListener('input', e => { variantesActuales[i].precio = Number(e.target.value) || 0; });
      inputs[2].addEventListener('input', e => { variantesActuales[i].stock = Number(e.target.value) || 0; });
      row.querySelector('.btn-remove-variante').addEventListener('click', () => {
        variantesActuales.splice(i, 1);
        renderVariantes();
      });
      variantesList.appendChild(row);
    });
  }

  btnAddVariante.addEventListener('click', () => addVarianteRow());

  // ─── Image Management ──────────────────────

  function renderImagenesPreview() {
    imagenesPreview.innerHTML = '';
    if (imagenesActuales.length === 0) {
      imagenesPreview.innerHTML = '<small style="color:var(--text-light);">Sin imágenes</small>';
      return;
    }
    imagenesActuales.forEach((url, i) => {
      const div = document.createElement('div');
      div.className = 'img-thumb';
      div.innerHTML = `
        <img src="${url}" alt="Imagen ${i + 1}"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect fill=%22%23BF6676%22 width=%2280%22 height=%2280%22/></svg>'">
        <button type="button" class="btn-remove-img" data-index="${i}">&times;</button>
      `;
      div.querySelector('.btn-remove-img').addEventListener('click', () => {
        imagenesActuales.splice(i, 1);
        renderImagenesPreview();
        prodImagenesUrl.value = JSON.stringify(imagenesActuales);
      });
      imagenesPreview.appendChild(div);
    });
    prodImagenesUrl.value = JSON.stringify(imagenesActuales);
  }

  btnAddImagenes.addEventListener('click', () => prodImagenes.click());

  prodImagenes.addEventListener('change', async () => {
    const files = prodImagenes.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const file of files) {
      formData.append('imagenes', file);
    }
    try {
      const res = await fetch(API.uploadMultiple, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.urls && data.urls.length > 0) {
        imagenesActuales = imagenesActuales.concat(data.urls);
        renderImagenesPreview();
        showToast(`${data.urls.length} imagen(es) subida(s)`);
      } else {
        showToast('Error al subir imágenes', 'error');
      }
    } catch (e) {
      showToast('Error al subir imágenes', 'error');
    }
    prodImagenes.value = '';
  });

  // ─── Product Table ─────────────────────────

  async function cargarProductos() {
    try {
      productos = await fetchJSON(API.productos);
      renderProductosTable();
      renderVentaProductos();
    } catch (e) {
      showToast('Error al cargar productos', 'error');
    }
  }

  function renderProductosTable() {
    if (productos.length === 0) {
      productosTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-light);">No hay productos</td></tr>';
      return;
    }

    let html = '';
    productos.forEach(p => {
      if (p.variantes) {
        const totalStock = p.variantes.reduce((s, v) => s + v.stock, 0);
        const precios = p.variantes.map(v => v.precio);
        const minP = Math.min(...precios);
        const maxP = Math.max(...precios);
        const precioStr = minP === maxP ? `$${Number(minP).toLocaleString('es-CO')}` : `$${Number(minP).toLocaleString('es-CO')} – $${Number(maxP).toLocaleString('es-CO')}`;
        const agotado = totalStock === 0 ? 'badge-warn' : 'badge-ok';
        html += `
        <tr class="parent-row">
          <td><strong>${p.nombre}</strong> <span class="badge badge-ok" style="background:var(--secondary);font-size:0.7rem;">${p.variantes.length} variantes</span></td>
          <td>${precioStr}</td>
          <td><span class="badge ${agotado}">${totalStock > 0 ? totalStock : 'Agotado'}</span></td>
          <td class="actions-cell">
            <button class="btn btn-secondary btn-sm" onclick="editarProducto(${p.id})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id})">🗑️</button>
          </td>
        </tr>`;
      } else {
        const agotado = p.stock > 0 ? 'badge-ok' : 'badge-warn';
        html += `
        <tr>
          <td><strong>${p.nombre}</strong></td>
          <td>$${Number(p.precio).toLocaleString('es-CO')}</td>
          <td><span class="badge ${agotado}">${p.stock > 0 ? p.stock : 'Agotado'}</span></td>
          <td class="actions-cell">
            <button class="btn btn-secondary btn-sm" onclick="editarProducto(${p.id})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id})">🗑️</button>
          </td>
        </tr>`;
      }
    });
    productosTableBody.innerHTML = html;
  }

  window.editarProducto = function (id) {
    const p = productos.find(x => x.id === id) || productos.find(x => x.variantes && x.variantes.some(v => v.id === id));
    if (!p) return;
    editando = true;
    productoId.value = p.id;
    prodNombre.value = p.nombre || '';

    const tieneVariantes = !!p.variantes;
    prodTieneVariantes.checked = tieneVariantes;
    simpleFields.style.display = tieneVariantes ? 'none' : '';
    variantesEditor.style.display = tieneVariantes ? 'block' : 'none';

    if (tieneVariantes) {
      variantesActuales = p.variantes.map(v => ({ id: v.id, tono: v.tono || '', precio: v.precio || 0, stock: v.stock || 0 }));
      renderVariantes();
      prodPrecio.value = '';
      prodStock.value = '0';
    } else {
      variantesActuales = [];
      renderVariantes();
      prodPrecio.value = p.precio || '';
      prodStock.value = p.stock || 0;
    }

    prodDescripcion.value = p.descripcion || '';
    prodCategoria.value = p.categoria || '';
    formProductoTitle.textContent = `✏️ Editar: ${p.nombre}`;
    btnGuardarProducto.textContent = '💾 Actualizar';
    btnCancelarProducto.style.display = 'inline-flex';

    imagenesActuales = (p.imagenes && p.imagenes.length > 0)
      ? p.imagenes.filter(url => !url.includes('placeholder'))
      : [];
    renderImagenesPreview();
  };

  window.eliminarProducto = async function (id) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await fetchJSON(`${API.productos}/${id}`, { method: 'DELETE' });
      showToast('Producto eliminado');
      cargarProductos();
    } catch (e) {
      showToast('Error al eliminar', 'error');
    }
  };

  function resetForm() {
    editando = false;
    productoForm.reset();
    productoId.value = '';
    prodCategoria.value = '';
    prodTieneVariantes.checked = false;
    simpleFields.style.display = '';
    variantesEditor.style.display = 'none';
    variantesActuales = [];
    renderVariantes();
    imagenesActuales = [];
    renderImagenesPreview();
    formProductoTitle.textContent = '✏️ Nuevo Producto';
    btnGuardarProducto.textContent = '💾 Guardar';
    btnCancelarProducto.style.display = 'none';
  }

  btnNuevoProducto.addEventListener('click', resetForm);
  btnCancelarProducto.addEventListener('click', resetForm);

  // ─── Form Submit ────────────────────────────

  productoForm.addEventListener('submit', async e => {
    e.preventDefault();
    const imagenes = imagenesActuales;

    let payload = {
      nombre: prodNombre.value,
      categoria: prodCategoria.value,
      descripcion: prodDescripcion.value
    };
    if (imagenes.length > 0) payload.imagenes = imagenes;

    if (prodTieneVariantes.checked) {
      const validas = variantesActuales.filter(v => v.tono.trim() !== '');
      if (validas.length === 0) {
        showToast('Agrega al menos una variante con tono', 'error');
        return;
      }
      payload.variantes = validas.map(v => ({
        id: v.id || Date.now() + Math.floor(Math.random() * 1000),
        tono: v.tono.trim(),
        precio: v.precio,
        stock: v.stock
      }));
    } else {
      if (!prodPrecio.value || Number(prodPrecio.value) <= 0) {
        showToast('Ingresa un precio válido', 'error');
        return;
      }
      payload.precio = Number(prodPrecio.value) || 0;
      payload.stock = Number(prodStock.value) || 0;
    }

    try {
      if (editando) {
        await fetchJSON(`${API.productos}/${productoId.value}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Producto actualizado');
      } else {
        await fetchJSON(API.productos, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Producto creado');
      }
      resetForm();
      cargarProductos();
    } catch (e) {
      showToast('Error al guardar producto', 'error');
    }
  });

  // ─── POS Ventas ─────────────────────────────

  function flattenForSales(productos) {
    const flat = [];
    productos.forEach(p => {
      if (p.variantes) {
        p.variantes.forEach(v => {
          flat.push({ ...v, nombre: `${p.nombre} - Tono ${v.tono}`, parentId: p.id });
        });
      } else {
        flat.push({ ...p });
      }
    });
    return flat;
  }

  function renderVentaProductos() {
    const flat = flattenForSales(productos);
    ventaProducto.innerHTML = flat
      .filter(p => p.stock > 0)
      .map(p => `<option value="${p.id}">${p.nombre} - $${Number(p.precio).toLocaleString('es-CO')} (${p.stock} uds)</option>`)
      .join('');
    if (ventaProducto.options.length === 0) {
      ventaProducto.innerHTML = '<option value="">Sin stock disponible</option>';
    }
  }

  btnRegistrarVenta.addEventListener('click', async () => {
    const id = Number(ventaProducto.value);
    const cantidad = Number(ventaCantidad.value);
    const metodo = ventaMetodo.value;
    const cliente = ventaCliente.value.trim();
    if (!id || cantidad < 1) { showToast('Selecciona producto y cantidad válida', 'error'); return; }
    const flat = flattenForSales(productos);
    const prod = flat.find(p => p.id === id);
    if (!prod) { showToast('Producto no encontrado', 'error'); return; }
    if (cantidad > prod.stock) { showToast(`Stock insuficiente (disponible: ${prod.stock})`, 'error'); return; }

    try {
      await fetchJSON(API.ventas, {
        method: 'POST',
        body: JSON.stringify({
          items: [{ id, cantidad, nombre: prod.nombre, precio: prod.precio }],
          total: prod.precio * cantidad,
          metodo,
          cliente
        })
      });
      showToast(`Venta registrada: ${prod.nombre} x${cantidad}`);
      ventaCantidad.value = 1;
      ventaCliente.value = '';
      cargarProductos();
      cargarVentas();
    } catch (e) {
      showToast('Error al registrar venta', 'error');
    }
  });

  // ─── Ventas ─────────────────────────────────

  async function cargarVentas() {
    try {
      const ventas = await fetchJSON(API.ventas);
      if (ventas.length === 0) {
        ventasList.innerHTML = '<p style="color:var(--text-light);">Sin ventas registradas</p>';
        return;
      }
      ventasList.innerHTML = ventas.slice().reverse().slice(0, 20).map(v => `
        <div class="venta-item">
          <strong>#${v.id}</strong> — ${new Date(v.fecha).toLocaleString('es-CO')}
          <div>
            ${v.items.map(i => `${i.nombre} x${i.cantidad}`).join(', ')}
          </div>
          <div class="venta-meta">
            Total: <strong>$${Number(v.total).toLocaleString('es-CO')}</strong>
            | Método: ${v.metodo}
            ${v.cliente ? `| Cliente: ${v.cliente}` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) {
      ventasList.innerHTML = '<p style="color:var(--text-light);">Error al cargar ventas</p>';
    }
  }

  // ─── Git Publish ────────────────────────────

  btnPublicar.addEventListener('click', async () => {
    btnPublicar.disabled = true;
    btnPublicar.textContent = '⏳ Publicando...';
    publishOutput.style.display = 'block';
    publishOutput.textContent = 'Ejecutando git add, commit y push...';
    try {
      const res = await fetch(API.publish, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        publishOutput.textContent = data.output || '✅ Publicado correctamente';
        showToast('✅ Cambios publicados en GitHub Pages');
      } else {
        publishOutput.textContent = data.error || 'Error desconocido';
        showToast('❌ Error al publicar', 'error');
      }
    } catch (e) {
      publishOutput.textContent = 'Error de conexión con el servidor';
      showToast('Error de conexión', 'error');
    }
    btnPublicar.disabled = false;
    btnPublicar.textContent = '🚀 Publicar en GitHub Pages';
  });

  // ─── Init ───────────────────────────────────

  cargarProductos();
  cargarVentas();
});
