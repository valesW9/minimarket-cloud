# Informe técnico: Implementación de infraestructura como código para Minimarket Cloud

**Asignatura:** Infraestructura Cloud / DevOps  
**Evaluación:** Evidencia de implementación de infraestructura como código  
**Institución:** INACAP  
**Integrantes:** [Completar]  
**Docente:** [Completar]  
**Fecha:** [Completar]

> Estado de la entrega: software y pruebas ejecutadas localmente. La implementación AWS, capturas y verificación de recursos permanecen pendientes y requieren AWS Academy y sus permisos.

## 1. Selección y descripción del caso

Este proyecto se centra en el desarrollo y despliegue de una plataforma web de gestión para un minimarket, destinada a optimizar la atención de pedidos en línea y el control interno de existencias. Actualmente, muchos negocios de este tipo administran sus productos con registros manuales y planillas locales aisladas. Esa falta de centralización produce desfases en el stock, errores en la recepción y seguimiento de pedidos, especialmente en horarios punta, y exposición a pérdidas de información por fallas del almacenamiento local.

La propuesta considera centralizar la información de productos, pedidos y movimientos mediante una aplicación web y una base de datos relacional administrada. Su infraestructura se describe como código con AWS CloudFormation, facilitando el versionamiento y despliegue reproducible. El diseño incorpora monitoreo, trazabilidad, automatización de pruebas y controles de red. Para la implementación académica se utiliza una instancia EC2 y una RDS de una zona; por ello **no se considera demostrada la alta disponibilidad** y queda como mejora futura.

## 2. Requerimientos del proyecto

### 2.1 Requerimientos funcionales

- **RF-01 — Gestión de catálogo e inventario:** registrar, actualizar y consultar productos con nombre, precio y stock; validar mediante operaciones GET, POST y PATCH.
- **RF-02 — Procesamiento de pedidos:** registrar pedidos en línea y descontar las unidades en forma transaccional; ante stock insuficiente se rechaza la operación sin descuentos parciales.
- **RF-03 — Panel de control operativo:** consultar pedidos y cambiar sus estados entre pendiente, en preparación y completado mediante acceso restringido.
- **RF-04 — Registro de movimientos:** guardar ajustes de stock y salidas por pedidos para permitir comprobaciones de inventario.

### 2.2 Requerimientos técnicos y no funcionales

- **RT-01 — Despliegue reproducible por IaC:** red, grupos de seguridad, servidor, RDS, logs y alarmas declarados en plantillas CloudFormation. Parámetros secretos y artefactos externos son prerrequisitos de aprovisionamiento, nunca datos embebidos en el código.
- **RT-02 — Disponibilidad y conectividad:** HTTP responde a `/health` y RDS se comunica únicamente desde la instancia de la aplicación. Una sola EC2 y RDS Single-AZ no garantizan funcionamiento sin interrupciones.
- **RT-03 — Observabilidad y alertas:** logs y métricas de EC2 mediante CloudWatch; alarma si CPU promedio supera 80 % durante dos periodos de cinco minutos; SNS opcional para aviso por correo.
- **RT-04 — Respaldo de datos:** la propuesta IaC habilita retención automática de respaldo RDS por un día y snapshot al eliminar la base. La restauración debe validarse en laboratorio.
- **RT-05 — Pruebas automatizadas:** ejecución de pruebas Node.js (`node:test`) y validación de código mediante GitHub Actions; soporte de ejecución opcional AWS CodeBuild.

### 2.3 Estándares de seguridad

- **ES-01 — Mínimo privilegio:** proteger operaciones administrativas, aislar RDS y revisar permisos de roles y políticas IAM. Se usa un perfil de instancia existente de AWS Academy; **el principio de mínimo privilegio del rol no queda certificado** sin revisar su política efectiva.
- **ES-02 — Secretos:** prohibir claves de acceso y contraseñas en el repositorio; usar parámetros SSM SecureString para la contraseña de la base y token de la demo. Nunca compartir credenciales del laboratorio.
- **ES-03 — Aislamiento:** VPC con subred pública para EC2, dos subredes privadas para RDS, Security Groups que limitan MySQL 3306 al servidor web y deniegan acceso público a la base. La demostración usa HTTP; para producción se exige HTTPS.
- **ES-04 — Auditoría:** CloudTrail Event History permite consulta de actividades; una plantilla opcional aprovisiona trail, almacenamiento S3 privado, versionamiento y validación de integridad, si el laboratorio lo admite.

## 3. Diseño general de la solución

La arquitectura se organiza en tres capas. **Red y perímetro:** VPC 10.42.0.0/16, subnet pública 10.42.1.0/24 y dos privadas 10.42.11.0/24 y 10.42.12.0/24 en diferentes zonas de disponibilidad. **Cómputo:** Amazon EC2 con Amazon Linux, Nginx y servidor Node.js. **Datos:** Amazon RDS MySQL en subred privada, cifrado en reposo y copias automatizadas. De forma transversal se utilizan CloudWatch, CloudTrail, S3, SSM, roles de instancia y automatización de pruebas.

**Flujo:** Cliente → navegador → EC2 HTTP (prototipo) → API Node.js → RDS MySQL (privado). CloudWatch recibe métricas y logs; CloudTrail audita acciones de la cuenta; repositorio Git controla cambios. El diagrama editable está en `docs/arquitectura.md`.

