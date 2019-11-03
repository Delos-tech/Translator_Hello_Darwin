const bulbToNVA = require("./mapping/DarwinBulbToNVA");
const { isObject } = require("util");

class CoreStateComparator {
  constructor({ translatorId } = {}) {
    if (!translatorId) throw new Error("translatorId is required!");

    this.translatorId = translatorId;
  }

  preparePatchNVAs({ bulbsInfo, coreState }) {
    if (!bulbsInfo) throw new Error("bulbsInfo is required!");
    if (!coreState) throw new Error("coreState is required!");

    // transformation: [ { id: 123, ... } ] -> { 123: { id: 123, ... } }
    const thingStateByDeviceId = coreState.reduce((coreDevices, device) => {
      return Object.assign(coreDevices, { [device.source.id]: device });
    }, {});

    const bulbsInfoById = bulbsInfo.reduce((devices, device) => {
      return Object.assign(devices, { [device.id]: device });
    }, {});

    const nvaQueries = { createNVAs: [], updateNVAs: [] };

    Object.values(bulbsInfoById).forEach(bulbDeviceInfo => {
      if (thingStateByDeviceId[bulbDeviceInfo.id]) {
        const updateNVAQueries = this.getUpdateNVAQueries(
          bulbDeviceInfo,
          thingStateByDeviceId[bulbDeviceInfo.id]
        );

        if (updateNVAQueries.length)
          nvaQueries.updateNVAs.push(...updateNVAQueries);
      } else {
        nvaQueries.createNVAs.push(this._getCreateNVAQuery(bulbDeviceInfo));
      }
    });

    // Checking if some of Core devices are missing in Manager's devices
    // and set them unreachable if so
    coreState.forEach(coreDevice => {
      if (!bulbsInfoById[coreDevice.source.id] && coreDevice.reachable) {
        nvaQueries.updateNVAs.push({
          noun: `${this.translatorId}_${coreDevice.source.id}`,
          verb: "set",
          adverb: {
            reachable: false
          }
        });
      }
    });

    return nvaQueries;
  }

  getUpdateNVAQueries(lifxDeviceInfo, coreThingState) {
    const updateNVAs = [];

    const filteredThingStateObjects = this._getFilteredThingStateObjects(
      this._prepareThingStateObjects(lifxDeviceInfo),
      coreThingState
    );
    const filteredThingStateFields = this._removeSameStateFields(
      this._prepareThingStateFields(lifxDeviceInfo),
      coreThingState
    );
    const filteredTags = this._removeSameStateFields(
      this._prepareTags(lifxDeviceInfo),
      coreThingState.tags
    );

    const filteredThingState = {
      ...filteredThingStateObjects,
      ...filteredThingStateFields
    };

    if (Object.keys(filteredTags).length) {
      updateNVAs.push({
        noun: coreThingState.id,
        verb: "tag",
        adverb: filteredTags
      });
    }
    if (Object.keys(filteredThingState).length) {
      updateNVAs.push({
        noun: coreThingState.id,
        verb: "set",
        adverb: filteredThingState
      });
    }

    return updateNVAs;
  }

  _getCreateNVAQuery(bulbDeviceInfo) {
    return {
      verb: "create",
      adverb: {
        name: bulbDeviceInfo.id.toLowerCase() || "unsigned",
        tags: this._prepareTags(bulbDeviceInfo),
        source: {
          translator: this.translatorId,
          id: bulbDeviceInfo.id
        },
        ...this._prepareThingStateObjects(bulbDeviceInfo)
      }
    };
  }

  _prepareTags(bulbDeviceInfo) {
    let tags = {};
    const deviceInfoKeys = this._getDeviceInfoKeys(bulbDeviceInfo);

    deviceInfoKeys.forEach(deviceInfoKey => {
      const mappingComponent = bulbToNVA.stateObjects[deviceInfoKey];

      if (!mappingComponent || !mappingComponent.tags) return;

      tags = { ...tags, ...mappingComponent.tags };
    });

    return tags;
  }

  _prepareThingStateFields(bulbDeviceInfo) {
    const stateFields = {};
    const deviceInfoKeys = this._getDeviceInfoKeys(bulbDeviceInfo);

    deviceInfoKeys.forEach(deviceInfoKey => {
      const mappingComponent = bulbToNVA.stateFields[deviceInfoKey];

      if (!mappingComponent || !mappingComponent.thingState) return;

      const { name, value } = mappingComponent.thingState;

      stateFields[name] =
        typeof value === "function" ? value(bulbDeviceInfo) : value;
    });

    return stateFields;
  }

  _prepareThingStateObjects(bulbDeviceInfo) {
    console.log("prep: " + JSON.stringify(bulbDeviceInfo, null, 2));
    const stateObjects = {};
    const deviceInfoKeys = this._getDeviceInfoKeys(bulbDeviceInfo);

    deviceInfoKeys.forEach(deviceInfoKey => {
      const mappingComponent = bulbToNVA.stateObjects[deviceInfoKey];

      if (!mappingComponent || !mappingComponent.thingState) return;

      const { thingState } = mappingComponent;

      for (const stateObjectName of Object.keys(thingState)) {
        const { name, value } = thingState[stateObjectName];

        stateObjects[stateObjectName] = {
          [name]: typeof value === "function" ? value(bulbDeviceInfo) : value
        };
      }
    });

    return stateObjects;
  }

  _removeSameStateFields(preparedThingState, coreThingState = {}) {
    const filteredObjValues = {};

    for (const stateField of Object.keys(preparedThingState)) {
      const formattedStateField =
        typeof preparedThingState[stateField] === "string"
          ? preparedThingState[stateField].toLowerCase()
          : preparedThingState[stateField];

      if (formattedStateField !== coreThingState[stateField]) {
        filteredObjValues[stateField] = formattedStateField;
      }
    }

    return filteredObjValues;
  }

  // Transformation: { "label": "light1", color: { hue: 122 } } -> [ "label", "color", "color.hue" ]
  _getDeviceInfoKeys(deviceInfo, fieldPath) {
    const fullObjectKeys = [];

    for (const field of Object.keys(deviceInfo)) {
      if (!isObject(deviceInfo[field])) {
        const fullFieldPath = fieldPath ? `${fieldPath}.${field}` : field;

        fullObjectKeys.push(fullFieldPath);
        continue;
      }

      fullObjectKeys.push(field);
      fullObjectKeys.push(...this._getDeviceInfoKeys(deviceInfo[field], field));
    }

    return fullObjectKeys;
  }

  _getFilteredThingStateObjects(preparedStateObjects, coreThingState) {
    let filteredStateObjects = {};

    Object.keys(preparedStateObjects).forEach(preparedStateObjName => {
      const preparedStateObj = this._removeSameStateFields(
        preparedStateObjects[preparedStateObjName],
        coreThingState[preparedStateObjName]
      );

      if (Object.keys(preparedStateObj).length) {
        filteredStateObjects = { ...filteredStateObjects, ...preparedStateObj };
      }
    });

    return filteredStateObjects;
  }
}

module.exports = CoreStateComparator;
