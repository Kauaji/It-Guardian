// Enumera todas as rotas registradas no app Express 4 (metodo + caminho
// completo), resolvendo os prefixos de cada Router montado.
function mountPath(layer) {
  const source = layer.regexp?.source || "";
  if (layer.regexp?.fast_slash) return "";
  const cleaned = source
    .replace("^\\/?(?=\\/|$)", "")
    .replace(/^\^/, "")
    .replace("\\/?(?=\\/|$)", "")
    .replace(/\\\//g, "/")
    .replace(/\$$/, "");
  return cleaned === "(?:/(?=$))?" ? "" : cleaned;
}

export function listRoutes(app) {
  const routes = [];
  const walk = (stack, prefix) => {
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter((method) => layer.route.methods[method]);
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const routePath of paths) {
          for (const method of methods) routes.push({ method: method.toUpperCase(), path: `${prefix}${routePath}` });
        }
      } else if (layer.name === "router" && layer.handle?.stack) {
        walk(layer.handle.stack, `${prefix}${mountPath(layer)}`);
      }
    }
  };
  walk(app._router.stack, "");
  return routes
    .map((route) => ({ ...route, path: route.path.replace(/\/+$/, "") || "/" }))
    .filter((route, index, all) => all.findIndex((other) => other.method === route.method && other.path === route.path) === index);
}
