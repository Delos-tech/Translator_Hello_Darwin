module.exports = {
  device: {
    "base/power/on": {
      name: "on",
      value: true
    },
    "base/power/off": {
      name: "on",
      value: false
    },
    "base/power/toggle": {
      name: "on",
      args: ({
        nva: {
          adverb: { duration = 0 }
        }
      }) => ({ duration })
    }
  },
  system: {}
};
