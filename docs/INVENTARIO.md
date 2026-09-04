# Inventários do IT Guardian

O sistema separa dois contextos para evitar ambiguidade:

- **Inventário de Ativos:** computadores, notebooks, servidores e equipamentos de rede, organizados em abas, grupos e segmentos.
- **Inventário de Peças:** estoque físico usado em manutenção, com rastreabilidade por código, part number, série, MAC, localização e histórico.

## Inventário de Peças

Cada peça possui saldo, estoque mínimo, condição, valor, unidade e identificação técnica. A busca considera nome, código interno, part number, número de série e MAC.

O catálogo é apresentado por famílias físicas: placas-mãe, processadores, placas de vídeo, memórias, HD/SSD/NVMe, fontes, mouses, teclados, monitores e diversos. Adaptadores de rede, drivers e dispositivos virtuais coletados pelo agente não entram no inventário de peças. A visualização **Kits por computador** reúne os componentes instalados em cada ativo e oferece um atalho direto para a máquina no Inventário de Ativos.

A conciliação com o hardware monitorado acontece automaticamente ao abrir a página. Quando houver divergência, o aviso filtra as peças afetadas; a ficha da peça identifica o problema e permite localizar o computador correspondente.

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
