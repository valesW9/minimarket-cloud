# Evidencias que debe completar el equipo (NO inventadas)

1. Captura de GitHub: árbol del repositorio y commits atribuidos a cada integrante.
2. Terminal: `npm test` aprobado y `npm run check`.
3. AWS CloudFormation: Stack en CREATE_COMPLETE y recursos de stack.
4. EC2: instancia, subred pública y Security Group (80; 22 cerrado a otros).
5. RDS: `Publicly accessible: No`, Security Group 3306 desde EC2, DB subnet group.
6. App: `/health`, catálogo, pedido completado y stock reducido (antes y después).
7. CloudWatch: grupo de logs, evento real y alarma CPU (se puede mostrar estado OK; **no simular incidencia**).
8. CloudTrail: Event history de API; si hay trail opcional, configuración de trail y S3.
9. IAM: roles de instancia y permisos visibles, con discusión de limitaciones LabRole.
10. GitHub Actions y/o CodeBuild: prueba ejecutada, estado y fecha.
11. Datos: mostrar política de backups y configuración de RDS, sin credenciales.
12. Presentación o video 3-5 min de entorno real, si es modalidad escogida.

Nombres sugeridos: `01-repo.png`, `02-tests.png`, `03-stack.png`, ...

**Guion de video 3–5 minutos:** (0:00-0:40) necesidad y arquitectura; (0:40-1:20) IaC en GitHub y stack; (1:20-2:10) catálogo, pedido y stock; (2:10-2:50) RDS y SG privados; (2:50-3:35) métricas, logs y CloudTrail; (3:35-4:20) CI y pruebas; (4:20-5:00) seguridad y reflexión.
