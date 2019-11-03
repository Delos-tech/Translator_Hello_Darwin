const MQTT = require("async-mqtt");
const CoreChannel = require("darwin-translator-sdk/lib/CoreChannel.js");
const Configurator = require("darwin-translator-sdk/lib/Configurator.js");
const ProxyChannel = require("darwin-translator-sdk/lib/ProxyChannel");
const { Logger } = require("darwin-translator-sdk/utils/Logger.js");
const ListeningChannel = require("darwin-translator-sdk/lib/ListeningChannel.js");
const request = require("request");
const CoreStateComparator = require("./CoreStateComparator");
const BulbClient = require("./BulbClient");
const BulbNVAConverter = require("./BulbNVAConverter");

const utils = require("./utils");
const util = require("util");

const logger = Logger("Translator");

class Translator {
  constructor({
    translatorId,
    mqttEndpoint,
    thingConfig,
    schema,
    validation,
    accessToken
  } = {}) {
    if (!translatorId) throw new Error("translatorId is required!");
    if (!mqttEndpoint) throw new Error("mqttEndpoint is required!");
    if (!accessToken) throw new Error("accessToken is required!");

    this.translatorId = translatorId;
    this.mqttEndpoint = mqttEndpoint;
    this.accessToken = accessToken;
    this.thingConfig = thingConfig;
    this.schema = schema;
    this.validation = validation;
    this.proxyChannel = null;
    this.bulbNVAConverter = new BulbNVAConverter();
  }

  async start() {
    try {
      const mqttClient = MQTT.connect(this.mqttEndpoint);
      await utils.waitForEvent(mqttClient, "connect");

      const proxyMqttClient = MQTT.connect(this.mqttEndpoint);
      await utils.waitForEvent(proxyMqttClient, "connect");

      // if you don`t need config, remove this configurator instance
      const configurator = new Configurator({
        schema: this.schema,
        config: this.thingConfig,
        methods: {
          saveConfig: utils.saveConfig,
          validateConfig: utils.createValidator(this.validation)
        }
      });

      // if you don`t need config, remove this line
      await configurator.validateConfig(this.thingConfig);

      this.coreChannel = new CoreChannel({
        mqttClient,
        translatorId: this.translatorId,
        configurator // if you don`t need config, don`t pass this parameter to CoreChannel
      });

      this.coreStateComparator = new CoreStateComparator({
        translatorId: this.translatorId
      });

      // if you don`t need config, remove this line
      // configurator.init({
      //   coreChannel: this.coreChannel,
      //   translatorId: this.translatorId,
      //   accessToken: this.accessToken
      // });

      // this.bulbClient = new BulbClient({
      //   translator: this
      // });

      this.coreChannel.onBatchedNVAMessage(
        this._processCoreNVAMessage.bind(this)
      );

      this.proxyChannel = new ProxyChannel({
        mqttClient: proxyMqttClient,
        translatorId: this.translatorId
      });

      this.proxyChannel.onMessage(this.bulbListenerHandler.bind(this));
      // this.proxyChannel.onMessage(this._helloDarwinRequestHandler.bind(this));
      // this.thingClient.onMessage(this._processThingMessage.bind(this));

      await this.coreChannel.init();
      await this.proxyChannel.init();
    } catch (e) {
      throw new Error(e);
    }
  }

  async _processCoreNVAMessage(message) {
    logger.debug("Message from core: " + JSON.stringify(message, null, 2));
    try {
      // todo iterate for batches
      const NVAs = message[0].nva;
      const data = message[0].data;

      const bulbId = data.source.id;

      console.log("-------" + bulbId);
      for (const [nvaIndex, nva] of NVAs.entries()) {
        logger.info(
          `Processing NVA from Core: ${util.inspect(nva, false, 3, false)}`
        );

        if (!this.bulbNVAConverter.isSupportedNVAVerb(nva.verb)) {
          throw Error("VERB_IS_NOT_SUPPORTED", { verb: nva.verb });
        }

        const deviceState = data;

        const {
          method,
          args,
          isSystemConfigurable
        } = this.bulbNVAConverter.convertNVAToBulbPayload(nva, deviceState);

        // _processSystemConfigurableNVA can change thingsIDsMapManager mappings,
        // so lifxDeviceId declaration was placed here

        // if (isSystemConfigurable) {
        //   await this._processSystemConfigurableNVA(nva);
        //   bulbDeviceId = this.thingsIDsMapManager.getLifxIdByCoreId(nva.noun);
        // } else {
        //   bulbDeviceId = this.thingsIDsMapManager.getLifxIdByCoreId(nva.noun);
        //   await this.lifxDevicesManager.callDeviceMethod({
        //     deviceId: bulbDeviceId,
        //     method,
        //     args
        //   });
        // }

        console.log("method: " + method);
        console.log("args: " + args);
        console.log("isSystem: " + isSystemConfigurable);
        await this._updateCoreThing({
          coreThingState: deviceState,
          bulbId: bulbId
        });
      }

      return { status: 1 };
    } catch (e) {
      const { code, reason, stack } = e;

      logger.error(`${e} ${reason || ""}`);
      logger.debug(stack);

      const error = !reason || !code ? "UNKNOWN_ERROR" : { code, reason };

      return { status: 0, error };
    }
  }

