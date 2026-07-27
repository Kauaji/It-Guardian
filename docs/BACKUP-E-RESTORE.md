# Backup, Restore e Reset

Os dados do perfil local ficam no volume PostgreSQL
`it_guardian_local_pgdata`. Parar os containers nao remove o volume.

## Backup

Com o ambiente iniciado:

```powershell
.\installers\windows\backup-server.ps1
```

O arquivo e criado em `backups\it-guardian-AAAAMMDD-HHMMSS.dump`. Para escolher
outro caminho:

```powershell
.\installers\windows\backup-server.ps1 -Destination D:\Backups\it-guardian.dump
```

## Restore

O restore substitui o banco atual e pede confirmacao:

```powershell
.\installers\windows\restore-server.ps1 -BackupFile D:\Backups\it-guardian.dump
```

Depois, confirme `/health`, login, inventario, historico e plantas.

## Reset

O reset remove containers e o volume de dados. Use somente em laboratorio:

```powershell
.\installers\windows\reset-local.ps1
```

O script pede confirmacao. Um novo start cria banco vazio; sera necessario criar
novo administrador e novos enrollments.

## Ensaio recomendado

1. Crie uma anotacao reconhecivel em uma maquina.
2. Gere o backup.
3. Altere a anotacao.
4. Restaure o backup.
5. Confirme que o estado anterior voltou.
6. Guarde uma copia do dump fora do computador servidor.
