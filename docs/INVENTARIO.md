# Inventários do IT Guardian

O sistema separa dois contextos para evitar ambiguidade:

- **Inventário de Ativos:** computadores, notebooks, servidores e equipamentos de rede, organizados em abas, grupos e segmentos.
- **Inventário de Peças:** estoque físico usado em manutenção, com rastreabilidade por código, part number, série, MAC, localização e histórico.

## Inventário de Peças

Cada peça possui saldo, estoque mínimo, condição, valor, unidade e identificação técnica. A busca considera nome, código interno, part number, número de série e MAC.

O catálogo é apresentado por famílias físicas: placas-mãe, processadores, placas de vídeo discretas, memórias, HD/SSD/NVMe, fontes, mouses, teclados, monitores e diversos. Adaptadores de rede, vídeo integrado ao processador, drivers, dispositivos virtuais e nomes genéricos publicados pelo Windows (como HID, PS/2 genérico, monitor PnP genérico e adaptadores de vídeo básicos) não entram no inventário de peças. A conciliação também desativa automaticamente registros antigos que se enquadrem nesses casos.

A visualização **Kits por computador** replica ao vivo as abas, grupos e segmentos do Inventário de Ativos. Os cartões iniciam recolhidos e mostram somente o nome fantasia; ao expandir um computador, aparecem seus componentes físicos e o atalho para o ativo. Memórias são resumidas por capacidade, por exemplo `16 GB (8 GB + 8 GB)`. Ao clicar em uma peça que está em uso, a página muda para os kits, abre e destaca automaticamente o computador onde ela está instalada.

O agente Windows 1.6.4 consulta monitores ativos pelo EDID/WMI para obter modelo, fabricante e série quando o equipamento fornece esses dados. Mouses, teclados e outros periféricos são consolidados por identidade física; interfaces HID genéricas e serviços de driver são descartados. Alguns fabricantes não publicam marca ou modelo ao Windows, portanto o sistema preserva apenas o nome físico disponível, sem inventar identificação.

A conciliação com o hardware monitorado acontece automaticamente ao abrir a página. Apenas componentes principais podem gerar incongruência: processador, placa-mãe, memória, armazenamento, placa de vídeo discreta e fonte. Quando houver divergência, o aviso filtra as peças afetadas; a ficha compara o estado anterior com a coleta atual, permite localizar o computador e oferece as decisões **Manter pendente** ou **Descartar incongruência**. Periféricos nunca entram nessa contagem.

Movimentações aceitas:

- entrada;
- consumo;
- retorno;
- ajuste de saldo;
- designação a ativo;
- desvinculação.

Consumo e designação devem estar ligados a um ativo ou Ordem de Serviço. Cada movimento registra saldo anterior, saldo resultante, usuário, data, observação, OS e ativo. O sistema bloqueia saída maior que o saldo disponível.

Permissões: `parts_inventory.view`, `parts_inventory.create`, `parts_inventory.update`, `parts_inventory.move_stock` e `parts_inventory.assign_assets`.

Endpoints principais: `GET/POST /api/parts`, `GET/PATCH /api/parts/:id`, `POST /api/parts/:id/movements` e `POST /api/parts/:id/discrepancy`.

## Vínculo com a infraestrutura física

Ativos do Inventário de Ativos podem ser vinculados a componentes da Planta de Infraestrutura. O vínculo transporta o identificador do ativo, grupo e segmento e permite exibir status, métricas, alertas e OS reais no mapa físico. Remover um componente ou a imagem de fundo não remove o ativo do inventário.

Consulte [MAPA-INFRAESTRUTURA.md](./MAPA-INFRAESTRUTURA.md) para os modos de calor, filtros e permissões.
