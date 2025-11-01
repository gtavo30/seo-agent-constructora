# 🚀 Agente SEO - Constructora Sarmiento Rodas

Agente SEO automatizado que analiza el rendimiento del sitio web y genera contenido optimizado usando OpenAI Assistants API.

## 📋 Características

- **Auditoría automática** de keywords desde Google Sheets
- **Generación de artículos** de blog optimizados para SEO
- **Optimización de páginas** existentes (títulos y metas)
- **Plan editorial** mensual automatizado
- **Integración con WordPress** vía REST API
- **Soporte para Yoast SEO**

## 🛠️ Requisitos Previos

1. Node.js 18+ instalado
2. Cuenta de OpenAI con acceso a la API
3. WordPress con:
   - Yoast SEO activo
   - Usuario con permisos de Editor o superior
   - Application Password configurado
   - REST API habilitada

## 📦 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/seo-agent.git
cd seo-agent
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
OPENAI_API_KEY=sk-proj-tu-api-key
OPENAI_ASSISTANT_ID=asst-tu-assistant-id
WP_BASE_URL=https://tu-sitio.com
WP_USER=tu-usuario-api
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
WP_DEFAULT_CATEGORY_ID=1
PORT=10000
```

### 4. Configurar WordPress

**IMPORTANTE:** Antes de usar el agente, debes agregar este código en WordPress para exponer los metacampos de Yoast en la REST API.

Ve a: **Snippets → Add New** (o **Apariencia → Editor → functions.php**)

```php
// Exponer metacampos de Yoast en REST API
add_action('rest_api_init', function () {
  // Para el CPT 'property'
  register_post_meta('property', '_yoast_wpseo_title', [
    'type' => 'string',
    'single' => true,
    'show_in_rest' => true,
    'auth_callback' => function() { return current_user_can('edit_posts'); }
  ]);
  
  register_post_meta('property', '_yoast_wpseo_metadesc', [
    'type' => 'string',
    'single' => true,
    'show_in_rest' => true,
    'auth_callback' => function() { return current_user_can('edit_posts'); }
  ]);
  
  // Para posts normales
  register_post_meta('post', '_yoast_wpseo_title', [
    'type' => 'string',
    'single' => true,
    'show_in_rest' => true,
    'auth_callback' => function() { return current_user_can('edit_posts'); }
  ]);
  
  register_post_meta('post', '_yoast_wpseo_metadesc', [
    'type' => 'string',
    'single' => true,
    'show_in_rest' => true,
    'auth_callback' => function() { return current_user_can('edit_posts'); }
  ]);
});
```

## 🚀 Uso

### Iniciar el servidor

```bash
npm start
```

El servidor estará disponible en: `http://localhost:10000`

### Verificar que funciona

```bash
curl http://localhost:10000
```

## 📡 Endpoints

### 1. Health Check
```
GET /
```

### 2. Auditoría de Watchlist
```
POST /audit
Content-Type: application/json

{
  "watchlist": [
    {
      "keyword": "casas vip quito",
      "landing_page": "https://...",
      "target_position": 5,
      "min_ctr": 2.5,
      "alert_drop_by": 3
    }
  ]
}
```

### 3. Generar Artículo de Blog
```
POST /generate-post
Content-Type: application/json

{
  "keyword": "departamentos vip valle de los chillos",
  "project": "Villa Venetto",
  "intent": "transaccional",
  "publish": true
}
```

### 4. Optimizar Página
```
POST /optimize-page
Content-Type: application/json

{
  "url": "https://...",
  "current_title": "Título actual",
  "current_description": "Descripción actual",
  "keyword": "casas vip"
}
```

### 5. Estrategia de Contenido
```
POST /content-strategy
Content-Type: application/json

{
  "month": "2025-11",
  "posts_per_month": 4,
  "priority_project": "Porto Alegre"
}
```

## 🔧 Deploy en Render

### Variables de Entorno en Render

Configura estas variables en el dashboard de Render:

- `OPENAI_API_KEY`
- `OPENAI_ASSISTANT_ID`
- `WP_BASE_URL`
- `WP_USER`
- `WP_APP_PASSWORD`
- `WP_DEFAULT_CATEGORY_ID`
- `PORT=10000`

### Build Command
```
npm install
```

### Start Command
```
npm start
```

## 📝 Notas

- Los artículos se publican como **borradores** por defecto para revisión
- El agente extrae automáticamente el título del HTML generado
- Las categorías son opcionales (configura `WP_DEFAULT_CATEGORY_ID` o déjalo vacío)
- Los permisos del usuario API deben permitir editar posts y properties

## 🐛 Troubleshooting

### Error 403 al actualizar páginas
- Verifica que el snippet PHP esté activo en WordPress
- Confirma que el usuario API tiene permisos suficientes

### No se actualizan los metas de Yoast
- Asegúrate de haber agregado el snippet PHP en WordPress
- Verifica que Yoast SEO esté activo
- Prueba con un post normal primero antes de un CPT

### Error en OpenAI
- Verifica que tu API key sea válida
- Confirma que el Assistant ID sea correcto
- Revisa los logs del servidor para más detalles

## 📄 Licencia

ISC

## 👥 Autor

Constructora Sarmiento Rodas
