# Minimarket Cloud — Proyecto de Evaluación Sumativa

**Estado:** aplicación y pruebas implementadas; **NO desplegado ni validado dentro de una cuenta AWS Academy**. La plantilla IaC es una propuesta verificable, pero puede necesitar ajustes por permisos, cuotas, costos y paquetes disponibles en el laboratorio. No entregar capturas ficticias.

## Objetivo

Centralizar catálogo, inventario, pedidos en línea y panel del minimarket. Implementar infraestructura declarativa con CloudFormation, métricas y logs en CloudWatch, pruebas automatizadas y controles de acceso. El diseño responde a la pauta `TILE23_U3_S15_ES.pdf` (criterios 3.1, 3.2 y 3.3).

## Arquitectura

Navegador -> HTTP:80 -> Nginx/EC2 -> Node.js API -> RDS MySQL privado. VPC con subred pública EC2 y dos subredes privadas (RDS subnet group, no Multi-AZ). CloudWatch Logs, CPU Alarm y SNS opcional. CloudTrail con bucket privado y validación de integridad, opcional. GitHub Actions CI; CodeBuild opcional con fuente S3. Consulte `docs/arquitectura.md`.

**Limitaciones deliberadas de la demo:** no hay HTTPS, WAF, autoescalado ni alta disponibilidad real; una EC2 y una RDS Single-AZ pueden fallar. El acceso administrativo usa un secreto compartido como token, apropiado solo para demostración; reemplazar por autenticación con sesiones e identidades en producción. Por seguridad, **no usar datos personales reales en el entorno HTTP**.

## Requisitos locales

- macOS o Linux; Node.js 22 recomendado
- Git y AWS CLI v2 (solo para AWS)
- Cuenta AWS Academy Learner Lab con permisos para servicios requeridos, si se va a desplegar
- SAM CLI **no requerido**, se usa AWS CloudFormation directamente

## Demo local SIN AWS ni base de datos

```bash
cd minimarket-cloud
export ADMIN_TOKEN='solo-demo-local-reemplazar'
npm test
npm run check
npm start
```

Abrir `http://localhost:3000` y `http://localhost:3000/admin`. Escribir token `solo-demo-local-reemplazar` en el panel. **Modo demo almacena información en memoria**; al reiniciar pierde pedidos y ajustes. Las pruebas usan `node:test` y no requieren instalar dependencias externas.

Para producción RDS se requiere `mysql2` con `npm install --omit=dev`, una base MySQL con `database/schema.sql` aplicado y variables `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `ADMIN_TOKEN` y `DB_SSL=true`.

## AWS Academy: verificación de permisos ANTES de desplegar

```bash
aws sts get-caller-identity --profile academy
aws configure get region --profile academy
aws ec2 describe-vpcs --profile academy --query 'Vpcs[].VpcId'
aws rds describe-db-instances --profile academy
aws cloudformation list-stacks --profile academy
```

Las consultas exitosas **no garantizan** permisos de creación. AWS Academy puede restringir EC2, RDS, SSM, IAM, CodeBuild o CloudTrail. No intentar evitar las restricciones de la cuenta. Activar controles de presupuesto/cuotas si el entorno lo permite. **RDS, EC2, CloudWatch y otros recursos pueden generar costos**.

## Despliegue orientativo en AWS (solo si el laboratorio lo permite)

**Antes:** confirmar `LabInstanceProfile`, permisos para S3 y SSM desde el rol asociado a EC2, acceso a una región con al menos dos AZ, tipo de EC2 `t3.micro` y RDS `db.t3.micro`; revisar precios/cuotas. Todo recurso Cloud principal está descrito en IaC, mientras que las claves, bucket de artefactos y perfiles preexistentes son prerequisitos explícitos del laboratorio.

1. Configurar credenciales temporales en el perfil `academy` (nunca commitear `.aws/`). Región de ejemplo `us-east-1`:

```bash
export AWS_PROFILE=academy
export AWS_REGION=us-east-1
aws sts get-caller-identity --query Arn --output text
```

2. Crear localmente dos secretos diferentes y fuertes. En la terminal propia, **no compartir sus valores, no ponerlos en el historial ni en el repositorio**. El siguiente script los genera con `openssl`, sube a SSM SecureString y no imprime valores:

```bash
bash scripts/crear_secretos_ssm.sh
```

**Nota:** AWS Academy podría denegar `ssm:PutParameter` o `ssm:GetParameter`; detener aquí si ocurre. Los parámetros deben ser **versión 1** conforme a la referencia dinámica en `infrastructure/template.yaml`. Si ya existen, NO sobrescribir ni cambiar versiones sin actualizar el template.

3. Utilizar un bucket S3 **existente** de artefactos con acceso permitido. Empaquetar el contenido de este repositorio en la raíz del ZIP, excluyendo `.env`, credenciales y dependencias:

```bash
bash scripts/empaquetar.sh
aws s3 cp dist/minimarket-cloud.zip s3://NOMBRE_BUCKET/minimarket-cloud.zip
```

4. Preparar un EC2 Key Pair existente desde la consola o mediante el mecanismo proporcionado por el laboratorio, sin compartir archivo privado `.pem`. Si la política exige IaC total, el par de claves debe administrarse en un stack bootstrap aparte o elegirse acceso SSM Session Manager en lugar de SSH. SSH permanece cerrado a internet de forma predeterminada.

5. Desplegar CloudFormation (ajustar bucket, key y región; el comando **crea recursos y puede generar costos**):

```bash
aws cloudformation validate-template --template-body file://infrastructure/template.yaml
aws cloudformation deploy \
  --stack-name minimarket-cloud \
  --template-file infrastructure/template.yaml \
  --parameter-overrides KeyName=MI_KEYPAIR ArtifactBucket=MI_BUCKET ArtifactKey=minimarket-cloud.zip InstanceProfileName=LabInstanceProfile EnableSNS=false \
  --no-fail-on-empty-changeset
