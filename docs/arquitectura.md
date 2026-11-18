# Diseño general de la solución

```mermaid
flowchart TD
 U[Clientes y personal] --> P[Internet HTTP solo demo]
 P --> EC2[EC2 Nginx + Node.js]
 subgraph VPC[Amazon VPC]
  subgraph PUB[Subred publica]
   EC2
  end
  subgraph PR1[Subred privada zona A]
   DB[(Amazon RDS MySQL)]
  end
  subgraph PR2[Subred privada zona B]
   SUB[Subred adicional RDS]
  end
 end
 EC2 -->|MySQL 3306 autorizado SG| DB
 EC2 --> CW[CloudWatch Logs y métricas]
 CW --> A[Alarma CPU]
 A -.-> SNS[SNS opcional]
 CT[CloudTrail opcional] --> S3[S3 privado]
 G[Repositorio GitHub] --> CI[GitHub Actions tests]
 S3B[S3 artefactos] --> EC2
 SSM[SSM SecureString] --> EC2
```

La arquitectura es de demostración y separa redes, cómputo y datos. VPC incluye dos subredes privadas para el DB subnet group, pero la instancia RDS utiliza `MultiAZ: false`. Un único servidor EC2 no proporciona alta disponibilidad ni balanceo. CloudWatch observa logs y CPU; el agente incluye memoria si tiene permisos. Para una plataforma real se requiere HTTPS, alta disponibilidad, monitoreo avanzado, autenticación robusta y política de recuperación probada.
