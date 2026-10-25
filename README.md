# Sony Recipe AI — primer prototipo móvil

App React Native / Expo para iOS y Android, interfaz en español. Proyecto independiente.

## Abrir desde el mismo iPhone

Esta entrega usa Expo SDK 57 para Expo Go durante la transición SDK 58. Instala la versión actual de Expo Go desde App Store.

1. Instala Expo Go desde App Store.
2. Abre https://codespaces.new/atiliocedeno/Lab-6400 en Safari y crea un Codespace en `main`. Necesitas cuenta GitHub con Codespaces habilitado y cuota disponible.
3. Espera a que termine la preparación y `npm ci` automático. Si Safari oculta controles, pide la versión de escritorio.
4. En Terminal → New Terminal ejecuta desde la raíz del repositorio:

```bash
npm run start:iphone
```

Si creaste un Codespace sin la configuración incluida, ejecuta `npm ci` primero.

5. Espera a que aparezca `Metro waiting on exp://...`. Copia la URL completa `exp://...` de la terminal, pégala en la barra de direcciones de Safari y acepta abrir Expo Go. No intentes escanear un QR en la pantalla del mismo teléfono.
6. Conserva el Codespace activo mientras pruebas. Parar el servidor o suspender el Codespace desconecta la sesión. Codespaces tiene cuotas y puede tener costos fuera del uso incluido.

Si el túnel falla, revisa el mensaje de ngrok, la conexión del Codespace y vuelve a iniciar `npm run start:iphone`. Si Expo Go muestra incompatibilidad de SDK, comprueba que estás usando la versión actual del repositorio y envía el mensaje exacto. No necesitas una cuenta Apple Developer ni crear un IPA para esta prueba con Expo Go.

## Ejecutar desde Mac

Usa Node.js 22 LTS, `npm ci` y `npm run start:iphone`. Abre el enlace o escanea el QR con el iPhone. El túnel usa internet, por lo que no exige estar en la misma red local.

El repositorio contiene código fuente. No se ha probado en un teléfono físico y no necesita claves API. El túnel se inicia en tu entorno, no viene activo dentro del ZIP.

## Implementado

- 77 entradas importadas: 76 looks y ajuste de fábrica; 12 grupos.
- Búsqueda, filtro por grupo, favoritos persistentes en almacenamiento local.
- Detalle con checklist manual, exposición convertida de tercios a EV, DRO y balance de blancos.
- Seis recetas con Picture Effect diferenciadas de las basadas en Creative Style.
- Estado honesto de conectividad: no se envían comandos a la cámara.

## Limitaciones y siguiente etapa

Los valores originales fueron desarrollados para A6000. Los nombres de estilos se muestran como referencia; los IDs internos nunca se transmiten a A6400. Escalas de WB, subparámetros, restricciones de vídeo y resultados visuales necesitan validación física. No se promete reproducción idéntica de películas o marcas. Las recetas con efecto requieren revisar restricciones JPEG/RAW y vídeo. Los pasos completados son confirmaciones del usuario, no lecturas de la cámara.

Pendiente: probar controles en A6400; validar transporte y comandos documentados antes de implementar USB/Wi-Fi/Bluetooth; definir procesamiento móvil con fotos de prueba; implementar asistente IA. No se afirma que Bluetooth permita aplicar recetas. No hay procesamiento RAW ni simulación fotográfica en esta versión.

## Fuente y licencia

Dataset derivado de `Recipes.java` de voxivoid/recipe-lab-sony-pmca, commit `aab4b5703a2b77362b83682801c8e50145ddc6ee`.
https://github.com/voxivoid/recipe-lab-sony-pmca
Se conserva fuente en vendor/Recipes.java y GPL-3.0 en LICENSE. Este prototipo derivado se distribuye bajo GPL-3.0. Las marcas pertenecen a sus titulares.

Especificaciones Sony consultadas para nombres y rangos de Creative Style:
https://www.sony.com.sg/electronics/support/e-mount-body-ilce-6000-series/ilce-6400/specifications
Guía Sony (balance de blancos y restricciones de uso):
https://helpguide.sony.net/ilc/1810/v1/en/index.html

## Validación reproducible

`python3 scripts/import-recipes.py` regenera JSON desde la fuente incluida.
`npx tsc --noEmit` comprueba TypeScript.
`npx expo export --platform ios --platform android` compila los bundles.
