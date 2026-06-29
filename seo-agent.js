const express = require("express");
const OpenAI = require("openai");
const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();

const app = express();
app.use(express.json());

// Configuración OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔥 MIGRACIÓN: ASSISTANT_ID -> ya no se usa (Assistants API deprecada).
// El modelo ahora se especifica en cada llamada vía OPENAI_MODEL.
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

// 🔥 MIGRACIÓN: las instrucciones del Assistant (antes guardadas en el
// dashboard de OpenAI) ahora viven aquí, como una constante de texto.
// Este Assistant NO usa function calling (confirmado), así que no hace
// falta ningún array de TOOLS para este bot.
const SYSTEM_INSTRUCTIONS = `# AGENTE SEO - CONSTRUCTORA SARMIENTO RODAS

Eres un experto en SEO especializado en el sector inmobiliario de Ecuador, específicamente para Constructora Sarmiento Rodas. Tu misión es analizar el rendimiento orgánico del sitio web y generar contenido optimizado para mejorar posicionamiento y conversiones.

## CONTEXTO DEL NEGOCIO

**Empresa:** Constructora Sarmiento Rodas
**Sitio web:** www.sarmientorodascr.com
**Ubicación:** Quito, Ecuador (Valle de los Chillos)
**Productos principales:**
- **Porto Alegre:** Casas VIP de 3-4 dormitorios ($105,000 - $136,000)
- **Villa Venetto:** Departamentos VIP de 1-2 dormitorios ($55,000 - $75,900)

**Financiamiento:** Crédito VIP (hasta 95% financiamiento a 25 años al 4.99%)

**Buyer Personas:**
1. Familias jóvenes (30-45 años) buscando primera vivienda
2. Profesionales solteros/parejas jóvenes buscando departamentos
3. Inversionistas buscando propiedades VIP para renta

**Keywords estratégicas:**
- Casas VIP Quito
- Departamentos VIP Valle de los Chillos
- Crédito hipotecario VIP Ecuador
- Viviendas de interés prioritario

## TUS CAPACIDADES

Tienes 4 funciones principales:

### 1. AUDIT_FROM_KPIs
Analizas el Watchlist de keywords y detectas problemas críticos:
- Keywords que cayeron >3 posiciones
- CTR por debajo del objetivo
- Impresiones altas pero bajo CTR
- Oportunidades de mejora rápida

**Output:** Reporte JSON con problemas priorizados y acciones específicas.

### 2. GENERATE_BLOG_POST
Creas artículos de blog optimizados para SEO:
- Longitud: 800-1,200 palabras
- Estructura: H1, H2, H3 lógicos
- Keywords naturalmente integradas
- CTAs específicos por proyecto
- Schema markup incluido

**Output:** Artículo completo en HTML listo para WordPress.

### 3. OPTIMIZE_PAGE
Analizas una página existente y generas mejoras:
- Nuevo título SEO (55-60 caracteres)
- Nueva meta description (150-160 caracteres)
- Sugerencias de keywords faltantes
- Recomendaciones de enlaces internos

**Output:** Código listo para copy/paste en WordPress.

### 4. CONTENT_STRATEGY
Creas un plan editorial mensual:
- 4-8 artículos por mes
- Mix de contenido transaccional/informacional
- Keywords objetivo por artículo
- Calendario de publicación

**Output:** Tabla con plan completo del mes.

## REGLAS DE ORO

1. **Siempre escribe en español de Ecuador**
   - Usa "departamento" no "apartamento"
   - "Crédito hipotecario" no "hipoteca"
   - "Valle de los Chillos" siempre con mayúsculas

2. **Tono de voz:**
   - Profesional pero cercano
   - Informativo sin ser aburrido
   - Inspiracional sin ser exagerado
   - Usa emojis sutilmente (🏡 🌳 ✨)

3. **CTAs específicos por proyecto:**
   - Porto Alegre: "¡Agenda tu visita a Porto Alegre hoy!"
   - Villa Venetto: "Conoce los departamentos de Villa Venetto"
   - General: "Contáctanos para más información"

4. **Keywords naturales:**
   - NUNCA stuffing de keywords
   - Integra naturalmente en el texto
   - Usa variaciones y sinónimos

5. **Estructura perfecta:**
   - H1: Único, con keyword principal
   - H2: 3-5 secciones principales
   - H3: Subsecciones cuando sea necesario
   - Párrafos cortos (2-3 líneas)
   - Listas y bullets para scannability

6. **Datos específicos:**
   - Menciona precios exactos cuando sea relevante
   - Usa ubicaciones específicas (Valle de los Chillos, Armenia 2)
   - Referencias al financiamiento VIP
   - Ventajas competitivas reales

## FORMATO DE RESPUESTAS

### Para AUDIT:
\`\`\`json
{
  "summary": "Resumen ejecutivo en 2-3 líneas",
  "critical_issues": [
    {
      "keyword": "nombre de la keyword",
      "problem": "descripción del problema",
      "impact": "alto/medio/bajo",
      "action": "acción específica recomendada"
    }
  ],
  "opportunities": [
    {
      "keyword": "nombre de la keyword",
      "opportunity": "descripción de la oportunidad",
      "estimated_gain": "+X clics/mes"
    }
  ],
  "quick_wins": [
    "Acción 1 específica",
    "Acción 2 específica",
    "Acción 3 específica"
  ]
}
\`\`\`

### Para GENERATE_BLOG_POST:
HTML completo con:
- Title tag optimizado
- Meta description
- H1 con keyword
- Contenido estructurado
- CTAs integrados
- Schema markup al final

### Para OPTIMIZE_PAGE:
\`\`\`
TÍTULO SEO (actual vs nuevo):
Actual: [título actual]
Nuevo: [título optimizado]

META DESCRIPTION (actual vs nueva):
Actual: [meta actual]
Nueva: [meta optimizada]

MEJORAS ADICIONALES:
1. [Sugerencia específica]
2. [Sugerencia específica]
3. [Sugerencia específica]
\`\`\`

## EJEMPLOS DE CALIDAD

**Buen título:**
✅ "Casas VIP en el Valle de los Chillos desde $105,000 | Porto Alegre"

**Mal título:**
❌ "Compra casas VIP en Quito Valle de los Chillos con crédito hipotecario"

**Buena meta:**
✅ "Descubre Porto Alegre: casas VIP de 3 dormitorios en el Valle de los Chillos. Financiamiento hasta 95% a 25 años. ¡Visítanos hoy!"

**Mala meta:**
❌ "Casas VIP, departamentos, crédito hipotecario, Valle de los Chillos, Quito, Ecuador, financiamiento, vivienda prioritaria."

## RESTRICCIONES

❌ NO hacer:
- Inventar datos de precios o características
- Prometer cosas que no ofrece la constructora
- Usar lenguaje técnico complejo innecesario
- Crear contenido de más de 1,500 palabras sin razón
- Mencionar competidores directamente

✅ SÍ hacer:
- Usar datos reales del contexto
- Ser específico con ubicaciones y precios
- Crear urgencia sutil ("Últimas unidades disponibles")
- Destacar ventajas del financiamiento VIP
- Incluir social proof ("Más de 100 familias felices")

## TU OBJETIVO PRINCIPAL

Aumentar el tráfico orgánico de calidad que genere leads reales para Constructora Sarmiento Rodas, posicionando a Porto Alegre y Villa Venetto como las mejores opciones de vivienda VIP en el Valle de los Chillos.

Cada pieza de contenido que generes debe acercar a un potencial cliente a agendar una visita o solicitar información.`;

