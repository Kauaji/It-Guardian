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

## Vínculo com a infraestrutura física

Ativos do Inventário de Ativos podem ser vinculados a componentes da Planta de Infraestrutura. O vínculo transporta o identificador do ativo, grupo e segmento e permite exibir status, métricas, alertas e OS reais no mapa físico. Remover um componente ou a imagem de fundo não remove o ativo do inventário.

Consulte [MAPA-INFRAESTRUTURA.md](./MAPA-INFRAESTRUTURA.md) para os modos de calor, filtros e permissões.
