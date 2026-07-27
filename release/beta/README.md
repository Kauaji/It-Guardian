# IT Guardian Beta

Esta pasta define a liberacao local funcional. O artefato e o proprio
repositorio mais o perfil `docker-compose.local.yml`; nenhuma credencial,
`.env.local`, backup ou token deve ser empacotado.

Entrada oficial:

```powershell
Copy-Item .env.local.example .env.local
.\installers\windows\start-server.ps1
```

Documentacao operacional: `docs/BETA-FUNCIONAL.md`.