// Configuración WordPress
const WP_BASE_URL = process.env.WP_BASE_URL;
const WP_USER = process.env.WP_USER;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const WP_AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * 🔥 MIGRACIÓN: runAssistant — antes: crear thread, crear mensaje, crear
 * run, hacer polling de run.status con un while loop. Ahora: UNA llamada
 * síncrona a openai.responses.create() con instructions + input. Como
 * este bot no usa function calling y cada petición es independiente (no
 * hay conversación persistente entre llamadas — cada endpoint crea un
 * thread nuevo en el código original), no se necesita previous_response_id
 * ni manejo de tool_calls. Es la migración más simple posible.
 */
async function runAssistant(userMessage) {
  try {
    console.log('[OpenAI] 📨 Llamando a responses.create()...');

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      instructions: SYSTEM_INSTRUCTIONS,
      input: userMessage,
    });

    console.log('[OpenAI] ✅ Respuesta recibida:', response.id);

    const responseText = response.output_text;

    if (!responseText) {
      throw new Error('La respuesta del modelo no contiene texto');
    }

    return responseText;

  } catch (error) {
    console.error('[OpenAI] ❌ Error:', error.message);
    throw error;
  }
}


/**
 * Extrae datos SEO de una URL usando web scraping
 */
async function scrapePageData(url) {
  try {
    console.log('[Scraper] 🌐 Extrayendo datos de:', url);
    
    // Hacer request con timeout y user agent
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEO-Agent/1.0; +https://seo-agent-constructora.onrender.com)'
      },
      maxContentLength: 500000 // Limitar a 500KB
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extraer datos SEO
    const pageData = {
      // Título
      title: $('title').text().trim() || 
             $('meta[property="og:title"]').attr('content') || 
             'Sin título',
      
      // Meta description
      description: $('meta[name="description"]').attr('content') || 
                   $('meta[property="og:description"]').attr('content') || 
                   'Sin meta description',
      
      // Headings
      h1: $('h1').first().text().trim() || 'Sin H1',
      h2s: $('h2').map((i, el) => $(el).text().trim()).get().slice(0, 5),
      
      // Contenido principal (primeros 500 caracteres)
      mainContent: $('article, main, .content, #content')
        .first()
        .text()
        .trim()
        .replace(/\s+/g, ' ')
        .substring(0, 500) || 
        $('body').text().trim().replace(/\s+/g, ' ').substring(0, 500),
      
      // Meta adicionales
      ogImage: $('meta[property="og:image"]').attr('content') || null,
      canonical: $('link[rel="canonical"]').attr('href') || url,
      
      // Schema markup (detectar si existe)
      hasSchema: $('script[type="application/ld+json"]').length > 0,
      
      // Contar palabras aproximadamente
      wordCount: $('body').text().trim().split(/\s+/).length
    };
    
    console.log('[Scraper] ✅ Datos extraídos exitosamente');
    console.log(`[Scraper] 📊 Título: ${pageData.title.substring(0, 50)}...`);
    console.log(`[Scraper] 📊 H1: ${pageData.h1.substring(0, 50)}...`);
    console.log(`[Scraper] 📊 Palabras: ~${pageData.wordCount}`);
    
    return pageData;
    
  } catch (error) {
    console.error('[Scraper] ❌ Error:', error.message);
    
    // Si falla el scraping, devolver datos vacíos
    return {
      title: 'Error al extraer título',
      description: 'Error al extraer descripción',
      h1: 'Error al extraer H1',
      h2s: [],
      mainContent: '',
      error: error.message
    };
  }
}

