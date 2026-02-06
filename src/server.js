import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import { Parser } from 'json2csv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import CatalogScraper from './scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicializar Fastify
const fastify = Fastify({
  logger: true
});

// Registrar CORS
await fastify.register(fastifyCors, {
  origin: true
});

// Servir archivos estáticos
await fastify.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/'
});

// Instancia global del scraper
let scraper = null;

// Inicializar scraper
async function initScraper() {
  if (!scraper) {
    scraper = new CatalogScraper();
    await scraper.init();
    console.log('[Server] Scraper inicializado');
  }
  return scraper;
}

// Ruta de health check
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Ruta principal para extraer catálogo
fastify.post('/api/scrape', async (request, reply) => {
  const { url } = request.body;

  if (!url) {
    return reply.status(400).send({
      success: false,
      error: 'URL es requerida'
    });
  }

  try {
    const scraperInstance = await initScraper();
    const products = await scraperInstance.scrape(url);

    return {
      success: true,
      url,
      totalProducts: products.length,
      products,
      scrapedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[API] Error:', error.message);
    return reply.status(500).send({
      success: false,
      error: error.message
    });
  }
});

// Ruta para exportar a CSV
fastify.post('/api/export/csv', async (request, reply) => {
  const { products } = request.body;

  if (!products || !Array.isArray(products)) {
    return reply.status(400).send({
      success: false,
      error: 'Products array es requerido'
    });
  }

  try {
    const fields = ['name', 'description', 'price', 'imageUrl'];
    const parser = new Parser({ fields });
    const csv = parser.parse(products);

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename=catalogo-whatsapp.csv')
      .send(csv);
  } catch (error) {
    console.error('[API] Error exportando CSV:', error.message);
    return reply.status(500).send({
      success: false,
      error: error.message
    });
  }
});

// Ruta para exportar a JSON
fastify.post('/api/export/json', async (request, reply) => {
  const { products } = request.body;

  if (!products || !Array.isArray(products)) {
    return reply.status(400).send({
      success: false,
      error: 'Products array es requerido'
    });
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalProducts: products.length,
    products
  };

  reply
    .header('Content-Type', 'application/json; charset=utf-8')
    .header('Content-Disposition', 'attachment; filename=catalogo-whatsapp.json')
    .send(JSON.stringify(exportData, null, 2));
});

// Cerrar scraper al terminar
const closeGracefully = async (signal) => {
  console.log(`[Server] Recibido ${signal}`);
  if (scraper) {
    await scraper.close();
  }
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', () => closeGracefully('SIGTERM'));
process.on('SIGINT', () => closeGracefully('SIGINT'));

// Iniciar servidor
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`[Server] Servidor corriendo en http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
