import puppeteer from 'puppeteer';

/**
 * WhatsApp Catalog Scraper
 * Extrae productos del catálogo público de WhatsApp Business
 */
export class CatalogScraper {
  constructor() {
    this.browser = null;
  }

  /**
   * Inicializa el navegador con configuración para Docker
   */
  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--single-process'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
  }

  /**
   * Cierra el navegador
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Valida y normaliza la URL del catálogo de WhatsApp
   * @param {string} url - URL del catálogo
   * @returns {string} URL normalizada
   */
  normalizeUrl(url) {
    // Acepta formatos: wa.me/c/PHONE, api.whatsapp.com/c/PHONE
    const patterns = [
      /https?:\/\/wa\.me\/c\/(\d+)/,
      /https?:\/\/api\.whatsapp\.com\/c\/(\d+)/,
      /https?:\/\/wa\.me\/message\/(\w+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return url;
      }
    }

    // Intentar extraer número de teléfono directo
    const phoneMatch = url.match(/(\d{10,15})/);
    if (phoneMatch) {
      return `https://wa.me/c/${phoneMatch[1]}`;
    }

    throw new Error('URL de catálogo de WhatsApp inválida. Usa el formato: https://wa.me/c/NUMERO');
  }

  /**
   * Extrae el catálogo de productos
   * @param {string} catalogUrl - URL del catálogo de WhatsApp
   * @returns {Promise<Array>} Lista de productos
   */
  async scrape(catalogUrl) {
    const url = this.normalizeUrl(catalogUrl);
    
    if (!this.browser) {
      await this.init();
    }

    const page = await this.browser.newPage();
    
    try {
      // Configurar viewport y user agent
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      console.log(`[Scraper] Navegando a: ${url}`);
      
      // Navegar a la página del catálogo
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Esperar un poco para que cargue el contenido dinámico
      await page.waitForTimeout(3000);

      // Obtener URL final después de redirecciones
      const finalUrl = page.url();
      console.log(`[Scraper] URL final: ${finalUrl}`);

      // Tomar screenshot para debug (opcional)
      // await page.screenshot({ path: 'debug.png', fullPage: true });

      // Intentar diferentes selectores según la estructura de la página
      const products = await this.extractProducts(page);
      
      console.log(`[Scraper] Productos encontrados: ${products.length}`);
      
      return products;
    } catch (error) {
      console.error('[Scraper] Error:', error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Extrae los productos de la página usando múltiples estrategias
   * @param {Object} page - Página de Puppeteer
   * @returns {Promise<Array>} Lista de productos
   */
  async extractProducts(page) {
    // Estrategia 1: Selectores comunes de catálogo WhatsApp
    let products = await page.evaluate(() => {
      const items = [];
      
      // Selectores conocidos para catálogos de WhatsApp
      const selectors = [
        // Selector principal del catálogo web
        '[data-testid="product-item"]',
        '.product-item',
        '[class*="product"]',
        '[class*="catalog"] [class*="item"]',
        // Selectores alternativos
        'div[role="listitem"]',
        '[class*="ProductCard"]',
        '[class*="catalog-item"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el, index) => {
            // Extraer imagen
            const imgEl = el.querySelector('img');
            const imageUrl = imgEl?.src || imgEl?.getAttribute('data-src') || '';
            
            // Extraer nombre del producto
            const nameEl = el.querySelector('h1, h2, h3, h4, [class*="name"], [class*="title"]');
            const name = nameEl?.textContent?.trim() || `Producto ${index + 1}`;
            
            // Extraer descripción
            const descEl = el.querySelector('p, [class*="description"], [class*="desc"]');
            const description = descEl?.textContent?.trim() || '';
            
            // Extraer precio
            const priceEl = el.querySelector('[class*="price"], [class*="Price"]');
            const price = priceEl?.textContent?.trim() || '';

            items.push({
              name,
              description,
              price,
              imageUrl
            });
          });
          break;
        }
      }

      return items;
    });

    // Estrategia 2: Si no encontramos con selectores, buscar por estructura
    if (products.length === 0) {
      products = await page.evaluate(() => {
        const items = [];
        
        // Buscar todas las imágenes con cierto tamaño (productos suelen tener imágenes)
        const images = document.querySelectorAll('img');
        const productImages = Array.from(images).filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > 100 && rect.height > 100;
        });

        productImages.forEach((img, index) => {
          // Buscar contenedor padre
          let container = img.parentElement;
          for (let i = 0; i < 5 && container; i++) {
            const textNodes = container.querySelectorAll('span, p, h1, h2, h3, h4, div');
            const texts = Array.from(textNodes)
              .map(n => n.textContent?.trim())
              .filter(t => t && t.length > 0 && t.length < 500);
            
            if (texts.length >= 2) {
              items.push({
                name: texts[0] || `Producto ${index + 1}`,
                description: texts.slice(1, -1).join(' ').substring(0, 200) || '',
                price: texts[texts.length - 1] || '',
                imageUrl: img.src || ''
              });
              break;
            }
            container = container.parentElement;
          }
        });

        return items;
      });
    }

    // Estrategia 3: Intentar scroll para cargar más productos (lazy loading)
    if (products.length === 0) {
      await this.autoScroll(page);
      
      // Re-intentar extracción después del scroll
      products = await page.evaluate(() => {
        const items = [];
        const allDivs = document.querySelectorAll('div');
        
        allDivs.forEach(div => {
          const style = window.getComputedStyle(div);
          const hasImage = div.querySelector('img');
          const hasText = div.textContent?.length > 10;
          
          if (hasImage && hasText && style.display !== 'none') {
            const rect = div.getBoundingClientRect();
            if (rect.height > 150 && rect.height < 600) {
              const img = div.querySelector('img');
              const text = div.textContent?.trim() || '';
              
              if (img?.src && text.length > 5) {
                items.push({
                  name: text.split('\n')[0]?.substring(0, 100) || 'Sin nombre',
                  description: text.split('\n').slice(1).join(' ').substring(0, 200) || '',
                  price: text.match(/[\$€£][\d,\.]+/)?.[0] || '',
                  imageUrl: img.src
                });
              }
            }
          }
        });

        // Eliminar duplicados
        return items.filter((item, index, self) =>
          index === self.findIndex(t => t.imageUrl === item.imageUrl && t.name === item.name)
        );
      });
    }

    return products;
  }

  /**
   * Realiza scroll automático para cargar contenido lazy-loaded
   * @param {Object} page - Página de Puppeteer
   */
  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    // Esperar a que cargue el contenido después del scroll
    await page.waitForTimeout(2000);
  }
}

export default CatalogScraper;