  async _helloDarwinRequestHandler(helloRequest) {
    await this._processDarwinBulbMessage(helloRequest);
    // console.dir(helloRequest);
    logger.debug(JSON.stringify(helloRequest.request));
    const req = helloRequest.request;

    // this._bulbAction(req.action);

    if (req.action.on !== undefined) {
      const requestArgs = {
        uri: `http://localhost:9091/api`,
        method: "POST",
        json: {
          id: req.action.id,
          on: req.action.on
        }
      };

      console.log(JSON.stringify(requestArgs));
      return new Promise((resolve, reject) => {
        request(requestArgs, (error, response, data) => {
          if (error) {
            console.log(`ERROR: ${error}`);
            return reject(error);
          }
          // console.log("RESPONSE: ", response);
          return resolve(data);
        });
      });
    }

    if (req.action.color !== undefined) {
      const requestArgs = {
        uri: `http://localhost:9091/api`,
        method: "POST",
        json: {
          id: req.action.id,
          color: req.action.color
        }
      };

      console.log(JSON.stringify(requestArgs));
      return new Promise((resolve, reject) => {
        request(requestArgs, (error, response, data) => {
          if (error) {
            console.log(`ERROR: ${error}`);
            return reject(error);
          }
          // console.log("RESPONSE: ", response);
          return resolve(data);
        });
      });
    }
  }

  async _handleListeningNotification(message) {
    logger.info(`MESSAGE FROM LISTENING SERVICE: ${JSON.stringify(message)}`);
  }

  // BULB
  async _getCoreState() {
    // Retry until core responds
    while (true) {
      // eslint-disable-line no-constant-condition
      try {
        const coreObjState = await this.coreChannel.executeNVA({
          nva: [
            { verb: "get", adverb: { "source.translator": this.translatorId } }
          ],
          sourceTranslator: this.translatorId,
          manipulatorId: this.translatorId,
          accessToken: this.accessToken
        });
        const coreState = [];

        for (const device of coreObjState) {
          const { data } = device;

          coreState.push(...data);
        }
        return coreState;
      } catch (error) {
        if (error) logger.error(error);
        logger.info("Retrying to get state from Core...");
        await utils.wait(5000);
      }
    }
  }

  async bulbListenerHandler(message) {
    logger.debug(`Listener message ${JSON.stringify(message)}`);
    const bulbInfo = message.request.data;

    try {
      logger.info("Syncing devices");
      let coreState = await this._getCoreState();

      // let { data: coreState } = foo;

      if (coreState === undefined) {
        coreState = [];
      }
      console.log(JSON.stringify(coreState, null, 2));
      this._syncDevicesIDs(coreState);

      const bulbsInfo = [bulbInfo];
      const {
        createNVAs,
        updateNVAs
      } = this.coreStateComparator.preparePatchNVAs({
        bulbsInfo,
        coreState
      });

      logger.debug(
        `Create NVAs for syncing: ${JSON.stringify(createNVAs, null, 2)}`
        // `Create NVAs for syncing: ${util.inspect(createNVAs, false, 3, false)}`
      );
      logger.debug(
        `Update NVAs for syncing: ${JSON.stringify(updateNVAs, null, 2)}`
        // `Update NVAs for syncing: ${util.inspect(updateNVAs, false, 3, false)}`
      );

      for (const createNVA of createNVAs) {
        const { data } = await this.coreChannel.executeNVA({
          nva: [createNVA],
          sourceTranslator: this.translatorId,
          manipulatorId: this.translatorId,
          accessToken: this.accessToken
        });

        // this.thingsIDsMapManager.setRelation({
        //   coreId: data.id,
        //   bulbId: data.source.id
        // });
      }

      if (!updateNVAs.length) return;

      console.log(
        JSON.stringify(
          {
            nva: updateNVAs,
            sourceTranslator: this.translatorId,
            manipulatorId: this.translatorId,
            accessToken: this.accessToken
          },
          null,
          2
        )
      );
      await this.coreChannel.executeNVA({
        nva: updateNVAs,
        sourceTranslator: this.translatorId,
        manipulatorId: this.translatorId,
        accessToken: this.accessToken
      });
    } catch (e) {
      logger.error(e);
      logger.debug(e.stack);
    }
  }

  async _syncDevicesIDs(coreState) {
    // const deletedFromCoreDevicesIDs = this.bulbsManager.getDeletedFromCoreDevicesIDs(
    //   coreState
    // );
    //
    // for (const deletedFromCoreDeviceID of deletedFromCoreDevicesIDs) {
    //   this.thingsIDsMapManager.deleteRelationBybulbId(deletedFromCoreDeviceID);
    // }
    // for (const coreThing of coreState) {
    //   this.thingsIDsMapManager.ensureRelation({
    //     coreId: coreThing.id,
    //     bulbId: coreThing.source.id
    //   });
    // }
  }

  async _updateCoreThing({ coreThingState, bulbId }) {
    console.log(JSON.stringify(coreThingState, null, 2));
    const updatedbulbInfo = await this.bulbsManager.getUpdatedDeviceInfo(
      bulbId
    );
    const updateNVAsToPatchCoreState = this.coreStateComparator.getUpdateNVAQueries(
      updatedbulbInfo,
      coreThingState
    );

    if (!updateNVAsToPatchCoreState.length) return;

    logger.info("Updating Core thing");
    logger.debug(
      `NVAs for update: ${util.inspect(
        updateNVAsToPatchCoreState,
        false,
        3,
        false
      )}`
    );

    await this.coreChannel.executeNVA({
      nva: updateNVAsToPatchCoreState,
      sourceTranslator: this.translatorId,
      manipulatorId: this.translatorId,
      accessToken: this.accessToken
    });
  }
}

module.exports = Translator;
