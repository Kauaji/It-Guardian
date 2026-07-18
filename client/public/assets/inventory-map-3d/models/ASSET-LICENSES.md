# Modelos 3D do mapa de inventario

Este diretorio contem apenas os modelos GLB finais usados pelo modo detalhado do mapa. Os arquivos fonte e o pacote bruto nao fazem parte do repositorio.

Ao adicionar um arquivo, registre nesta tabela a origem, o autor, a licenca e as alteracoes realizadas.

| Arquivo | Modelo original | Origem | Autor | Licenca | Alteracoes |
| --- | --- | --- | --- | --- | --- |
| `quaternius/desk.glb` | `Desk.fbx` | [Ultimate Furniture Pack](https://quaternius.com/packs/ultimatefurniture.html) | Quaternius | CC0 | Convertido com FBX2glTF 0.9.7 e otimizado com glTF Transform 4.4.1 |
| `quaternius/table.glb` | `Table.fbx` | [Ultimate Furniture Pack](https://quaternius.com/packs/ultimatefurniture.html) | Quaternius | CC0 | Convertido com FBX2glTF 0.9.7 e otimizado com glTF Transform 4.4.1 |
| `quaternius/chair.glb` | `OfficeChair.fbx` | [Ultimate Furniture Pack](https://quaternius.com/packs/ultimatefurniture.html) | Quaternius | CC0 | Convertido com FBX2glTF 0.9.7 e otimizado com glTF Transform 4.4.1 |
| `quaternius/cabinet.glb` | `Closet.fbx` | [Ultimate Furniture Pack](https://quaternius.com/packs/ultimatefurniture.html) | Quaternius | CC0 | Convertido com FBX2glTF 0.9.7 e otimizado com glTF Transform 4.4.1 |
| `quaternius/shelf.glb` | `Bookcase.fbx` | [Ultimate Furniture Pack](https://quaternius.com/packs/ultimatefurniture.html) | Quaternius | CC0 | Convertido com FBX2glTF 0.9.7 e otimizado com glTF Transform 4.4.1 |
| `quaternius/door.glb` | `Door1.fbx` | [Ultimate Furniture Pack](https://quaternius.com/packs/ultimatefurniture.html) | Quaternius | CC0 | Convertido com FBX2glTF 0.9.7 e otimizado com glTF Transform 4.4.1 |
| `kenney/computerScreen.glb` | `computerScreen.glb` | [Furniture Kit](https://kenney.nl/assets/furniture-kit) | Kenney | CC0 | Copiado sem alteracoes do pacote GLTF oficial |
| `kenney/computerKeyboard.glb` | `computerKeyboard.glb` | [Furniture Kit](https://kenney.nl/assets/furniture-kit) | Kenney | CC0 | Copiado sem alteracoes do pacote GLTF oficial |
| `kenney/computerMouse.glb` | `computerMouse.glb` | [Furniture Kit](https://kenney.nl/assets/furniture-kit) | Kenney | CC0 | Copiado sem alteracoes do pacote GLTF oficial |
| `kenney/laptop.glb` | `laptop.glb` | [Furniture Kit](https://kenney.nl/assets/furniture-kit) | Kenney | CC0 | Copiado sem alteracoes do pacote GLTF oficial |
| `kenney/televisionModern.glb` | `televisionModern.glb` | [Furniture Kit](https://kenney.nl/assets/furniture-kit) | Kenney | CC0 | Copiado sem alteracoes do pacote GLTF oficial |

Download realizado em 2026-07-15 pela pasta oficial do Quaternius. A pagina oficial informava 20 modelos, formatos FBX/OBJ/Blend e licenca CC0 para uso pessoal e comercial. A conversao usou os FBX oficiais porque o Blender nao estava instalado no ambiente. A otimizacao foi executada sem compressao de geometria para evitar decoder adicional no cliente; os arquivos finais ficaram entre 47 KB e 158 KB, sem texturas ou animacoes.

## Texturas PBR

As texturas abaixo foram baixadas em resolucao 1K e sao carregadas localmente. Cada material usa os mapas diffuse, normal OpenGL e roughness.

| Arquivos | Origem | Autor | Licenca | Alteracoes |
| --- | --- | --- | --- | --- |
| `../textures/polyhaven/wood_floor_*_1k.jpg` | [Wood Floor](https://polyhaven.com/a/wood_floor) | Rob Tuytel / Poly Haven | CC0 | Mapas JPG 1K oficiais, sem alteracoes |
| `../textures/polyhaven/brick_wall_003_*_1k.jpg` | [Brick Wall 003](https://polyhaven.com/a/brick_wall_003) | Poly Haven | CC0 | Mapas JPG 1K oficiais, sem alteracoes |
