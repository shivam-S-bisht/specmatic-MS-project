function actuatorMappings(app, appName) {
  return (req, res) => {
    const dispatcherServlet = [];
    app._router.stack.forEach(layer => {
      if (!layer.route) return;

      const pattern = layer.route.path.replace(/:([^/]+)/g, '{$1}');
      if (pattern.startsWith('/actuator')) return;

      Object.keys(layer.route.methods)
        .filter(method => layer.route.methods[method])
        .forEach(method => {
          const verb = method.toUpperCase();
          dispatcherServlet.push({
            handler: `${appName}#${verb} ${pattern}`,
            predicate: `{${verb} ${pattern}}`,
            details: {
              handlerMethod: { className: appName },
              requestMappingConditions: { methods: [verb], patterns: [pattern] }
            }
          });
        });
    });

    res.json({
      contexts: {
        [appName]: {
          mappings: { dispatcherServlets: { dispatcherServlet } }
        }
      }
    });
  };
}

module.exports = actuatorMappings;
