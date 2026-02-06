# WhatsApp Catalog Scraper

Aplicación web para extraer catálogos públicos de WhatsApp Business.

## Características

- Extrae productos de catálogos públicos de WhatsApp Business
- Interfaz web simple y moderna con Tailwind CSS
- Exportación a JSON y CSV
- Optimizado para Docker/Easypanel
- No requiere escaneo de código QR

## Requisitos

- Docker y Docker Compose
- O Node.js 18+ para desarrollo local

## Despliegue en Easypanel

### Opción 1: Desde Docker Compose

1. Sube este proyecto a un repositorio Git
2. En Easypanel, crea una nueva aplicación desde Git
3. Selecciona "Docker Compose" como método de despliegue
4. Configura el dominio y despliega

### Opción 2: Build desde Dockerfile

1. En Easypanel, crea una nueva aplicación
2. Selecciona "Docker" > "From Dockerfile"
3. Conecta tu repositorio Git
4. El Dockerfile ya está configurado para el puerto 3000

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Ejecutar en producción
npm start
```

## Docker Local

```bash
# Construir imagen
docker-compose build

# Ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

## API Endpoints

### POST /api/scrape
Extrae productos de un catálogo.

**Request:**
```json
{
  "url": "https://wa.me/c/56964151927"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://wa.me/c/56964151927",
  "totalProducts": 10,
  "products": [
    {
      "name": "Producto 1",
      "description": "Descripción del producto",
      "price": "$10.00",
      "imageUrl": "https://..."
    }
  ],
  "scrapedAt": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/export/json
Exporta productos a JSON.

### POST /api/export/csv
Exporta productos a CSV.

### GET /health
Health check del servicio.

## Estructura del Proyecto

```
whatsapp-catalog-scraper/
├── src/
│   ├── server.js      # Servidor Fastify
│   ├── scraper.js     # Lógica de scraping con Puppeteer
│   └── public/
│       └── index.html # Frontend
├── Dockerfile         # Configuración Docker
├── docker-compose.yml # Docker Compose
├── package.json       # Dependencias
└── README.md
```

## Notas Importantes

- Esta herramienta solo funciona con catálogos **públicos** de WhatsApp Business
- No requiere autenticación ni acceso a la API oficial de WhatsApp
- El scraping respeta los límites del sitio web
- Algunos catálogos pueden tener estructuras diferentes y el scraper intentará múltiples estrategias de extracción

## Limitaciones

- Solo extrae información visible públicamente
- La estructura del catálogo de WhatsApp puede cambiar sin previo aviso
- Requiere conexión estable a internet
- El tiempo de extracción depende del tamaño del catálogo

## Licencia

MIT