## 4. Implementación de IaC

El archivo `infrastructure/template.yaml` describe VPC, gateway, rutas, subredes, Security Groups, RDS, EC2, logs de CloudWatch, alarmas y SNS opcional. `UserData` prevé instalar Nginx y Node.js, recuperar el ZIP desde S3, obtener secretos de SSM e inicializar el esquema MySQL. Las plantillas `cloudtrail-optional.yaml` y `codebuild.yaml` permiten extender la solución si existen permisos y cuotas.

La aplicación contiene las rutas `GET /health`, `GET/POST /api/products`, `PATCH /api/products/:id/stock`, `POST/GET /api/orders`, `PATCH /api/orders/:id/status` y `GET /api/movements`. En modo local se usa almacenamiento en memoria; conectado a MySQL, los pedidos emplean transacciones InnoDB y bloqueos `SELECT ... FOR UPDATE` para evitar vender stock inexistente.

## 5. Monitoreo y logging (criterio 3.1)

Se declara un grupo de logs en CloudWatch con retención de siete días y una alarma para CPUUtilization. UserData prevé instalar CloudWatch Agent y enviar `/var/log/minimarket/app.log`. Se registra cada error de HTTP como JSON estructurado; las métricas de memoria están incluidas en el archivo de configuración del agente. Para validar se requiere desplegar, abrir `/health`, generar solicitudes y revisar logs y alarmas efectivamente recibidos. No se considera evidencia de CloudWatch la ejecución exclusiva del servidor local.

## 6. Pruebas automatizadas (criterio 3.2)

Se implementaron **10 pruebas automatizadas** con Node.js `node:test`: salud HTTP, listado de productos, descuento por pedido, rechazo por stock insuficiente, pedido con producto inexistente, protección del panel, actualización de estado, creación de productos, trazabilidad de ajuste y validación de cantidades negativas. Se ejecutaron en el entorno local y finalizaron con **10 aprobadas, 0 fallidas** durante la preparación del entregable. El pipeline `.github/workflows/ci.yml` ejecutará los tests en push/PR una vez publicado en GitHub; su ejecución remota aún no ha sido evidenciada. `buildspec.yml` ofrece pruebas para AWS CodeBuild, que requiere permisos de laboratorio y rol de servicio.

## 7. Prácticas de seguridad DevOps (criterio 3.3)

El aislamiento se aplica con Security Groups independientes: EC2 acepta HTTP en puerto 80; SSH está cerrado por defecto a accesos externos con CIDR 127.0.0.1/32; RDS acepta MySQL 3306 únicamente desde el SG de EC2. Se obliga a IMDSv2 en EC2. El template requiere contraseñas almacenadas fuera del repositorio en SSM SecureString. Las credenciales temporales de AWS Academy deben permanecer únicamente en el equipo del estudiante.

**Limitaciones:** HTTP no cifra el token administrativo, por lo que el panel solo debe demostrarse localmente hasta habilitar TLS. El perfil `LabInstanceProfile` puede contener permisos más amplios de los necesarios. La plantilla CloudTrail opcional requiere autorización previa y la integridad verificable no equivale a inmutabilidad garantizada. Estas limitaciones quedan documentadas para impedir afirmaciones incorrectas.

## 8. Evidencias de implementación y resultados

**Comprobado localmente:** sintaxis de los archivos Node.js, parseo sintáctico YAML de las tres plantillas y 10 pruebas automatizadas aprobadas. **Pendiente de evidencia real:** Stack CloudFormation, operaciones EC2 y RDS, CloudWatch métricas y logs, resultados de CloudTrail, revisión de políticas IAM, CodeBuild o pipeline GitHub y prueba end-to-end contra RDS. Una sintaxis YAML correcta no certifica despliegue válido en AWS.

Revisar `docs/evidencias/GUIA.md` para el conjunto de capturas necesarias y el guion de un video de 3–5 minutos. Completar los espacios solo con evidencia real obtenida de la cuenta del equipo.

## 9. Reflexión final del equipo (borrador que debe personalizarse)

El proyecto permitió integrar desarrollo web, base de datos relacional y prácticas de infraestructura como código. Resultó especialmente relevante asociar los requerimientos con pruebas observables y separar los datos de la aplicación de las credenciales de acceso. El principal desafío pendiente es desplegar la solución dentro de las restricciones del laboratorio y validar operativamente sus servicios de monitoreo y seguridad. El equipo deberá completar esta reflexión con las dificultades reales de instalación, permisos y pruebas observadas durante su implementación.

## Referencias (APA 7)

Amazon Web Services. (s. f.). *AWS CloudFormation User Guide*. https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html

Amazon Web Services. (s. f.). *Amazon CloudWatch User Guide*. https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html

Amazon Web Services. (s. f.). *AWS CloudTrail User Guide*. https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html

Amazon Web Services. (s. f.). *AWS Identity and Access Management User Guide*. https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html

Amazon Web Services. (s. f.). *AWS CodeBuild User Guide*. https://docs.aws.amazon.com/codebuild/latest/userguide/welcome.html

Amazon Web Services. (s. f.). *Amazon RDS User Guide*. https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html

Node.js. (s. f.). *Test runner*. https://nodejs.org/api/test.html
