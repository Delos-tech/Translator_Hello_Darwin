const MQTT = require("async-mqtt");
const CoreChannel = require("darwin-translator-sdk/lib/CoreChannel.js");
const Configurator = require("darwin-translator-sdk/lib/Configurator.js");
const ProxyChannel = require("darwin-translator-sdk/lib/ProxyChannel");
const { Logger } = require("darwin-translator-sdk/utils/Logger.js");
const CoreStateComparator = require("./CoreStateComparator");

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

      this.proxyChannel = new ProxyChannel({
        mqttClient: proxyMqttClient,
        translatorId: this.translatorId
      });

      this.coreChannel.onBatchedNVAMessage(this.onNVAMessage.bind(this));

      this.proxyChannel.onMessage(this.bulbListenerHandler.bind(this));

      await this.coreChannel.init();
      await this.proxyChannel.init();
    } catch (e) {
      throw new Error(e);
    }
  }

  onNVAMessage(message) {
    console.log(JSON.stringify(message ,null, 2));
  }

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

      if (coreState === undefined) {
        coreState = [];
      }
      console.log(JSON.stringify(coreState, null, 2));

      const bulbsInfo = [bulbInfo];
      const { createNVAs, updateNVAs } = this.coreStateComparator.preparePatchNVAs({ bulbsInfo, coreState });

      logger.debug(
        `Create NVAs for syncing: ${JSON.stringify(createNVAs, null, 2)}`
      );
      logger.debug(
        `Update NVAs for syncing: ${JSON.stringify(updateNVAs, null, 2)}`
      );

      for (const createNVA of createNVAs) {
        const { data } = await this.coreChannel.executeNVA({
          nva: [createNVA],
          sourceTranslator: this.translatorId,
          manipulatorId: this.translatorId,
          accessToken: this.accessToken
        });
      }

      if (!updateNVAs.length) return;

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
}

module.exports = Translator;
