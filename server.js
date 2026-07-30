const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

const PRODUCTOS_PATH = path.join(__dirname, 'public', 'data', 'productos.json');
const VENTAS_PATH = path.join(__dirname, 'data', 'ventas.json');
const IMG_DIR = path.join(__dirname, 'public', 'img');

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(VENTAS_PATH))) fs.mkdirSync(path.dirname(VENTAS_PATH), { recursive: true });
if (!fs.existsSync(VENTAS_PATH)) fs.writeFileSync(VENTAS_PATH, '[]');

function leerProductos() {
  return JSON.parse(fs.readFileSync(PRODUCTOS_PATH, 'utf-8'));
}

function guardarProductos(data) {
  fs.writeFileSync(PRODUCTOS_PATH, JSON.stringify(data, null, 2));
}

function flattenProductos(productos) {
  const flat = [];
  productos.forEach(p => {
    if (p.variantes) {
      p.variantes.forEach(v => {
        flat.push({ ...v, parentId: p.id, categoria: p.categoria, descripcion: p.descripcion, parentNombre: p.nombre });
      });
    } else {
      flat.push({ ...p });
    }
  });
  return flat;
}

function findProductById(productos, id) {
  for (const p of productos) {
    if (p.id === id) return p;
    if (p.variantes) {
      const v = p.variantes.find(x => x.id === id);
      if (v) return v;
    }
  }
  return null;
}

function findParentOf(productos, id) {
  for (const p of productos) {
    if (p.variantes && p.variantes.some(v => v.id === id)) return p;
  }
  return null;
}

function leerVentas() {
  return JSON.parse(fs.readFileSync(VENTAS_PATH, 'utf-8'));
}

function guardarVentas(data) {
  fs.writeFileSync(VENTAS_PATH, JSON.stringify(data, null, 2));
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo imágenes permitidas'));
  }
});

// ─── API Productos ────────────────────────────────────────────

app.get('/api/productos', (req, res) => {
  try {
    const productos = leerProductos();
    res.json(productos);
  } catch (e) {
    res.status(500).json({ error: 'Error al leer productos' });
  }
});

app.post('/api/productos', (req, res) => {
  try {
    const productos = leerProductos();
    const nuevo = {
      id: Date.now(),
      nombre: req.body.nombre,
      precio: Number(req.body.precio) || 0,
      imagenes: req.body.imagenes || [req.body.imagen || 'img/placeholder.jpg'],
      stock: Number(req.body.stock) || 0,
      categoria: req.body.categoria || '',
      descripcion: req.body.descripcion || ''
    };
    if (req.body.variantes) {
      nuevo.variantes = req.body.variantes;
      delete nuevo.precio;
      delete nuevo.stock;
    }
    productos.push(nuevo);
    guardarProductos(productos);
    res.json(nuevo);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

app.put('/api/productos/:id', (req, res) => {
  try {
    let productos = leerProductos();
    const id = Number(req.params.id);
    const idx = productos.findIndex(p => p.id === id);
    if (idx !== -1) {
      if (req.body.variantes) {
        productos[idx] = {
          ...productos[idx],
          ...req.body,
          id: productos[idx].id,
          variantes: req.body.variantes
        };
        delete productos[idx].precio;
        delete productos[idx].stock;
      } else {
        productos[idx] = {
          ...productos[idx],
          ...req.body,
          id: productos[idx].id
        };
        delete productos[idx].variantes;
      }
      if (req.body.imagen && !req.body.imagenes) {
        productos[idx].imagenes = [req.body.imagen];
      }
      guardarProductos(productos);
      return res.json(productos[idx]);
    }
    const parent = findParentOf(productos, id);
    if (parent) {
      const vIdx = parent.variantes.findIndex(v => v.id === id);
      if (vIdx !== -1) {
        parent.variantes[vIdx] = { ...parent.variantes[vIdx], ...req.body, id: parent.variantes[vIdx].id };
        guardarProductos(productos);
        return res.json(parent.variantes[vIdx]);
      }
    }
    res.status(404).json({ error: 'Producto no encontrado' });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

app.delete('/api/productos/:id', (req, res) => {
  try {
    let productos = leerProductos();
    const id = Number(req.params.id);
    const idx = productos.findIndex(p => p.id === id);
    if (idx !== -1) {
      productos.splice(idx, 1);
      guardarProductos(productos);
      return res.json({ success: true });
    }
    const parent = findParentOf(productos, id);
    if (parent) {
      parent.variantes = parent.variantes.filter(v => v.id !== id);
      if (parent.variantes.length === 0) {
        const pIdx = productos.findIndex(p => p.id === parent.id);
        productos.splice(pIdx, 1);
      }
      guardarProductos(productos);
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Producto no encontrado' });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// ─── Subida de imágenes ───────────────────────────────────────

app.post('/api/upload', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se envió imagen' });
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `producto_${Date.now()}${ext}`;
    const outputPath = path.join(IMG_DIR, filename);
    await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
    res.json({ url: `img/${filename}` });
  } catch (e) {
    res.status(500).json({ error: 'Error al procesar imagen' });
  }
});

app.post('/api/upload-multiple', upload.array('imagenes', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se enviaron imágenes' });
    }
    const urls = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname) || '.jpg';
      const filename = `producto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`;
      const outputPath = path.join(IMG_DIR, filename);
      await sharp(file.buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
      urls.push(`img/${filename}`);
    }
    res.json({ urls });
  } catch (e) {
    res.status(500).json({ error: 'Error al procesar imágenes' });
  }
});

// ─── Ventas ───────────────────────────────────────────────────

app.post('/api/ventas', (req, res) => {
  try {
    const { items, total, metodo, cliente } = req.body;
    let productos = leerProductos();
    for (const item of items) {
      const prod = findProductById(productos, item.id);
      if (!prod) return res.status(400).json({ error: `Producto ID ${item.id} no encontrado` });
      if (prod.stock < item.cantidad) return res.status(400).json({ error: `Stock insuficiente para ${prod.nombre || prod.tono}` });
      prod.stock -= item.cantidad;
    }
    guardarProductos(productos);
    const ventas = leerVentas();
    const venta = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      items,
      total,
      metodo: metodo || 'WhatsApp',
      cliente: cliente || ''
    };
    ventas.push(venta);
    guardarVentas(ventas);
    res.json(venta);
  } catch (e) {
    res.status(500).json({ error: 'Error al registrar venta' });
  }
});

app.get('/api/ventas', (req, res) => {
  try {
    res.json(leerVentas());
  } catch (e) {
    res.status(500).json({ error: 'Error al leer ventas' });
  }
});

// ─── Git Publish ──────────────────────────────────────────────

app.post('/api/git-publish', (req, res) => {
  const publicDir = path.join(__dirname, 'public');
  const docsDir = path.join(__dirname, 'docs');

  try {
    if (fs.existsSync(docsDir)) {
      fs.rmSync(docsDir, { recursive: true, force: true });
    }
    fs.cpSync(publicDir, docsDir, { recursive: true });

    const commands = [
      'git add .',
      'git commit -m "update"',
      'git push origin main'
    ];
    const fullCmd = commands.join(' && ');
    exec(fullCmd, { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) return res.status(500).json({ error: stderr || err.message });
      res.json({ success: true, output: stdout });
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al copiar archivos: ' + e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor Lilihum corriendo en http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});