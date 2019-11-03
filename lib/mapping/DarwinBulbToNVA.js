module.exports = {
  stateObjects: {
    color: {
      thingState: {
        "base/color": {
          name: "color",
          value: bulbInfo => bulbInfo.color
        }
      },
      tags: {
        color: "base/color"
      }
    },
    on: {
      thingState: {
        "base/power": {
          name: "state",
          value: bulbInfo => (bulbInfo.on ? "on" : "off")
        }
      },
      tags: {
        power: "base/power",
        light: "light",
        bulb: "darwin-demo-bulb"
      }
    }
  },
  stateFields: {
    name: {
      thingState: {
        name: "name",
        value: bulbInfo => bulbInfo.id
      }
    }
  }
};