/**
 * Publica un artículo en WordPress
 */
async function publishToWordPress(title, content, status = 'draft') {
  try {
    console.log('[WordPress] 📝 Publicando artículo...');
    
    // Extraer título del HTML si es posible
    const titleMatch = content.match(/<title>([^<]+)<\/title>/i) || 
                      content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const finalTitle = titleMatch ? titleMatch[1].trim() : title;
    
    // Preparar body
    const body = {
      title: finalTitle,
      content: content,
      status: status
    };
    
    // Agregar categoría solo si está configurada
    const defaultCategory = process.env.WP_DEFAULT_CATEGORY_ID;
    if (defaultCategory) {
      body.categories = [parseInt(defaultCategory)];
    }
    
    const response = await axios.post(
      `${WP_BASE_URL}/wp-json/wp/v2/posts`,
      body,
      {
        headers: {
          'Authorization': `Basic ${WP_AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('[WordPress] ✅ Artículo publicado:', response.data.link);
    
    return {
      success: true,
      post_id: response.data.id,
      url: response.data.link,
      title: finalTitle
    };
    
  } catch (error) {
    console.error('[WordPress] ❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Actualiza los metacampos SEO de una página
 */
async function updatePageSEO(postId, seoData, postType = 'property') {
  try {
    console.log('[WordPress] 🔧 Actualizando SEO de página:', postId);
    
    const response = await axios.post(
      `${WP_BASE_URL}/wp-json/wp/v2/${postType}/${postId}`,
      {
        meta: {
          _yoast_wpseo_title: seoData.title,
          _yoast_wpseo_metadesc: seoData.description
        }
      },
      {
        headers: {
          'Authorization': `Basic ${WP_AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('[WordPress] ✅ SEO actualizado');
    
    return {
      success: true,
      url: response.data.link
    };
    
  } catch (error) {
    console.error('[WordPress] ❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// ENDPOINTS
// ============================================

/**
 * Endpoint de verificación
 */
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Agente SEO - Constructora Sarmiento Rodas",
    version: "1.2.0",
    endpoints: {
      audit: "/audit",
      generate_post: "/generate-post",
      optimize_page: "/optimize-page (con scraping automático)",
      update_seo_metas: "/update-seo-metas",
      content_strategy: "/content-strategy"
    },
    features: {
      web_scraping: true,
      auto_analysis: true,
      wordpress_integration: true
    }
  });
});

/**
 * ENDPOINT 1: Auditoría del Watchlist
 * Analiza las keywords y detecta problemas
 */
app.post("/audit", async (req, res) => {
  try {
    console.log('[Audit] 🔍 Iniciando auditoría...');
    
    const watchlist = req.body.watchlist || [];
    
    if (watchlist.length === 0) {
      return res.status(400).json({
        error: "No se recibieron keywords en el watchlist"
      });
    }
    
    // Construir mensaje para el Assistant
    const userMessage = `
TAREA: AUDIT_FROM_KPIs

Analiza este Watchlist y genera un reporte de auditoría SEO:

${JSON.stringify(watchlist, null, 2)}

Instrucciones:
1. Identifica keywords con problemas críticos (posición lejos del objetivo, CTR bajo)
2. Detecta oportunidades de mejora rápida (quick wins)
3. Prioriza las acciones más impactantes
4. Genera reporte en formato JSON como se especifica en tus instrucciones

Responde SOLO con el JSON, sin texto adicional.
`;
    
    const response = await runAssistant(userMessage);
    
    // Intentar parsear como JSON
    let auditData;
    try {
      // Extraer JSON del response (en caso de que venga con markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        auditData = JSON.parse(jsonMatch[0]);
      } else {
        auditData = JSON.parse(response);
      }
    } catch (parseError) {
      // Si no es JSON válido, devolver como texto
      auditData = {
        raw_response: response
      };
    }
    
    console.log('[Audit] ✅ Auditoría completada');
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      audit: auditData
    });
    
  } catch (error) {
    console.error('[Audit] ❌ Error:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * ENDPOINT 2: Generar artículo de blog
 * Crea contenido optimizado para una keyword
 */
app.post("/generate-post", async (req, res) => {
  try {
    console.log('[GeneratePost] ✍️ Generando artículo...');
    
    const { keyword, project, intent, publish } = req.body;
    
    if (!keyword) {
      return res.status(400).json({
        error: "Se requiere el parámetro 'keyword'"
      });
    }
    
    const userMessage = `
TAREA: GENERATE_BLOG_POST

Crea un artículo de blog optimizado para esta keyword:

Keyword: ${keyword}
Proyecto relacionado: ${project || "General"}
Intención: ${intent || "informacional"}

Requisitos:
1. Longitud: 800-1,200 palabras
2. Estructura clara con H1, H2, H3
3. Keyword integrada naturalmente
4. CTAs apropiados para ${project || "la constructora"}
5. Incluir schema markup al final
6. Formato HTML listo para WordPress

Responde con el HTML completo del artículo.
`;
    
    const articleHTML = await runAssistant(userMessage);
    
    // Si se solicita publicar automáticamente
    if (publish) {
      const wpResult = await publishToWordPress(
        keyword,
        articleHTML,
        'draft' // Siempre como borrador para revisión
      );
      
      return res.json({
        success: true,
        article: articleHTML,
        wordpress: wpResult
      });
    }
    
    console.log('[GeneratePost] ✅ Artículo generado');
    
    res.json({
      success: true,
      article: articleHTML,
      note: "Artículo generado. Usa 'publish: true' para publicar en WordPress."
    });
    
  } catch (error) {
    console.error('[GeneratePost] ❌ Error:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * ENDPOINT 3: Optimizar página existente (CON SCRAPING AUTOMÁTICO)
 * Analiza una página y sugiere mejoras de SEO
 */
app.post("/optimize-page", async (req, res) => {
  try {
    console.log('[OptimizePage] 🔧 Optimizando página...');
    
    const { url, keyword } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: "Se requiere el parámetro 'url'"
      });
    }
    
    // NUEVO: Extraer datos de la página automáticamente
    const pageData = await scrapePageData(url);
    
    // Si hubo error en el scraping pero no crítico, continuar con datos parciales
    const userMessage = `
TAREA: OPTIMIZE_PAGE

Analiza y optimiza esta página usando los datos extraídos automáticamente:

**URL:** ${url}

**DATOS ACTUALES EXTRAÍDOS:**
- **Título SEO actual:** ${pageData.title}
- **Meta description actual:** ${pageData.description}
- **H1 principal:** ${pageData.h1}
- **H2s encontrados:** ${pageData.h2s.join(', ') || 'Ninguno'}
- **Cantidad de palabras:** ~${pageData.wordCount}
- **Tiene schema markup:** ${pageData.hasSchema ? 'Sí' : 'No'}
- **Vista previa del contenido:** ${pageData.mainContent.substring(0, 200)}...

${keyword ? `**Keyword objetivo:** ${keyword}` : ''}

${pageData.error ? `⚠️ Nota: Hubo un error parcial al extraer datos (${pageData.error}), pero continúa con lo disponible.` : ''}

**GENERA:**
1. Nuevo título SEO optimizado (55-60 caracteres)
   - Debe incluir keyword principal
   - Debe ser más atractivo que el actual
   - Formato natural, no robótico

2. Nueva meta description (150-160 caracteres)
   - Debe incluir keyword principal
   - Debe tener CTA claro
   - Debe ser más persuasiva que la actual

3. 3-5 sugerencias de mejora específicas basadas en el contenido analizado:
   - Estructura de headings
   - Oportunidades de contenido
   - Schema markup (si falta)
   - Enlaces internos
   - Cualquier problema detectado

Usa el formato estructurado especificado en tus instrucciones.
`;
    
    const recommendations = await runAssistant(userMessage);
    
    console.log('[OptimizePage] ✅ Optimización completada');
    
    res.json({
      success: true,
      url: url,
      current_data: {
        title: pageData.title,
        description: pageData.description,
        h1: pageData.h1,
        word_count: pageData.wordCount,
        has_schema: pageData.hasSchema
      },
      recommendations: recommendations,
      scraped: !pageData.error
    });
    
  } catch (error) {
    console.error('[OptimizePage] ❌ Error:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * ENDPOINT 4: Actualizar metas SEO de una página
 * Actualiza SOLO el título y meta description sin tocar el contenido
 */
app.post("/update-seo-metas", async (req, res) => {
  try {
    console.log('[UpdateSEOMetas] 🔧 Actualizando metas SEO...');
    
    const { post_id, post_type, title, description } = req.body;
    
    if (!post_id || !title || !description) {
      return res.status(400).json({
        error: "Se requieren los parámetros: post_id, title, description"
      });
    }
    
    const typeEndpoint = post_type || 'property';
    
    console.log(`[UpdateSEOMetas] 📝 Actualizando post ${post_id} (${typeEndpoint})`);
    
    // Usar la función auxiliar existente
    const result = await updatePageSEO(
      post_id,
      { title, description },
      typeEndpoint
    );
    
    console.log('[UpdateSEOMetas] ✅ Metas actualizadas correctamente');
    
    res.json({
      success: true,
      post_id: post_id,
      url: result.url,
      updated: {
        title: title,
        description: description
      },
      message: "Metas SEO actualizadas exitosamente"
    });
    
  } catch (error) {
    console.error('[UpdateSEOMetas] ❌ Error:', error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

/**
 * ENDPOINT 5: Estrategia de contenido mensual
 * Genera plan editorial del mes
 */
app.post("/content-strategy", async (req, res) => {
  try {
    console.log('[ContentStrategy] 📅 Generando plan editorial...');
    
    const { month, posts_per_month, priority_project } = req.body;
    
    const userMessage = `
TAREA: CONTENT_STRATEGY

Genera un plan editorial mensual:

Mes: ${month || new Date().toISOString().slice(0, 7)}
Cantidad de posts: ${posts_per_month || 4}
Proyecto prioritario: ${priority_project || "Porto Alegre"}

Crea un calendario con:
1. Título del artículo
2. Keyword objetivo
3. Tipo de contenido (transaccional/informacional)
4. Fecha sugerida de publicación
5. Brief de 2-3 líneas

Formato: Tabla markdown clara y organizada.
`;
    
    const strategy = await runAssistant(userMessage);
    
    console.log('[ContentStrategy] ✅ Estrategia generada');
    
    res.json({
      success: true,
      month: month || new Date().toISOString().slice(0, 7),
      strategy: strategy
    });
    
  } catch (error) {
    console.error('[ContentStrategy] ❌ Error:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║  🚀 Agente SEO - Constructora Sarmiento Rodas  ║
╚════════════════════════════════════════════════╝

✅ Servidor activo en puerto ${PORT}
✅ Modelo OpenAI: ${OPENAI_MODEL}
✅ WordPress: ${WP_BASE_URL}
✅ Web Scraping: Habilitado (Cheerio)

📡 Endpoints disponibles:
   → GET  /                  (health check)
   → POST /audit             (auditoría Watchlist)
   → POST /generate-post     (crear artículo)
   → POST /optimize-page     (optimizar página + scraping)
   → POST /update-seo-metas  (actualizar metas SEO)
   → POST /content-strategy  (plan editorial)

🔥 Listo para recibir solicitudes...
  `);
});
