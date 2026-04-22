// Mock Element SDK
window.elementSdk = (function () {
  let _config = {};
  let _onConfigChange = null;

  return {
    init: function (options) {
      _config = { ...(options.defaultConfig || {}) };
      _onConfigChange = options.onConfigChange || null;

      if (_onConfigChange) {
        _onConfigChange(_config);
      }
    },

    setConfig: function (newConfig) {
      _config = { ..._config, ...newConfig };
      if (_onConfigChange) {
        _onConfigChange(_config);
      }
    },

    getConfig: function () {
      return { ..._config };
    }
  };
})();
