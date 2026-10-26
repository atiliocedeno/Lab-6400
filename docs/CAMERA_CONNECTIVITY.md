# Integración de cámara, versión 1.1

## Protocolo implementado

`discovery.ts` envía M-SEARCH SSDP a 239.255.255.250:1900 para ScalarWebAPI y ssdp:all. Escucha 6,5 segundos, deduplica hasta 16 anuncios y descarga exclusivamente las descripciones anunciadas. Cierra el socket al terminar o cancelar. No escanea subredes ni usa puertos HTTP predeterminados.

`protocol.ts` valida que LOCATION sea HTTP sobre IPv4 privada y que el remitente coincida. Procesa XML sin entidades/DOCTYPE, comprueba fabricante Sony y modelo ILCE-6400/ILCE-6400A. Obtiene ActionList_URL del servicio camera, exige el mismo host que el descriptor y agrega /camera. Tamaño máximo de texto aceptado: 256 KiB. Las redirecciones HTTP se rechazan.

`session.ts` usa JSON-RPC versión 1.0 con ID correlacionado, errores Sony explícitos y timeout de ocho segundos. Consulta capacidades e inicia startRecMode solo si aparece. Refresca capacidades antes de cada escritura, valida el valor contra el rango actual y verifica después con getters (hasta cinco lecturas). No reintenta setters ni disparos. Si una receta falla a mitad, informa qué cambios fueron confirmados; no promete rollback.

La interfaz bloquea operaciones simultáneas y cierra la sesión al pasar a segundo plano. Un fallo invalida la sesión visible y requiere reconectar. Compartir diagnóstico es una acción explícita del usuario.

## Recetas parciales

Solo se mapean white balance (Auto WB / Color Temperature) y exposure compensation cuando hay setter, getter y consulta de disponibles. Temperaturas se validan contra máximo/mínimo/paso. EV de la receta está expresado en tercios: para índice de paso Sony 1 se usa el mismo índice; para paso 2 (medios) se convierte exactamente. Valores no representables se dejan manuales, sin redondeo silencioso.

No existen implementaciones de Creative Style, contraste, saturación, nitidez, DRO ni ajuste fino. No se transmiten los enums internos de Recipe Lab. No se afirma aplicación completa.

## Nativo y firma

react-native-udp necesita compilación propia; no funciona en Expo Go. app.json declara descripción de red local y entitlement multicast de iOS. Apple debe autorizar el entitlement y el perfil de firma debe contenerlo; no basta con este repositorio. Android habilita red y HTTP local mediante un config plugin.

El perfil EAS preview incorpora JavaScript y evita depender de Metro cuando el teléfono usa el Wi-Fi de la cámara. No hay IPA/APK generado en esta entrega. La sesión Expo del Codespace del usuario no se comparte con este entorno.

## Evidencia y límites

La implementación sigue la API Sony legacy, **no** Camera Remote Command/PTP ni Camera Remote SDK. Que Sony enumere A6400 para otro toolkit no prueba que anuncie ScalarWebAPI. El comportamiento del hardware y los permisos multicast en dispositivo siguen sin verificarse. Ninguna prueba simulada valida todos los firmwares.

Referencias:
- Sony Camera Remote API development guide (descubrimiento): https://be-bright.github.io/assets/documents/Sony_CameraRemoteAPIbeta_DevelopmentGuide_v1.20.pdf
- Sony API reference (JSON-RPC, controles y unidades): https://be-bright.github.io/assets/documents/Sony_CameraRemoteAPIbeta_API-Reference_v2.40.pdf
- Guía A6400: https://helpguide.sony.net/ilc/1810/v1/en/contents/TP0002273504.html
- Camera Remote Command: https://support.d-imaging.sony.co.jp/app/cameraremotecommand/en/index.html
- UDP nativo: https://github.com/tradle/react-native-udp
- Compilaciones Expo: https://docs.expo.dev/develop/development-builds/introduction/

## Validación pendiente

Compilar y firmar; verificar solicitud de permiso y descubrimiento con cámara física; comprobar lectura/escritura real por firmware; validar suspensión/reconexión y resultado visual. Si la cámara anuncia solo otro protocolo, será necesaria su implementación documentada. El timeout anterior por sí solo no determina qué protocolo admite.
