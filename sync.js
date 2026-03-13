(function () {
  const CHANNEL_NAME = "hackySackOverlayChannel";
  const STORAGE_KEYS = {
    message: "hackySackOverlay.message",
    state: "hackySackOverlay.state"
  };

  function parseJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function create(role) {
    const listeners = new Set();
    const instanceId = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = typeof BroadcastChannel === "function"
      ? new BroadcastChannel(CHANNEL_NAME)
      : null;

    function notify(message) {
      if (!message || message.instanceId === instanceId) return;
      listeners.forEach((listener) => listener(message));
    }

    if (channel) {
      channel.addEventListener("message", (event) => notify(event.data));
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEYS.message) return;
      notify(parseJson(event.newValue));
    });

    function publish(type, payload) {
      const message = {
        type,
        payload,
        role,
        instanceId,
        sentAt: Date.now()
      };

      if (channel) {
        channel.postMessage(message);
      }

      try {
        localStorage.setItem(STORAGE_KEYS.message, JSON.stringify(message));
      } catch (error) {
        // Ignore storage failures in embedded browser sources.
      }

      return message;
    }

    function publishState(state) {
      try {
        localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(state));
      } catch (error) {
        // Ignore storage failures in embedded browser sources.
      }
      return publish("state", state);
    }

    function readState() {
      try {
        return parseJson(localStorage.getItem(STORAGE_KEYS.state));
      } catch (error) {
        return null;
      }
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    return {
      publish,
      publishState,
      readState,
      subscribe
    };
  }

  window.HackySackSync = { create };
})();
