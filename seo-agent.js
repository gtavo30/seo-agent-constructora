const express = require("express");
const OpenAI = require("openai");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// Configuración OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

// Configuración WordPress
const WP_BASE_URL = process.env.WP_BASE_URL;
const WP_USER = process.env.WP_USER;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;
const WP_AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Ejecuta el Assistant de OpenAI con un mensaje
 */
async function runAssistant(userMessage) {
  try {
    console.log('[OpenAI] 🤖 Creando thread...');
    
    // Crear thread
    const thread = await openai.beta.threads.create();
    
    // Agregar mensaje
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage
    });
    
    console.log('[OpenAI] 🏃 Ejecutando Assistant...');
    
    // Ejecutar Assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });
    
    // Esperar a que termine
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      console.log(`[OpenAI] ⏳ Status: ${runStatus.status}`);
      
      if (runStatus.status === 'failed' || runStatus.status === 'cancelled' || runStatus.status === 'expired') {
        throw new Error(`Run failed with status: ${runStatus.status}`);
      }
    }
    
    console.log('[OpenAI] ✅ Assistant completado');
    
    // Obtener respuesta - tomar el mensaje más reciente del assistant
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant') || messages.data[0];
    
    if (!assistantMessage) {
      throw new Error('No se recibió respuesta del Assistant');
    }
    
    // Buscar contenido de tipo texto
    const textContent = assistantMessage.content.find(c => c.type === 'text');
    
    if (!textContent) {
      throw new Error('La respuesta del Assistant no contiene texto');
    }
    
    const responseText = textContent.text.value;
    
    return responseText;
    
  } catch (error) {
    console.error('[OpenAI] ❌ Error:', error.message);
    throw error;
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
    version: "1.1.0",
    endpoints: {
      audit: "/audit",
      generate_post: "/generate-post",
      optimize_page: "/optimize-page",
      update_seo_metas: "/update-seo-metas",
      content_strategy: "/content-strategy"
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
 * ENDPOINT 3: Optimizar página existente
 * Analiza una página y sugiere mejoras de SEO
 */
app.post("/optimize-page", async (req, res) => {
  try {
    console.log('[OptimizePage] 🔧 Optimizando página...');
    
    const { url, current_title, current_description, keyword } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: "Se requiere el parámetro 'url'"
      });
    }
    
    const userMessage = `
TAREA: OPTIMIZE_PAGE

Analiza y optimiza esta página:

URL: ${url}
Título actual: ${current_title || "No especificado"}
Meta description actual: ${current_description || "No especificada"}
Keyword objetivo: ${keyword || "No especificada"}

Genera:
1. Nuevo título SEO optimizado (55-60 caracteres)
2. Nueva meta description (150-160 caracteres)
3. 3-5 sugerencias de mejora específicas

Usa el formato especificado en tus instrucciones.
`;
    
    const recommendations = await runAssistant(userMessage);
    
    console.log('[OptimizePage] ✅ Optimización completada');
    
    res.json({
      success: true,
      url: url,
      recommendations: recommendations
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
✅ Assistant ID: ${ASSISTANT_ID}
✅ WordPress: ${WP_BASE_URL}

📡 Endpoints disponibles:
   → GET  /                  (health check)
   → POST /audit             (auditoría Watchlist)
   → POST /generate-post     (crear artículo)
   → POST /optimize-page     (optimizar página)
   → POST /update-seo-metas  (actualizar metas SEO)
   → POST /content-strategy  (plan editorial)

🔥 Listo para recibir solicitudes...
  `);
});