```

6. Verificar Stack `CREATE_COMPLETE`, salidas `WebURL`, `DBEndpoint`, recursos EC2/RDS y errores de `cloud-init` si los hay. **El stack terminado no garantiza que se instaló la aplicación**: hacer `/health` y prueba funcional. Si falla, inspeccionar `/var/log/minimarket-bootstrap.log`, `/var/log/cloud-init-output.log`, `systemctl status minimarket nginx` usando acceso autorizado.

```bash
aws cloudformation describe-stacks --stack-name minimarket-cloud --query 'Stacks[0].Outputs' --output table
```

7. Confirmar alarma, grupo de logs y métricas reales en CloudWatch. El agente requiere permisos `logs:CreateLogStream`, `logs:PutLogEvents`, `cloudwatch:PutMetricData` en el perfil asociado a EC2. Para SNS se necesita el parámetro `EnableSNS=true` y `NotificationEmail=...`, junto con confirmación por correo.

8. **Opcional**: si la cuenta autoriza CloudTrail, desplegar `infrastructure/cloudtrail-optional.yaml` con un nombre globalmente único para el bucket y verificar el trail. La auditoría de eventos de la cuenta puede encontrarse en CloudTrail Event History aunque no sea posible crear un trail propio. No llamar "inmutables" a los archivos de auditoría sin controles adicionales.

9. **Opcional** CodeBuild: crear el proyecto con `infrastructure/codebuild.yaml` indicando `SourceBucket`, `SourceKey` y el ARN de un rol ya autorizado para S3 y CloudWatch Logs. Ejecutar manualmente una build y evidenciar los resultados. Para ejecución automática con cada push ya existe `.github/workflows/ci.yml`; el mecanismo automático de GitHub **no equivale a** CodeBuild con webhook.

## Controles de seguridad

- RDS en subredes privadas con `PubliclyAccessible: false` y acceso MySQL únicamente desde Security Group EC2.
- Cifrado en reposo de RDS y contraseñas externas al repositorio (SSM SecureString).
- SSH restringido a `127.0.0.1/32` por defecto; EC2 IMDSv2 requerido.
- Logs de aplicación 7 días, alarma de CPU y retención configurable; CloudTrail opcional.
- IAM: se reutiliza `LabInstanceProfile` por las limitaciones de Learner Lab. **No se afirma mínimo privilegio verificado**: el rol y su política deben auditarse en la cuenta antes de presentar ES-01 como cumplido.
- Aplicación de demostración HTTP: el token viaja sin cifrar por red pública. No usar panel remotamente hasta configurar TLS con dominio, ACM y balanceador/reverse proxy compatible.

## Evidencias para evaluación

Ver `docs/evidencias/GUIA.md`. No presentar tests locales como pruebas de servicios AWS. Adjuntar capturas reales, el historial Git de aportes, resultados CI, salidas CloudFormation, CloudWatch, RDS, auditoría, permisos y una demostración de 3 a 5 min, según pauta.

## Eliminación y costos

**Importante:** `Database` tiene `DeletionPolicy: Snapshot`; al eliminar el stack podrían permanecer snapshots de RDS que generan costos. Bucket/objetos de artefactos, parámetros SSM SecureString, y buckets retenidos de CloudTrail también deben revisarse. No borrar recursos compartidos de AWS Academy. Seguir las políticas del docente.

## Estructura

- `src/`: servidor HTTP y repositorios memory/MySQL.
- `public/`: catálogo, carrito, panel y estilos.
- `database/schema.sql`: esquema transaccional.
- `infrastructure/`: plantillas de CloudFormation.
- `tests/`: pruebas automáticas.
- `buildspec.yml`: build de CodeBuild.
- `.github/workflows/ci.yml`: integración continua GitHub.
- `docs/`: informe, arquitectura, trazabilidad y evidencias.

Fuentes oficiales y bibliografía APA 7 en `docs/INFORME.md`.
