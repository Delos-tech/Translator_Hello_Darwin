const MQTT = require('async-mqtt');
const CoreChannel = require('darwin-translator-sdk/lib/CoreChannel.js');
const Configurator = require('darwin-translator-sdk/lib/Configurator.js');
const ProxyChannel = require('darwin-translator-sdk/lib/ProxyChannel');
const {Logger} = require('darwin-translator-sdk/utils/Logger.js');
const ListeningChannel = require('darwin-translator-sdk/lib/ListeningChannel.js');
const request = require('request');

const utils = require('./utils');
const ThingClient = require('./ThingClient');


const logger = Logger('Translator');

class Translator {
    constructor({translatorId, mqttEndpoint, thingConfig, schema, validation, accessToken} = {}) {
        if (!translatorId) throw new Error('translatorId is required!');
        if (!mqttEndpoint) throw new Error('mqttEndpoint is required!');
        if (!accessToken) throw new Error('accessToken is required!');

        this.translatorId = translatorId;
        this.mqttEndpoint = mqttEndpoint;
        this.accessToken = accessToken;
        this.thingConfig = thingConfig;
        this.schema = schema;
        this.validation = validation;
        this.proxyChannel = null;
        this.bulbs = {};
    }

    async start() {
        try {
            const mqttClient = MQTT.connect(this.mqttEndpoint);
            await utils.waitForEvent(mqttClient, 'connect');

            const proxyMqttClient = MQTT.connect(this.mqttEndpoint);
            await utils.waitForEvent(proxyMqttClient, 'connect');

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


            this.coreChannel.onBatchedNVAMessage(this._processCoreNVAMessage.bind(this));
            // this.coreChannel.onSingleNVAMessage(this._processCoreNVAMessage.bind(this));

            // if you don`t need config, remove this line
            configurator.init({
                coreChannel: this.coreChannel,
                translatorId: this.translatorId,
                accessToken: this.accessToken
            });

            this.proxyChannel = new ProxyChannel({
                mqttClient: proxyMqttClient,
                translatorId: this.translatorId
            });

            this.proxyChannel.onMessage(this._helloDarwinRequestHandler.bind(this));
            // this.thingClient.onMessage(this._processThingMessage.bind(this));

            await this.coreChannel.init();
            await this.proxyChannel.init();

        } catch (e) {
            throw new Error(e);
        }
    }

    async _helloDarwinRequestHandler(helloRequest) {
        // console.dir(helloRequest);
        logger.debug(JSON.stringify(helloRequest.request));
        const req = helloRequest.request;

        this._bulbAction(req.action);

        if (req.action.on !== undefined) {
            const requestArgs = {
                uri: `http://localhost:9091/api`,
                method: 'POST',
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
                method: 'POST',
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

    async _bulbAction(data) {
        const id = data.id;
        const bulb = this.bulbs[id];

        if (bulb === undefined) {
            this.bulbs[id] = {
                on: data.on,
                color: data.color
            }
            this._createBulb(id)
        }
    }

    async _createBulb(id) {

        const coreResponse = await this.coreChannel.executeNVA({
            nva: [{
                verb: "create",
                adverb: {
                    name: id,
                    tags: {
                        "power": "base/power",
                        "color": "base/color"
                    }
                }
            }],
            sourceTranslator : this.translatorId,
            manipulatorId    : this.translatorId,
            accessToken      : this.accessToken
        });

    }

    async _processCoreNVAMessage(message) {
        logger.debug('MESSAGE FROM CORE:');
        logger.debug(message);
    }

    async _processThingMessage(message) {
        logger.debug(`MESSAGE FROM THING: ${JSON.stringify(message)}`);

        /*
            You can communicate with core or services via channels
            from darwin-translator-sdk by calling relevant methods of each one.
            For example:

            - if you send json nva:
                const coreResponse = await this.coreChannel.executeNVA({
                    nva              : [ nva ],
                    sourceTranslator : this.translatorId,
                    manipulatorId    : this.translatorId,
                    accessToken      : this.accessToken
                });

            - if you send string nva:
                const coreResponse = await this.coreChannel.executeNVA({
                    nva,
                    sourceTranslator : this.translatorId,
                    manipulatorId    : this.translatorId,
                    accessToken      : this.accessToken
                });
        */

        // Some logic to process thing message here
    }

    async _handleListeningNotification(message) {
        logger.info(`MESSAGE FROM LISTENING SERVICE: ${JSON.stringify(message)}`);
    }
}

module.exports = Translator;
