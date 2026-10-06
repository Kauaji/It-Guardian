import * as THREE from "three";

function drawLabelBackground(context) {
  context.clearRect(0, 0, 512, 128);
  context.fillStyle = "rgba(255, 255, 255, 0.88)";
  context.strokeStyle = "rgba(15, 23, 42, 0.12)";
  context.lineWidth = 10;
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(12, 24, 488, 80, 24);
  } else {
    context.rect(12, 24, 488, 80);
  }
  context.fill();
  context.stroke();
}

// Etiqueta de texto (sprite) usada sobre ativos e conexoes.
export function createTextSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  drawLabelBackground(context);
  context.fillStyle = "#0f172a";
  context.font = "700 34px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(text || "Objeto").slice(0, 22), 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.2, 0.55, 1);
  sprite.userData.isLabel = true;
  return sprite;
}
