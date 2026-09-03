# Inventários do IT Guardian

O sistema separa dois contextos para evitar ambiguidade:

- **Inventário de Ativos:** computadores, notebooks, servidores e equipamentos de rede, organizados em abas, grupos e segmentos.
- **Inventário de Peças:** estoque físico usado em manutenção, com rastreabilidade por código, part number, série, MAC, localização e histórico.

## Inventário de Peças

Cada peça possui saldo, estoque mínimo, condição, valor, unidade e identificação técnica. A busca considera nome, código interno, part number, número de série e MAC.

Movimentações aceitas:

- entrada;
- consumo;
- retorno;
- ajuste de saldo;
- designação a ativo;
- desvinculação.

Consumo e designação devem estar ligados a um ativo ou Ordem de Serviço. Cada movimento registra saldo anterior, saldo resultante, usuário, data, observação, OS e ativo. O sistema bloqueia saída maior que o saldo disponível.

Permissões: `parts_inventory.view`, `parts_inventory.create`, `parts_inventory.update`, `parts_inventory.move_stock` e `parts_inventory.assign_assets`.

Endpoints principais: `GET/POST /api/parts`, `GET/PATCH /api/parts/:id` e `POST /api/parts/:id/movements`.
